/**
 * Utility functions for form handling, state management, and field manipulation in React components
 * with enhanced security and validation features.
 * 
 * These utilities provide a secure approach to form handling with validation tracking,
 * anti-XSS measures, and comprehensive error management for React form components.
 * 
 * @packageDocumentation
 * @version 1.0.0
 */

import * as yup from 'yup'; // ^1.0.0
import { FormField, FormState } from '../types/form.types';
import { validateField } from './validation.utils';
import { VALIDATION_RULES } from '../constants/validation.constants';

/**
 * Sanitizes user input to prevent XSS attacks
 * @param value - Value to sanitize
 * @returns Sanitized value
 */
const sanitizeValue = (value: any): any => {
  if (value === null || value === undefined) {
    return value;
  }
  
  if (typeof value === 'string') {
    // Basic XSS prevention by replacing HTML special chars
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  
  if (typeof value === 'object' && !Array.isArray(value)) {
    const sanitizedObj: Record<string, any> = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        sanitizedObj[key] = sanitizeValue(value[key]);
      }
    }
    return sanitizedObj;
  }
  
  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item));
  }
  
  return value;
};

/**
 * Tracks for potential security issues in form submissions
 * @param formState - Current form state
 * @returns Object with security analysis
 */
const performSecurityCheck = (formState: FormState): { suspicious: boolean; reason?: string } => {
  // Check for rapid submission attempts that might indicate automated attacks
  if (formState.submitCount > 10 && Date.now() - (formState.lastSubmitTime || 0) < 60000) {
    return { suspicious: true, reason: 'Submission rate limited' };
  }
  
  // Add more security checks as needed
  return { suspicious: false };
};

/**
 * Adds performance tracking to form state
 * @param formState - Current form state
 * @returns Updated form state with performance tracking
 */
const addPerformanceTracking = (formState: FormState): FormState => {
  return {
    ...formState,
    performanceMetrics: {
      startTime: Date.now(),
      validationTime: 0,
      lastInteractionTime: Date.now()
    }
  } as FormState & { performanceMetrics: any };
};

/**
 * Implements debounced validation for improved performance
 * Returns a function that will only call the provided callback after a delay
 * @param callback - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
const debounce = <T extends (...args: any[]) => Promise<any>>(callback: T, delay: number = 300) => {
  let timer: NodeJS.Timeout;
  
  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return new Promise(resolve => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        resolve(callback(...args));
      }, delay);
    });
  };
};

/**
 * Initializes form state with default values, empty errors, and validation tracking
 * 
 * Creates a comprehensive form state object with security and performance tracking,
 * preparing the form for user interaction with clean validation state.
 * 
 * @param fields - Array of form field configurations
 * @param initialValues - Initial values for form fields (optional)
 * @returns Initial form state object with validation tracking
 */
export const initializeFormState = (
  fields: FormField[],
  initialValues: Record<string, any> = {}
): FormState => {
  // Create empty values object with initial values
  const values: Record<string, any> = {};
  
  // Create empty errors object
  const errors: Record<string, string> = {};
  
  // Create empty touched object
  const touched: Record<string, boolean> = {};
  
  // Create empty dirty fields tracking
  const dirtyFields: Record<string, boolean> = {};
  
  // Initialize each field
  fields.forEach(field => {
    // Set initial value (if provided) or empty string
    values[field.name] = initialValues[field.name] !== undefined
      ? sanitizeValue(initialValues[field.name])
      : '';
    
    // Initialize with empty error
    errors[field.name] = '';
    
    // Initialize as untouched
    touched[field.name] = false;
    
    // Initialize as clean (not dirty)
    dirtyFields[field.name] = false;
  });
  
  // Create initial form state
  const formState: FormState = {
    values,
    errors,
    touched,
    dirtyFields,
    isSubmitting: false,
    isValid: true,
    isValidating: false,
    submitCount: 0,
    lastSubmitTime: undefined, // Custom property for security tracking
  } as FormState & { lastSubmitTime?: number };
  
  // Add performance tracking
  return addPerformanceTracking(formState);
};

