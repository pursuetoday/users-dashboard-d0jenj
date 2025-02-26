/**
 * Express middleware that provides comprehensive request logging functionality.
 * Implements ELK Stack integration for error logs, audit trails, and health monitoring.
 * Includes performance metrics tracking, security event logging, and compliance-aware data handling.
 */

import { Request, Response, NextFunction } from 'express'; // ^4.18.x
import { logger } from '../utils/logger.util';

// Extend Express Request interface to include our custom properties
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      startTime?: number;
      user?: any; // User object with id and role properties
    }
  }
}

/**
 * Express middleware function that provides comprehensive request/response logging with 
 * performance tracking, security monitoring, and health metrics collection.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
const loggerMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Generate unique correlation ID for request tracking
    const correlationId = generateCorrelationId();
    
    // Store correlation ID and start time in request object
    req.correlationId = correlationId;
    req.startTime = Date.now();
    
    // Add correlation ID to response headers for client-side tracking
    res.setHeader('X-Correlation-ID', correlationId);
    
    // Extract and sanitize request data for logging
    const sanitizedRequest = sanitizeRequestData(req);
    
    // Check for potential security issues
    const securityIssues = detectSecurityIssues(req);
    
    // Log initial request details
    logger.info(`Request started: ${req.method} ${req.originalUrl}`, {
      correlationId,
      request: sanitizedRequest,
      securityIssues: securityIssues || undefined,
    });
    
    // Log security events if suspicious activity detected
    if (securityIssues) {
      logger.logSecurity('suspicious_request_detected', {
        correlationId,
        request: sanitizedRequest,
        issues: securityIssues,
      }, sanitizedRequest.user?.id);
    }
    
    // Store original end method
    const originalEnd = res.end;
    
    // Create response end handler for logging completion
    res.end = function(this: Response, ...args: any[]): any {
      // Calculate response time
      const responseTime = Date.now() - (req.startTime || Date.now());
      
      // Restore original end method
      res.end = originalEnd;
      
      // Call original end method with all arguments
      const result = originalEnd.apply(this, args);
      
      // Collect response metadata for logging
      const responseData = {
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
        responseTime,
        contentType: res.getHeader('content-type'),
        contentLength: res.getHeader('content-length'),
      };
      
      // Log response based on status code
      if (res.statusCode >= 500) {
        // Server error
        logger.error(`Server error in request: ${req.method} ${req.originalUrl}`, {
          correlationId,
          request: sanitizedRequest,
          response: responseData,
        });
        
        // Log health metrics for server errors
        logger.logHealth({
          error_rate: 1,
          response_time: responseTime,
          status_code: res.statusCode,
        }, `Server error ${res.statusCode} detected`);
      } else if (res.statusCode >= 400) {
        // Client error
        logger.warn(`Client error in request: ${req.method} ${req.originalUrl}`, {
          correlationId,
          request: sanitizedRequest,
          response: responseData,
        });
        
        // Log specific authentication/authorization failures as security events
        if (res.statusCode === 401 || res.statusCode === 403) {
          logger.logSecurity('authentication_failure', {
            correlationId,
            statusCode: res.statusCode,
            method: req.method,
            url: req.originalUrl,
            ip: req.ip,
            userId: sanitizedRequest.user?.id,
          });
        }
      } else {
        // Successful response
        logger.info(`Request completed successfully: ${req.method} ${req.originalUrl}`, {
          correlationId,
          response: responseData,
        });
      }
      
      // Log performance metrics for all requests
      logger.logMetrics({
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        responseTime,
        contentLength: responseData.contentLength || 0,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      }, {
        correlationId,
        userId: sanitizedRequest.user?.id,
      });
      
      return result;
    };
    
    // Attach error handler for uncaught exceptions
    const handleError = (err: Error): void => {
      logger.error(`Uncaught exception in request processing: ${req.method} ${req.originalUrl}`, {
        correlationId,
        request: sanitizedRequest,
        error: {
          message: err.message,
          stack: err.stack,
          name: err.name,
        },
      });
      
      // Update health metrics for exceptions
      logger.logHealth({
        error_rate: 1,
        response_time: Date.now() - (req.startTime || Date.now()),
        exception: true,
      }, 'Uncaught exception in request processing');
    };
    
    // Listen for error events on response
    res.on('error', handleError);
    
    // Continue to next middleware
    next();
  } catch (error) {
    // Failsafe error handling - ensure logging issues don't break the application
    console.error('Error in logger middleware:', error);
    next();
  }
};

/**
 * Generates a unique correlation ID for request tracking
 * @returns A correlation ID string based on timestamp and random value
 */
