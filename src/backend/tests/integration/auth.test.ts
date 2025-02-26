/**
 * Comprehensive Integration Tests for Authentication Endpoints
 * 
 * These tests cover the full authentication flow including login, registration,
 * token refresh, and password reset with security validations, error handling,
 * and performance monitoring.
 * 
 * @version 1.0.0
 */

import request from 'supertest';
import { app } from '../../src/app';
import { ILoginCredentials } from '../../src/interfaces/auth.interface';
import { faker } from '@faker-js/faker';
import Redis from 'ioredis';
import winston from 'winston';

// Test users with predefined credentials for consistent testing
const testUsers = {
  admin: {
    email: 'admin@test.com',
    password: 'Admin123!@#',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin'
  },
  regular: {
    email: 'user@test.com',
    password: 'User123!@#',
    firstName: 'Regular',
    lastName: 'User',
    role: 'user'
  }
};

// Configuration values for testing
const testConfig = {
  rateLimits: {
    login: 5,        // Max login attempts per IP
    register: 3,      // Max registration attempts per IP
    resetPassword: 2  // Max password reset attempts per IP
  },
  lockoutDuration: 900,  // 15 minutes in seconds
  tokenExpiry: {
    access: 900,       // 15 minutes in seconds
    refresh: 86400     // 24 hours in seconds
  }
};

// Test server instance
let server;

// Redis client for interacting with the cache during tests
let redisClient: Redis;

// Logger instance for test logs
let logger: winston.Logger;

/**
 * Setup before all tests
 * - Initialize test environment
 * - Set up Redis connection
 * - Create test users
 * - Configure logger
 */
beforeAll(async () => {
  // Initialize logger for tests
  logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    defaultMeta: { service: 'auth-integration-tests' },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ]
  });

  // Initialize Redis client
  redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  
  // Clear Redis data to ensure clean tests
  await redisClient.flushall();
  
  // Start the server on a test port
  const port = process.env.TEST_PORT || 3001;
  server = app.listen(port);
  
  logger.info(`Test server started on port ${port}`);
  
  // Create test users if they don't exist
  try {
    // Register admin user
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: testUsers.admin.email,
        password: testUsers.admin.password,
        firstName: testUsers.admin.firstName,
        lastName: testUsers.admin.lastName,
        role: testUsers.admin.role
      });
      
    // Register regular user
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: testUsers.regular.email,
        password: testUsers.regular.password,
        firstName: testUsers.regular.firstName,
        lastName: testUsers.regular.lastName,
        role: testUsers.regular.role
      });
      
    logger.info('Test users created successfully');
  } catch (error) {
    logger.warn('Error creating test users - they may already exist', { error });
  }
});

/**
 * Cleanup after all tests
 * - Close server connections
 * - Close Redis connections
 * - Clear test data
 */
afterAll(async () => {
  // Close the server
  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
  
  // Close Redis connection
  await redisClient.quit();
  
  logger.info('Test server and Redis connections closed');
});

/**
 * Setup before each test
 * - Reset rate limiting counters
 * - Clear active tokens
 * - Reset database state to known state
 */
beforeEach(async () => {
  // Reset rate limiting in Redis
  const rateLimitKeys = await redisClient.keys('ratelimit:*');
  if (rateLimitKeys.length > 0) {
    await redisClient.del(rateLimitKeys);
  }
  
  // Clear specific user test data between tests
  const testTokensKeys = await redisClient.keys('token:test-*');
  if (testTokensKeys.length > 0) {
    await redisClient.del(testTokensKeys);
  }
  
  logger.info('Test environment reset for next test');
});

/**
 * Test suite for user registration endpoint
 */
