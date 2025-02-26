/**
 * User Controller Implementation
 * 
 * Provides a robust API for user management operations with comprehensive
 * security features including:
 * - Input validation and sanitization
 * - Role-based access control
 * - Rate limiting
 * - Audit logging
 * - Error handling
 * 
 * Implements RESTful endpoints for CRUD operations on user resources
 * with strict adherence to security best practices as specified in
 * the technical specifications section 7.2 Data Security.
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express'; // ^4.18.2
import { plainToClass } from 'class-transformer'; // ^0.5.1
import { Logger } from 'winston'; // ^3.8.2
import { validationResult } from 'express-validator'; // ^7.0.1
import rateLimit from 'express-rate-limit'; // ^6.7.0

import { UserService } from '../services/user.service';
import { IUserCreate, IUserUpdate, UserRole } from '../interfaces/user.interface';

/**
 * Rate limit configuration for sensitive operations
 * Implements rate limiting as specified in API Security section (7.3)
 */
export const userRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP as specified in API Design
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many requests, please try again later'
  }
});

/**
 * User controller handling HTTP requests for user management operations
 * with enhanced security, validation, and audit logging.
 */
export class UserController {
  /**
   * Service for user data operations
   * @private
   */
  private userService: UserService;
  
  /**
   * Logger service for audit logging
   * @private
   */
  private logger: Logger;

  /**
   * Initializes UserController with required services
   * 
   * @param userService - Service for user data operations
   * @param logger - Logger service for audit logging
   */
  constructor(userService: UserService, logger: Logger) {
    this.userService = userService;
    this.logger = logger;
  }

