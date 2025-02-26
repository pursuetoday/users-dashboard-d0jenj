/**
 * Audit Log Model
 * 
 * Provides comprehensive tracking of user actions and system changes with enhanced
 * security features, including sensitive data masking, immutable storage,
 * retention policies, and proper data relationships.
 * 
 * The model ensures:
 * - Immutable audit trail of all system operations
 * - 90-day retention policy with automated expiration tracking
 * - Proper masking of sensitive data
 * - Typed action categories for consistent audit records
 * 
 * @version 1.0.0
 */

import { Prisma } from '@prisma/client'; // ^5.0.0
import { IUser } from '../interfaces/user.interface';

/**
 * Defines the types of actions that can be audited
 * Each action represents a specific operation category in the system
 */
export enum ActionType {
  /**
   * User authentication actions
   */
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_FAILED_LOGIN = 'USER_FAILED_LOGIN',
  PASSWORD_RESET = 'PASSWORD_RESET',
  
  /**
   * User record modifications
   */
  USER_CREATE = 'USER_CREATE',
  USER_UPDATE = 'USER_UPDATE',
  USER_DELETE = 'USER_DELETE',
  
  /**
   * Role and permission changes
   */
  ROLE_CHANGE = 'ROLE_CHANGE',
  PERMISSION_CHANGE = 'PERMISSION_CHANGE',
  
  /**
   * System operations
   */
  SYSTEM_CONFIGURE = 'SYSTEM_CONFIGURE',
  SYSTEM_MAINTENANCE = 'SYSTEM_MAINTENANCE',
  
  /**
   * Data access operations
   */
  DATA_EXPORT = 'DATA_EXPORT',
  DATA_IMPORT = 'DATA_IMPORT',
  DATA_ACCESS = 'DATA_ACCESS',
  
  /**
   * Security monitoring
   */
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  SECURITY_ALERT = 'SECURITY_ALERT'
}

/**
 * Enhanced model class representing an immutable audit log entry with
 * retention policies and security features
 */
export class AuditLog {
  /**
   * Unique identifier for the audit log entry
   */
  id: string;
  
  /**
   * Reference to the user who performed the action
   */
  userId: string;
  
  /**
   * Type of action performed
   */
  actionType: ActionType;
  
  /**
   * Recorded changes in JSON format
   * Contains before/after state for update operations
   */
  changes: Prisma.JsonValue;
  
  /**
   * Timestamp when the action was performed
   */
  createdAt: Date;
  
  /**
   * Date when this audit log entry can be archived or deleted
   * Calculated as createdAt + 90 days (retention policy)
   */
  retentionDate: Date;
  
  /**
   * Additional metadata about the action
   * May include IP address, browser info, etc.
   */
  metadata: Prisma.JsonValue;
  
  /**
   * Flag indicating if the audit data is stored with encryption
   */
  isEncrypted: boolean;
  
  /**
   * Reference to the user object (populated on demand)
   */
  user?: IUser;
  
  /**
   * Creates a new audit log instance with enhanced validation and security features
   * 
   * @param userId The ID of the user who performed the action
   * @param actionType The type of action performed
   * @param changes Record of changes made in the action
   * @param metadata Additional context data about the action
   */
  constructor(
    userId: string,
    actionType: ActionType,
    changes: Record<string, any>,
    metadata: Record<string, any> = {}
  ) {
    // Validate input parameters and action type
    if (!userId) {
      throw new Error('User ID is required for audit logging');
    }
    
    if (!Object.values(ActionType).includes(actionType)) {
      throw new Error(`Invalid action type: ${actionType}`);
    }
    
    // Initialize audit log properties
    this.id = ''; // This will be set by the database
    this.userId = userId;
    this.actionType = actionType;
    
    // Sanitize and mask sensitive data in changes
    this.changes = this.maskSensitiveData(changes);
    
    // Set creation timestamp
    this.createdAt = new Date();
    
    // Calculate retention date (90 days from creation)
    this.retentionDate = new Date(this.createdAt);
    this.retentionDate.setDate(this.retentionDate.getDate() + 90);
    
    // Set metadata with additional security information
    this.metadata = {
      ...metadata,
      timestamp: new Date().toISOString(),
      actionCategory: this.getActionCategory(actionType)
    };
    
    // Apply encryption if required
    this.isEncrypted = this.shouldEncrypt(actionType, changes);
    
    // Validate immutability constraints
    Object.freeze(this.changes); // Make changes immutable
  }
  