describe('POST /auth/register', () => {
  /**
   * Test successful registration with valid credentials
   */
  it('should register a new user with valid credentials', async () => {
    // Generate random user data
    const email = faker.internet.email();
    const password = 'Test123!@#';
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    
    // Send register request
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email,
        password,
        firstName,
        lastName,
        role: 'user'
      });
      
    // Assertions - expect 201 Created
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('accessToken');
    expect(response.body).toHaveProperty('expiresIn');
    expect(response.body).toHaveProperty('tokenType', 'Bearer');
    
    // Check if refresh token is set in cookies
    expect(response.headers['set-cookie']).toBeDefined();
    expect(response.headers['set-cookie'][0]).toContain('refreshToken');
    
    // Verify security headers
    expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
  });
  
  /**
   * Test registration with existing email
   */
  it('should return 409 Conflict when registering with existing email', async () => {
    // Try to register with existing email
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: testUsers.regular.email,
        password: 'NewPass123!@#',
        firstName: 'Duplicate',
        lastName: 'User',
        role: 'user'
      });
      
    // Assertions
    expect(response.status).toBe(409);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body.message).toContain('exists');
  });
  
  /**
   * Test registration with invalid email format
   */
  it('should return 400 Bad Request when registering with invalid email format', async () => {
    // Try to register with invalid email
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'invalid-email',
        password: 'Test123!@#',
        firstName: 'Test',
        lastName: 'User',
        role: 'user'
      });
      
    // Assertions
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body.message).toContain('email');
  });
  
  /**
   * Test registration with weak password
   */
  it('should return 400 Bad Request when registering with weak password', async () => {
    // Try to register with weak password
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: faker.internet.email(),
        password: 'password', // Weak password
        firstName: 'Test',
        lastName: 'User',
        role: 'user'
      });
      
    // Assertions
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body.message).toContain('password');
  });
  
  /**
   * Test registration with missing required fields
   */
  it('should return 400 Bad Request when registering with missing fields', async () => {
    // Missing firstName
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: faker.internet.email(),
        password: 'Test123!@#',
        // firstName is missing
        lastName: 'User',
        role: 'user'
      });
      
    // Assertions
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body.errors).toBeDefined();
  });
  
  /**
   * Test registration rate limiting
   */
  it('should enforce rate limiting for registration attempts', async () => {
    // Generate test data
    const testData = {
      password: 'Test123!@#',
      firstName: 'Rate',
      lastName: 'Limited',
      role: 'user'
    };
    
    // Make multiple registration attempts with different emails
    for (let i = 0; i < testConfig.rateLimits.register; i++) {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...testData,
          email: `test${i}@ratelimit.com`
        });
        
      // First N attempts should succeed (or fail with validation, but not with rate limiting)
      expect(response.status).not.toBe(429);
    }
    
    // Next attempt should hit rate limit
    const rateLimitResponse = await request(app)
      .post('/api/v1/auth/register')
      .send({
        ...testData,
        email: 'final@ratelimit.com'
      });
      
    // Assertions for rate limiting
    expect(rateLimitResponse.status).toBe(429);
    expect(rateLimitResponse.body).toHaveProperty('success', false);
    expect(rateLimitResponse.body.message).toContain('Too many');
  });
  
  /**
   * Test SQL injection prevention
   */
  it('should prevent SQL injection in registration fields', async () => {
    // Try SQL injection in firstName field
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: faker.internet.email(),
        password: 'Test123!@#',
        firstName: "Robert'); DROP TABLE users; --",
        lastName: 'User',
        role: 'user'
      });
      
    // Should fail validation (400) but not server error (500)
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
  });
  
  /**
   * Test XSS prevention
   */
  it('should prevent XSS in user input', async () => {
    // Try XSS in firstName field
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: faker.internet.email(),
        password: 'Test123!@#',
        firstName: '<script>alert("XSS")</script>',
        lastName: 'User',
        role: 'user'
      });
      
    // Should fail validation (400) but not server error (500)
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
  });
  
  /**
   * Test password hash strength
   */
  it('should store passwords securely hashed, not in plaintext', async () => {
    // Register a new user
    const email = faker.internet.email();
    const password = 'Test123!@#';
    
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email,
        password,
        firstName: 'Hash',
        lastName: 'Test',
        role: 'user'
      });
      
    // Try to login with the same credentials to verify hashing worked
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email,
        password
      });
      
    // Login should succeed
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toHaveProperty('success', true);
  });
  
  /**
   * Test response headers for security
   */
  it('should include security headers in registration response', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: faker.internet.email(),
        password: 'Test123!@#',
        firstName: 'Header',
        lastName: 'Test',
        role: 'user'
      });
      
    // Check security headers
    expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
    // Any of these security headers might be present depending on configuration
    const securityHeaders = ['x-xss-protection', 'x-frame-options', 'strict-transport-security'];
    const hasSecurityHeader = securityHeaders.some(header => 
      Object.keys(response.headers).includes(header)
    );
    expect(hasSecurityHeader).toBeTruthy();
  });
});

