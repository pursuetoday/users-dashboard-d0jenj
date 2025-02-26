/**
 * Role-based Access Control (RBAC) Constants
 * 
 * This file defines the authorization constants used throughout the application,
 * implementing a comprehensive role-based permissions system with hierarchical
 * access control and granular permission definitions.
 * 
 * The system uses:
 * - Role constants: Basic role identifiers
 * - Permission hierarchy: Detailed permission mapping for each role
 * - Permission types: Standard operation categories
 * 
 * @version 1.0.0
 */

/**
 * Core role definitions used for user authorization.
 * These immutable role identifiers represent the different access levels in the system.
 */
export const ROLES = {
  /**
   * Administrator role with full system access
   */
  ADMIN: 'admin',
  
  /**
   * Manager role with elevated access to manage users
   * but restricted from system-wide configuration
   */
  MANAGER: 'manager',
  
  /**
   * Standard user with access to own data and limited
   * view access to other users
   */
  USER: 'user',
  
  /**
   * Limited access for unauthenticated or restricted users
   * with access only to public information
   */
  GUEST: 'guest'
} as const;

/**
 * Type definition for role values to ensure type safety
 */
export type RoleType = typeof ROLES[keyof typeof ROLES];

/**
 * Permission hierarchy that defines which permissions each role has.
 * This establishes a granular permission system where:
 * 
 * - '*' represents full system access
 * - Format 'resource.operation' defines specific permissions
 * - '.self' suffix indicates permissions limited to own resources
 * - '.public' suffix indicates permissions limited to public data
 */
export const ROLE_HIERARCHY = {
  /**
   * Admin role has unrestricted access to all system resources
   * represented by the wildcard permission '*'
   */
  ADMIN: ['*'],
  
  /**
   * Manager role has broad access to user management with
   * ability to read, write, and delete user records
   */
  MANAGER: [
    'user.read',     // View all users
    'user.write',    // Edit all users
    'user.delete',   // Delete users
    'profile.read',  // View all profiles
    'profile.write', // Edit all profiles
    'settings.read'  // View system settings
  ],
  
  /**
   * Standard user role has permissions primarily for their own data
   * and limited read access to other users
   */
  USER: [
    'user.read',         // View users (basic info)
    'user.write.self',   // Edit own user data
    'profile.read.self', // View own profile
    'profile.write.self', // Edit own profile
    'settings.read.self' // View own settings
  ],
  
  /**
   * Guest role has minimal access to public information only
   */
  GUEST: [
    'user.read.public',   // View public user info
    'profile.read.public' // View public profiles
  ]
} as const;

/**
 * Default role assigned to newly created users
 */
export const DEFAULT_ROLE = 'user' as const;

/**
 * Standard permission operation types used throughout the application
 * These define the basic operations that can be performed on resources
 */
export const PERMISSION_TYPES = {
  /**
   * Permission to view or access information
   */
  READ: 'read',
  
  /**
   * Permission to create or modify information
   */
  WRITE: 'write',
  
  /**
   * Permission to remove information
   */
  DELETE: 'delete',
  
  /**
   * Permission to perform administrative operations
   */
  MANAGE: 'manage'
} as const;

/**
 * Type definition for permission types to ensure type safety
 */
export type PermissionType = typeof PERMISSION_TYPES[keyof typeof PERMISSION_TYPES];