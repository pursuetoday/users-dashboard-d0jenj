/**
 * Centralized logging utility that provides a configured Winston logger instance
 * with enhanced capabilities for error tracking, system health monitoring, and ELK Stack integration.
 * Supports comprehensive logging across different environments with advanced metadata collection
 * and structured log formatting.
 */

import { createLogger, format, transports } from 'winston'; // ^3.10.0
import { ElasticsearchTransport } from 'winston-elasticsearch'; // ^0.17.0
import { loggerConfig } from '../config/logger.config';

/**
 * Log levels with numerical values
 * Lower values indicate higher severity
 */
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

/**
 * Health metrics tracked for system monitoring
 */
const HEALTH_METRICS = {
  cpu_usage: 'number',
  memory_usage: 'number',
  request_count: 'number',
  error_rate: 'number',
  response_time: 'number'
};

/**
 * Standard metadata fields added to all logs
 */
const LOG_METADATA = {
  service_name: 'string',
  environment: 'string',
  request_id: 'string',
  correlation_id: 'string',
  user_id: 'string',
  timestamp: 'Date'
};

/**
 * Creates an enhanced custom log format with comprehensive metadata,
 * timestamps, and environment-specific formatting
 * @returns Winston format object with enhanced metadata and formatting
 */
const createCustomFormat = () => {
  return format.combine(
    // Add ISO timestamp with timezone information
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS Z'
    }),
    
    // Add error stack traces for error logs
    format.errors({ stack: true }),
    
    // Add splat formatting for string interpolation
    format.splat(),
    
    // Add conditional colorization based on environment
    process.env.NODE_ENV !== 'production' 
      ? format.colorize() 
      : format.uncolorize(),
    
    // Add custom formatter with metadata
    format.printf(({ level, message, timestamp, stack, ...rest }) => {
      // Base log structure
      const logObject = {
        timestamp,
        level,
        message,
        // Include service information with all logs
        service: process.env.SERVICE_NAME || 'user-management-dashboard',
        environment: process.env.NODE_ENV || 'development',
      };

      // Add request tracking IDs when available
      if (rest.requestId) {
        logObject['requestId'] = rest.requestId;
      }
      
      if (rest.correlationId) {
        logObject['correlationId'] = rest.correlationId;
      }
      
      if (rest.userId) {
        logObject['userId'] = rest.userId;
      }
      
      // Add stack trace for errors
      if (stack) {
        logObject['stack'] = stack;
      }
      
      // Add system metrics if present
      if (rest.metrics) {
        logObject['metrics'] = rest.metrics;
      }
      
      // Add any remaining custom fields
      const metadata = { ...rest };
      delete metadata.requestId;
      delete metadata.correlationId;
      delete metadata.userId;
      delete metadata.metrics;
      
      if (Object.keys(metadata).length > 0) {
        logObject['metadata'] = metadata;
      }
      
      return JSON.stringify(logObject);
    })
  );
};

/**
 * Creates a specialized logger instance for system health monitoring
 * @returns Winston logger configured for health metrics
 */
const createHealthLogger = () => {
  // Configure health-specific log format
  const healthFormat = format.combine(
    format.timestamp(),
    format.json({
      space: process.env.NODE_ENV !== 'production' ? 2 : 0
    })
  );

  // Set up performance metric collection
  const healthOptions = {
    level: 'debug',
    format: healthFormat,
    defaultMeta: { 
      service: process.env.SERVICE_NAME || 'user-management-dashboard',
      component: 'health-monitor'
    },
    transports: [
      // Console transport for development visibility
      new transports.Console({
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        format: format.combine(
          format.colorize(),
          format.simple()
        )
      }),
      // File transport for persistent health logs
      new transports.File({ 
        filename: 'logs/health.log',
        level: 'debug',
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
        tailable: true
      })
    ]
  };

  // Configure resource usage tracking
  if (process.env.NODE_ENV === 'production') {
    // Add alerting thresholds
    healthOptions.defaultMeta.thresholds = {
      error_rate: { warning: 1, critical: 5 },
      cpu_usage: { warning: 70, critical: 90 },
      memory_usage: { warning: 80, critical: 95 },
      response_time: { warning: 1000, critical: 3000 } // in ms
    };
  }

  // Return health-focused logger instance
  return createLogger(healthOptions);
};

// Initialize the main logger with configuration
const logger = createLogger({
  level: loggerConfig.level,
  levels: LOG_LEVELS,
  format: createCustomFormat(),
  transports: loggerConfig.transports,
  exitOnError: false,
});

// Initialize the health logger
const healthLogger = createHealthLogger();