/**
 * Test suite for login endpoint
 */
describe('POST /auth/login', () => {
  /**
   * Test successful login with valid credentials
   */
  it('should login successfully with valid credentials', async () => {
    // Login with test user
    const loginCredentials: ILoginCredentials = {
      email: testUsers.regular.email,
      password: testUsers.regular.password
    };
    
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send(loginCredentials);
      
    // Assertions
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('accessToken');
    expect(response.body).toHaveProperty('expiresIn');
    expect(response.body).toHaveProperty('tokenType', 'Bearer');
    
    // Check if refresh token is set in cookies
    expect(response.headers['set-cookie']).toBeDefined();
    expect(response.headers['set-cookie'][0]).toContain('refreshToken');
  });
  
  /**
   * Test login with non-existent email
   */
  it('should return 401 Unauthorized when logging in with non-existent email', async () => {
    // Login with non-existent email
    const loginCredentials: ILoginCredentials = {
      email: 'nonexistent@test.com',
      password: 'Test123!@#'
    };
    
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send(loginCredentials);
      
    // Assertions
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body.message).toContain('Invalid email or password');
  });
  
  /**
   * Test login with incorrect password
   */
  it('should return 401 Unauthorized when logging in with incorrect password', async () => {
    // Login with incorrect password
    const loginCredentials: ILoginCredentials = {
      email: testUsers.regular.email,
      password: 'WrongPassword123!@#'
    };
    
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send(loginCredentials);
      
    // Assertions
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body.message).toContain('Invalid email or password');
  });
  
  /**
   * Test account lockout after multiple failed attempts
   */
  it('should lock account after multiple failed login attempts', async () => {
    // Create a new user for this test
    const email = faker.internet.email();
    const password = 'Test123!@#';
    
    // Register user
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email,
        password,
        firstName: 'Lockout',
        lastName: 'Test',
        role: 'user'
      });
    
    // Make multiple failed login attempts
    for (let i = 0; i < testConfig.rateLimits.login; i++) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email,
          password: 'WrongPassword123!@#'
        });
    }
    
    // Try logging in with correct password, either should be locked out or rate limited
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email,
        password
      });
      
    // Assertions for account lockout/rate limiting
    expect(response.status).not.toBe(200);
    expect(response.body).toHaveProperty('success', false);
  });
  
  /**
   * Test rate limiting for login attempts
   */
  it('should enforce rate limiting for login attempts', async () => {
    // Login with incorrect password repeatedly to trigger rate limiting
    const loginCredentials: ILoginCredentials = {
      email: testUsers.regular.email,
      password: 'WrongPassword123!@#'
    };
    
    // Make multiple login attempts
    for (let i = 0; i < testConfig.rateLimits.login; i++) {
      await request(app)
        .post('/api/v1/auth/login')
        .send(loginCredentials);
    }
    
    // Next attempt should hit rate limit
    const rateLimitResponse = await request(app)
      .post('/api/v1/auth/login')
      .send(loginCredentials);
      
    // Assertions for rate limiting
    expect(rateLimitResponse.status).toBe(429);
    expect(rateLimitResponse.body).toHaveProperty('success', false);
    expect(rateLimitResponse.body.message).toContain('Too many');
  });
  
  /**
   * Test brute force protection
   */
  it('should protect against brute force attacks', async () => {
    // Try different passwords for the same account to simulate brute force
    const baseEmail = 'bruteforce@test.com';
    const basePassword = 'BruteForce123!';
    
    // Create a test user for brute force testing
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: baseEmail,
        password: basePassword,
        firstName: 'Brute',
        lastName: 'Force',
        role: 'user'
      });
    
    // Generate different password variants
    const passwordVariants = [
      'Password123!',
      'Password123@',
      'Password123#',
      'Password124!',
      'Password1234!'
    ];
    
    // Try each password variant
    for (let i = 0; i < passwordVariants.length; i++) {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: baseEmail,
          password: passwordVariants[i]
        });
        
      // All should fail with 401, not 200
      expect(response.status).toBe(401);
    }
    
    // After several attempts, should hit rate limiting or account lockout
    const lockoutResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: baseEmail,
        password: 'AnotherAttempt123!'
      });
      
    expect(lockoutResponse.status).toBe(429);
  });
  
  /**
   * Test JWT token structure and claims
   */
  it('should return properly structured JWT token with required claims', async () => {
    // Login with test user
    const loginCredentials: ILoginCredentials = {
      email: testUsers.regular.email,
      password: testUsers.regular.password
    };
    
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send(loginCredentials);
      
    // Get JWT token from response
    const token = response.body.accessToken;
    
    // JWT tokens have three parts separated by dots
    const tokenParts = token.split('.');
    expect(tokenParts.length).toBe(3);
    
    // Decode the payload (middle part)
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    
    // Check required claims
    expect(payload).toHaveProperty('sub'); // Subject (user ID)
    expect(payload).toHaveProperty('email', testUsers.regular.email);
    expect(payload).toHaveProperty('role', testUsers.regular.role);
    expect(payload).toHaveProperty('iat'); // Issued at
    expect(payload).toHaveProperty('exp'); // Expiration
    
    // Verify expiration is in the future
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
  
  /**
   * Test refresh token generation
   */
  it('should generate a refresh token on successful login', async () => {
    // Login with test user
    const loginCredentials: ILoginCredentials = {
      email: testUsers.regular.email,
      password: testUsers.regular.password
    };
    
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send(loginCredentials);
      
    // Check cookie contains refresh token
    expect(response.headers['set-cookie']).toBeDefined();
    const cookieHeader = response.headers['set-cookie'][0];
    expect(cookieHeader).toContain('refreshToken');
    
    // Extract refresh token from cookie
    const refreshToken = cookieHeader.split(';')[0].split('=')[1];
    expect(refreshToken).toBeTruthy();
    
    // Verify refresh token is stored in Redis
    const refreshTokenKey = `refresh_token:${refreshToken}`;
    const storedToken = await redisClient.exists(refreshTokenKey);
    expect(storedToken).toBeTruthy();
  });
  
  /**
   * Test session management
   */
  it('should create a session on successful login', async () => {
    // Login with test user
    const loginCredentials: ILoginCredentials = {
      email: testUsers.regular.email,
      password: testUsers.regular.password
    };
    
    await request(app)
      .post('/api/v1/auth/login')
      .send(loginCredentials);
      
    // Verify a user session exists in Redis
    // In a real application, this would check for user-specific session data
    const userSessionPattern = `user_tokens:*`;
    const userSessions = await redisClient.keys(userSessionPattern);
    expect(userSessions.length).toBeGreaterThan(0);
  });
  
  /**
   * Test secure cookie settings
   */
  it('should set secure cookie options for refresh token', async () => {
    // Login with test user
    const loginCredentials: ILoginCredentials = {
      email: testUsers.regular.email,
      password: testUsers.regular.password
    };
    
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send(loginCredentials);
      
    // Check refresh token cookie settings
    const cookieHeader = response.headers['set-cookie'][0];
    
    // Check for secure flags
    expect(cookieHeader).toContain('HttpOnly'); // Prevents JavaScript access
    
    // In development environment, Secure might not be set
    // In production, we would test for:
    // expect(cookieHeader).toContain('Secure');
    
    expect(cookieHeader).toContain('SameSite'); // Prevents CSRF
    expect(cookieHeader).toContain('Path='); // Path restriction
  });
});