  /**
   * Creates a new user with enhanced validation and security
   * 
   * @param req - Express request object containing user data
   * @param res - Express response object
   * @returns Created user data with 201 status
   */
  async createUser(req: Request, res: Response): Promise<Response> {
    try {
      // Check for validation errors (assuming middleware validation)
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        this.logger.warn('Validation failed for user creation', {
          errors: errors.array(),
          ip: req.ip,
          userId: req.user?.id,
          action: 'user_create_validation_failed'
        });
        
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array()
        });
      }
      
      // Transform request data to expected format
      const userData: IUserCreate = plainToClass(Object as any, req.body);
      
      // Create the user (validation happens in the service)
      const createdUser = await this.userService.createUser(userData);
      
      // Log success (audit)
      this.logger.info('User created successfully', {
        userId: req.user?.id || 'system',
        targetUserId: createdUser.id,
        ip: req.ip,
        action: 'user_create_success'
      });
      
      // Return sanitized response
      return res.status(201).json({
        status: 'success',
        message: 'User created successfully',
        data: createdUser
      });
      
    } catch (error) {
      this.logger.error('Error creating user', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        ip: req.ip,
        data: req.body,
        action: 'user_create_error'
      });
      
      if (error instanceof Error && error.message.includes('already exists')) {
        return res.status(409).json({
          status: 'error',
          message: 'User with this email already exists'
        });
      }
      
      if (error instanceof Error && error.message.includes('Validation')) {
        return res.status(400).json({
          status: 'error',
          message: error.message
        });
      }
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to create user',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Retrieves a user by ID with role-based access control
   * 
   * @param req - Express request object with user ID
   * @param res - Express response object
   * @returns User data with 200 status
   */
  async getUser(req: Request, res: Response): Promise<Response> {
    try {
      // Extract user ID from request params
      const userId = req.params.id;
      
      // Get the requesting user from the request
      const requestingUserId = req.user?.id || 'system';
      const requestingUserRole = req.user?.role || UserRole.ADMIN;
      
      // Retrieve the user with permission checking
      const user = await this.userService.getUserById(
        userId,
        requestingUserId,
        requestingUserRole
      );
      
      // If user not found, return 404
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
      }
      
      // Log success (audit)
      this.logger.info('User retrieved successfully', {
        userId: requestingUserId,
        targetUserId: userId,
        ip: req.ip,
        action: 'user_get_success'
      });
      
      // Return response
      return res.status(200).json({
        status: 'success',
        data: user
      });
      
    } catch (error) {
      this.logger.error('Error retrieving user', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId: req.params.id,
        ip: req.ip,
        action: 'user_get_error'
      });
      
      if (error instanceof Error && error.message.includes('Permission denied')) {
        return res.status(403).json({
          status: 'error',
          message: 'Permission denied: Insufficient privileges to access this user'
        });
      }
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve user',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Updates a user with comprehensive validation and role-based access control
   * 
   * @param req - Express request object with user ID and update data
   * @param res - Express response object
   * @returns Updated user data with 200 status
   */
  async updateUser(req: Request, res: Response): Promise<Response> {
    try {
      // Extract user ID from request params
      const userId = req.params.id;
      
      // Check for validation errors (assuming middleware validation)
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        this.logger.warn('Validation failed for user update', {
          errors: errors.array(),
          ip: req.ip,
          userId: req.user?.id,
          targetUserId: userId,
          action: 'user_update_validation_failed'
        });
        
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array()
        });
      }
      
      // Transform request data to expected format
      const updateData: IUserUpdate = plainToClass(Object as any, req.body);
      
      // Get the requesting user from the request
      const requestingUserId = req.user?.id || 'system';
      const requestingUserRole = req.user?.role || UserRole.ADMIN;
      
      // Update the user (validation and permission checking happens in the service)
      const updatedUser = await this.userService.updateUser(
        userId,
        updateData,
        requestingUserId,
        requestingUserRole
      );
      
      // Log success (audit)
      this.logger.info('User updated successfully', {
        userId: requestingUserId,
        targetUserId: userId,
        ip: req.ip,
        changes: Object.keys(updateData),
        action: 'user_update_success'
      });
      
      // Return response
      return res.status(200).json({
        status: 'success',
        message: 'User updated successfully',
        data: updatedUser
      });
      
    } catch (error) {
      this.logger.error('Error updating user', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId: req.params.id,
        ip: req.ip,
        data: req.body,
        action: 'user_update_error'
      });
      
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
      }
      
      if (error instanceof Error && error.message.includes('Permission denied')) {
        return res.status(403).json({
          status: 'error',
          message: error.message
        });
      }
      
      if (error instanceof Error && error.message.includes('Validation')) {
        return res.status(400).json({
          status: 'error',
          message: error.message
        });
      }
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to update user',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Deletes a user with role-based access control and audit logging
   * 
   * @param req - Express request object with user ID
   * @param res - Express response object
   * @returns Success message with 200 status
   */
  async deleteUser(req: Request, res: Response): Promise<Response> {
    try {
      // Extract user ID from request params
      const userId = req.params.id;
      
      // Get the requesting user from the request
      const requestingUserId = req.user?.id || 'system';
      const requestingUserRole = req.user?.role || UserRole.ADMIN;
      
      // Delete the user (permission checking happens in the service)
      const result = await this.userService.deleteUser(
        userId,
        requestingUserId,
        requestingUserRole
      );
      
      // Log success (audit - critical operation)
      this.logger.info('User deleted successfully', {
        userId: requestingUserId,
        targetUserId: userId,
        ip: req.ip,
        action: 'user_delete_success'
      });
      
      // Return success response
      return res.status(200).json({
        status: 'success',
        message: result
      });
      
    } catch (error) {
      this.logger.error('Error deleting user', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId: req.params.id,
        ip: req.ip,
        action: 'user_delete_error'
      });
      
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
      }
      
      if (error instanceof Error && error.message.includes('Permission denied')) {
        return res.status(403).json({
          status: 'error',
          message: error.message
        });
      }
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to delete user',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Retrieves a paginated list of users with filtering and role-based access
   * 
   * @param req - Express request object with query parameters
   * @param res - Express response object
   * @returns Paginated users with 200 status
   */
  async getUsers(req: Request, res: Response): Promise<Response> {
    try {
      // Get the requesting user from the request
      const requestingUserId = req.user?.id || 'system';
      const requestingUserRole = req.user?.role || UserRole.ADMIN;
      
      // Extract pagination and filter parameters with appropriate type conversion
      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        role: req.query.role as string | undefined,
        isActive: req.query.isActive !== undefined ? 
          req.query.isActive === 'true' : undefined,
        cursor: req.query.cursor as string | undefined
      };
      
      // Retrieve users with permission-based filtering
      const result = await this.userService.getUsers(
        options,
        requestingUserId,
        requestingUserRole
      );
      
      // Log success (audit)
      this.logger.info('Users list retrieved successfully', {
        userId: requestingUserId,
        ip: req.ip,
        filters: options,
        count: result.users.length,
        total: result.total,
        action: 'users_list_success'
      });
      
      // Return response
      return res.status(200).json({
        status: 'success',
        data: {
          users: result.users,
          total: result.total,
          page: options.page || 1,
          limit: options.limit || 10,
          nextCursor: result.nextCursor
        }
      });
      
    } catch (error) {
      this.logger.error('Error retrieving users', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        ip: req.ip,
        query: req.query,
        action: 'users_list_error'
      });
      
      if (error instanceof Error && error.message.includes('Validation')) {
        return res.status(400).json({
          status: 'error',
          message: error.message
        });
      }
      
      if (error instanceof Error && error.message.includes('Permission denied')) {
        return res.status(403).json({
          status: 'error',
          message: error.message
        });
      }
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve users',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}