function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Sanitizes request data to remove sensitive information
 * @param req Express request object
 * @returns Sanitized request data safe for logging
 */
function sanitizeRequestData(req: Request): Record<string, any> {
  const sanitized: Record<string, any> = {
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    referrer: req.headers.referer || req.headers.referrer,
  };

  // Include safe request body data (redact sensitive fields)
  if (req.body) {
    sanitized.body = { ...req.body };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'passwordConfirmation', 'token', 'accessToken', 'refreshToken'];
    sensitiveFields.forEach(field => {
      if (sanitized.body[field]) {
        sanitized.body[field] = '[REDACTED]';
      }
    });
  }

  // Include query parameters
  if (req.query && Object.keys(req.query).length > 0) {
    sanitized.query = req.query;
  }

  // Include URL parameters
  if (req.params && Object.keys(req.params).length > 0) {
    sanitized.params = req.params;
  }

  // Include authenticated user information (if available)
  if (req.user) {
    sanitized.user = {
      id: req.user.id,
      role: req.user.role,
    };
  }

  return sanitized;
}

/**
 * Detects potential security concerns in the request
 * @param req Express request object
 * @returns Object with security issues if detected, null otherwise
 */
function detectSecurityIssues(req: Request): Record<string, any> | null {
  const securityIssues: Record<string, any> = {};
  let hasIssues = false;

  // Check for SQL injection attempts in query string
  const sqlInjectionPatterns = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', '--', '/*', '*/'];
  const queryString = req.originalUrl?.toLowerCase() || '';
  
  for (const pattern of sqlInjectionPatterns) {
    if (queryString.includes(pattern.toLowerCase())) {
      securityIssues.sqlInjectionAttempt = true;
      securityIssues.suspiciousPattern = pattern;
      hasIssues = true;
      break;
    }
  }

  // Check for XSS attempts
  const xssPatterns = ['<script', 'javascript:', 'onerror=', 'onload=', 'eval('];
  for (const pattern of xssPatterns) {
    if (queryString.includes(pattern.toLowerCase())) {
      securityIssues.xssAttempt = true;
      securityIssues.suspiciousPattern = pattern;
      hasIssues = true;
      break;
    }
  }

  // Check for suspicious request headers
  const forwardedHeader = req.headers['x-forwarded-for'];
  if (forwardedHeader) {
    const forwardedIps = typeof forwardedHeader === 'string' 
      ? forwardedHeader.split(',') 
      : forwardedHeader;
      
    if (Array.isArray(forwardedIps) && forwardedIps.length > 3) {
      securityIssues.suspiciousForwardedHeader = true;
      hasIssues = true;
    }
  }

  // Check for suspicious user agents
  const userAgent = (req.headers['user-agent'] as string)?.toLowerCase() || '';
  const suspiciousUserAgents = ['sqlmap', 'nikto', 'nessus', 'vulnerability', 'havij'];
  
  for (const agent of suspiciousUserAgents) {
    if (userAgent.includes(agent)) {
      securityIssues.suspiciousUserAgent = agent;
      hasIssues = true;
      break;
    }
  }

  // Check for brute force login attempts
  if ((req.originalUrl.includes('/login') || req.originalUrl.includes('/auth')) && 
      req.method === 'POST') {
    // This is a login attempt - actual rate limiting would be handled elsewhere
    // but we can flag it for tracking in the logs
    securityIssues.loginAttempt = true;
    hasIssues = true;
  }

  return hasIssues ? securityIssues : null;
}

export default loggerMiddleware;