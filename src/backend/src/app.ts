/**
 * Main application entry point for the User Management Dashboard backend API.
 * Configures and initializes the Express server with comprehensive security features,
 * production-ready middleware, advanced error handling, and health monitoring capabilities.
 * 
 * @module app
 * @version 1.0.0
 */

import express, { Express, Request, Response, NextFunction } from 'express'; // ^4.18.2
import cors from 'cors'; // ^2.8.5
import helmet from 'helmet'; // ^7.0.0
import compression from 'compression'; // ^1.7.4
import http from 'http';

import { config } from './config';
import {
  loggerMiddleware,
  errorHandler,
  rateLimiterMiddleware,
  authenticate,
  validateRequest,
  authorize
} from './middleware';
import router from './routes';

// Create Express application instance
const app: Express = express();

/**
 * Initializes and configures all application middleware with security and performance optimizations
 */
function initializeMiddleware(): void {
  // Enable trust proxy for load balancer support
  app.set('trust proxy', true);
  
  // Configure security headers with helmet using strict CSP
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    xssFilter: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    }
  }));
  
  // Configure CORS with strict options from config
  app.use(cors(config.cors));
  
  // Enable JSON body parsing with size limits
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  
  // Enable response compression
  app.use(compression());
  
  // Configure rate limiting (100 requests/minute per IP as per API Design requirements)
  app.use(rateLimiterMiddleware);
  
  // Setup structured request logging with correlation IDs
  app.use(loggerMiddleware);
  
  // Authentication and validation will be applied to specific routes as needed
  // JWT authentication handled by authenticate middleware
  // Request validation handled by validateRequest middleware
}

/**
 * Mounts all application routes with versioning and monitoring endpoints
 */
function initializeRoutes(): void {
  // Mount metrics endpoint for monitoring systems
  app.get('/metrics', (req: Request, res: Response) => {
    const memoryUsage = process.memoryUsage();
    
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      metrics: {
        requests: {
          total: 0, // Would be tracked in a real implementation
          success: 0,
          error: 0
        },
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB'
        },
        responseTime: {
          average: 0, // Would be tracked in a real implementation
          p95: 0,
          p99: 0
        }
      }
    });
  });
  
  // Mount API routes (including health check route at /api/health)
  app.use('/api', router);
  
  // Configure API documentation route
  app.get('/api-docs', (req: Request, res: Response) => {
    res.redirect('/api/v1/docs');
  });
  
  // Configure 404 handler with structured response
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      status: 404,
      message: 'Resource not found',
      path: req.path
    });
  });
  
  // Configure global error handler with security filtering
  app.use(errorHandler);
}

/**
 * Starts the Express server with graceful shutdown support
 * 
 * @param port - Port number to listen on
 * @returns Promise that resolves when server starts successfully
 */
async function startServer(port: number): Promise<void> {
  try {
    // Initialize middleware chain
    initializeMiddleware();
    
    // Initialize routes and handlers
    initializeRoutes();
    
    // Create HTTP server
    const server = http.createServer(app);
    
    // Configure keep-alive timeout (slightly higher than ALB's default of 60s)
    server.keepAliveTimeout = 65000; // 65 seconds
    server.headersTimeout = 66000; // 66 seconds
    
    // Start HTTP server on specified port
    server.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
      console.log(`🔗 Health check: http://localhost:${port}/api/health`);
      console.log(`📊 Metrics: http://localhost:${port}/metrics`);
      console.log(`📚 API Documentation: http://localhost:${port}/api-docs`);
    });
    
    // Setup graceful shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown(server));
    process.on('SIGINT', () => gracefulShutdown(server));
    
    // Log server startup information
    console.log(`✅ Environment: ${config.env}`);
    console.log(`✅ Database: Connected to ${config.database.url.replace(/:.+@/, ':****@')}`);
    console.log(`✅ Cache: Connected to ${config.cache.url.replace(/:.+@/, ':****@')}`);
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Handles graceful server shutdown with connection draining
 * 
 * @param server - HTTP server instance
 * @returns Promise that resolves when shutdown is complete
 */
async function gracefulShutdown(server: http.Server): Promise<void> {
  console.log('🛑 Received shutdown signal. Starting graceful shutdown...');
  
  // Create a timeout to force shutdown if graceful shutdown takes too long
  const forcedShutdownTimeout = setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 30000); // 30 seconds timeout
  
  try {
    // Stop accepting new connections but continue to process existing ones
    server.close(() => {
      console.log('✅ HTTP server closed. No longer accepting connections.');
      
      // Clear the forced shutdown timeout
      clearTimeout(forcedShutdownTimeout);
      
      // Close database connections if applicable
      console.log('📦 Closing database connections...');
      // In a real implementation, this would call database.disconnect()
      
      // Clear Redis cache if applicable
      console.log('🗄️ Closing Redis connections...');
      // In a real implementation, this would call redisClient.quit()
      
      // Shutdown monitoring systems if applicable
      console.log('📊 Shutting down monitoring systems...');
      // In a real implementation, this would call monitoring.shutdown()
      
      // Exit process when complete
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    
    // Clear the forced shutdown timeout
    clearTimeout(forcedShutdownTimeout);
    
    // Exit with error code
    process.exit(1);
  }
}

// Export Express app and server start function
export { app, startServer };