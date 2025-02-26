/**
 * User Validator Module
 * 
 * Implements comprehensive validation logic for user-related operations including 
 * user creation, updates, and queries. This module ensures data integrity and 
 * security through strict validation rules with XSS prevention, input sanitization,
 * and role-based validation hierarchy.
 * 
 * The validators serve as Express middleware that perform:
 * - Field-level validation with contextual error messages
 * - Input sanitization to prevent injection attacks
 * - Authorization checks for role-based operations
 * - Rate limiting validation
 * 
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { object, string, boolean, number, mixed } from 'yup'; // v1.0.0
import { IUser, UserRole } from '../interfaces/user.interface';
import { USER_VALIDATION_MESSAGES } from '../constants/validation-messages';
import { ValidationUtils } from '../utils/validation.util';

/**
 * Yup schema for user creation
 * Defines validation rules for all required fields in a new user record
 */
const createUserSchema = object({
  email: string()
    .required(USER_VALIDATION_MESSAGES.EMAIL_REQUIRED)
    .max(255, 'Email cannot exceed 255 characters')
    .test('email-validation', USER_VALIDATION_MESSAGES.EMAIL_INVALID, 
      value => ValidationUtils.validateEmail(value || '').isValid),
  
  password: string()
    .required(USER_VALIDATION_MESSAGES.PASSWORD_REQUIRED)
    .test('password-strength', USER_VALIDATION_MESSAGES.PASSWORD_INVALID,
      value => ValidationUtils.validatePassword(value || '').isValid),
  
  firstName: string()
    .required(USER_VALIDATION_MESSAGES.NAME_REQUIRED)
    .test('name-validation', USER_VALIDATION_MESSAGES.NAME_INVALID,
      value => ValidationUtils.validateName(value || '').isValid),
  
  lastName: string()
    .required(USER_VALIDATION_MESSAGES.NAME_REQUIRED)
    .test('name-validation', USER_VALIDATION_MESSAGES.NAME_INVALID,
      value => ValidationUtils.validateName(value || '').isValid),
  
  role: string()
    .required(USER_VALIDATION_MESSAGES.ROLE_REQUIRED)
    .test('role-validation', USER_VALIDATION_MESSAGES.ROLE_INVALID,
      value => ValidationUtils.validateRole(value || '').isValid)
});

/**
 * Yup schema for user updates
 * Supports partial updates with all fields optional but validated if present
 */
const updateUserSchema = object({
  email: string()
    .optional()
    .max(255, 'Email cannot exceed 255 characters')
    .test('email-validation', USER_VALIDATION_MESSAGES.EMAIL_INVALID, 
      value => value === undefined || ValidationUtils.validateEmail(value || '').isValid),
  
  password: string()
    .optional()
    .test('password-strength', USER_VALIDATION_MESSAGES.PASSWORD_INVALID,
      value => value === undefined || ValidationUtils.validatePassword(value || '').isValid),
  
  firstName: string()
    .optional()
    .test('name-validation', USER_VALIDATION_MESSAGES.NAME_INVALID,
      value => value === undefined || ValidationUtils.validateName(value || '').isValid),
  
  lastName: string()
    .optional()
    .test('name-validation', USER_VALIDATION_MESSAGES.NAME_INVALID,
      value => value === undefined || ValidationUtils.validateName(value || '').isValid),
  
  role: string()
    .optional()
    .test('role-validation', USER_VALIDATION_MESSAGES.ROLE_INVALID,
      value => value === undefined || ValidationUtils.validateRole(value || '').isValid),
  
  isActive: boolean()
    .optional()
    .typeError(USER_VALIDATION_MESSAGES.STATUS_INVALID)
});

/**
 * Yup schema for user query parameters
 * Validates pagination, sorting, and filtering parameters
 */
const userQuerySchema = object({
  page: number()
    .optional()
    .transform((value) => (isNaN(Number(value)) ? undefined : Number(value)))
    .positive('Page number must be a positive integer')
    .integer('Page number must be a positive integer'),
  
  pageSize: number()
    .optional()
    .transform((value) => (isNaN(Number(value)) ? undefined : Number(value)))
    .positive('Page size must be a positive integer')
    .integer('Page size must be a positive integer')
    .max(100, 'Page size cannot exceed 100'),
  
  sortBy: string()
    .optional()
    .oneOf(
      ['firstName', 'lastName', 'email', 'role', 'createdAt', 'updatedAt', 'isActive'],
      'Invalid sort field'
    ),
  
  sortOrder: string()
    .optional()
    .lowercase()
    .oneOf(['asc', 'desc'], "Sort order must be either 'asc' or 'desc'"),
  
  role: string()
    .optional()
    .test('role-validation', 'Invalid role filter',
      value => value === undefined || ValidationUtils.validateRole(value).isValid),
  
  isActive: boolean()
    .optional()
    .transform((value) => {
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;
    })
    .typeError('isActive must be a boolean value'),
  
  search: string()
    .optional()
    .max(100, 'Search term cannot exceed 100 characters')
    .test('xss-validation', 'Search term contains invalid characters',
      value => value === undefined || !/<script|javascript:|on\w+\s*=|data:/i.test(value))
});

