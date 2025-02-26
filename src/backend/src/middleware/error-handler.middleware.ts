import { Request, Response, NextFunction } from 'express'; // ^4.18.2
import { HTTP_STATUS } from '../constants/http-status';
import { logger } from '../utils/logger.util';
import { createErrorResponse, isOperationalError } from '../utils/error.util';

/**
 * Express error handling middleware that processes errors, logs them to ELK Stack,
 * and returns secure standardized responses.
 * 
 * Implements hierarchical error handling with specialized handlers for different error types
 * and ensures proper security practices by sanitizing error information in production.
 * 
 * @param error - The error object
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate a correlation ID for error tracking
  const correlationId = req.headers['x-correlation-id'] as string || 
                        req.headers['x-request-id'] as string || 
                        `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Extract useful request information for logging context
  const requestInfo = {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userId: (req as any).user?.id || 'unauthenticated',
    userAgent: req.get('User-Agent') || 'unknown',
    referrer: req.get('Referrer') || 'unknown'
  };
  
  // Determine error type and appropriate status code
  let statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  let errorType = 'UnknownError';
  
  // Error type detection based on error name and properties
  if (error.name === 'ValidationError' || error.name.includes('Validation')) {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    errorType = 'ValidationError';
  } else if (error.name === 'AuthenticationError' || error.name.includes('Auth')) {
    statusCode = HTTP_STATUS.UNAUTHORIZED;
    errorType = 'AuthenticationError';
  } else if (error.name === 'ForbiddenError' || error.name.includes('Permission')) {
    statusCode = HTTP_STATUS.FORBIDDEN;
    errorType = 'PermissionError';
  } else if ((error as any).statusCode) {
    // If the error has a statusCode property, use it
    statusCode = (error as any).statusCode;
    errorType = error.name;
  }
  
  // Log the error with detailed metadata for ELK Stack analysis
  logger.error(`[${errorType}] ${error.message}`, {
    correlationId,
    errorType,
    statusCode,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    request: requestInfo,
    timestamp: new Date().toISOString()
  });

  // Check if this is an operational (expected) error
  const isOperational = isOperationalError(error);
  
  // Create standardized error response (handles sanitization)
  const errorResponse = createErrorResponse(error);
  
  // Add correlation ID to response headers for tracking
  res.setHeader('X-Correlation-ID', correlationId);
  
  // Send the error response with appropriate status code
  res.status(statusCode).json(errorResponse);
  
  // Update error metrics for monitoring
  try {
    const errorMetrics = {
      error_rate: 1,
      error_type: errorType,
      status_code: statusCode,
      is_operational: isOperational,
      path: req.path,
      timestamp: Date.now()
    };
    
    // Log metrics for monitoring systems
    logger.logMetrics(errorMetrics, { source: 'error-handler' });
  } catch (metricsError) {
    // Don't let metrics tracking failure affect the main error handling
    logger.warn('Failed to track error metrics', { 
      cause: (metricsError as Error).message 
    });
  }
  
  // For non-operational errors (programming errors), take additional actions
  if (!isOperational) {
    logger.warn('Non-operational error detected. This may indicate a programming error.', {
      correlationId,
      errorType: 'CriticalError',
      error: {
        name: error.name,
        message: error.message
      },
      isCritical: true
    });
    
    // In production, for critical non-operational errors, we might want to:
    // 1. Capture detailed diagnostics
    // 2. Trigger alerts
    // 3. Potentially restart the process
    if (process.env.NODE_ENV === 'production') {
      // Capture detailed process information for diagnostics
      const diagnostics = {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        pid: process.pid
      };
      
      logger.error('Critical system error detected', {
        correlationId,
        diagnostics,
        recommendedAction: 'Investigate immediately'
      });
      
      // Log a potential security event if this might indicate a security issue
      const potentialSecurityErrors = [
        'TokenError', 
        'JWTError', 
        'SQLInjection', 
        'AccessDenied',
        'Unauthorized'
      ];
      
      if (potentialSecurityErrors.some(term => 
          error.name.includes(term) || error.message.includes(term))) {
        logger.logSecurity('potential_security_issue', {
          correlationId,
          errorType,
          message: error.message,
          request: {
            ip: req.ip,
            method: req.method,
            path: req.path
          }
        }, (req as any).user?.id);
      }
      
      // Optional: Trigger graceful shutdown in extreme cases
      // Uncomment in production environments with proper process management
      /*
      if (process.env.AUTO_RESTART_ON_CRITICAL_ERROR === 'true') {
        logger.error('Initiating graceful shutdown due to critical error', { correlationId });
        process.exit(1);
      }
      */
    }
  }
};