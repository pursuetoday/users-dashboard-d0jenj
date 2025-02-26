/**
 * Integration tests for the health check endpoint that verifies API service status 
 * monitoring, performance metrics, and infrastructure health check compliance
 * for container orchestration.
 * 
 * @version 1.0.0
 */

import request from 'supertest'; // ^6.3.3
import { app } from '../../src/app';
import { HTTP_STATUS } from '../../src/constants/http-status';

describe('Health Check Endpoint', () => {
  let server: any;
  
  // Setup test server before running tests
  beforeAll(done => {
    server = app.listen(0, () => {
      console.log(`Test server running on random port ${(server.address() as any).port}`);
      done();
    });
  });
  
  // Cleanup test server after tests complete
  afterAll(done => {
    if (server) {
      server.close(() => {
        console.log('Test server closed');
        done();
      });
    } else {
      done();
    }
  });
  
  it('should return 200 OK with valid health status', async () => {
    // Send GET request to health endpoint
    const response = await request(app).get('/api/health');
    
    // Verify response status is 200 OK
    expect(response.status).toBe(HTTP_STATUS.OK);
    
    // Verify response content type is JSON
    expect(response.headers['content-type']).toContain('application/json');
    
    // Verify essential health information is present
    expect(response.body).toHaveProperty('status', 'healthy');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime');
    expect(response.body).toHaveProperty('requestId');
    
    // Verify timestamp is valid ISO format
    const timestamp = new Date(response.body.timestamp);
    expect(isNaN(timestamp.getTime())).toBe(false);
    
    // Verify uptime is a positive number (service is running)
    expect(typeof response.body.uptime).toBe('number');
    expect(response.body.uptime).toBeGreaterThan(0);
    
    // Verify response time meets performance requirements
    // Response should be fast for infrastructure health checks
    expect(response.headers['x-response-time']).toBeDefined();
  });
  
  it('should include all required health check fields', async () => {
    const response = await request(app).get('/api/health');
    
    // Verify status field is present and valid
    expect(response.body).toHaveProperty('status', 'healthy');
    
    // Verify timestamp is in ISO format
    expect(response.body).toHaveProperty('timestamp');
    const timestamp = new Date(response.body.timestamp);
    expect(isNaN(timestamp.getTime())).toBe(false);
    
    // Verify uptime is a positive number
    expect(response.body).toHaveProperty('uptime');
    expect(typeof response.body.uptime).toBe('number');
    expect(response.body.uptime).toBeGreaterThan(0);
    
    // Verify memory metrics required for container monitoring
    expect(response.body).toHaveProperty('memory');
    expect(response.body.memory).toHaveProperty('used');
    expect(response.body.memory).toHaveProperty('free');
    expect(response.body.memory).toHaveProperty('total');
    expect(response.body.memory).toHaveProperty('usagePercent');
    expect(typeof response.body.memory.used).toBe('number');
    expect(typeof response.body.memory.free).toBe('number');
    expect(typeof response.body.memory.total).toBe('number');
    expect(typeof response.body.memory.usagePercent).toBe('number');
    
    // Verify system information required for infrastructure monitoring
    expect(response.body).toHaveProperty('system');
    expect(response.body.system).toHaveProperty('platform');
    expect(response.body.system).toHaveProperty('nodeVersion');
    expect(response.body.system).toHaveProperty('cpuCores');
    expect(response.body.system).toHaveProperty('loadAverage');
    
    // Verify version and environment information for deployment tracking
    expect(response.body).toHaveProperty('version');
    expect(response.body).toHaveProperty('environment');
    
    // Verify request identification for tracing
    expect(response.body).toHaveProperty('requestId');
    expect(typeof response.body.requestId).toBe('string');
    // Health check IDs should follow the format: health-timestamp-random
    expect(response.body.requestId).toMatch(/^health-\d+-\d+$/);
  });
  
  it('should handle concurrent health check requests', async () => {
    // Create multiple concurrent requests to simulate infrastructure load testing
    const concurrentRequests = 10;
    const requests = Array(concurrentRequests)
      .fill(null)
      .map(() => request(app).get('/api/health'));
    
    // Execute all requests concurrently
    const responses = await Promise.all(requests);
    
    // Verify all requests succeeded with 200 OK
    responses.forEach(response => {
      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body).toHaveProperty('status', 'healthy');
    });
    
    // Verify each request has a unique requestId (no collisions)
    const requestIds = responses.map(response => response.body.requestId);
    const uniqueIds = new Set(requestIds);
    expect(uniqueIds.size).toBe(concurrentRequests);
    
    // Verify consistent response format across all concurrent requests
    responses.forEach(response => {
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('system');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
    
    // Verify no degradation in metrics accuracy under load
    responses.forEach(response => {
      expect(typeof response.body.memory.usagePercent).toBe('number');
      expect(response.body.memory.usagePercent).toBeGreaterThanOrEqual(0);
      expect(response.body.memory.usagePercent).toBeLessThanOrEqual(100);
    });
  });
});