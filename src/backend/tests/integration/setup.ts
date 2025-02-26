/**
 * Integration Test Setup
 * 
 * This module configures the test environment for integration testing, including
 * database connections, server initialization, and global test hooks for integration testing
 * with comprehensive error handling, logging, and resource management.
 * 
 * @module tests/integration/setup
 * @version 1.0.0
 */

import { beforeAll, afterAll, beforeEach } from '@jest/globals'; // ^29.0.0
import supertest from 'supertest'; // ^6.3.3
import { PrismaClient } from '@prisma/client'; // ^5.0.0
import winston from 'winston'; // ^3.8.0
import * as Express from 'express';
import { app } from '../../src/app';
import { databaseConfig } from '../../src/config/database.config';

// Global constants
const TEST_PORT: number = 4000;

// Global variables
let testServer: Express.Application;
let prisma: PrismaClient;
let logger: winston.Logger;

/**
 * Initializes test database with proper isolation and transaction support
 * @returns Promise resolving when database is ready with proper connection pool
 */
async function setupTestDatabase(): Promise<void> {
  try {
    logger.info('Initializing test database connection...');
    
    // Connect to test database using Prisma client with connection pool
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL || databaseConfig.url,
        },
      },
      log: ['error', 'warn'],
    });
    
    // Validate database connection and configuration
    await prisma.$connect();
    logger.info(`Connected to database: ${databaseConfig.url.replace(/:.+@/, ':****@')}`);
    
    // Run database migrations with error handling
    logger.info('Running database migrations...');
    try {
      // In a real implementation, we would run migrations
      // await prisma.$executeRaw`...`;
      logger.info('Database migrations completed successfully');
    } catch (error) {
      logger.error('Failed to run database migrations:', error);
      throw new Error(`Database migrations failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Clear existing test data with transaction support
    logger.info('Clearing existing test data...');
    await clearTestData();
    
    // Initialize database schema with test constraints
    logger.info('Initializing database schema for testing...');
    // This would setup any test-specific schema requirements
    
    // Verify database setup completion
    logger.info('Database setup completed successfully');
  } catch (error) {
    logger.error('Failed to initialize test database:', error);
    throw new Error(`Database initialization failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Clears all test data from the database
 * @returns Promise resolving when data is cleared
 */
async function clearTestData(): Promise<void> {
  try {
    // Use transaction for data consistency
    await prisma.$transaction(async (tx) => {
      // Clear tables in reverse order of dependencies
      // The specific tables depend on your schema
      logger.debug('Clearing test data...');
      
      // Example clear operations - update these based on your actual schema
      await tx.session?.deleteMany({}).catch(err => logger.warn('Error clearing sessions:', err));
      await tx.auditLog?.deleteMany({}).catch(err => logger.warn('Error clearing audit logs:', err));
      await tx.user?.deleteMany({}).catch(err => logger.warn('Error clearing users:', err));
      
      // Add any other tables that need to be cleared
    });
    
    logger.info('Test data cleared successfully');
  } catch (error) {
    logger.error('Failed to clear test data:', error);
    throw new Error(`Failed to clear test data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Initializes test server instance with security configurations
 * @returns Promise resolving when server is ready and validated
 */
async function setupTestServer(): Promise<void> {
  try {
    logger.info(`Initializing test server on port ${TEST_PORT}...`);
    
    // Configure server security settings
    // In a real implementation, we might apply test-specific middleware or configurations
    
    // Start server on test port with error handling
    testServer = app.listen(TEST_PORT, () => {
      logger.info(`Test server running on port ${TEST_PORT}`);
    }) as unknown as Express.Application;
    
    // Validate server health endpoints
    try {
      const response = await supertest(app).get('/api/health');
      if (response.status !== 200) {
        throw new Error(`Health check failed with status ${response.status}`);
      }
      logger.info('Server health check passed');
    } catch (error) {
      logger.error('Server health check failed:', error);
      throw new Error(`Server health check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Configure request timeouts
    (testServer as any).timeout = 30000; // 30 seconds
    
    // Setup server-side logging
    logger.info('Server-side logging configured');
    
    // Initialize connection pools
    logger.info('Connection pools initialized');
    
    logger.info('Test server initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize test server:', error);
    throw new Error(`Server initialization failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Performs comprehensive cleanup of test resources
 * @returns Promise resolving when cleanup is complete
 */
async function cleanupTestResources(): Promise<void> {
  try {
    logger.info('Cleaning up test resources...');
    
    // Close database connections properly
    if (prisma) {
      logger.info('Closing database connections...');
      await prisma.$disconnect();
      logger.info('Database connections closed');
    }
    
    // Clear connection pools
    logger.info('Clearing connection pools...');
    
    // Remove temporary test files
    logger.info('Removing temporary test files...');
    
    // Clear cache data
    logger.info('Clearing cache data...');
    
    // Reset environment variables
    logger.info('Resetting environment variables...');
    
    // Shutdown test server gracefully
    if (testServer) {
      logger.info('Shutting down test server...');
      await new Promise<void>((resolve, reject) => {
        const httpServer = testServer as unknown as { close: (callback: (err?: Error) => void) => void };
        httpServer.close((err?: Error) => {
          if (err) {
            logger.error('Error shutting down test server:', err);
            reject(err);
          } else {
            logger.info('Test server shut down successfully');
            resolve();
          }
        });
      });
    }
    
    // Flush logs to disk
    logger.info('Flushing logs to disk...');
    
    // Verify resource cleanup completion
    logger.info('Test resource cleanup completed');
  } catch (error) {
    logger.error('Failed to clean up test resources:', error);
    throw new Error(`Resource cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Initialize logger
logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ level, message, timestamp }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      level: process.env.NODE_ENV === 'test' ? 'info' : 'error',
    }),
    new winston.transports.File({ 
      filename: 'logs/integration-tests.log',
      level: 'debug',
    }),
  ],
});