/**
 * Handles form field value changes with enhanced validation and security checks
 * 
 * Manages field updates with security sanitization, validation, and state tracking.
 * Implements debounced validation for performance optimization during user input.
 * 
 * @param currentState - Current form state
 * @param fieldName - Name of the field being changed
 * @param value - New value for the field
 * @param fields - Array of form field configurations
 * @returns Promise resolving to updated form state with validation results
 */
export const handleFieldChange = (() => {
  // Create debounced validation function for performance
  const debouncedValidateField = debounce(async (
    field: FormField,
    value: any,
    formState: FormState
  ): Promise<string | null> => {
    const startTime = performance.now();
    const error = await validateField(field, value);
    
    // Update validation performance metrics if available
    if ((formState as any).performanceMetrics) {
      (formState as any).performanceMetrics.validationTime += performance.now() - startTime;
    }
    
    return error;
  }, 300);
  
  return async (
    currentState: FormState,
    fieldName: string,
    value: any,
    fields: FormField[]
  ): Promise<FormState> => {
    // Security: Start by sanitizing input value
    const sanitizedValue = sanitizeValue(value);
    
    // Find the field configuration
    const fieldConfig = fields.find(field => field.name === fieldName);
    if (!fieldConfig) {
      console.error(`Field ${fieldName} not found in form configuration`);
      return currentState;
    }
    
    // Track performance for this operation
    const startTime = performance.now();
    
    // Create a new state object to avoid direct mutations
    const newState = { 
      ...currentState,
      values: { ...currentState.values },
      errors: { ...currentState.errors },
      touched: { ...currentState.touched },
      dirtyFields: { ...currentState.dirtyFields },
    };
    
    // Update the field value
    newState.values[fieldName] = sanitizedValue;
    
    // Mark field as touched
    newState.touched[fieldName] = true;
    
    // Mark field as dirty if it's different from initial value
    const initialFormState = initializeFormState(fields);
    newState.dirtyFields[fieldName] = 
      JSON.stringify(newState.values[fieldName]) !== 
      JSON.stringify(initialFormState.values[fieldName]);
    
    // Set validation in progress
    newState.isValidating = true;
    
    // Validate the field with security checks
    try {
      const error = await debouncedValidateField(fieldConfig, sanitizedValue, newState);
      
      // Update field error
      newState.errors[fieldName] = error || '';
      
      // Update form validity
      newState.isValid = Object.values(newState.errors).every(err => !err);
      
      // Security logging for sensitive fields
      if (fieldConfig.type === 'password' || fieldConfig.type === 'email') {
        console.debug(`Validated sensitive field: ${fieldName}, valid: ${!error}`);
      }
    } catch (validationError) {
      // Handle validation errors
      console.error(`Validation error for ${fieldName}:`, validationError);
      newState.errors[fieldName] = 'Validation failed';
      newState.isValid = false;
    } finally {
      // Validation complete
      newState.isValidating = false;
      
      // Update performance metrics if available
      if ((newState as any).performanceMetrics) {
        (newState as any).performanceMetrics.lastInteractionTime = Date.now();
        (newState as any).performanceMetrics.fieldOperationTime = performance.now() - startTime;
      }
    }
    
    return newState;
  };
})();

/**
 * Handles form submission with comprehensive validation and security measures
 * 
 * Performs full form validation, implements rate limiting, suspicious pattern detection,
 * and proper error handling during the submission process.
 * 
 * @param formState - Current form state
 * @param fields - Array of form field configurations
 * @param onSubmit - Function to call with validated form values
 * @returns Promise resolving to updated form state after submission attempt
 */
