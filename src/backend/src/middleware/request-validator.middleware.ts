import { Request, Response, NextFunction } from 'express';
import * as yup from 'yup'; // v1.2.0
import NodeCache from 'node-cache'; // v5.1.2

import { ValidationError } from '../utils/error.util';
import { validateEmail, validatePassword, sanitizeInput } from '../utils/validation.util';

/**
 * Cache for validation results to improve performance
 * Uses a TTL-based caching strategy to automatically expire stale entries
 */
const validationCache = new NodeCache({
  stdTTL: 300, // 5 minutes standard TTL
  checkperiod: 60, // Check for expired keys every 60 seconds
  maxKeys: 1000, // Maximum number of keys in cache
  useClones: false // Don't clone objects for performance
});

/**
 * Options for customizing the request validator middleware
 */
interface ValidationOptions {
  // Validation behavior
  abortEarly?: boolean;
  stripUnknown?: boolean;
  recursive?: boolean;
  
  // Performance optimization
  cacheResults?: boolean;
  validationTimeout?: number; // in milliseconds
  
  // Security settings
  requestSizeLimit?: number; // in bytes
  deepSanitize?: boolean;
  
  // Enhanced field validation
  useStrictEmailValidation?: boolean;
  useStrictPasswordValidation?: boolean;
  emailFieldPatterns?: RegExp[];
  passwordFieldPatterns?: RegExp[];
  
  // Custom validation
  customValidators?: {
    [field: string]: (value: any) => boolean | { isValid: boolean; error?: string };
  };
}

/**
 * Default validation options with security-focused defaults
 */
const defaultOptions: ValidationOptions = {
  // Validation behavior
  abortEarly: false,
  stripUnknown: true,
  recursive: true,
  
  // Performance optimization
  cacheResults: true,
  validationTimeout: 5000, // 5 seconds
  
  // Security settings
  requestSizeLimit: 1024 * 1024, // 1MB
  deepSanitize: true,
  
  // Enhanced field validation
  useStrictEmailValidation: true,
  useStrictPasswordValidation: true,
  emailFieldPatterns: [/^email$/i, /email$/i, /^e?mail$/i],
  passwordFieldPatterns: [/^password$/i, /password$/i, /^pwd$/i, /pwd$/i]
};

/**
 * Sanitizes request data recursively with advanced security measures
 * and performance optimizations for objects, arrays, and primitive values.
 * 
 * @param data - Data to sanitize (can be object, array, or primitive)
 * @param options - Sanitization options
 * @returns Deeply sanitized data
 */
function sanitizeRequestData(data: any, options: {
  depth?: number;
  maxDepth?: number;
  memoCache?: Map<any, any>;
} = {}): any {
  // Default options
  const opts = {
    depth: 0,
    maxDepth: 10,
    memoCache: new Map(),
    ...options
  };

  // Handle null/undefined case
  if (data === null || data === undefined) {
    return data;
  }

  // Memoization to prevent circular references and improve performance
  if (opts.memoCache.has(data)) {
    return opts.memoCache.get(data);
  }

  // Prevent excessively deep structures (security against DoS)
  if (opts.depth > opts.maxDepth) {
    return typeof data === 'object' ? {} : data;
  }

  // Process by data type
  if (Array.isArray(data)) {
    // Handle arrays - map over elements and sanitize each
    const sanitizedArr = data.map(item => 
      sanitizeRequestData(item, {
        depth: opts.depth + 1,
        maxDepth: opts.maxDepth,
        memoCache: opts.memoCache
      })
    );
    opts.memoCache.set(data, sanitizedArr);
    return sanitizedArr;
  } else if (typeof data === 'object' && data !== null) {
    // Handle objects - recursively sanitize each property
    const sanitizedObj: Record<string, any> = {};
    opts.memoCache.set(data, sanitizedObj); // Set early to handle circular refs
    
    for (const [key, value] of Object.entries(data)) {
      // Sanitize keys to prevent prototype pollution
      const sanitizedKey = typeof key === 'string' 
        ? key.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100)
        : key;
        
      // Skip __proto__, constructor, prototype to prevent prototype pollution
      if (
        sanitizedKey === '__proto__' || 
        sanitizedKey === 'constructor' || 
        sanitizedKey === 'prototype'
      ) {
        continue;
      }
      
      // Recursively sanitize values
      sanitizedObj[sanitizedKey] = sanitizeRequestData(value, {
        depth: opts.depth + 1,
        maxDepth: opts.maxDepth,
        memoCache: opts.memoCache
      });
    }
    
    return sanitizedObj;
  } else if (typeof data === 'string') {
    // Sanitize strings to prevent XSS and injection attacks
    return sanitizeInput(data, {
      stripTags: true,
      normalizeWhitespace: true,
      encodeOutput: 'none'
    });
  } else if (typeof data === 'number') {
    // Prevent attacks using invalid numbers (NaN, Infinity)
    if (isNaN(data) || !isFinite(data)) {
      return 0;
    }
    return data;
  } else if (typeof data === 'boolean') {
    // Booleans are safe as is
    return data;
  } else {
    // For any other type, convert to string and sanitize
    return sanitizeInput(String(data));
  }
}