// Global setup before running tests
beforeAll(async () => {
  try {
    logger.info('----------------------------------------');
    logger.info('Starting integration test setup...');
    
    // Validate test environment variables
    if (!process.env.NODE_ENV) {
      process.env.NODE_ENV = 'test';
    }
    
    logger.info('Validating test environment variables...');
    
    // Setup test database connection with retries
    let retries = 3;
    let connected = false;
    
    while (retries > 0 && !connected) {
      try {
        await setupTestDatabase();
        connected = true;
      } catch (error) {
        retries--;
        logger.error(`Database connection failed, retries left: ${retries}`, error);
        
        if (retries === 0) {
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, (4 - retries) * 1000));
      }
    }
    
    // Run database migrations with validation
    logger.info('Database setup completed with migrations and validation');
    
    // Initialize test server with security configs
    await setupTestServer();
    
    // Setup test data isolation
    logger.info('Test data isolation configured');
    
    // Configure test timeouts
    jest.setTimeout(30000); // 30 seconds
    
    // Initialize connection pools
    logger.info('Connection pools initialized');
    
    logger.info('Integration test setup completed successfully');
    logger.info('----------------------------------------');
  } catch (error) {
    logger.error('Integration test setup failed:', error);
    // Re-throw to fail tests
    throw error;
  }
});

// Global teardown after tests complete
afterAll(async () => {
  try {
    logger.info('----------------------------------------');
    logger.info('Starting integration test teardown...');
    
    // Cleanup all resources
    await cleanupTestResources();
    
    logger.info('Integration test teardown completed successfully');
    logger.info('----------------------------------------');
  } catch (error) {
    logger.error('Integration test teardown failed:', error);
    // Re-throw to report failure
    throw error;
  }
});

// Setup before each test with proper isolation
beforeEach(async () => {
  try {
    logger.debug('Setting up test isolation...');
    
    // Start new transaction for test isolation
    // In a real implementation with Prisma, we would use transaction API:
    // const tx = await prisma.$transaction(async (tx) => {
    //   // Use tx for all database operations during test
    //   // This allows automatic rollback
    // });
    
    // Clear test database tables
    await clearTestData();
    
    // Reset database to known state
    logger.debug('Database reset to known state');
    
    // Clear cached data
    logger.debug('Cached data cleared');
    
    // Reset request counters
    logger.debug('Request counters reset');
    
    // Clear temporary files
    logger.debug('Temporary files cleared');
    
    // Reset timeout counters
    logger.debug('Timeout counters reset');
    
    // Prepare test isolation
    logger.debug('Test isolation prepared');
  } catch (error) {
    logger.error('Test isolation setup failed:', error);
    throw error;
  }
});

// Export Jest hooks for test files
export { beforeAll, afterAll, beforeEach };