// Add ELK Stack transport if configured in environment
if (process.env.ELK_STACK_URL) {
  logger.add(new ElasticsearchTransport({
    level: 'info',
    index: process.env.ELK_INDEX_PREFIX || 'logs',
    clientOpts: {
      node: process.env.ELK_STACK_URL,
      auth: process.env.ELK_USERNAME ? {
        username: process.env.ELK_USERNAME,
        password: process.env.ELK_PASSWORD || ''
      } : undefined,
      ssl: {
        rejectUnauthorized: process.env.NODE_ENV === 'production'
      }
    },
    buffering: true,
    bufferLimit: 100,
    flushInterval: 5000
  }));
}

/**
 * Log system health metrics with threshold monitoring
 * @param metrics Object containing system health metrics
 * @param message Optional message to accompany the metrics
 */
const logHealth = (metrics: Record<string, any>, message: string = 'System health metrics') => {
  healthLogger.debug({
    message,
    metrics,
    timestamp: new Date().toISOString()
  });
  
  // Define thresholds for various metrics
  const thresholds = {
    error_rate: { warning: 1, critical: 5 },
    cpu_usage: { warning: 70, critical: 90 },
    memory_usage: { warning: 80, critical: 95 },
    response_time: { warning: 1000, critical: 3000 } // in ms
  };
  
  // Check for critical health issues
  if (metrics.error_rate) {
    if (metrics.error_rate >= thresholds.error_rate.critical) {
      logger.error(`CRITICAL: Error rate at ${metrics.error_rate}%`, { metrics });
    } else if (metrics.error_rate >= thresholds.error_rate.warning) {
      logger.warn(`High error rate detected: ${metrics.error_rate}%`, { metrics });
    }
  }
  
  if (metrics.cpu_usage) {
    if (metrics.cpu_usage >= thresholds.cpu_usage.critical) {
      logger.error(`CRITICAL: CPU usage at ${metrics.cpu_usage}%`, { metrics });
    } else if (metrics.cpu_usage >= thresholds.cpu_usage.warning) {
      logger.warn(`High CPU usage detected: ${metrics.cpu_usage}%`, { metrics });
    }
  }
  
  if (metrics.memory_usage) {
    if (metrics.memory_usage >= thresholds.memory_usage.critical) {
      logger.error(`CRITICAL: Memory usage at ${metrics.memory_usage}%`, { metrics });
    } else if (metrics.memory_usage >= thresholds.memory_usage.warning) {
      logger.warn(`High memory usage detected: ${metrics.memory_usage}%`, { metrics });
    }
  }
  
  if (metrics.response_time) {
    if (metrics.response_time >= thresholds.response_time.critical) {
      logger.error(`CRITICAL: Slow response time: ${metrics.response_time}ms`, { metrics });
    } else if (metrics.response_time >= thresholds.response_time.warning) {
      logger.warn(`Slow response time detected: ${metrics.response_time}ms`, { metrics });
    }
  }
};

/**
 * Log performance metrics for application monitoring
 * @param metrics Object containing performance metrics
 * @param context Additional contextual information
 */
const logMetrics = (metrics: Record<string, any>, context: Record<string, any> = {}) => {
  logger.info('Performance metrics', { 
    metrics,
    context,
    timestamp: new Date().toISOString() 
  });
};

/**
 * Log security events with enhanced metadata and severity assessment
 * @param event Security event name
 * @param data Event details
 * @param userId Optional user ID associated with the event
 */
const logSecurity = (event: string, data: Record<string, any>, userId?: string) => {
  // Categorize security events by severity
  const highSeverityEvents = [
    'unauthorized_access', 
    'authentication_breach', 
    'permission_violation', 
    'data_exfiltration',
    'brute_force_attempt',
    'sql_injection_attempt'
  ];
  
  const mediumSeverityEvents = [
    'login_failed', 
    'session_hijacking_attempt', 
    'rate_limit_exceeded',
    'suspicious_activity',
    'unusual_access_pattern'
  ];
  
  // Determine log level based on severity
  let logLevel = 'info';
  if (highSeverityEvents.includes(event)) {
    logLevel = 'error';
  } else if (mediumSeverityEvents.includes(event)) {
    logLevel = 'warn';
  }
  
  // Log the security event with appropriate level
  logger[logLevel](`Security event: ${event}`, {
    security_event: event,
    severity: logLevel,
    data,
    userId,
    timestamp: new Date().toISOString()
  });
};

// Add the custom methods to the logger instance to create enhanced logger
const enhancedLogger = {
  ...logger,
  logHealth,
  logMetrics,
  logSecurity
};

// Export the enhanced logger
export { enhancedLogger as logger };