  /**
   * Converts audit log to a secure JSON representation with masked sensitive data
   * 
   * @returns Sanitized JSON representation of audit log
   */
  toJSON(): Record<string, any> {
    return {
      id: this.id,
      userId: this.userId,
      actionType: this.actionType,
      changes: this.changes,
      createdAt: this.createdAt.toISOString(),
      retentionDate: this.retentionDate.toISOString(),
      metadata: this.metadata,
      isEncrypted: this.isEncrypted
    };
  }
  
  /**
   * Checks if the audit log has exceeded its retention period
   * 
   * @returns True if retention period has expired
   */
  isRetentionExpired(): boolean {
    const now = new Date();
    
    // Consider legal hold status from metadata if present
    const metadata = this.metadata as Record<string, any>;
    if (metadata?.legalHold === true) {
      return false; // Records on legal hold don't expire
    }
    
    return now > this.retentionDate;
  }
  
  /**
   * Applies masking rules to sensitive data in changes
   * 
   * @param data The data object to mask
   * @returns Masked data object
   */
  private maskSensitiveData(data: Record<string, any>): Record<string, any> {
    // Create a deep copy to avoid modifying the original
    const maskedData = JSON.parse(JSON.stringify(data));
    
    // Identify sensitive fields that require masking
    const sensitiveFields = [
      'password', 
      'passwordHash', 
      'token', 
      'secret',
      'creditCard',
      'ssn',
      'apiKey'
    ];
    
    // Apply masking rules with recursive function for nested objects
    const applyMasking = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      
      Object.keys(obj).forEach(key => {
        if (sensitiveFields.includes(key)) {
          // Mask sensitive values but preserve field presence for audit integrity
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          // Recursively process nested objects
          applyMasking(obj[key]);
        }
      });
    };
    
    applyMasking(maskedData);
    return maskedData;
  }
  
  /**
   * Determines the high-level category of an action type
   * Used for metadata and reporting
   * 
   * @param actionType The action type to categorize
   * @returns Category name
   */
  private getActionCategory(actionType: ActionType): string {
    if (actionType.startsWith('USER_')) {
      return 'User Management';
    } else if (actionType.includes('LOGIN') || actionType.includes('LOGOUT')) {
      return 'Authentication';
    } else if (actionType.startsWith('SYSTEM_')) {
      return 'System Administration';
    } else if (actionType.startsWith('DATA_')) {
      return 'Data Operations';
    } else if (actionType.includes('SECURITY') || actionType.includes('UNAUTHORIZED')) {
      return 'Security Events';
    }
    
    return 'Other';
  }
  
  /**
   * Determines if a particular audit record should be encrypted
   * based on action type and content
   * 
   * @param actionType The type of action
   * @param changes The changes being recorded
   * @returns True if encryption should be applied
   */
  private shouldEncrypt(actionType: ActionType, changes: Record<string, any>): boolean {
    // Encrypt security-related events
    if (
      actionType === ActionType.UNAUTHORIZED_ACCESS ||
      actionType === ActionType.SECURITY_ALERT ||
      actionType === ActionType.USER_FAILED_LOGIN
    ) {
      return true;
    }
    
    // Encrypt records with potentially sensitive data
    if (
      actionType === ActionType.DATA_EXPORT ||
      actionType === ActionType.USER_CREATE ||
      actionType === ActionType.PASSWORD_RESET
    ) {
      return true;
    }
    
    // Encrypt if changes contain sensitive fields
    const hasSensitiveData = Object.keys(changes).some(key => 
      key.toLowerCase().includes('password') ||
      key.toLowerCase().includes('secret') ||
      key.toLowerCase().includes('token')
    );
    
    return hasSensitiveData;
  }
}