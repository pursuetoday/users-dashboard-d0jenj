/**
 * Authentication Service
 * 
 * Service class that handles user authentication, token management, and password
 * operations with enhanced security features, Redis-based token management, and
 * comprehensive error handling.
 * 
 * Key features:
 * - JWT-based secure authentication with role-based access control
 * - Rate limiting for login attempts
 * - Token rotation and blacklisting
 * - Redis-based token storage
 * - Comprehensive security metrics
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid'; // ^9.0.0
import { TokenBucket } from 'token-bucket'; // ^2.0.0
import jwt from 'jsonwebtoken';

import { ILoginCredentials, IAuthTokens } from '../interfaces/auth.interface';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { UserModel } from '../models/user.model';
import { CacheService } from './cache.service';
import { AUTH_ERRORS, SYSTEM_ERRORS } from '../constants/error-messages';
import { UserRole } from '../interfaces/user.interface';

/**
 * Enhanced service class for user authentication with 
 * advanced token management and security features
 */
export class AuthService {
  private readonly userModel: UserModel;
  private readonly cacheService: CacheService;
  private readonly rateLimiter: TokenBucket;
  private readonly TOKEN_EXPIRY_ACCESS: number;
  private readonly TOKEN_EXPIRY_REFRESH: number;
  private readonly MAX_LOGIN_ATTEMPTS: number;

  /**
   * Initializes the AuthService with required dependencies and configurations
   * 
   * @param userModel - User model for database operations
   * @param cacheService - Cache service for token management
   * @param rateLimiter - Rate limiter for authentication attempts
   */
  constructor(userModel: UserModel, cacheService: CacheService, rateLimiter: TokenBucket) {
    this.userModel = userModel;
    this.cacheService = cacheService;
    this.rateLimiter = rateLimiter;
    
    // Set token expiration constants (in seconds)
    this.TOKEN_EXPIRY_ACCESS = parseInt(process.env.ACCESS_TOKEN_EXPIRY || '900', 10); // 15 minutes
    this.TOKEN_EXPIRY_REFRESH = parseInt(process.env.REFRESH_TOKEN_EXPIRY || '604800', 10); // 7 days
    
    // Set security configuration constants
    this.MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10);
    
