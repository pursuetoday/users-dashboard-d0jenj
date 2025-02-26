/**
 * User Model Implementation
 * 
 * This file implements the core User model using Prisma ORM with enhanced security features
 * including field-level encryption, password hashing, and role-based access control.
 * 
 * Key features:
 * - Type-safe database operations using Prisma ORM
 * - Field-level encryption for sensitive data
 * - Password hashing using bcrypt
 * - Role-based access control for user management
 * - Cursor-based pagination for efficient data retrieval
 * 
 * @version 1.0.0
 */

import { PrismaClient } from '@prisma/client'; // ^5.0.0
import bcrypt from 'bcrypt'; // ^5.1.0
import crypto from 'crypto'; // ^1.0.1
import { IUser, UserRole } from '../interfaces/user.interface';
import { ROLES } from '../constants/roles';

/**
 * Configuration for encryption operations
 */
interface EncryptionConfig {
  algorithm: string;
  secretKey: Buffer;
  iv: Buffer;
}

/**
 * User model class implementing secure database operations and business logic
 * for user management with field-level encryption and role-based access control
 */
export class UserModel {
  /**
   * Prisma client instance for database operations
   */
  private prisma: PrismaClient;
  
  /**
   * Encryption configuration for field-level encryption
   */
  private encryptionConfig: EncryptionConfig;

  /**
   * Fields that should be encrypted in the database
   * Protects PII data in accordance with data protection requirements
   */
  private readonly ENCRYPTED_FIELDS = ['email', 'firstName', 'lastName'];

  /**
   * Number of salt rounds for bcrypt password hashing
   * Using 12 rounds as specified in the security requirements (7.2 Data Security)
   */
  private readonly BCRYPT_SALT_ROUNDS = 12;

  /**
   * Initializes the UserModel with Prisma client instance and encryption settings
   * 
   * @param prisma - Prisma client instance for database operations
   */
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    
    // Configure encryption using environment variables
    // In a production environment, these should be securely stored in a vault/secret manager
    const encryptionKey = process.env.ENCRYPTION_KEY || 'default-secure-encryption-key-32chars';
    const encryptionIv = process.env.ENCRYPTION_IV || 'secure-iv-16chars';
    