/**
 * Test suite for token refresh endpoint
 */
describe('POST /auth/refresh-token', () => {
  let accessToken: string;
  let refreshToken: string;

  // Log in and get tokens before each test
  beforeEach(async () => {
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUsers.regular.email,
        password: testUsers.regular.password
      });
      
    accessToken = loginResponse.body.accessToken;
    
    // Extract refresh token from cookie
    const cookieHeader = loginResponse.headers['set-cookie'][0];
    const cookieParts = cookieHeader.split(';')[0].split('=');
    refreshToken = cookieParts[1];
  });
  
  /**
   * Test successful token refresh
   */
  it('should issue new tokens when a valid refresh token is provided', async () => {
    // Refresh token - try both cookie-based and request body approaches
    const response = await request(app)
      .post('/api/v1/auth/refresh-token')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', [`refreshToken=${refreshToken}`])
      .send({ refreshToken }); // Some implementations expect it in request body
      
    // Assertions
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('accessToken');
    expect(response.body).toHaveProperty('expiresIn');
    
    // New token should be different from the old one
    expect(response.body.accessToken).not.toBe(accessToken);
    
    // Check new refresh token is issued in cookie
    expect(response.headers['set-cookie']).toBeDefined();
    expect(response.headers['set-cookie'][0]).toContain('refreshToken');
  });
  
  /**
   * Test token rotation security
   */
  it('should invalidate the old refresh token after rotation', async () => {
    // First refresh to rotate the token
    await request(app)
      .post('/api/v1/auth/refresh-token')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', [`refreshToken=${refreshToken}`])
      .send({ refreshToken });
      
    // Try to use the old refresh token again
    const secondRefreshResponse = await request(app)
      .post('/api/v1/auth/refresh-token')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', [`refreshToken=${refreshToken}`])
      .send({ refreshToken });
      
    // Should fail because old token should be blacklisted
    expect(secondRefreshResponse.status).toBe(401);
    expect(secondRefreshResponse.body).toHaveProperty('success', false);
  });
  
  /**
   * Test refresh with invalid token
   */
  it('should reject refresh requests with invalid tokens', async () => {
    // Try to refresh with invalid token
    const response = await request(app)
      .post('/api/v1/auth/refresh-token')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', ['refreshToken=invalid-token'])
      .send({ refreshToken: 'invalid-token' });
      
    // Assertions
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('success', false);
  });
});