    // Validate critical configurations in production
    if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
      console.error('CRITICAL: JWT_SECRET is not set in production environment!');
    }
  }

  /**
   * Authenticates user credentials with rate limiting and enhanced security
   * 
   * @param credentials - User login credentials (email and password)
   * @returns Access and refresh tokens with enhanced security
   * @throws Error if authentication fails or rate limit exceeded
   */
  async login(credentials: ILoginCredentials): Promise<IAuthTokens> {
    try {
      // Check rate limit for login attempts
      const identifier = credentials.email.toLowerCase();
      const hasTokens = this.rateLimiter.tryRemoveTokens(1, identifier);
      
      if (!hasTokens) {
        throw new Error(SYSTEM_ERRORS.RATE_LIMIT_EXCEEDED);
      }
      
      // Validate input credentials
      if (!credentials.email || !credentials.password) {
        throw new Error('Email and password are required');
      }
      
      // Find user by email using userModel
      const user = await this.userModel.verifyPassword(credentials.email, credentials.password);
      
      if (!user) {
        throw new Error(AUTH_ERRORS.INVALID_CREDENTIALS);
      }
      
      // Check if user is active
      if (!user.isActive) {
        throw new Error('Account is inactive or suspended');
      }
      
      // Generate access token with enhanced payload
      const now = Math.floor(Date.now() / 1000);
      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        iat: now,
        exp: now + this.TOKEN_EXPIRY_ACCESS
      };
      
      const jwtSecret = process.env.JWT_SECRET || 'default-jwt-secret-not-for-production';
      const accessToken = jwt.sign(payload, jwtSecret);
      
      // Generate secure refresh token using UUID
      const refreshToken = uuidv4();
      
      // Store refresh token in Redis with metadata
      await this.storeRefreshToken(refreshToken, user.id);
      
      // Update login metrics for security monitoring
      await this.updateLoginMetrics(user.id, true);
      
      // Return tokens with expiration for client-side management
      return {
        accessToken,
        refreshToken,
        expiresIn: this.TOKEN_EXPIRY_ACCESS
      };
    } catch (error) {
      // Update failed login metrics if email was provided
      if (credentials?.email) {
        await this.updateLoginMetrics(credentials.email, false);
      }
      
      // Re-throw error for consistent error handling upstream
      throw error;
    }
  }

  /**
   * Enhanced token refresh with rotation and blacklisting
   * 
   * @param refreshToken - Current refresh token
   * @returns New token pair with rotation
   * @throws Error if token is invalid or blacklisted
   */
  async refreshToken(refreshToken: string): Promise<IAuthTokens> {
    try {
      // Validate refresh token format
      if (!refreshToken || typeof refreshToken !== 'string') {
        throw new Error(AUTH_ERRORS.TOKEN_INVALID);
      }
      
      // Check token blacklist
      const isBlacklisted = await this.isTokenBlacklisted(refreshToken);
      if (isBlacklisted) {
        throw new Error(AUTH_ERRORS.TOKEN_INVALID);
      }
      
      // Verify token in Redis cache
      const tokenKey = `refresh_token:${refreshToken}`;
      const tokenData = await this.cacheService.get<{ userId: string }>(tokenKey);
      
      if (!tokenData) {
        throw new Error(AUTH_ERRORS.TOKEN_EXPIRED);
      }
      
      // Get user data to include in the new token
      const user = await this.userModel.findById(tokenData.userId);
      
      if (!user) {
        throw new Error(AUTH_ERRORS.USER_NOT_FOUND);
      }
      
      // Generate new access token
      const now = Math.floor(Date.now() / 1000);
      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        iat: now,
        exp: now + this.TOKEN_EXPIRY_ACCESS
      };
      
      const jwtSecret = process.env.JWT_SECRET || 'default-jwt-secret-not-for-production';
      const newAccessToken = jwt.sign(payload, jwtSecret);
      
      // Generate new refresh token
      const newRefreshToken = uuidv4();
      
      // Blacklist old refresh token
      await this.blacklistToken(refreshToken);
      
      // Store new refresh token
      await this.storeRefreshToken(newRefreshToken, user.id);
      
      // Return new token pair
      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: this.TOKEN_EXPIRY_ACCESS
      };
    } catch (error) {
      // Re-throw error for consistent error handling
      throw error;
    }
  }

  /**
   * Secure logout with token blacklisting
   * 
   * @param refreshToken - Refresh token to invalidate
   * @param accessToken - Access token to invalidate
   * @throws Error if token handling fails
   */
  async logout(refreshToken: string, accessToken: string): Promise<void> {
    try {
      // Validate tokens
      if (!refreshToken) {
        throw new Error('Refresh token is required for logout');
      }
      
      // Add refresh token to blacklist
      await this.blacklistToken(refreshToken);
      
      // Add access token to blacklist if provided
      if (accessToken) {
        await this.blacklistToken(accessToken);
      }
      
      // Clear user session data
      const tokenKey = `refresh_token:${refreshToken}`;
      const tokenData = await this.cacheService.get<{ userId: string }>(tokenKey);
      
      if (tokenData) {
        // Remove token from storage
        await this.cacheService.delete(tokenKey);
        
        // Log the successful logout for audit purposes
        console.info(`User ${tokenData.userId} logged out successfully`);
        
        // Cleanup any other user-specific session data if needed
        await this.cleanupUserSessions(tokenData.userId, refreshToken);
      }
    } catch (error) {
      // For logout, we may want to still proceed with partial operations
      // but still need to report the error
      console.error('Error during logout process:', error);
      throw error;
    }
  }

  /**
   * Stores a refresh token in Redis with user metadata
   * 
   * @param token - Refresh token to store
   * @param userId - Associated user ID
   * @returns Promise that resolves when token is stored
   * @private
   */
  private async storeRefreshToken(token: string, userId: string): Promise<void> {
    const tokenKey = `refresh_token:${token}`;
    const tokenData = {
      userId,
      createdAt: new Date().toISOString(),
      userAgent: process.env.USER_AGENT || 'unknown'
    };
    
    // Store token with configured TTL
    await this.cacheService.set(tokenKey, tokenData, this.TOKEN_EXPIRY_REFRESH);
    
    // Track active tokens per user for security monitoring and potential forced logout
    const userTokensKey = `user_tokens:${userId}`;
    const userTokens = await this.cacheService.get<string[]>(userTokensKey) || [];
    userTokens.push(token);
    
    // Limit the number of concurrent refresh tokens per user
    const maxTokensPerUser = parseInt(process.env.MAX_REFRESH_TOKENS_PER_USER || '5', 10);
    if (userTokens.length > maxTokensPerUser) {
      // Blacklist oldest tokens when limit is exceeded
      const tokensToRemove = userTokens.slice(0, userTokens.length - maxTokensPerUser);
      for (const oldToken of tokensToRemove) {
        await this.blacklistToken(oldToken);
      }
      
      // Keep only the most recent tokens within the limit
      userTokens.splice(0, userTokens.length - maxTokensPerUser);
    }
    
    // Update the user's active tokens list
    await this.cacheService.set(userTokensKey, userTokens, this.TOKEN_EXPIRY_REFRESH);
  }

  /**
   * Adds a token to blacklist to prevent reuse
   * 
   * @param token - Token to blacklist
   * @returns Promise that resolves when token is blacklisted
   * @private
   */
  private async blacklistToken(token: string): Promise<void> {
    const blacklistKey = `blacklist:${token}`;
    await this.cacheService.set(blacklistKey, { 
      blacklistedAt: new Date().toISOString() 
    }, this.TOKEN_EXPIRY_REFRESH);
  }

  /**
   * Checks if a token is in the blacklist
   * 
   * @param token - Token to check
   * @returns Whether token is blacklisted
   * @private
   */
  private async isTokenBlacklisted(token: string): Promise<boolean> {
    const blacklistKey = `blacklist:${token}`;
    const result = await this.cacheService.get(blacklistKey);
    return result !== null;
  }

  /**
   * Updates metrics for successful and failed login attempts
   * 
   * @param identifier - User ID or email
   * @param success - Whether login was successful
   * @private
   */
  private async updateLoginMetrics(identifier: string, success: boolean): Promise<void> {
    try {
      const metricsKey = `login_metrics:${identifier}`;
      
      const current = await this.cacheService.get<{
        lastLogin?: string;
        lastAttempt: string;
        failedAttempts: number;
        successfulLogins: number;
      }>(metricsKey) || { 
        lastAttempt: new Date().toISOString(),
        failedAttempts: 0, 
        successfulLogins: 0 
      };
      
      // Update login metrics based on success
      current.lastAttempt = new Date().toISOString();
      
      if (success) {
        current.lastLogin = current.lastAttempt;
        current.successfulLogins += 1;
        current.failedAttempts = 0; // Reset failed attempts on success
      } else {
        current.failedAttempts += 1;
      }
      
      // Store with longer TTL for security analysis
      await this.cacheService.set(metricsKey, current, 60 * 60 * 24 * 30); // 30 days
      
      // Security alerts for suspicious activity
      if (!success && current.failedAttempts >= this.MAX_LOGIN_ATTEMPTS) {
        console.warn(`SECURITY ALERT: Multiple failed login attempts (${current.failedAttempts}) for ${identifier}`);
        // TODO: In a production system, this could trigger additional security measures
      }
    } catch (error) {
      // Non-critical error, log but continue
      console.error('Error updating login metrics:', error);
    }
  }

  /**
   * Cleans up user sessions during logout
   * 
   * @param userId - User ID whose sessions to clean
   * @param currentToken - Current token being used for logout
   * @private
   */
  private async cleanupUserSessions(userId: string, currentToken: string): Promise<void> {
    try {
      const userTokensKey = `user_tokens:${userId}`;
      const userTokens = await this.cacheService.get<string[]>(userTokensKey) || [];
      
      // Remove the current token from the list
      const updatedTokens = userTokens.filter(token => token !== currentToken);
      
      // Update or remove the tracking key
      if (updatedTokens.length > 0) {
        await this.cacheService.set(userTokensKey, updatedTokens, this.TOKEN_EXPIRY_REFRESH);
      } else {
        await this.cacheService.delete(userTokensKey);
      }
    } catch (error) {
      // Log but don't fail the logout process
      console.error('Error cleaning up user sessions:', error);
    }
  }
}