    this.encryptionConfig = {
      algorithm: 'aes-256-cbc', // AES-256 as specified in security requirements
      secretKey: Buffer.from(encryptionKey),
      iv: Buffer.from(encryptionIv.slice(0, 16))
    };
  }

  /**
   * Creates a new user with encrypted sensitive data and hashed password
   * 
   * @param userData - User data to create new user
   * @returns Promise resolving to created user with sensitive data filtered
   * @throws Error if validation fails or database operation fails
   */
  async create(userData: IUser): Promise<IUser> {
    try {
      // Validate required fields
      this.validateUserData(userData);
      
      // Hash password using bcrypt
      const hashedPassword = await this.hashPassword(userData.password);
      
      // Encrypt sensitive fields
      const encryptedData = this.encryptSensitiveFields(userData);
      
      // Create user record with Prisma transaction for atomicity
      const user = await this.prisma.$transaction(async (tx) => {
        // Check for duplicate email (using encrypted value)
        const existingUser = await tx.user.findUnique({
          where: { email: encryptedData.email }
        });
        
        if (existingUser) {
          throw new Error('Email already exists');
        }
        
        // Create user with encrypted data and hashed password
        return tx.user.create({
          data: {
            ...encryptedData,
            password: hashedPassword,
            role: userData.role,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      });
      
      // Decrypt sensitive fields for response
      const decryptedUser = this.decryptSensitiveFields(user);
      
      // Filter out password for security
      const { password, ...userWithoutPassword } = decryptedUser;
      
      return userWithoutPassword as IUser;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error creating user: ${error.message}`);
      }
      throw new Error('Unknown error occurred while creating user');
    }
  }

  /**
   * Finds a user by ID and decrypts sensitive data
   * 
   * @param id - User ID to find
   * @returns Promise resolving to found user with decrypted data or null
   * @throws Error if ID is invalid or database operation fails
   */
  async findById(id: string): Promise<IUser | null> {
    try {
      // Validate ID format
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid user ID');
      }
      
      // Query user by ID
      const user = await this.prisma.user.findUnique({
        where: { id }
      });
      
      // Return null if user not found
      if (!user) {
        return null;
      }
      
      // Decrypt sensitive fields
      const decryptedUser = this.decryptSensitiveFields(user);
      
      // Filter out password for security
      const { password, ...userWithoutPassword } = decryptedUser;
      
      return userWithoutPassword as IUser;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error finding user: ${error.message}`);
      }
      throw new Error('Unknown error occurred while finding user');
    }
  }

  /**
   * Retrieves users with pagination, filtering, and role-based access
   * Implements cursor-based pagination for optimal performance with large datasets
   * 
   * @param options - Query options including pagination, filters, and cursors
   * @returns Promise resolving to paginated users with total count and cursor
   * @throws Error if validation fails or database operation fails
   */
  async findAll(options: {
    page?: number;
    limit?: number;
    role?: string;
    isActive?: boolean;
    cursor?: string;
  }): Promise<{ users: IUser[]; total: number; nextCursor?: string }> {
    try {
      // Default pagination values
      const page = options.page || 1;
      const limit = options.limit || 10;
      
      // Build filter conditions
      const where: any = {};
      
      // Add role filter if provided
      if (options.role && Object.values(ROLES).includes(options.role as any)) {
        where.role = options.role;
      }
      
      // Add active status filter if provided
      if (typeof options.isActive === 'boolean') {
        where.isActive = options.isActive;
      }
      
      // Build cursor condition for pagination
      const cursor = options.cursor
        ? { id: options.cursor }
        : undefined;
      
      // Query users with pagination
      const users = await this.prisma.user.findMany({
        where,
        take: limit,
        skip: cursor ? 0 : (page - 1) * limit,
        cursor,
        orderBy: { createdAt: 'desc' }
      });
      
      // Get total count for pagination
      const total = await this.prisma.user.count({ where });
      
      // Calculate next cursor for subsequent queries
      const nextCursor = users.length === limit
        ? users[users.length - 1].id
        : undefined;
      
      // Decrypt sensitive fields and filter out passwords
      const processedUsers = users.map(user => {
        const decryptedUser = this.decryptSensitiveFields(user);
        const { password, ...userWithoutPassword } = decryptedUser;
        return userWithoutPassword as IUser;
      });
      
      return {
        users: processedUsers,
        total,
        nextCursor
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error retrieving users: ${error.message}`);
      }
      throw new Error('Unknown error occurred while retrieving users');
    }
  }

  /**
   * Verifies a password against a user's stored hash
   * Used for authentication purposes
   * 
   * @param email - User email for lookup
   * @param password - Password to verify
   * @returns Promise resolving to user if password matches, null otherwise
   */
  async verifyPassword(email: string, password: string): Promise<IUser | null> {
    try {
      // Encrypt email for lookup
      const encryptedEmail = this.encrypt(email);
      
      // Find user by email
      const user = await this.prisma.user.findUnique({
        where: { email: encryptedEmail }
      });
      
      // Return null if user not found
      if (!user) {
        return null;
      }
      
      // Verify password
      const passwordMatch = await bcrypt.compare(password, user.password);
      
      if (!passwordMatch) {
        return null;
      }
      
      // Decrypt sensitive fields
      const decryptedUser = this.decryptSensitiveFields(user);
      
      // Filter out password for security
      const { password: _, ...userWithoutPassword } = decryptedUser;
      
      return userWithoutPassword as IUser;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error verifying password: ${error.message}`);
      }
      throw new Error('Unknown error occurred while verifying password');
    }
  }

  /**
   * Encrypts sensitive fields in the user data object
   * 
   * @param userData - User data to encrypt fields for
   * @returns User data with encrypted fields
   * @private
   */
  private encryptSensitiveFields(userData: any): any {
    const encryptedData = { ...userData };
    
    for (const field of this.ENCRYPTED_FIELDS) {
      if (userData[field]) {
        encryptedData[field] = this.encrypt(userData[field]);
      }
    }
    
    return encryptedData;
  }

  /**
   * Decrypts sensitive fields in the user data object
   * 
   * @param userData - User data to decrypt fields for
   * @returns User data with decrypted fields
   * @private
   */
  private decryptSensitiveFields(userData: any): any {
    const decryptedData = { ...userData };
    
    for (const field of this.ENCRYPTED_FIELDS) {
      if (userData[field]) {
        try {
          decryptedData[field] = this.decrypt(userData[field]);
        } catch (error) {
          // In case decryption fails, keep the original value
          console.error(`Failed to decrypt field ${field}: ${error}`);
        }
      }
    }
    
    return decryptedData;
  }

  /**
   * Encrypts a string value using configured encryption settings
   * Implements AES-256 encryption as specified in security requirements
   * 
   * @param text - Text to encrypt
   * @returns Encrypted text as hex string
   * @private
   */
  private encrypt(text: string): string {
    const cipher = crypto.createCipheriv(
      this.encryptionConfig.algorithm,
      this.encryptionConfig.secretKey,
      this.encryptionConfig.iv
    );
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return encrypted;
  }

  /**
   * Decrypts a hex string value using configured encryption settings
   * 
   * @param encryptedText - Encrypted hex string to decrypt
   * @returns Decrypted text
   * @private
   */
  private decrypt(encryptedText: string): string {
    const decipher = crypto.createDecipheriv(
      this.encryptionConfig.algorithm,
      this.encryptionConfig.secretKey,
      this.encryptionConfig.iv
    );
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Hashes a password using bcrypt with configured salt rounds
   * Implements the password hashing requirement from security specifications
   * 
   * @param password - Password to hash
   * @returns Hashed password
   * @private
   */
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.BCRYPT_SALT_ROUNDS);
  }

  /**
   * Validates user data for required fields and format
   * Implements the validation rules from form validation requirements
   * 
   * @param userData - User data to validate
   * @throws Error if validation fails
   * @private
   */
  private validateUserData(userData: Partial<IUser>): void {
    // Check required fields
    if (!userData.email) {
      throw new Error('Email is required');
    }
    
    if (!userData.password) {
      throw new Error('Password is required');
    }
    
    if (!userData.firstName) {
      throw new Error('First name is required');
    }
    
    if (!userData.lastName) {
      throw new Error('Last name is required');
    }
    
    if (!userData.role) {
      throw new Error('Role is required');
    }
    
    // Validate email format (RFC 5322 compliant regex)
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
    if (!emailRegex.test(userData.email)) {
      throw new Error('Invalid email format');
    }
    
    // Max 255 characters for email (as per validation rules)
    if (userData.email.length > 255) {
      throw new Error('Email must be less than 255 characters');
    }
    
    // Validate password strength (as per validation rules in 3.1 User Interface Design)
    if (userData.password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    
    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(userData.password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }
    
    // Check for at least one number
    if (!/\d/.test(userData.password)) {
      throw new Error('Password must contain at least one number');
    }
    
    // Check for at least one special character
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(userData.password)) {
      throw new Error('Password must contain at least one special character');
    }
    
    // Validate name format (2-50 characters, alphabets and spaces only)
    const nameRegex = /^[A-Za-z\s]{2,50}$/;
    if (!nameRegex.test(userData.firstName)) {
      throw new Error('First name must be 2-50 characters and contain only letters and spaces');
    }
    
    if (!nameRegex.test(userData.lastName)) {
      throw new Error('Last name must be 2-50 characters and contain only letters and spaces');
    }
    
    // Validate role
    const validRoles = Object.values(UserRole);
    if (!validRoles.includes(userData.role as UserRole)) {
      throw new Error('Invalid role');
    }
  }
}