export const handleFormSubmit = async (
  formState: FormState,
  fields: FormField[],
  onSubmit: (values: Record<string, any>) => Promise<void>
): Promise<FormState> => {
  // Create a new state object to avoid direct mutations
  const newState = { ...formState };
  
  // Track submission time for rate limiting
  const now = Date.now();
  const lastSubmitTime = (newState as any).lastSubmitTime || 0;
  (newState as any).lastSubmitTime = now;
  
  // Implement rate limiting for security
  if (newState.submitCount > 5 && now - lastSubmitTime < 10000) { // 10 second cooldown after 5 attempts
    newState.errors['form'] = 'Too many submission attempts. Please try again shortly.';
    return newState;
  }
  
  // Increment submission count
  newState.submitCount += 1;
  
  // Set form as submitting
  newState.isSubmitting = true;
  
  // Check for suspicious activity
  const securityCheck = performSecurityCheck(newState);
  if (securityCheck.suspicious) {
    newState.errors['form'] = securityCheck.reason || 'Suspicious activity detected';
    newState.isSubmitting = false;
    return newState;
  }
  
  // Validate all fields
  let hasErrors = false;
  const startValidationTime = performance.now();
  
  // Create a validation promise for each field
  const validationPromises = fields.map(async field => {
    const fieldValue = newState.values[field.name];
    const error = await validateField(field, fieldValue);
    
    // Update field error
    newState.errors[field.name] = error || '';
    
    // Mark field as touched during submission
    newState.touched[field.name] = true;
    
    // Track if we have errors
    if (error) {
      hasErrors = true;
    }
  });
  
  // Wait for all validations to complete
  await Promise.all(validationPromises);
  
  // Update performance metrics if available
  if ((newState as any).performanceMetrics) {
    (newState as any).performanceMetrics.validationTime += 
      performance.now() - startValidationTime;
  }
  
  // Update form validity
  newState.isValid = !hasErrors;
  
  // If the form is valid, submit the data
  if (newState.isValid) {
    try {
      // Create a sanitized copy of values for submission
      const sanitizedValues = sanitizeValue(newState.values);
      
      // Submit the form
      await onSubmit(sanitizedValues);
      
      // Clear any form-level errors on success
      newState.errors['form'] = '';
      
    } catch (error) {
      // Handle submission error
      console.error("Form submission error:", error);
      
      newState.errors['form'] = error instanceof Error 
        ? error.message 
        : 'An error occurred during submission';
        
      newState.isValid = false;
    }
  }
  
  // Set form as no longer submitting
  newState.isSubmitting = false;
  
  return newState;
};

/**
 * Resets form state to initial values with validation cleanup
 * 
 * Clears all field values, errors, and interaction tracking to start with
 * a fresh form state while maintaining security and performance monitoring.
 * 
 * @param fields - Array of form field configurations
 * @param initialValues - Initial values for form fields (optional)
 * @returns Reset form state with clean validation
 */
export const resetForm = (
  fields: FormField[],
  initialValues: Record<string, any> = {}
): FormState => {
  // Create a fresh form state
  const freshState = initializeFormState(fields, initialValues);
  
  // Clear all validation errors
  Object.keys(freshState.errors).forEach(fieldName => {
    freshState.errors[fieldName] = '';
  });
  
  // Reset touched status
  Object.keys(freshState.touched).forEach(fieldName => {
    freshState.touched[fieldName] = false;
  });
  
  // Reset dirty status
  Object.keys(freshState.dirtyFields).forEach(fieldName => {
    freshState.dirtyFields[fieldName] = false;
  });
  
  // Reset submission tracking while keeping performance metrics
  freshState.submitCount = 0;
  freshState.isSubmitting = false;
  freshState.isValidating = false;
  freshState.isValid = true;
  
  // Reset but keep the performance monitoring structure
  if ((freshState as any).performanceMetrics) {
    (freshState as any).performanceMetrics = {
      startTime: Date.now(),
      validationTime: 0,
      lastInteractionTime: Date.now()
    };
  }
  
  return freshState;
};