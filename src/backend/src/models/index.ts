/**
 * Model Barrel File
 * 
 * This file serves as a centralized access point for all database models in the application.
 * It exports all model classes to provide a single import location for modules that need
 * to access multiple models, improving code organization and maintainability.
 * 
 * The exported models implement the database schema defined in the system architecture,
 * including Users, Sessions, and AuditLogs as specified in the database design section.
 * 
 * @version 1.0.0
 */

// Import model classes from individual files
import { AuditLog } from './audit-log.model';
import { Session } from './session.model';
import { UserModel } from './user.model';

// Re-export model classes for centralized access
export { 
  // Re-export AuditLog model for tracking system changes
  AuditLog,
  
  // Re-export Session model for managing user authentication sessions
  Session,
  
  // Re-export UserModel for database operations and business logic
  UserModel
};