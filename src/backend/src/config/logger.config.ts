/**
 * Configuration module for the application's logging system using Winston logger.
 * Implements a production-grade logging system with environment-specific configurations,
 * multiple transports, and ELK Stack integration.
 * Supports comprehensive error tracking, audit logging, and system health monitoring.
 */

import { format, transports } from 'winston'; // ^3.10.0
import DailyRotateFile from 'winston-daily-rotate-file'; // ^4.7.1
import { LoggerConfig } from '../interfaces/config.interface';

// Default log level if not specified
const DEFAULT_LOG_LEVEL = 'info';

// Default log format options
const LOG_FORMAT = {
  timestamp: true,
  json: true,
  colorize: process.env.NODE_ENV !== 'production',
  metadata: {
    service: process.env.SERVICE_NAME || 'user-management-dashboard',
    environment: process.env.NODE_ENV || 'development',
    requestId: true
  }
};

// Default file rotation options for regular logs
const FILE_OPTIONS = {
  filename: 'logs/%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxFiles: '14d',
  maxSize: '20m',
  zippedArchive: true
};

// Default file rotation options for error logs
const ERROR_FILE_OPTIONS = {
  filename: 'logs/error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxFiles: '30d',
  maxSize: '20m',
  zippedArchive: true,
  level: 'error'
};

/**
 * Winston logger configuration object.
 * Provides comprehensive logging capabilities with environment-specific settings,
 * multiple transports for different destinations, and robust error handling.
 */
export const loggerConfig = {
  // Set log level based on environment or default to info
  level: (process.env.LOG_LEVEL as LoggerConfig['level']) || DEFAULT_LOG_LEVEL,
  
  // Configure log format
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json(),
    process.env.NODE_ENV !== 'production' ? format.colorize() : format.uncolorize(),
    format.printf(({ timestamp, level, message, stack, ...meta }) => {
      return JSON.stringify({
        timestamp,
        level,
        message,
        stack,
        service: process.env.SERVICE_NAME || 'user-management-dashboard',
        environment: process.env.NODE_ENV || 'development',
        ...meta
      });
    })
  ),
  
  // Configure transports based on environment
  transports: [
    // Console transport (used in all environments)
    new transports.Console({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      handleExceptions: true
    }),
    
    // File transport for all logs
    new DailyRotateFile(FILE_OPTIONS),
    
    // File transport for error logs
    new DailyRotateFile(ERROR_FILE_OPTIONS)
  ],
  
  // Exception handlers
  exceptionHandlers: [
    new transports.Console({ handleExceptions: true }),
    new DailyRotateFile({
      ...ERROR_FILE_OPTIONS,
      filename: 'logs/exceptions-%DATE%.log'
    })
  ],
  
  // Promise rejection handlers
  rejectionHandlers: [
    new transports.Console({ handleRejections: true }),
    new DailyRotateFile({
      ...ERROR_FILE_OPTIONS,
      filename: 'logs/rejections-%DATE%.log'
    })
  ]
};

// Add ELK Stack transport if configured
if (process.env.ELK_STACK_URL) {
  /**
   * ELK Stack integration
   * 
   * To enable ELK Stack integration:
   * 1. Install winston-elasticsearch package: npm install winston-elasticsearch
   * 2. Uncomment the following code
   * 3. Configure environment variables: ELK_STACK_URL, ELK_USERNAME, ELK_PASSWORD (optional)
   *
   * import { ElasticsearchTransport } from 'winston-elasticsearch';
   * 
   * loggerConfig.transports.push(
   *   new ElasticsearchTransport({
   *     level: 'info',
   *     clientOpts: {
   *       node: process.env.ELK_STACK_URL,
   *       auth: {
   *         username: process.env.ELK_USERNAME,
   *         password: process.env.ELK_PASSWORD
   *       }
   *     },
   *     indexPrefix: process.env.SERVICE_NAME || 'user-management',
   *     ensureMappingTemplate: true
   *   })
   * );
   */
}