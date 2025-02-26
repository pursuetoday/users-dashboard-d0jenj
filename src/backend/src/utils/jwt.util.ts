/**
 * JWT Utility Module
 * 
 * Provides comprehensive JWT token generation, verification and management
 * functionality with enhanced security features for the authentication system.
 * 
 * This module implements secure cryptographic token handling with strict validation
 * and robust error handling to ensure token integrity and security.
 * 
 * @module utils/jwt
 * @version 1.0.0
 */

import { sign, verify, decode, JsonWebTokenError, TokenExpiredError, NotBeforeError } from 'jsonwebtoken'; // ^9.0.0
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { authConfig } from '../config/auth.config';
import { AuthenticationError } from './error.util';
import { AUTH_ERRORS } from '../constants/error-messages';

/**
 * Generates a secure JWT token with comprehensive payload validation
 * and enhanced security features.
 * 
 * @param {JwtPayload} payload - The payload to include in the token
 * @returns {string} - Cryptographically signed JWT token with defined expiration
 * @throws {AuthenticationError} - If payload validation fails
 */
export function generateToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  try {
    // Validate required payload fields
    if (!payload.sub || !payload.email || !payload.role) {
      throw new AuthenticationError(AUTH_ERRORS.TOKEN_INVALID, {
        message: 'Missing required fields in token payload'
      });
    }

    // Validate payload values
    if (typeof payload.sub !== 'string' || !payload.sub.trim()) {
      throw new AuthenticationError(AUTH_ERRORS.TOKEN_INVALID, {
        message: 'Invalid subject format'
      });
    }

    if (typeof payload.email !== 'string' || !payload.email.includes('@')) {
      throw new AuthenticationError(AUTH_ERRORS.TOKEN_INVALID, {
        message: 'Invalid email format'
      });
    }

    // Create token with security features
    const token = sign(
      {
        ...payload,
        // Add current timestamp for token tracking
        iat: Math.floor(Date.now() / 1000),
      },
      authConfig.jwtSecret,
      {
        expiresIn: authConfig.accessTokenExpiration,
        algorithm: 'HS256' // HMAC with SHA-256
      }
    );

    // Verify token format
    if (!token || typeof token !== 'string') {
      throw new AuthenticationError(AUTH_ERRORS.TOKEN_INVALID, {
        message: 'Failed to generate valid token'
      });
    }

    return token;
  } catch (error) {
    // Enhanced error handling
    if (error instanceof AuthenticationError) {
      throw error;
    }
    
    // Handle specific JWT errors
    if (error instanceof JsonWebTokenError) {
      throw new AuthenticationError(AUTH_ERRORS.TOKEN_INVALID, {
        message: 'Token generation failed',
        error: error.message
      });
    }

    // Handle unexpected errors
    throw new AuthenticationError(AUTH_ERRORS.UNAUTHORIZED, {
      message: 'Token generation failed due to an unexpected error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Performs comprehensive verification and validation of JWT tokens
 * with enhanced security checks.
 * 
 * @param {string} token - JWT token to verify
 * @returns {JwtPayload} - Verified and decoded token payload with type safety
 * @throws {AuthenticationError} - If token is invalid, expired, or tampered
 */
export function verifyToken(token: string): JwtPayload {
  try {
    // Validate token format
    if (!token || typeof token !== 'string') {
      throw new AuthenticationError(AUTH_ERRORS.TOKEN_MISSING, {
        message: 'Token must be a non-empty string'
      });
    }

    // Check token structure (header.payload.signature)
    if (!token.match(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/)) {
      throw new AuthenticationError(AUTH_ERRORS.TOKEN_INVALID, {
        message: 'Token format is invalid'
      });
    }

    // Verify token with full validation
    const decoded = verify(token, authConfig.jwtSecret, {
      algorithms: ['HS256'], // Restrict to secure algorithm
      complete: true,       // Return decoded payload and header
    });

    // Extract and validate payload
    const payload = decoded.payload as JwtPayload;

    // Validate required fields
    if (!payload.sub || !payload.email || !payload.role || !payload.iat || !payload.exp) {
      throw new AuthenticationError(AUTH_ERRORS.TOKEN_INVALID, {
        message: 'Token payload is missing required fields'
      });
    }

    return payload;
  } catch (error) {
    // Handle specific verification errors with appropriate responses
    if (error instanceof TokenExpiredError) {
      throw new AuthenticationError(AUTH_ERRORS.TOKEN_EXPIRED, {
        message: 'Token has expired',
        expiredAt: error.expiredAt
      });
    }

    if (error instanceof JsonWebTokenError) {
      throw new AuthenticationError(AUTH_ERRORS.TOKEN_INVALID, {
        message: 'Invalid token',
        error: error.message
      });
    }

    if (error instanceof NotBeforeError) {
      throw new AuthenticationError(AUTH_ERRORS.TOKEN_INVALID, {
        message: 'Token not yet valid',
        date: error.date
      });
    }

    if (error instanceof AuthenticationError) {
      throw error;
    }

    // Handle unexpected errors
    throw new AuthenticationError(AUTH_ERRORS.UNAUTHORIZED, {
      message: 'Token verification failed due to an unexpected error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Safely decodes JWT tokens without signature verification
 * for non-critical operations.
 * 
 * WARNING: Since this doesn't verify the signature, it should only be used
 * for non-sensitive operations where token authenticity isn't critical.
 * 
 * @param {string} token - JWT token to decode
 * @returns {JwtPayload} - Decoded token payload with type safety
 * @throws {AuthenticationError} - If decoding fails
 */
export function decodeToken(token: string): JwtPayload {
  try {
    // Validate basic token format
    if (!token || typeof token !== 'string') {
      throw new AuthenticationError(AUTH_ERRORS.TOKEN_MISSING, {
        message: 'Token must be a non-empty string'
      });
    }

    // Check token structure integrity
    if (!token.match(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/)) {
      throw new AuthenticationError(AUTH_ERRORS.TOKEN_INVALID, {
        message: 'Token format is invalid'
      });
    }

    // Decode token without verification
    const decoded = decode(token, { complete: true });

    if (!decoded || typeof decoded === 'string') {
      throw new AuthenticationError(AUTH_ERRORS.TOKEN_INVALID, {
        message: 'Failed to decode token'
      });
    }

    // Extract payload
    const payload = decoded.payload as JwtPayload;

    // Validate payload structure
    if (!payload.sub || !payload.email || !payload.role) {
      throw new AuthenticationError(AUTH_ERRORS.TOKEN_INVALID, {
        message: 'Decoded token missing required fields'
      });
    }

    return payload;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    throw new AuthenticationError(AUTH_ERRORS.TOKEN_INVALID, {
      message: 'Token decoding failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}