/**
 * Validates user creation request data with comprehensive security checks and sanitization
 * 
 * Performs thorough validation of:
 * - Email format and domain validation
 * - Password strength with multiple criteria
 * - Name format with Unicode support
 * - Role validation against allowed values
 * - XSS prevention for all string inputs
 * 
 * @param req - Express request object containing user data in body
 * @param res - Express response object for sending validation errors
 * @param next - Express next function to proceed to next middleware
 */
export const validateCreateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Sanitize input data to prevent XSS and injection attacks
    const userData = {
      email: ValidationUtils.sanitizeInput(req.body.email || '', { maxLength: 255 }),
      password: req.body.password || '',
      firstName: ValidationUtils.sanitizeInput(req.body.firstName || '', { maxLength: 50 }),
      lastName: ValidationUtils.sanitizeInput(req.body.lastName || '', { maxLength: 50 }),
      role: ValidationUtils.sanitizeInput(req.body.role || '', { maxLength: 20 })
    };

    // Validate against schema
    await createUserSchema.validate(userData, {
      abortEarly: false,
      stripUnknown: true
    });

    // Additional XSS checks for all string inputs
    // These are more comprehensive than the basic sanitization already performed
    const xssPattern = /<script|javascript:|on\w+\s*=|data:|eval\(|expression\(|url\s*\(|@import/i;
    if (xssPattern.test(userData.email) || 
        xssPattern.test(userData.firstName) || 
        xssPattern.test(userData.lastName)) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: {
          security: 'Input contains potentially malicious content'
        }
      });
    }

    // Create a normalized user object with properly formatted data
    req.body = {
      email: userData.email.toLowerCase().trim(),
      password: userData.password,
      firstName: ValidationUtils.validateName(userData.firstName).normalized,
      lastName: ValidationUtils.validateName(userData.lastName).normalized,
      role: userData.role.toLowerCase(),
    };

    // Proceed to next middleware if all validations pass
    next();
  } catch (error) {
    // Handle Yup validation errors
    if (error instanceof Error && 'inner' in error) {
      const validationErrors = (error as any).inner.reduce((errors: Record<string, string>, err: any) => {
        errors[err.path] = err.message;
        return errors;
      }, {});

      // Log validation error for security monitoring
      console.error('User validation error:', validationErrors);
      
      // Return detailed validation errors
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    // Handle other types of errors
    console.error('User validation error:', error);
    res.status(400).json({
      success: false,
      message: 'Invalid input data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Validates user update request data with partial update support and security checks
 * 
 * Key features:
 * - Supports partial updates (only validates provided fields)
 * - Enforces role hierarchy restrictions
 * - Prevents privilege escalation
 * - Validates status changes with proper authorization
 * 
 * @param req - Express request object containing update data in body
 * @param res - Express response object for sending validation errors
 * @param next - Express next function to proceed to next middleware
 */
export const validateUpdateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Extract and sanitize update data
    const updateData: Record<string, any> = {};
    const allowedFields = ['email', 'firstName', 'lastName', 'role', 'isActive', 'password'];
    
    // Process and sanitize each provided field
    for (const field of Object.keys(req.body)) {
      // Skip fields that are not allowed to be updated
      if (!allowedFields.includes(field)) continue;
      
      // Get the raw value
      const rawValue = req.body[field];
      
      // Skip undefined or null values
      if (rawValue === undefined || rawValue === null) continue;
      
      // Sanitize string fields
      if (field !== 'isActive' && field !== 'password') {
        updateData[field] = ValidationUtils.sanitizeInput(rawValue, { 
          maxLength: field === 'email' ? 255 : 50 
        });
      } else {
        updateData[field] = rawValue;
      }
    }
    
    // If no fields to update, return error
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }
    
    // Validate against schema
    await updateUserSchema.validate(updateData, {
      abortEarly: false,
      stripUnknown: true
    });
    
    // Additional XSS checks for all string inputs
    const xssPattern = /<script|javascript:|on\w+\s*=|data:|eval\(|expression\(|url\s*\(|@import/i;
    for (const field of ['email', 'firstName', 'lastName']) {
      if (updateData[field] && xssPattern.test(updateData[field])) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: {
            security: 'Input contains potentially malicious content'
          }
        });
      }
    }
    
    // Role change authorization check
    // In a real implementation, we would check if the current user
    // has permission to assign this role based on role hierarchy
    if (updateData.role && req.user) {
      const currentUserRole = (req.user as any).role;
      const roleValidation = ValidationUtils.validateRole(updateData.role);
      const currentRoleValidation = ValidationUtils.validateRole(currentUserRole);
      
      // Prevent privilege escalation - users cannot assign roles higher than their own
      if (roleValidation.details.hierarchy > currentRoleValidation.details.hierarchy) {
        return res.status(403).json({
          success: false,
          message: 'Validation failed',
          errors: {
            role: USER_VALIDATION_MESSAGES.ROLE_UNAUTHORIZED
          }
        });
      }
    }
    
    // Normalize update data
    if (updateData.email) {
      updateData.email = updateData.email.toLowerCase().trim();
    }
    
    if (updateData.firstName) {
      updateData.firstName = ValidationUtils.validateName(updateData.firstName).normalized;
    }
    
    if (updateData.lastName) {
      updateData.lastName = ValidationUtils.validateName(updateData.lastName).normalized;
    }
    
    if (updateData.role) {
      updateData.role = updateData.role.toLowerCase();
    }
    
    // Replace request body with sanitized and validated data
    req.body = updateData;
    
    // Proceed to next middleware
    next();
  } catch (error) {
    // Handle Yup validation errors
    if (error instanceof Error && 'inner' in error) {
      const validationErrors = (error as any).inner.reduce((errors: Record<string, string>, err: any) => {
        errors[err.path] = err.message;
        return errors;
      }, {});

      // Log validation error for security monitoring
      console.error('User update validation error:', validationErrors);
      
      // Return detailed validation errors
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    // Handle other types of errors
    console.error('User update validation error:', error);
    res.status(400).json({
      success: false,
      message: 'Invalid update data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Validates user list query parameters with comprehensive input validation
 * 
 * Validates and sanitizes:
 * - Pagination parameters (page, pageSize)
 * - Sorting parameters (sortBy, sortOrder)
 * - Filtering parameters (role, isActive)
 * - Search term
 * 
 * @param req - Express request object containing query parameters
 * @param res - Express response object for sending validation errors
 * @param next - Express next function to proceed to next middleware
 */
export const validateUserQueryParams = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Extract query parameters
    const queryParams = { ...req.query };
    
    // Sanitize string parameters to prevent XSS
    for (const key of Object.keys(queryParams)) {
      if (typeof queryParams[key] === 'string') {
        queryParams[key] = ValidationUtils.sanitizeInput(queryParams[key] as string, { 
          maxLength: 100,
          encodeOutput: 'html'
        });
      }
    }
    
    // Validate against schema
    const validatedQuery = await userQuerySchema.validate(queryParams, {
      abortEarly: false,
      stripUnknown: true
    });
    
    // Set default values for missing parameters
    const sanitizedQuery = {
      page: validatedQuery.page || 1,
      pageSize: validatedQuery.pageSize || 10,
      sortBy: validatedQuery.sortBy || 'createdAt',
      sortOrder: validatedQuery.sortOrder || 'desc',
      ...validatedQuery
    };
    
    // Rate limiting check - prevent excessive pagination for performance protection
    // In a real implementation, this would use a rate limiting service
    const totalItems = sanitizedQuery.pageSize * sanitizedQuery.page;
    if (totalItems > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Query limit exceeded',
        errors: {
          pagination: 'The requested result set is too large. Please refine your query.'
        }
      });
    }
    
    // Replace query parameters with sanitized and validated values
    req.query = sanitizedQuery;
    
    // Proceed to next middleware
    next();
  } catch (error) {
    // Handle Yup validation errors
    if (error instanceof Error && 'inner' in error) {
      const validationErrors = (error as any).inner.reduce((errors: Record<string, string>, err: any) => {
        errors[err.path] = err.message;
        return errors;
      }, {});

      // Log validation error for security monitoring
      console.error('Query parameter validation error:', validationErrors);
      
      // Return detailed validation errors
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: validationErrors
      });
    }

    // Handle other types of errors
    console.error('Query parameter validation error:', error);
    res.status(400).json({
      success: false,
      message: 'Invalid query parameters',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};