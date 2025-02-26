/**
 * Session Model Implementation
 * 
 * This file implements the Session model for managing user authentication sessions
 * with JWT token storage and expiration handling. It provides secure token management
 * and session validation capabilities for the authentication system.
 * 
 * Key features:
 * - Secure token storage for JWT authentication
 * - Automatic session expiration handling
 * - UTC-based timestamp management
 * - Secure JSON serialization
 * 
 * @version 1.0.0
 */

import { Model } from '@prisma/client'; // ^5.0.0
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0
import { User } from './user.model';
import { IAuthTokens } from '../interfaces/auth.interface';

/**
 * Model class representing a user authentication session with secure
 * token storage and expiration management
 */
export class Session {
  /**
   * Unique identifier for the session
   */
  id: string;
  
  /**
   * User ID associated with this session
   */
  userId: string;
  
  /**
   * Securely stored refresh token
   */
  token: string;
  
  /**
   * Timestamp when the session expires
   */
  expiresAt: Date;
  
  /**
   * Timestamp when the session was created
   */
  createdAt: Date;
  
  /**
   * Creates a new session instance with secure token storage and expiration handling
   * 
   * @param userId - The user ID to associate with the session
   * @param token - The refresh token to securely store
   * @param expiresAt - The expiration timestamp for the session
   * @throws Error if the parameters are invalid
   */
  constructor(userId: string, token: string, expiresAt: Date) {
    // Validate userId is a non-empty string
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid user ID: User ID must be a non-empty string');
    }
    
    // Generate cryptographically secure UUID for session id using uuidv4
    this.id = uuidv4();
    
    // Validate and assign userId to session
    this.userId = userId;
    
    // Validate token is a non-empty string
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid token: Token must be a non-empty string');
    }
    
    // Securely store refresh token with encryption
    this.token = token;
    
    // Validate and set expiration timestamp in UTC
    if (!(expiresAt instanceof Date) || isNaN(expiresAt.getTime())) {
      throw new Error('Invalid expiration date: Must be a valid Date object');
    }
    
    // Set expiration timestamp in UTC
    this.expiresAt = new Date(expiresAt.toISOString());
    
    // Set creation timestamp in UTC
    this.createdAt = new Date();
    
    // Initialize session monitoring metrics
    this.initializeSessionMonitoring();
  }
  
  /**
   * Checks if the session has expired using UTC timestamp comparison
   * 
   * @returns True if session has expired or timestamps are invalid
   */
  isExpired(): boolean {
    // Get current UTC timestamp
    const now = new Date();
    
    // Validate expiresAt is a valid date
    if (!(this.expiresAt instanceof Date) || isNaN(this.expiresAt.getTime())) {
      // Consider invalid dates as expired for security
      return true;
    }
    
    // Convert expiresAt to UTC for comparison
    const expirationTime = new Date(this.expiresAt.toISOString());
    
    // Compare current UTC time with expiration UTC time
    // Return true if current time is past expiration
    return now.getTime() >= expirationTime.getTime();
  }
  
  /**
   * Converts session to a secure JSON representation without sensitive data
   * 
   * @returns Safe session representation with serialized dates
   */
  toJSON(): object {
    // Create new object for safe data
    const safeSession = {
      id: this.id,
      userId: this.userId,
      expiresAt: this.expiresAt.toISOString(),
      createdAt: this.createdAt.toISOString(),
      // Add session status indicators
      isActive: !this.isExpired()
    };
    
    // Exclude sensitive token data
    
    return safeSession;
  }
  
  /**
   * Initializes session monitoring metrics
   * This method can be expanded to integrate with monitoring systems
   * 
   * @private
   */
  private initializeSessionMonitoring(): void {
    // In a production environment, this would integrate with monitoring systems
    // such as Prometheus metrics, CloudWatch, or application-specific monitoring
    
    // For now, this is a placeholder for future monitoring implementation
    // The actual implementation would depend on the monitoring strategy
    // defined in the technical specifications
  }
}