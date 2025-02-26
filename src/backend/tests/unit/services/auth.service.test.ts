/**
 * Auth Service Unit Tests
 * 
 * Comprehensive test suite for AuthService that validates authentication flows,
 * token management, and security measures.
 */

import { AuthService } from '../../src/services/auth.service';
import { UserModel } from '../../src/models/user.model';
import { CacheService } from '../../src/services/cache.service';
import { UserRole } from '../../src/interfaces/user.interface';
import { AUTH_ERRORS, SYSTEM_ERRORS } from '../../src/constants/error-messages';
import bcrypt from 'bcrypt'; // ^5.1.0
import jest from 'jest'; // ^29.0.0

// Mock dependencies
jest.mock('../../src/models/user.model');
jest.mock('../../src/services/cache.service');
jest.mock('jsonwebtoken');
jest.mock('uuid');
jest.mock('token-bucket');

describe('AuthService', () => {
  // Setup variables
  let authService: AuthService;
  let mockUserModel: jest.Mocked<UserModel>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockRateLimiter: any;
  let testData: {
    validUser: any;
    inactiveUser: any;
    validCredentials: any;
    invalidCredentials: any;
    accessToken: string;
    refreshToken: string;
    newRefreshToken: string;
    tokenData: any;
  };

  /**
   * Initializes test environment with mocked dependencies and test data
   */
  beforeEach(() => {
    // Reset all Jest mocks
    jest.clearAllMocks();
    
    // Mock UUID generation for predictable tokens in tests
    jest.requireMock('uuid').v4 = jest.fn()
      .mockReturnValueOnce('test-refresh-token')
      .mockReturnValueOnce('new-refresh-token');
    
    // Mock JWT sign
    jest.requireMock('jsonwebtoken').sign = jest.fn().mockReturnValue('mock-access-token');
    
    // Create mock instances
    mockUserModel = new UserModel() as jest.Mocked<UserModel>;
    mockCacheService = new CacheService() as jest.Mocked<CacheService>;
    
    // Create mock rate limiter
    mockRateLimiter = {
      tryRemoveTokens: jest.fn().mockReturnValue(true)
    };
    
    // Initialize test data fixtures
    testData = {
      validUser: {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.USER,
        isActive: true
      },
      inactiveUser: {
        id: 'user-456',
        email: 'inactive@example.com',
        firstName: 'Inactive',
        lastName: 'User',
        role: UserRole.USER,
        isActive: false
      },
      validCredentials: {
        email: 'test@example.com',
        password: 'Password123!'
      },
      invalidCredentials: {
        email: 'test@example.com',
        password: 'WrongPassword123!'
      },
      accessToken: 'mock-access-token',
      refreshToken: 'test-refresh-token',
      newRefreshToken: 'new-refresh-token',
      tokenData: {
        userId: 'user-123',
        createdAt: new Date().toISOString()
      }
    };
    
    // Configure mock implementations for database operations
    mockUserModel.verifyPassword = jest.fn().mockImplementation((email, password) => {
      if (email === testData.validUser.email && password === testData.validCredentials.password) {
        return Promise.resolve(testData.validUser);
      } else if (email === testData.inactiveUser.email) {
        return Promise.resolve(testData.inactiveUser);
      }
      return Promise.resolve(null);
    });
    
    mockUserModel.findById = jest.fn().mockImplementation((id) => {
      if (id === testData.validUser.id) {
        return Promise.resolve(testData.validUser);
      } else if (id === testData.inactiveUser.id) {
        return Promise.resolve(testData.inactiveUser);
      }
      return Promise.resolve(null);
    });
    
    // Configure mock implementations for cache operations
    mockCacheService.get = jest.fn().mockImplementation((key) => {
      if (key === `refresh_token:${testData.refreshToken}`) {
        return Promise.resolve(testData.tokenData);
      } else if (key === `blacklist:${testData.refreshToken}`) {
        return Promise.resolve(null);
      } else if (key.startsWith('user_tokens:')) {
        return Promise.resolve([testData.refreshToken]);
      } else if (key.startsWith('login_metrics:')) {
        return Promise.resolve({
          lastAttempt: new Date().toISOString(),
          failedAttempts: 0,
          successfulLogins: 0
        });
      } else if (key.startsWith('blacklist:blacklisted-token')) {
        return Promise.resolve({ blacklistedAt: new Date().toISOString() });
      }
      return Promise.resolve(null);
    });
    
    mockCacheService.set = jest.fn().mockResolvedValue(undefined);
    mockCacheService.delete = jest.fn().mockResolvedValue(undefined);
    
    // Initialize AuthService instance with mocked dependencies
    authService = new AuthService(mockUserModel, mockCacheService, mockRateLimiter);
    
    // Setup environment variables for testing
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.ACCESS_TOKEN_EXPIRY = '900';  // 15 minutes
    process.env.REFRESH_TOKEN_EXPIRY = '604800';  // 7 days
    process.env.MAX_LOGIN_ATTEMPTS = '5';
    process.env.MAX_REFRESH_TOKENS_PER_USER = '5';
  });

  /**
   * Cleans up test environment after each test
   */
  afterEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset test data
    testData = null;
    
    // Clear environment variables
    delete process.env.JWT_SECRET;
    delete process.env.ACCESS_TOKEN_EXPIRY;
    delete process.env.REFRESH_TOKEN_EXPIRY;
    delete process.env.MAX_LOGIN_ATTEMPTS;
    delete process.env.MAX_REFRESH_TOKENS_PER_USER;
  });

  /**
   * Tests user login functionality with various scenarios
   */
  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      // Act
      const result = await authService.login(testData.validCredentials);
      
      // Assert
      expect(mockRateLimiter.tryRemoveTokens).toHaveBeenCalledWith(1, testData.validCredentials.email.toLowerCase());
      expect(mockUserModel.verifyPassword).toHaveBeenCalledWith(
        testData.validCredentials.email, 
        testData.validCredentials.password
      );
      expect(result).toEqual({
        accessToken: testData.accessToken,
        refreshToken: testData.refreshToken,
        expiresIn: 900
      });
      
      // Should store refresh token in cache
      expect(mockCacheService.set).toHaveBeenCalled();
    });
    
    it('should fail login with invalid password', async () => {
      // Act & Assert
      await expect(authService.login(testData.invalidCredentials))
        .rejects.toThrow(AUTH_ERRORS.INVALID_CREDENTIALS);
      
      expect(mockUserModel.verifyPassword).toHaveBeenCalledWith(
        testData.invalidCredentials.email, 
        testData.invalidCredentials.password
      );
      
      // Should update login metrics
      const updateMetricsSpy = jest.spyOn(authService as any, 'updateLoginMetrics');
      expect(updateMetricsSpy).toHaveBeenCalledWith(testData.invalidCredentials.email, false);
    });
    
    it('should fail login when user is inactive', async () => {
      // Arrange
      const inactiveCredentials = {
        email: 'inactive@example.com',
        password: 'Password123!'
      };
      mockUserModel.verifyPassword = jest.fn().mockResolvedValue(testData.inactiveUser);
      
      // Act & Assert
      await expect(authService.login(inactiveCredentials))
        .rejects.toThrow('Account is inactive or suspended');
      
      expect(mockUserModel.verifyPassword).toHaveBeenCalled();
    });
    
    it('should fail login when rate limit is exceeded', async () => {
      // Arrange
      mockRateLimiter.tryRemoveTokens = jest.fn().mockReturnValue(false);
      
      // Act & Assert
      await expect(authService.login(testData.validCredentials))
        .rejects.toThrow(SYSTEM_ERRORS.RATE_LIMIT_EXCEEDED);
      
      expect(mockRateLimiter.tryRemoveTokens).toHaveBeenCalled();
      expect(mockUserModel.verifyPassword).not.toHaveBeenCalled();
    });
    
    it('should validate input credentials', async () => {
      // Arrange
      const invalidInputs = [
        { email: '', password: 'password' },
        { email: 'test@example.com', password: '' },
        {},
        undefined,
        null
      ];
      
      // Act & Assert
      for (const input of invalidInputs) {
        await expect(authService.login(input as any))
          .rejects.toThrow('Email and password are required');
      }
    });
    
    it('should update login metrics on success', async () => {
      // Arrange
      const updateMetricsSpy = jest.spyOn(authService as any, 'updateLoginMetrics');
      
      // Act
      await authService.login(testData.validCredentials);
      
      // Assert
      expect(updateMetricsSpy).toHaveBeenCalledWith(testData.validUser.id, true);
    });
  });

  /**
   * Tests token refresh and validation operations
   */
  describe('token management', () => {
    it('should successfully refresh token', async () => {
      // Act
      const result = await authService.refreshToken(testData.refreshToken);
      
      // Assert
      expect(mockCacheService.get).toHaveBeenCalledWith(`refresh_token:${testData.refreshToken}`);
      expect(mockUserModel.findById).toHaveBeenCalledWith(testData.validUser.id);
      expect(result).toEqual({
        accessToken: testData.accessToken,
        refreshToken: testData.newRefreshToken,
        expiresIn: 900
      });
    });
    
    it('should reject invalid token formats', async () => {
      // Arrange
      const invalidTokens = [null, undefined, 123, {}, [], true, ''];
      
      // Act & Assert
      for (const token of invalidTokens) {
        await expect(authService.refreshToken(token as any))
          .rejects.toThrow(AUTH_ERRORS.TOKEN_INVALID);
      }
    });
    
    it('should reject blacklisted tokens', async () => {
      // Arrange
      const isBlacklistedSpy = jest.spyOn(authService as any, 'isTokenBlacklisted')
        .mockResolvedValue(true);
      
      // Act & Assert
      await expect(authService.refreshToken(testData.refreshToken))
        .rejects.toThrow(AUTH_ERRORS.TOKEN_INVALID);
      
      expect(isBlacklistedSpy).toHaveBeenCalledWith(testData.refreshToken);
    });
    
    it('should reject expired tokens', async () => {
      // Arrange
      mockCacheService.get = jest.fn().mockResolvedValue(null);
      
      // Act & Assert
      await expect(authService.refreshToken(testData.refreshToken))
        .rejects.toThrow(AUTH_ERRORS.TOKEN_EXPIRED);
    });
    
    it('should reject when user not found', async () => {
      // Arrange
      mockUserModel.findById = jest.fn().mockResolvedValue(null);
      
      // Act & Assert
      await expect(authService.refreshToken(testData.refreshToken))
        .rejects.toThrow(AUTH_ERRORS.USER_NOT_FOUND);
      
      expect(mockUserModel.findById).toHaveBeenCalledWith(testData.validUser.id);
    });
    
    it('should blacklist old token when refreshing', async () => {
      // Arrange
      const blacklistSpy = jest.spyOn(authService as any, 'blacklistToken');
      
      // Act
      await authService.refreshToken(testData.refreshToken);
      
      // Assert
      expect(blacklistSpy).toHaveBeenCalledWith(testData.refreshToken);
    });
    
    it('should store new refresh token when refreshing', async () => {
      // Arrange
      const storeSpy = jest.spyOn(authService as any, 'storeRefreshToken');
      
      // Act
      await authService.refreshToken(testData.refreshToken);
      
      // Assert
      expect(storeSpy).toHaveBeenCalledWith(testData.newRefreshToken, testData.validUser.id);
    });
    
    it('should check if token is blacklisted', async () => {
      // Act
      const isBlacklisted = await (authService as any).isTokenBlacklisted('blacklisted-token');
      const isNotBlacklisted = await (authService as any).isTokenBlacklisted(testData.refreshToken);
      
      // Assert
      expect(isBlacklisted).toBe(true);
      expect(isNotBlacklisted).toBe(false);
      expect(mockCacheService.get).toHaveBeenCalledWith('blacklist:blacklisted-token');
      expect(mockCacheService.get).toHaveBeenCalledWith(`blacklist:${testData.refreshToken}`);
    });
    
    it('should limit the number of concurrent refresh tokens per user', async () => {
      // Arrange
      const userId = testData.validUser.id;
      const existingTokens = ['token1', 'token2', 'token3', 'token4', 'token5', 'token6'];
      
      mockCacheService.get = jest.fn().mockImplementation((key) => {
        if (key === `user_tokens:${userId}`) {
          return Promise.resolve(existingTokens);
        }
        return Promise.resolve(null);
      });
      
      const storeToken = (authService as any).storeRefreshToken.bind(authService);
      const blacklistSpy = jest.spyOn(authService as any, 'blacklistToken');
      
      // Act
      await storeToken('new-token', userId);
      
      // Assert
      expect(blacklistSpy).toHaveBeenCalledWith('token1');
      expect(blacklistSpy).toHaveBeenCalledWith('token2');
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `user_tokens:${userId}`,
        ['token3', 'token4', 'token5', 'token6', 'new-token'],
        expect.any(Number)
      );
    });
  });

  /**
   * Tests password operations
   */
  describe('password operations', () => {
    // Note: resetPassword method is not implemented in the current AuthService
    it('should recognize that resetPassword is not implemented', () => {
      expect(typeof (authService as any).resetPassword).toBe('undefined');
    });
  });

  /**
   * Tests logout functionality
   */
  describe('logout', () => {
    it('should successfully logout', async () => {
      // Arrange
      const blacklistSpy = jest.spyOn(authService as any, 'blacklistToken');
      const cleanupSpy = jest.spyOn(authService as any, 'cleanupUserSessions');
      
      // Act
      await authService.logout(testData.refreshToken, testData.accessToken);
      
      // Assert
      expect(blacklistSpy).toHaveBeenCalledWith(testData.refreshToken);
      expect(blacklistSpy).toHaveBeenCalledWith(testData.accessToken);
      expect(mockCacheService.get).toHaveBeenCalledWith(`refresh_token:${testData.refreshToken}`);
      expect(mockCacheService.delete).toHaveBeenCalledWith(`refresh_token:${testData.refreshToken}`);
      expect(cleanupSpy).toHaveBeenCalledWith(testData.validUser.id, testData.refreshToken);
    });
    
    it('should require refresh token for logout', async () => {
      // Act & Assert
      await expect(authService.logout('', testData.accessToken))
        .rejects.toThrow('Refresh token is required for logout');
    });
    
    it('should handle access token being optional for logout', async () => {
      // Act
      await authService.logout(testData.refreshToken, '');
      
      // Assert
      const blacklistSpy = jest.spyOn(authService as any, 'blacklistToken');
      expect(blacklistSpy).toHaveBeenCalledWith(testData.refreshToken);
      expect(blacklistSpy).not.toHaveBeenCalledWith('');
    });
    
    it('should clean up user sessions during logout', async () => {
      // Arrange
      mockCacheService.get = jest.fn().mockImplementation((key) => {
        if (key === `refresh_token:${testData.refreshToken}`) {
          return Promise.resolve(testData.tokenData);
        } else if (key === `user_tokens:${testData.validUser.id}`) {
          return Promise.resolve([testData.refreshToken, 'other-token']);
        }
        return Promise.resolve(null);
      });
      
      // Act
      await authService.logout(testData.refreshToken, testData.accessToken);
      
      // Assert
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `user_tokens:${testData.validUser.id}`,
        ['other-token'],
        expect.any(Number)
      );
    });
    
    it('should remove user tokens tracking when no tokens remain', async () => {
      // Arrange
      mockCacheService.get = jest.fn().mockImplementation((key) => {
        if (key === `refresh_token:${testData.refreshToken}`) {
          return Promise.resolve(testData.tokenData);
        } else if (key === `user_tokens:${testData.validUser.id}`) {
          return Promise.resolve([testData.refreshToken]); // Only one token
        }
        return Promise.resolve(null);
      });
      
      // Act
      await authService.logout(testData.refreshToken, testData.accessToken);
      
      // Assert
      expect(mockCacheService.delete).toHaveBeenCalledWith(`user_tokens:${testData.validUser.id}`);
    });
  });

  /**
   * Tests error handling scenarios
   */
  describe('error handling', () => {
    it('should handle database connection errors during login', async () => {
      // Arrange
      mockUserModel.verifyPassword = jest.fn().mockRejectedValue(new Error('Database connection error'));
      
      // Act & Assert
      await expect(authService.login(testData.validCredentials))
        .rejects.toThrow('Database connection error');
    });
    
    it('should handle cache service failures during refresh token', async () => {
      // Arrange
      mockCacheService.get = jest.fn().mockRejectedValue(new Error('Redis connection error'));
      
      // Act & Assert
      await expect(authService.refreshToken(testData.refreshToken))
        .rejects.toThrow('Redis connection error');
    });
    
    it('should handle errors during logout', async () => {
      // Arrange
      mockCacheService.delete = jest.fn().mockRejectedValue(new Error('Cache error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Act & Assert
      await expect(authService.logout(testData.refreshToken, testData.accessToken))
        .rejects.toThrow('Cache error');
      
      expect(consoleSpy).toHaveBeenCalled();
    });
    
    it('should handle non-critical errors in updateLoginMetrics', async () => {
      // Arrange
      mockCacheService.get = jest.fn().mockRejectedValueOnce(new Error('Cache error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const updateLoginMetrics = (authService as any).updateLoginMetrics.bind(authService);
      
      // Act
      await updateLoginMetrics('test@example.com', false);
      
      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error updating login metrics:',
        expect.any(Error)
      );
    });
    
    it('should handle errors in cleanupUserSessions', async () => {
      // Arrange
      mockCacheService.get = jest.fn().mockImplementation((key) => {
        if (key === `refresh_token:${testData.refreshToken}`) {
          return Promise.resolve(testData.tokenData);
        }
        return Promise.reject(new Error('Cache error'));
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Act
      await authService.logout(testData.refreshToken, testData.accessToken);
      
      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error cleaning up user sessions:',
        expect.any(Error)
      );
    });
    
    it('should trigger security alerts for multiple failed login attempts', async () => {
      // Arrange
      mockCacheService.get = jest.fn().mockImplementation((key) => {
        if (key.startsWith('login_metrics:')) {
          return Promise.resolve({
            lastAttempt: new Date().toISOString(),
            failedAttempts: 4, // One more will trigger alert
            successfulLogins: 0
          });
        }
        return Promise.resolve(null);
      });
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const updateLoginMetrics = (authService as any).updateLoginMetrics.bind(authService);
      
      // Act
      await updateLoginMetrics('test@example.com', false);
      
      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('SECURITY ALERT: Multiple failed login attempts')
      );
    });
  });
});