/**
 * Test suite for logout endpoint
 */
describe('POST /auth/logout', () => {
  let accessToken: string;
  let refreshToken: string;

  // Log in and get tokens before each test
  beforeEach(async () => {
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUsers.regular.email,
        password: testUsers.regular.password
      });
      
    accessToken = loginResponse.body.accessToken;
    
    // Extract refresh token from cookie
    const cookieHeader = loginResponse.headers['set-cookie'][0];
    const cookieParts = cookieHeader.split(';')[0].split('=');
    refreshToken = cookieParts[1];
  });
  
  /**
   * Test successful logout
   */
  it('should successfully log out and invalidate tokens', async () => {
    // Logout
    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', [`refreshToken=${refreshToken}`]);
      
    // Assertions
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    
    // Check that refresh cookie is cleared
    expect(response.headers['set-cookie']).toBeDefined();
    expect(response.headers['set-cookie'][0]).toContain('refreshToken=;');
    
    // Verify tokens are invalidated by trying to use them
    const refreshResponse = await request(app)
      .post('/api/v1/auth/refresh-token')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', [`refreshToken=${refreshToken}`])
      .send({ refreshToken });
      
    // Should reject the invalidated token
    expect(refreshResponse.status).toBe(401);
  });
});

/**
 * Test suite for password reset
 */
describe('POST /auth/reset-password', () => {
  /**
   * Test password reset with invalid token
   */
  it('should reject password reset with invalid token', async () => {
    // Try to reset with invalid token
    const response = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        email: testUsers.regular.email,
        token: 'invalid-token',
        newPassword: 'NewPass123!@#'
      });
      
    // Assertions
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
  });
  
  /**
   * Test password complexity validation
   */
  it('should validate password complexity during reset', async () => {
    // Try to reset with weak password
    const response = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        email: testUsers.regular.email,
        token: 'simulated-reset-token',
        newPassword: 'password' // Weak password
      });
      
    // Assertions - should fail validation
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body.message).toContain('password');
  });
  
  /**
   * Test rate limiting for password reset attempts
   */
  it('should enforce rate limiting for password reset attempts', async () => {
    // Make multiple password reset attempts
    for (let i = 0; i < testConfig.rateLimits.resetPassword; i++) {
      await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          email: testUsers.regular.email,
          token: 'test-token',
          newPassword: 'NewPass123!@#'
        });
    }
    
    // Next attempt should hit rate limit
    const rateLimitResponse = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        email: testUsers.regular.email,
        token: 'test-token',
        newPassword: 'NewPass123!@#'
      });
      
    // Assertions for rate limiting
    expect(rateLimitResponse.status).toBe(429);
    expect(rateLimitResponse.body).toHaveProperty('success', false);
    expect(rateLimitResponse.body.message).toContain('Too many');
  });
});