/**
 * Validates the data against specialized fields patterns for emails and passwords
 * using enhanced validation utilities for stronger security checks.
 * 
 * @param data - The data object to validate
 * @param options - Validation options
 * @throws ValidationError if validation fails
 */
function validateSpecializedFields(data: any, options: ValidationOptions, path = ''): void {
  if (!data || typeof data !== 'object') return;
  
  for (const [key, value] of Object.entries(data)) {
    const currentPath = path ? `${path}.${key}` : key;
    
    // Email validation with advanced domain and format checking
    if (
      options.useStrictEmailValidation &&
      typeof value === 'string' && 
      options.emailFieldPatterns?.some(pattern => pattern.test(key))
    ) {
      const result = validateEmail(value);
      if (!result.isValid) {
        throw new ValidationError(`Invalid email format: ${currentPath}`, {
          field: currentPath,
          message: result.error,
          value: value,
          details: result.details
        });
      }
    } 
    // Password validation with strength assessment
    else if (
      options.useStrictPasswordValidation &&
      typeof value === 'string' && 
      options.passwordFieldPatterns?.some(pattern => pattern.test(key))
    ) {
      const result = validatePassword(value);
      if (!result.isValid) {
        throw new ValidationError(`Invalid password format: ${currentPath}`, {
          field: currentPath,
          message: result.error,
          // Don't include actual password in error
          value: '******',
          details: result.details
        });
      }
    } 
    // Recursive processing for nested objects
    else if (typeof value === 'object' && value !== null) {
      validateSpecializedFields(value, options, currentPath);
    }
  }
}

/**
 * Applies custom validators to the validated data with detailed error reporting
 * 
 * @param data - The data object to validate
 * @param validators - Map of field paths to validator functions
 * @throws ValidationError if validation fails
 */
function applyCustomValidators(
  data: any, 
  validators: Record<string, (value: any) => boolean | { isValid: boolean; error?: string }> = {}
): void {
  for (const [field, validator] of Object.entries(validators)) {
    try {
      // Get field value using path notation (e.g., 'user.profile.email')
      let fieldValue = data;
      const fieldPath = field.split('.');
      
      // Navigate through the object path
      for (const pathPart of fieldPath) {
        if (fieldValue === undefined || fieldValue === null) break;
        fieldValue = fieldValue[pathPart];
      }
      
      // Skip validation if field doesn't exist
      if (fieldValue === undefined || fieldValue === null) {
        continue;
      }
      
      // Apply validator
      const result = validator(fieldValue);
      
      // Check result and throw appropriate error if validation fails
      if (typeof result === 'object' && !result.isValid) {
        throw new ValidationError(`Validation failed for ${field}`, {
          field,
          message: result.error,
          value: typeof fieldValue === 'string' && field.toLowerCase().includes('password')
            ? '******' // Mask password values for security
            : fieldValue
        });
      } else if (result === false) {
        throw new ValidationError(`Validation failed for ${field}`, {
          field,
          value: typeof fieldValue === 'string' && field.toLowerCase().includes('password')
            ? '******' // Mask password values for security
            : fieldValue
        });
      }
    } catch (error) {
      // Rethrow ValidationErrors, ignore other errors (field might not exist)
      if (error instanceof ValidationError) {
        throw error;
      }
    }
  }
}

/**
 * Extends Express Request interface to include validated data and metrics
 */
