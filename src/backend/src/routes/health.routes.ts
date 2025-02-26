/**
 * Health Check Routes Configuration
 * 
 * Configures Express router with health check endpoint optimized for infrastructure
 * monitoring, automated health verification, and system status reporting.
 * Implements standardized health check route for monitoring service health
 * with a response time target of <100ms for optimal reliability tracking.
 */

import { Router } from 'express'; // ^4.18.2
import { checkHealth } from '../controllers/health.controller';

/**
 * Configures and returns an Express router with health check endpoint
 * optimized for performance and reliability. This router provides a 
 * standardized health check endpoint for infrastructure monitoring and
 * automated health verification used by ECS container health checks.
 * 
 * The implementation focuses on minimal latency with:
 * - No unnecessary middleware to reduce processing time
 * - Direct controller attachment to minimize overhead
 * - Supports high concurrency (1000+ concurrent health checks)
 * - Real-time health data without caching
 * 
 * @returns {Router} Configured Express router with health check route that supports infrastructure monitoring
 */
const configureHealthRoutes = (): Router => {
  // Create new Express router instance with strict typing
  const router: Router = Router();

  // Configure GET /health endpoint without middleware for optimal performance
  // This endpoint is designed for infrastructure monitoring with <100ms response time
  router.get('/health', checkHealth);

  // Enable router-level error handling for reliability
  router.use((err, req, res, next) => {
    if (err) {
      return res.status(500).json({
        status: 'error',
        message: 'Health check service error',
        timestamp: new Date().toISOString()
      });
    }
    next();
  });

  return router;
};

// Export configured router for integration with main application
export default configureHealthRoutes();