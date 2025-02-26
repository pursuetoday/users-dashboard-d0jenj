/**
 * Unit Tests for UserService
 * 
 * This file contains comprehensive test suite for the UserService class, covering:
 * - CRUD operations (Create, Read, Update, Delete)
 * - Security validations
 * - Role-based access control
 * - Data protection measures
 * - Error handling scenarios
 * 
 * @version 1.0.0
 */

import { UserService } from '../../../src/services/user.service';
import { UserModel } from '../../../src/models/user.model';
import { CacheService } from '../../../src/services/cache.service';
import { IUser, IUserResponse, UserRole, IUserCreate, IUserUpdate } from '../../../src/interfaces/user.interface';
import crypto from 'crypto'; // latest

// Mock dependencies
jest.mock('../../../src/models/user.model');
jest.mock('../../../src/services/cache.service');

/**
 * Creates a mock user for testing
 * @param overrides - Optional overrides for user properties
 * @returns A mock user object
 */
const createMockUser = (overrides = {}): IUser => {
  const id = crypto.randomUUID();
  return {
    id,
    email: `user-${id}@example.com`,
    password: 'hashedPassword123!',
    firstName: 'Test',
    lastName: 'User',
    role: UserRole.USER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
};

/**
 * Creates a mock user response object for testing
 * @param overrides - Optional overrides for user response properties
 * @returns A mock user response object
 */
const createMockUserResponse = (overrides = {}): IUserResponse => {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  return {
    id,
    email: `user-${id}@example.com`,
    firstName: 'Test',
    lastName: 'User',
    role: UserRole.USER,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
};

/**
 * Sets up all required mocks for testing
 */
const setupTestMocks = () => {
  // Reset all mocks
  jest.clearAllMocks();

  // Set up UserModel mock
  const mockUserModel = UserModel as jest.MockedClass<typeof UserModel>;
  mockUserModel.prototype.create = jest.fn();
  mockUserModel.prototype.findById = jest.fn();
  mockUserModel.prototype.findByEmail = jest.fn();
  mockUserModel.prototype.findAll = jest.fn();

  // Set up CacheService mock
  const mockCacheService = CacheService as jest.MockedClass<typeof CacheService>;
  mockCacheService.prototype.get = jest.fn();
  mockCacheService.prototype.set = jest.fn();
  mockCacheService.prototype.delete = jest.fn();
};

describe('UserService', () => {
  let userService: UserService;
  let mockUserModel: UserModel;
  let mockCacheService: CacheService;
  let mockLogger: any;

  beforeEach(() => {
    setupTestMocks();

    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    // Initialize dependencies
    mockUserModel = new UserModel({} as any);
    mockCacheService = new CacheService();

    // Create service instance
    userService = new UserService(mockUserModel, mockCacheService as any, mockLogger);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createUser', () => {
    it('should successfully create a user', async () => {
      // Arrange
      const mockUser = createMockUser();
      const userInput: IUserCreate = {
        email: mockUser.email,
        password: 'Password123!',
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        role: mockUser.role
      };

      (mockUserModel.create as jest.Mock).mockResolvedValue(mockUser);

      // Act
      const result = await userService.createUser(userInput);

      // Assert
      expect(mockUserModel.create).toHaveBeenCalledWith(expect.objectContaining({
        email: userInput.email,
        password: userInput.password,
        firstName: userInput.firstName,
        lastName: userInput.lastName,
        role: userInput.role
      }));
      expect(result).toEqual(expect.objectContaining({
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        role: mockUser.role,
        isActive: mockUser.isActive
      }));
      expect(mockLogger.info).toHaveBeenCalledWith('User created', expect.any(Object));
    });

    it('should handle duplicate email error', async () => {
      // Arrange
      const userInput: IUserCreate = {
        email: 'existing@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.USER
      };

      const mockError = new Error('Email already exists');
      (mockUserModel.create as jest.Mock).mockRejectedValue(mockError);

      // Act & Assert
      await expect(userService.createUser(userInput)).rejects.toThrow('Failed to create user: Email already exists');
      expect(mockLogger.error).toHaveBeenCalledWith('User creation failed', expect.any(Object));
    });

    it('should handle validation errors during creation', async () => {
      // Arrange
      const userInput = {
        email: 'invalid-email',
        password: 'weak',
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.USER
      } as IUserCreate;

      // Mock validateOrReject to fail
      jest.mock('class-validator', () => ({
        validateOrReject: jest.fn().mockRejectedValue([
          { property: 'email', constraints: { isEmail: 'email must be valid' } },
          { property: 'password', constraints: { minLength: 'password too short' } }
        ])
      }));

      // Act & Assert
      await expect(userService.createUser(userInput)).rejects.toThrow('Failed to create user');
      expect(mockLogger.error).toHaveBeenCalledWith('User creation failed', expect.any(Object));
    });
  });

  describe('getUserById', () => {
    it('should retrieve a user by ID from database when not in cache', async () => {
      // Arrange
      const mockUser = createMockUser();
      const userId = mockUser.id;
      const requestingUserId = mockUser.id; // Same user (retrieving self)
      const requestingUserRole = UserRole.USER;

      // Cache miss
      (mockCacheService.get as jest.Mock).mockResolvedValue(null);
      // DB hit
      (mockUserModel.findById as jest.Mock).mockResolvedValue(mockUser);

      // Act
      const result = await userService.getUserById(userId, requestingUserId, requestingUserRole);

      // Assert
      expect(mockCacheService.get).toHaveBeenCalled();
      expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
      expect(mockCacheService.set).toHaveBeenCalled(); // Should cache the result
      expect(result).toEqual(expect.objectContaining({
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        role: mockUser.role
      }));
      expect(mockLogger.info).toHaveBeenCalledWith('User retrieved', expect.any(Object));
    });

    it('should retrieve a user from cache when available', async () => {
      // Arrange
      const mockUserResponse = createMockUserResponse();
      const userId = mockUserResponse.id;
      const requestingUserId = mockUserResponse.id; // Same user
      const requestingUserRole = UserRole.USER;

      // Cache hit
      (mockCacheService.get as jest.Mock).mockResolvedValue(JSON.stringify(mockUserResponse));

      // Act
      const result = await userService.getUserById(userId, requestingUserId, requestingUserRole);

      // Assert
      expect(mockCacheService.get).toHaveBeenCalled();
      expect(mockUserModel.findById).not.toHaveBeenCalled(); // Should not hit DB
      expect(result).toEqual(mockUserResponse);
    });

    it('should return null when user does not exist', async () => {
      // Arrange
      const userId = 'non-existent-id';
      const requestingUserId = 'admin-id';
      const requestingUserRole = UserRole.ADMIN;

      // Cache miss
      (mockCacheService.get as jest.Mock).mockResolvedValue(null);
      // DB miss
      (mockUserModel.findById as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await userService.getUserById(userId, requestingUserId, requestingUserRole);

      // Assert
      expect(result).toBeNull();
    });

    it('should deny access to user data when permission is insufficient', async () => {
      // Arrange
      const userId = 'user-id';
      const requestingUserId = 'different-user-id'; // Different user
      const requestingUserRole = UserRole.USER; // Regular user cannot access other users

      // Act & Assert
      await expect(userService.getUserById(userId, requestingUserId, requestingUserRole))
        .rejects.toThrow('Permission denied');
      expect(mockLogger.warn).toHaveBeenCalledWith('Permission denied for user access', expect.any(Object));
    });

    it('should allow admins to access any user data', async () => {
      // Arrange
      const mockUser = createMockUser();
      const userId = mockUser.id;
      const requestingUserId = 'admin-id'; // Different user
      const requestingUserRole = UserRole.ADMIN;

      // Cache miss
      (mockCacheService.get as jest.Mock).mockResolvedValue(null);
      // DB hit
      (mockUserModel.findById as jest.Mock).mockResolvedValue(mockUser);

      // Act
      const result = await userService.getUserById(userId, requestingUserId, requestingUserRole);

      // Assert
      expect(result).toEqual(expect.objectContaining({
        id: mockUser.id,
        email: mockUser.email
      }));
    });

    it('should handle errors during retrieval', async () => {
      // Arrange
      const userId = 'user-id';
      const requestingUserId = 'admin-id';
      const requestingUserRole = UserRole.ADMIN;

      // Cache miss
      (mockCacheService.get as jest.Mock).mockResolvedValue(null);
      // DB error
      const mockError = new Error('Database connection error');
      (mockUserModel.findById as jest.Mock).mockRejectedValue(mockError);

      // Act & Assert
      await expect(userService.getUserById(userId, requestingUserId, requestingUserRole))
        .rejects.toThrow('Failed to retrieve user');
      expect(mockLogger.error).toHaveBeenCalledWith('User retrieval failed', expect.any(Object));
    });
  });

  describe('updateUser', () => {
    it('should successfully update a user', async () => {
      // Arrange
      const mockUser = createMockUser();
      const userId = mockUser.id;
      const requestingUserId = mockUser.id; // Same user
      const requestingUserRole = UserRole.USER;
      const updateData: IUserUpdate = {
        firstName: 'Updated',
        lastName: 'Name'
      };

      // Mock finding current user
      (mockUserModel.findById as jest.Mock).mockResolvedValue(mockUser);

      // Mock the private updateUserData method
      jest.spyOn(userService as any, 'updateUserData').mockResolvedValue({
        ...mockUser,
        ...updateData,
        updatedAt: new Date()
      });

      // Act
      const result = await userService.updateUser(userId, updateData, requestingUserId, requestingUserRole);

      // Assert
      expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
      expect(mockCacheService.delete).toHaveBeenCalled(); // Should clear cache
      expect(result).toEqual(expect.objectContaining({
        id: mockUser.id,
        firstName: updateData.firstName,
        lastName: updateData.lastName
      }));
      expect(mockLogger.info).toHaveBeenCalledWith('User updated', expect.any(Object));
    });

    it('should deny update when user does not have permission', async () => {
      // Arrange
      const userId = 'user-id';
      const requestingUserId = 'different-user-id'; // Different user
      const requestingUserRole = UserRole.USER; // Regular user
      const updateData: IUserUpdate = { firstName: 'Updated' };

      // Act & Assert
      await expect(userService.updateUser(userId, updateData, requestingUserId, requestingUserRole))
        .rejects.toThrow('Permission denied');
      expect(mockLogger.warn).toHaveBeenCalledWith('Permission denied for user update', expect.any(Object));
    });

    it('should deny role change when user does not have permission', async () => {
      // Arrange
      const mockUser = createMockUser();
      const userId = mockUser.id;
      const requestingUserId = userId; // Same user
      const requestingUserRole = UserRole.USER; // Regular user
      const updateData: IUserUpdate = { role: UserRole.ADMIN }; // Trying to promote to admin

      // Act & Assert
      await expect(userService.updateUser(userId, updateData, requestingUserId, requestingUserRole))
        .rejects.toThrow('Permission denied');
      expect(mockLogger.warn).toHaveBeenCalledWith('Permission denied for role change', expect.any(Object));
    });

    it('should handle validation errors during update', async () => {
      // Arrange
      const mockUser = createMockUser();
      const userId = mockUser.id;
      const requestingUserId = 'admin-id';
      const requestingUserRole = UserRole.ADMIN;
      const updateData: IUserUpdate = { email: 'invalid-email' }; // Invalid data

      // Mock finding current user
      (mockUserModel.findById as jest.Mock).mockResolvedValue(mockUser);

      // Mock validateOrReject to fail
      jest.mock('class-validator', () => ({
        validateOrReject: jest.fn().mockRejectedValue([
          { property: 'email', constraints: { isEmail: 'email must be valid' } }
        ])
      }));

      // Act & Assert
      await expect(userService.updateUser(userId, updateData, requestingUserId, requestingUserRole))
        .rejects.toThrow('Failed to update user');
      expect(mockLogger.error).toHaveBeenCalledWith('User update failed', expect.any(Object));
    });

    it('should handle user not found during update', async () => {
      // Arrange
      const userId = 'non-existent-id';
      const requestingUserId = 'admin-id';
      const requestingUserRole = UserRole.ADMIN;
      const updateData: IUserUpdate = { firstName: 'Updated' };

      // Mock user not found
      (mockUserModel.findById as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(userService.updateUser(userId, updateData, requestingUserId, requestingUserRole))
        .rejects.toThrow('User not found');
      expect(mockLogger.error).toHaveBeenCalledWith('User update failed', expect.any(Object));
    });
  });

  describe('deleteUser', () => {
    it('should successfully delete a user (soft delete)', async () => {
      // Arrange
      const mockUser = createMockUser();
      const userId = mockUser.id;
      const requestingUserId = 'admin-id'; // Admin user
      const requestingUserRole = UserRole.ADMIN;

      // Mock finding user
      (mockUserModel.findById as jest.Mock).mockResolvedValue(mockUser);

      // Mock the private deleteUserData method
      jest.spyOn(userService as any, 'deleteUserData').mockResolvedValue(undefined);

      // Act
      const result = await userService.deleteUser(userId, requestingUserId, requestingUserRole);

      // Assert
      expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
      expect(mockCacheService.delete).toHaveBeenCalled(); // Should clear cache
      expect(result).toContain('successfully deleted');
      expect(mockLogger.info).toHaveBeenCalledWith('User deleted', expect.any(Object));
    });

    it('should deny deletion when user does not have permission', async () => {
      // Arrange
      const userId = 'user-id';
      const requestingUserId = 'different-user-id'; // Different user
      const requestingUserRole = UserRole.USER; // Regular user

      // Act & Assert
      await expect(userService.deleteUser(userId, requestingUserId, requestingUserRole))
        .rejects.toThrow('Permission denied');
      expect(mockLogger.warn).toHaveBeenCalledWith('Permission denied for user deletion', expect.any(Object));
    });

    it('should prevent self-deletion even for admins', async () => {
      // Arrange
      const userId = 'admin-id';
      const requestingUserId = userId; // Same user (self)
      const requestingUserRole = UserRole.ADMIN;

      // Act & Assert
      await expect(userService.deleteUser(userId, requestingUserId, requestingUserRole))
        .rejects.toThrow('Permission denied');
      expect(mockLogger.warn).toHaveBeenCalledWith('Permission denied for user deletion', expect.any(Object));
    });

    it('should handle user not found during deletion', async () => {
      // Arrange
      const userId = 'non-existent-id';
      const requestingUserId = 'admin-id';
      const requestingUserRole = UserRole.ADMIN;

      // Mock user not found
      (mockUserModel.findById as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(userService.deleteUser(userId, requestingUserId, requestingUserRole))
        .rejects.toThrow('User not found');
      expect(mockLogger.error).toHaveBeenCalledWith('User deletion failed', expect.any(Object));
    });

    it('should handle errors during deletion', async () => {
      // Arrange
      const mockUser = createMockUser();
      const userId = mockUser.id;
      const requestingUserId = 'admin-id';
      const requestingUserRole = UserRole.ADMIN;

      // Mock finding user
      (mockUserModel.findById as jest.Mock).mockResolvedValue(mockUser);

      // Mock error during deleteUserData
      const mockError = new Error('Database error');
      jest.spyOn(userService as any, 'deleteUserData').mockRejectedValue(mockError);

      // Act & Assert
      await expect(userService.deleteUser(userId, requestingUserId, requestingUserRole))
        .rejects.toThrow('Failed to delete user');
      expect(mockLogger.error).toHaveBeenCalledWith('User deletion failed', expect.any(Object));
    });
  });

  describe('getUsers', () => {
    it('should retrieve paginated list of users', async () => {
      // Arrange
      const mockUsers = [
        createMockUser({ id: '1', role: UserRole.ADMIN }),
        createMockUser({ id: '2', role: UserRole.USER }),
        createMockUser({ id: '3', role: UserRole.GUEST })
      ];
      
      const options = { page: 1, limit: 10 };
      const requestingUserId = 'admin-id';
      const requestingUserRole = UserRole.ADMIN;

      // Mock finding users
      (mockUserModel.findAll as jest.Mock).mockResolvedValue({
        users: mockUsers,
        total: mockUsers.length,
        nextCursor: null
      });

      // Act
      const result = await userService.getUsers(options, requestingUserId, requestingUserRole);

      // Assert
      expect(mockUserModel.findAll).toHaveBeenCalledWith(expect.objectContaining(options));
      expect(result.users).toHaveLength(mockUsers.length);
      expect(result.total).toBe(mockUsers.length);
      expect(mockLogger.info).toHaveBeenCalledWith('Users list retrieved', expect.any(Object));
    });

    it('should apply role-based filters for USER role', async () => {
      // Arrange
      const options = { page: 1, limit: 10 };
      const requestingUserId = 'user-id';
      const requestingUserRole = UserRole.USER;

      // Mock finding users
      (mockUserModel.findAll as jest.Mock).mockResolvedValue({
        users: [],
        total: 0,
        nextCursor: null
      });

      // Act
      await userService.getUsers(options, requestingUserId, requestingUserRole);

      // Assert
      expect(mockUserModel.findAll).toHaveBeenCalledWith(expect.objectContaining({
        isActive: true // Should filter to only active users
      }));
    });

    it('should apply role-based filters for GUEST role', async () => {
      // Arrange
      const options = { page: 1, limit: 10 };
      const requestingUserId = 'guest-id';
      const requestingUserRole = UserRole.GUEST;

      // Mock finding users
      (mockUserModel.findAll as jest.Mock).mockResolvedValue({
        users: [],
        total: 0,
        nextCursor: null
      });

      // Act
      await userService.getUsers(options, requestingUserId, requestingUserRole);

      // Assert
      expect(mockUserModel.findAll).toHaveBeenCalledWith(expect.objectContaining({
        isActive: true // Should filter to only active users
      }));
    });

    it('should handle errors when retrieving users', async () => {
      // Arrange
      const options = { page: 1, limit: 10 };
      const requestingUserId = 'admin-id';
      const requestingUserRole = UserRole.ADMIN;

      // Mock error
      const mockError = new Error('Database error');
      (mockUserModel.findAll as jest.Mock).mockRejectedValue(mockError);

      // Act & Assert
      await expect(userService.getUsers(options, requestingUserId, requestingUserRole))
        .rejects.toThrow('Failed to retrieve users');
      expect(mockLogger.error).toHaveBeenCalledWith('Users retrieval failed', expect.any(Object));
    });
  });

  // Test permission checking methods
  describe('Permission checks', () => {
    describe('canAccessUser', () => {
      it('should allow admins to access any user', () => {
        // Act & Assert
        const result = (userService as any).canAccessUser(UserRole.ADMIN, 'admin-id', 'any-user-id');
        expect(result).toBe(true);
      });

      it('should allow managers to access any user', () => {
        // Act & Assert
        const result = (userService as any).canAccessUser(UserRole.MANAGER, 'manager-id', 'any-user-id');
        expect(result).toBe(true);
      });

      it('should allow users to access themselves only', () => {
        // Act & Assert - same user
        const resultSame = (userService as any).canAccessUser(UserRole.USER, 'user-id', 'user-id');
        expect(resultSame).toBe(true);

        // Act & Assert - different user
        const resultDifferent = (userService as any).canAccessUser(UserRole.USER, 'user-id', 'other-user-id');
        expect(resultDifferent).toBe(false);
      });

      it('should deny guest users from accessing specific users', () => {
        // Act & Assert
        const result = (userService as any).canAccessUser(UserRole.GUEST, 'guest-id', 'any-user-id');
        expect(result).toBe(false);
      });
    });

    describe('canModifyUser', () => {
      it('should allow admins to modify any user', () => {
        // Act & Assert
        const result = (userService as any).canModifyUser(UserRole.ADMIN, 'admin-id', 'any-user-id');
        expect(result).toBe(true);
      });

      it('should allow managers to modify any user', () => {
        // Act & Assert
        const result = (userService as any).canModifyUser(UserRole.MANAGER, 'manager-id', 'any-user-id');
        expect(result).toBe(true);
      });

      it('should allow users to modify themselves only', () => {
        // Act & Assert - same user
        const resultSame = (userService as any).canModifyUser(UserRole.USER, 'user-id', 'user-id');
        expect(resultSame).toBe(true);

        // Act & Assert - different user
        const resultDifferent = (userService as any).canModifyUser(UserRole.USER, 'user-id', 'other-user-id');
        expect(resultDifferent).toBe(false);
      });

      it('should deny guest users from modifying any user', () => {
        // Act & Assert
        const result = (userService as any).canModifyUser(UserRole.GUEST, 'guest-id', 'any-user-id');
        expect(result).toBe(false);
      });
    });

    describe('canDeleteUser', () => {
      it('should allow admins to delete other users but not themselves', () => {
        // Act & Assert - other user
        const resultOther = (userService as any).canDeleteUser(UserRole.ADMIN, 'admin-id', 'other-user-id');
        expect(resultOther).toBe(true);

        // Act & Assert - self
        const resultSelf = (userService as any).canDeleteUser(UserRole.ADMIN, 'admin-id', 'admin-id');
        expect(resultSelf).toBe(false);
      });

      it('should allow managers to delete other users but not themselves', () => {
        // Act & Assert - other user
        const resultOther = (userService as any).canDeleteUser(UserRole.MANAGER, 'manager-id', 'other-user-id');
        expect(resultOther).toBe(true);

        // Act & Assert - self
        const resultSelf = (userService as any).canDeleteUser(UserRole.MANAGER, 'manager-id', 'manager-id');
        expect(resultSelf).toBe(false);
      });

      it('should deny regular users from deleting any user', () => {
        // Act & Assert - other user
        const resultOther = (userService as any).canDeleteUser(UserRole.USER, 'user-id', 'other-user-id');
        expect(resultOther).toBe(false);

        // Act & Assert - self
        const resultSelf = (userService as any).canDeleteUser(UserRole.USER, 'user-id', 'user-id');
        expect(resultSelf).toBe(false);
      });
    });

    describe('canChangeUserRole', () => {
      it('should allow admins to assign any role', () => {
        // Act & Assert
        const resultAdmin = (userService as any).canChangeUserRole(UserRole.ADMIN, UserRole.ADMIN);
        const resultManager = (userService as any).canChangeUserRole(UserRole.ADMIN, UserRole.MANAGER);
        const resultUser = (userService as any).canChangeUserRole(UserRole.ADMIN, UserRole.USER);
        const resultGuest = (userService as any).canChangeUserRole(UserRole.ADMIN, UserRole.GUEST);

        expect(resultAdmin).toBe(true);
        expect(resultManager).toBe(true);
        expect(resultUser).toBe(true);
        expect(resultGuest).toBe(true);
      });

      it('should allow managers to assign only USER or GUEST roles', () => {
        // Act & Assert
        const resultAdmin = (userService as any).canChangeUserRole(UserRole.MANAGER, UserRole.ADMIN);
        const resultManager = (userService as any).canChangeUserRole(UserRole.MANAGER, UserRole.MANAGER);
        const resultUser = (userService as any).canChangeUserRole(UserRole.MANAGER, UserRole.USER);
        const resultGuest = (userService as any).canChangeUserRole(UserRole.MANAGER, UserRole.GUEST);

        expect(resultAdmin).toBe(false);
        expect(resultManager).toBe(false);
        expect(resultUser).toBe(true);
        expect(resultGuest).toBe(true);
      });

      it('should deny regular users from changing roles', () => {
        // Act & Assert
        const resultAdmin = (userService as any).canChangeUserRole(UserRole.USER, UserRole.ADMIN);
        const resultManager = (userService as any).canChangeUserRole(UserRole.USER, UserRole.MANAGER);
        const resultUser = (userService as any).canChangeUserRole(UserRole.USER, UserRole.USER);
        const resultGuest = (userService as any).canChangeUserRole(UserRole.USER, UserRole.GUEST);

        expect(resultAdmin).toBe(false);
        expect(resultManager).toBe(false);
        expect(resultUser).toBe(false);
        expect(resultGuest).toBe(false);
      });
    });
  });

  // Test utility methods
  describe('Utility methods', () => {
    describe('mapUserToResponse', () => {
      it('should map internal user object to response format', () => {
        // Arrange
        const mockUser = createMockUser();
        
        // Act
        const result = (userService as any).mapUserToResponse(mockUser);
        
        // Assert
        expect(result).toHaveProperty('id', mockUser.id);
        expect(result).toHaveProperty('email', mockUser.email);
        expect(result).toHaveProperty('firstName', mockUser.firstName);
        expect(result).toHaveProperty('lastName', mockUser.lastName);
        expect(result).toHaveProperty('role', mockUser.role);
        expect(result).toHaveProperty('isActive', mockUser.isActive);
        expect(result).toHaveProperty('createdAt');
        expect(result).toHaveProperty('updatedAt');
        expect(result).not.toHaveProperty('password'); // Should not include password
      });

      it('should handle date formatting correctly', () => {
        // Arrange
        const mockUser = createMockUser();
        const dateString = '2023-01-01T00:00:00.000Z';
        mockUser.createdAt = new Date(dateString);
        mockUser.updatedAt = dateString as any; // Already a string
        
        // Act
        const result = (userService as any).mapUserToResponse(mockUser);
        
        // Assert
        expect(result.createdAt).toBe(dateString);
        expect(result.updatedAt).toBe(dateString);
      });
    });

    describe('getChanges', () => {
      it('should identify changes between old and new user objects', () => {
        // Arrange
        const oldUser = {
          email: 'old@example.com',
          firstName: 'Old',
          lastName: 'User',
          role: UserRole.USER,
          isActive: true
        };
        
        const newUser = {
          email: 'new@example.com',
          firstName: 'New',
          lastName: 'User',
          role: UserRole.ADMIN,
          isActive: true
        };
        
        // Act
        const changes = (userService as any).getChanges(oldUser, newUser);
        
        // Assert
        expect(changes).toHaveProperty('email', { from: 'old@example.com', to: 'new@example.com' });
        expect(changes).toHaveProperty('firstName', { from: 'Old', to: 'New' });
        expect(changes).not.toHaveProperty('lastName'); // No change
        expect(changes).toHaveProperty('role', { from: UserRole.USER, to: UserRole.ADMIN });
        expect(changes).not.toHaveProperty('isActive'); // No change
      });

      it('should return empty object when no changes', () => {
        // Arrange
        const user = {
          email: 'user@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: UserRole.USER,
          isActive: true
        };
        
        // Act
        const changes = (userService as any).getChanges(user, { ...user });
        
        // Assert
        expect(Object.keys(changes)).toHaveLength(0);
      });
    });

    describe('clearUserCache', () => {
      it('should delete user from cache', async () => {
        // Arrange
        const userId = 'test-user-id';
        const cacheKey = `user:${userId}`;
        
        // Act
        await (userService as any).clearUserCache(userId);
        
        // Assert
        expect(mockCacheService.delete).toHaveBeenCalledWith(cacheKey);
      });
    });

    describe('hasPermission', () => {
      it('should check if a role has a specific permission', () => {
        // Setup permission map
        (userService as any).permissionMap = new Map([
          ['admin', ['*']],
          ['manager', ['user.read', 'user.write']],
          ['user', ['user.read.self']],
          ['guest', ['user.read.public']]
        ]);
        
        // Act & Assert - Admin wildcard
        expect((userService as any).hasPermission(UserRole.ADMIN, 'any.permission')).toBe(true);
        
        // Act & Assert - Direct permission match
        expect((userService as any).hasPermission(UserRole.MANAGER, 'user.read')).toBe(true);
        expect((userService as any).hasPermission(UserRole.MANAGER, 'user.delete')).toBe(false);
        
        // Act & Assert - Permission not found
        expect((userService as any).hasPermission(UserRole.USER, 'user.write')).toBe(false);
        
        // Act & Assert - Non-existent role
        expect((userService as any).hasPermission('invalid-role' as UserRole, 'user.read')).toBe(false);
      });
    });
  });

  // Test private implementation methods
  describe('Private implementation methods', () => {
    describe('updateUserData', () => {
      it('should update user data correctly', async () => {
        // Arrange
        const mockUser = createMockUser();
        const updateData: IUserUpdate = { 
          firstName: 'Updated', 
          lastName: 'Name',
          isActive: false
        };

        // Mock findById to return the user
        (mockUserModel.findById as jest.Mock).mockResolvedValue(mockUser);

        // Act
        const result = await (userService as any).updateUserData(mockUser.id, updateData);

        // Assert
        expect(result).toEqual(expect.objectContaining({
          ...mockUser,
          ...updateData,
          updatedAt: expect.any(Date)
        }));
      });

      it('should throw error when user not found', async () => {
        // Arrange
        const userId = 'non-existent-id';
        const updateData: IUserUpdate = { firstName: 'Updated' };

        // Mock findById to return null
        (mockUserModel.findById as jest.Mock).mockResolvedValue(null);

        // Act & Assert
        await expect((userService as any).updateUserData(userId, updateData))
          .rejects.toThrow('User not found');
      });
    });

    describe('deleteUserData', () => {
      it('should perform soft delete by setting isActive to false', async () => {
        // Arrange
        const mockUser = createMockUser();
        
        // Mock findById to return the user
        (mockUserModel.findById as jest.Mock).mockResolvedValue(mockUser);
        
        // Mock updateUserData to verify it's called with isActive: false
        jest.spyOn(userService as any, 'updateUserData').mockResolvedValue({
          ...mockUser,
          isActive: false,
          updatedAt: new Date()
        });

        // Act
        await (userService as any).deleteUserData(mockUser.id);

        // Assert
        expect((userService as any).updateUserData).toHaveBeenCalledWith(
          mockUser.id, 
          { isActive: false }
        );
      });

      it('should throw error when user not found', async () => {
        // Arrange
        const userId = 'non-existent-id';

        // Mock findById to return null
        (mockUserModel.findById as jest.Mock).mockResolvedValue(null);

        // Act & Assert
        await expect((userService as any).deleteUserData(userId))
          .rejects.toThrow('User not found');
      });
    });
  });
});