declare global {
  namespace Express {
    interface Request {
      validatedData?: Record<string, any>;
      validationMetrics?: {
        duration: number;
        schema: any;
        cached: boolean;
      };
    }
  }
}

/**
 * Factory function that creates a request validator middleware using
 * the provided schema with advanced error handling, performance optimization,
 * and security features.
 *
 * @param schema - Yup validation schema
 * @param options - Validation options
 * @returns Express middleware for request validation
 */
function validateRequest(schema: yup.Schema<any>, options: ValidationOptions = {}) {
  // Merge with default options
  const opts = { ...defaultOptions, ...options };
  
  // Return the middleware function
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Performance metrics start time
      const startTime = Date.now();
      
      // Check request size to prevent DoS attacks
      const contentLength = parseInt(req.headers['content-length'] || '0', 10);
      if (opts.requestSizeLimit && contentLength > opts.requestSizeLimit) {
        throw new ValidationError('Request size too large', {
          limit: opts.requestSizeLimit,
          actual: contentLength
        });
      }
      
      // Create combined data object from request
      const requestData = {
        body: req.body || {},
        query: req.query || {},
        params: req.params || {}
      };
      
      // Cache handling for performance optimization
      let cacheKey = '';
      let cachedResult = null;
      
      if (opts.cacheResults) {
        // Create a unique cache key based on the request data and schema
        cacheKey = JSON.stringify(requestData) + schema.toString();
        cachedResult = validationCache.get(cacheKey);
        
        if (cachedResult) {
          // Use cached result for optimization
          req.validatedData = cachedResult;
          req.validationMetrics = {
            duration: 0,
            schema: schema.describe(),
            cached: true
          };
          return next();
        }
      }
      
      // Pre-sanitize input data for security if enabled
      const sanitizedData = opts.deepSanitize 
        ? {
            body: sanitizeRequestData(requestData.body),
            query: sanitizeRequestData(requestData.query),
            params: sanitizeRequestData(requestData.params),
          }
        : requestData;
      
      // Set validation timeout to prevent DoS attacks via complex validation
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new ValidationError('Validation timeout exceeded', {
            timeout: opts.validationTimeout,
            schema: schema.describe().type
          }));
        }, opts.validationTimeout);
      });
      
      // Validate with timeout
      const validatedData = await Promise.race([
        schema.validate(sanitizedData, {
          abortEarly: opts.abortEarly,
          stripUnknown: opts.stripUnknown,
          recursive: opts.recursive
        }),
        timeoutPromise
      ]);
      
      // Apply specialized field validations if enabled
      if (opts.useStrictEmailValidation || opts.useStrictPasswordValidation) {
        validateSpecializedFields(validatedData, opts);
      }
      
      // Apply custom validators if provided
      if (opts.customValidators) {
        applyCustomValidators(validatedData, opts.customValidators);
      }
      
      // Perform final deep sanitization if enabled
      const finalData = opts.deepSanitize
        ? sanitizeRequestData(validatedData)
        : validatedData;
        
      // Cache validation result if enabled
      if (opts.cacheResults && cacheKey) {
        validationCache.set(cacheKey, finalData);
      }
      
      // Attach validated and sanitized data to request object
      req.validatedData = finalData;
      
      // Add validation metrics to request context for performance monitoring
      req.validationMetrics = {
        duration: Date.now() - startTime,
        schema: schema.describe(),
        cached: false
      };
      
      // Validation successful, continue to next middleware
      next();
    } catch (error) {
      // Handle Yup validation errors
      if (error instanceof yup.ValidationError) {
        // Transform Yup error into our custom ValidationError format
        const validationErrors = error.inner.reduce(
          (errors, err) => {
            const fieldPath = err.path || err.params?.path || 'unknown';
            errors[fieldPath] = err.message;
            return errors;
          },
          {} as Record<string, string>
        );
        
        next(new ValidationError('Validation failed', validationErrors));
      } else if (error instanceof ValidationError) {
        // Pass through our ValidationError
        next(error);
      } else {
        // Handle unexpected errors with security in mind
        next(new ValidationError('Unexpected validation error', {
          originalError: process.env.NODE_ENV === 'development' 
            ? error instanceof Error ? error.message : String(error)
            : 'Internal validation error' // Don't expose details in production
        }));
      }
    }
  };
}

// Export the validation middleware factory and sanitization function
export { validateRequest, sanitizeRequestData };