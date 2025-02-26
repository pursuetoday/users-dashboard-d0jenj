/**
 * Authentication configuration module that defines JWT token settings, 
 * expiration times, and other authentication-related parameters
 * for the application with enhanced security validation and type safety.
 * 
 * @module config/auth
 * @version 1.0.0
 */

import { config } from 'dotenv'; // ^16.0.0
import { AuthConfig } from '../interfaces/config.interface';

// Load environment variables
config();

/**
 * Validates the format and value of token expiration strings
 * Ensures that expiration values follow the format: number + unit (e.g., '15m', '7d')
 * 
 * @param {string} expiration - Token expiration string to validate
 * @returns {boolean} True if the expiration format is valid
 */
export function validateTokenExpiration(expiration: string): boolean {
  // Check if the string matches pattern: number + time unit (m, h, d)
  const expirationPattern = /^(\d+)([mhd])$/;
  const match = expiration.match(expirationPattern);
  
  if (!match) {
    return false;
  }
  
  const [, valueStr, unit] = match;
  const value = parseInt(valueStr, 10);
  
  // Value must be positive
  if (value <= 0) {
    return false;
  }
  
  // Unit must be valid (m = minutes, h = hours, d = days)
  if (!['m', 'h', 'd'].includes(unit)) {
    return false;
  }
  
  return true;
}

/**
 * Validates that the JWT secret meets security requirements
 * Ensures the secret has sufficient length and complexity for security
 * 
 * @param {string} secret - JWT secret to validate
 * @returns {boolean} True if the secret meets security requirements
 */
export function validateJwtSecret(secret?: string): boolean {
  if (!secret) {
    return false;
  }
  
  // Secret should be at least 32 characters for adequate security
  if (secret.length < 32) {
    return false;
  }
  
  // Check for entropy - secret should contain a mix of character types
  const hasUppercase = /[A-Z]/.test(secret);
  const hasLowercase = /[a-z]/.test(secret);
  const hasNumbers = /[0-9]/.test(secret);
  const hasSpecial = /[^A-Za-z0-9]/.test(secret);
  
  // Require at least 3 of the 4 character types for strong entropy
  const entropyScore = [hasUppercase, hasLowercase, hasNumbers, hasSpecial]
    .filter(Boolean).length;
    
  return entropyScore >= 3;
}

// Default values with fallbacks
const DEFAULT_ACCESS_TOKEN_EXPIRATION = '15m';   // 15 minutes
const DEFAULT_REFRESH_TOKEN_EXPIRATION = '7d';   // 7 days
const DEFAULT_PASSWORD_HASH_ROUNDS = 12;         // Recommended for bcrypt
const DEFAULT_TOKEN_ISSUER = 'user-management-dashboard';
const DEFAULT_TOKEN_AUDIENCE = ['user-management-api'];

// Get JWT secret from environment variables
const jwtSecret = process.env.JWT_SECRET;

// Validate JWT secret
if (!jwtSecret || !validateJwtSecret(jwtSecret)) {
  throw new Error(
    'Invalid JWT_SECRET in environment variables. ' +
    'Secret must be at least 32 characters long and contain a mix of character types.'
  );
}

// Get token expiration settings with fallbacks
const accessTokenExpiration = process.env.ACCESS_TOKEN_EXPIRATION || DEFAULT_ACCESS_TOKEN_EXPIRATION;
const refreshTokenExpiration = process.env.REFRESH_TOKEN_EXPIRATION || DEFAULT_REFRESH_TOKEN_EXPIRATION;

// Validate token expiration formats
if (!validateTokenExpiration(accessTokenExpiration)) {
  throw new Error(
    `Invalid ACCESS_TOKEN_EXPIRATION format: "${accessTokenExpiration}". ` +
    'Must be in format: number + unit (e.g., 15m, 1h, 7d).'
  );
}

if (!validateTokenExpiration(refreshTokenExpiration)) {
  throw new Error(
    `Invalid REFRESH_TOKEN_EXPIRATION format: "${refreshTokenExpiration}". ` +
    'Must be in format: number + unit (e.g., 15m, 1h, 7d).'
  );
}

// Get password hash rounds, with validation
const passwordHashRoundsStr = process.env.PASSWORD_HASH_ROUNDS || `${DEFAULT_PASSWORD_HASH_ROUNDS}`;
const passwordHashRounds = parseInt(passwordHashRoundsStr, 10);

if (isNaN(passwordHashRounds) || passwordHashRounds < 10) {
  throw new Error(
    `Invalid PASSWORD_HASH_ROUNDS: "${passwordHashRoundsStr}". ` +
    'Must be a number greater than or equal to 10 for security.'
  );
}

// Get token issuer and audience
const tokenIssuer = process.env.TOKEN_ISSUER || DEFAULT_TOKEN_ISSUER;
const tokenAudienceStr = process.env.TOKEN_AUDIENCE || DEFAULT_TOKEN_AUDIENCE.join(',');
const tokenAudience = tokenAudienceStr.split(',').map(audience => audience.trim());

if (tokenAudience.length === 0) {
  throw new Error('TOKEN_AUDIENCE must contain at least one audience.');
}

/**
 * Authentication configuration object implementing AuthConfig interface
 * Contains validated JWT and authentication settings loaded from environment variables
 */
export const authConfig: AuthConfig = {
  jwtSecret,
  accessTokenExpiration,
  refreshTokenExpiration,
  passwordHashRounds,
  tokenIssuer,
  tokenAudience
};

export default authConfig;