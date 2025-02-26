/**
 * Health Check Controller
 * 
 * Provides endpoints to monitor API service health and status.
 * Implements standardized health check responses for infrastructure monitoring,
 * automated health verification, and detailed system metrics for operational monitoring.
 */

import { Request, Response } from 'express'; // ^4.18.2
import { HTTP_STATUS } from '../constants/http-status';
import { logger } from '../utils/logger.util';
import os from 'os';

/**
 * Handles health check requests and returns comprehensive API service status
 * including system metrics, uptime, and performance indicators.
 * 
 * @param req Express request object
 * @param res Express response object
 * @returns JSON response with detailed health status
 */
export const checkHealth = async (req: Request, res: Response): Promise<Response> => {
  // Start timing the request for performance measurement
  const startTime = Date.now();
  
  // Generate unique request identifier for tracing
  const requestId = `health-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  
  // Log incoming health check request with metadata (requestId, timestamp, clientIp)
  logger.info('Health check requested', {
    requestId,
    timestamp: new Date().toISOString(),
    clientIp: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    endpoint: '/health',
  });
  
  // Calculate process uptime in seconds
  const uptime = process.uptime();
  
  // Gather memory usage statistics (used, free, total)
  const memoryUsage = process.memoryUsage();
  const memory = {
    used: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100, // MB
    free: Math.round((memoryUsage.heapTotal - memoryUsage.heapUsed) / 1024 / 1024 * 100) / 100, // MB
    total: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100, // MB
    rss: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100, // MB
    usagePercent: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
  };
  
  // Get application version from package.json
  // In a real implementation, this would be imported from package.json
  const version = process.env.npm_package_version || '1.0.0';
  
  // Construct health check response object with all metrics
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    requestId,
    uptime,
    memory,
    system: {
      platform: process.platform,
      nodeVersion: process.version,
      cpuCores: os.cpus().length,
      hostname: os.hostname(),
      loadAverage: os.loadavg(),
    },
    version,
    environment: process.env.NODE_ENV || 'development',
  };
  
  // Calculate duration for logging
  const duration = Date.now() - startTime;
  
  // Log request completion with duration
  logger.info('Health check completed', {
    requestId,
    duration,
    status: healthData.status,
    memoryUsage: memory.usagePercent,
  });
  
  // Return 200 OK status with comprehensive health information
  return res.status(HTTP_STATUS.OK).json(healthData);
};