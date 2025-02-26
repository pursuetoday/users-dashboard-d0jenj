import { rest, HttpResponse } from 'msw';
import { UserRole, AuthResponse } from '../../src/types/auth.types';
import { User } from '../../src/types/user.types';

// Simulate network delay to make tests more realistic
const MOCK_DELAY = 300; // milliseconds

// Pre-defined mock users for testing
const mockUsers: User[] = [
  {
    id: '1',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    role: UserRole.ADMIN,
    isActive: true,
    createdAt: new Date(2023, 0, 1).toISOString(),
    updatedAt: new Date(2023, 0, 1).toISOString()
  },
  {
    id: '2',
    email: 'user@example.com',
    firstName: 'Regular',
    lastName: 'User',
    role: UserRole.USER,
    isActive: true,
    createdAt: new Date(2023, 0, 15).toISOString(),
    updatedAt: new Date(2023, 0, 15).toISOString()
  },
  {
    id: '3',
    email: 'inactive@example.com',
    firstName: 'Inactive',
    lastName: 'User',
    role: UserRole.USER,
    isActive: false,
    createdAt: new Date(2023, 1, 1).toISOString(),
    updatedAt: new Date(2023, 2, 1).toISOString()
  }
];

// Store tokens for authenticated users
const mockTokens = new Map<string, { accessToken: string, refreshToken: string }>();

/**
 * Generates a mock user object with default values that can be overridden
 * @param overrides - Optional partial user object to override defaults
 * @returns Complete mock user object with unique ID and timestamps
 */
function generateMockUser(overrides: Partial<User> = {}): User {
  const now = new Date().toISOString();
  
  return {
    id: crypto.randomUUID(),
    email: `user-${Date.now()}@example.com`,
    firstName: 'Test',
    lastName: 'User',
    role: UserRole.USER,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

/**
 * Validates user data against schema requirements
 * @param userData - User data to validate
 * @returns Validation result with any error messages
 */
function validateUserData(userData: Partial<User>): { isValid: boolean; errors: Record<string, string[]> } {
  const errors: Record<string, string[]> = {};
  
  // Email validation
  if (!userData.email) {
    errors.email = ['Email is required'];
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
    errors.email = ['Invalid email format'];
  } else if (userData.email.length > 255) {
    errors.email = ['Email cannot exceed 255 characters'];
  }
  
  // First name validation
  if (!userData.firstName) {
    errors.firstName = ['First name is required'];
  } else if (userData.firstName.length < 2 || userData.firstName.length > 50) {
    errors.firstName = ['First name must be between 2 and 50 characters'];
  } else if (!/^[A-Za-z\s]+$/.test(userData.firstName)) {
    errors.firstName = ['First name can only contain alphabets and spaces'];
  }
  
  // Last name validation
  if (!userData.lastName) {
    errors.lastName = ['Last name is required'];
  } else if (userData.lastName.length < 2 || userData.lastName.length > 50) {
    errors.lastName = ['Last name must be between 2 and 50 characters'];
  } else if (!/^[A-Za-z\s]+$/.test(userData.lastName)) {
    errors.lastName = ['Last name can only contain alphabets and spaces'];
  }
  
  // Role validation
  if (userData.role !== undefined && !Object.values(UserRole).includes(userData.role)) {
    errors.role = ['Invalid role value'];
  }
  
  return { 
    isValid: Object.keys(errors).length === 0,
    errors 
  };
}

// Login handler
const loginHandler = rest.post('/auth/login', async ({ request }) => {
  await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
  
  try {
    const { email, password } = await request.json();
    
    // Validate required fields
    if (!email || !password) {
      return HttpResponse.json(
        {
          message: 'Email and password are required',
          errors: {
            ...(email ? {} : { email: ['Email is required'] }),
            ...(password ? {} : { password: ['Password is required'] }),
          },
          status: 400,
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }
    
    // Find user by email
    const user = mockUsers.find(u => u.email === email);
    
    // Simulate authentication failure
    if (!user || password !== 'password123') {
      return HttpResponse.json(
        {
          message: 'Invalid email or password',
          errors: {},
          status: 401,
          code: 'AUTHENTICATION_FAILED',
        },
        { status: 401 }
      );
    }
    
    // Check if user is active
    if (!user.isActive) {
      return HttpResponse.json(
        {
          message: 'Your account has been deactivated',
          errors: {},
          status: 403,
          code: 'ACCOUNT_DEACTIVATED',
        },
        { status: 403 }
      );
    }
    
    // Generate tokens
    const accessToken = `mock-access-token-${user.id}-${Date.now()}`;
    const refreshToken = `mock-refresh-token-${user.id}-${Date.now()}`;
    
    // Store tokens for this user
    mockTokens.set(user.id, { accessToken, refreshToken });
    
    // Return successful response
    const response: AuthResponse = {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
    
    return HttpResponse.json(response);
  } catch (error) {
    return HttpResponse.json(
      {
        message: 'Invalid request format',
        errors: {},
        status: 400,
        code: 'INVALID_REQUEST',
      },
      { status: 400 }
    );
  }
});

// Register handler
const registerHandler = rest.post('/auth/register', async ({ request }) => {
  await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
  
  try {
    const { email, password, firstName, lastName } = await request.json();
    
    // Check for required fields
    const missingFields: Record<string, string[]> = {};
    if (!email) missingFields.email = ['Email is required'];
    if (!password) missingFields.password = ['Password is required'];
    if (!firstName) missingFields.firstName = ['First name is required'];
    if (!lastName) missingFields.lastName = ['Last name is required'];
    
    if (Object.keys(missingFields).length > 0) {
      return HttpResponse.json(
        {
          message: 'Required fields are missing',
          errors: missingFields,
          status: 400,
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }
    
    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return HttpResponse.json(
        {
          message: 'Invalid email format',
          errors: { email: ['Invalid email format'] },
          status: 400,
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }
    
    // Validate password strength
    if (password.length < 8) {
      return HttpResponse.json(
        {
          message: 'Password is too weak',
          errors: { password: ['Password must be at least 8 characters'] },
          status: 400,
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }
    
    // Check if email already exists
    if (mockUsers.some(u => u.email === email)) {
      return HttpResponse.json(
        {
          message: 'Email is already in use',
          errors: { email: ['Email already exists'] },
          status: 409,
          code: 'EMAIL_EXISTS',
        },
        { status: 409 }
      );
    }
    
    // Create new user
    const newUser = generateMockUser({
      email,
      firstName,
      lastName,
      role: UserRole.USER,
      isActive: true,
    });
    
    // Add to mock database
    mockUsers.push(newUser);
    
    // Generate tokens
    const accessToken = `mock-access-token-${newUser.id}-${Date.now()}`;
    const refreshToken = `mock-refresh-token-${newUser.id}-${Date.now()}`;
    
    // Store tokens
    mockTokens.set(newUser.id, { accessToken, refreshToken });
    
    // Return successful response
    const response: AuthResponse = {
      accessToken,
      refreshToken,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
      },
    };
    
    return HttpResponse.json(response);
  } catch (error) {
    return HttpResponse.json(
      {
        message: 'Invalid request format',
        errors: {},
        status: 400,
        code: 'INVALID_REQUEST',
      },
      { status: 400 }
    );
  }
});

// Refresh token handler
const refreshTokenHandler = rest.post('/auth/refresh', async ({ request }) => {
  await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
  
  try {
    const { refreshToken } = await request.json();
    
    if (!refreshToken) {
      return HttpResponse.json(
        {
          message: 'Refresh token is required',
          errors: {},
          status: 400,
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }
    
    // Find user by refresh token
    let userId: string | null = null;
    for (const [id, tokens] of mockTokens.entries()) {
      if (tokens.refreshToken === refreshToken) {
        userId = id;
        break;
      }
    }
    
    if (!userId) {
      return HttpResponse.json(
        {
          message: 'Invalid refresh token',
          errors: {},
          status: 401,
          code: 'INVALID_TOKEN',
        },
        { status: 401 }
      );
    }
    
    const user = mockUsers.find(u => u.id === userId);
    
    if (!user) {
      return HttpResponse.json(
        {
          message: 'User not found',
          errors: {},
          status: 404,
          code: 'USER_NOT_FOUND',
        },
        { status: 404 }
      );
    }
    
    // Generate new tokens
    const newAccessToken = `mock-access-token-${user.id}-${Date.now()}`;
    const newRefreshToken = `mock-refresh-token-${user.id}-${Date.now()}`;
    
    // Update stored tokens
    mockTokens.set(user.id, { 
      accessToken: newAccessToken, 
      refreshToken: newRefreshToken 
    });
    
    // Return successful response
    const response: AuthResponse = {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
    
    return HttpResponse.json(response);
  } catch (error) {
    return HttpResponse.json(
      {
        message: 'Invalid request format',
        errors: {},
        status: 400,
        code: 'INVALID_REQUEST',
      },
      { status: 400 }
    );
  }
});

// Logout handler
const logoutHandler = rest.post('/auth/logout', async ({ request }) => {
  await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
  
  try {
    const { refreshToken } = await request.json();
    
    // Find user by refresh token and remove their tokens
    for (const [id, tokens] of mockTokens.entries()) {
      if (tokens.refreshToken === refreshToken) {
        mockTokens.delete(id);
        break;
      }
    }
    
    // Always return success even if token wasn't found (for security reasons)
    return HttpResponse.json({
      message: 'Logged out successfully',
      status: 200,
    });
  } catch (error) {
    // Even with error, return success for security
    return HttpResponse.json({
      message: 'Logged out successfully',
      status: 200,
    });
  }
});

// Get all users handler
const getUsersHandler = rest.get('/api/users', async ({ request }) => {
  await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
  
  // Check for token in Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return HttpResponse.json(
      {
        message: 'Authentication required',
        errors: {},
        status: 401,
        code: 'MISSING_TOKEN',
      },
      { status: 401 }
    );
  }
  
  const token = authHeader.split(' ')[1];
  
  // Validate token
  let isValidToken = false;
  let currentUser: User | undefined;
  
  for (const [id, tokens] of mockTokens.entries()) {
    if (tokens.accessToken === token) {
      isValidToken = true;
      currentUser = mockUsers.find(u => u.id === id);
      break;
    }
  }
  
  if (!isValidToken || !currentUser) {
    return HttpResponse.json(
      {
        message: 'Invalid or expired token',
        errors: {},
        status: 401,
        code: 'INVALID_TOKEN',
      },
      { status: 401 }
    );
  }
  
  // Parse query parameters
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '10', 10);
  const roleFilter = url.searchParams.get('role');
  const isActiveFilter = url.searchParams.has('isActive') ? 
    url.searchParams.get('isActive') === 'true' : 
    undefined;
  const search = url.searchParams.get('search') || '';
  
  // Filter users based on query parameters
  let filteredUsers = [...mockUsers];
  
  // Apply role filter if specified
  if (roleFilter) {
    filteredUsers = filteredUsers.filter(u => u.role.toString() === roleFilter);
  }
  
  // Apply active status filter if specified
  if (isActiveFilter !== undefined) {
    filteredUsers = filteredUsers.filter(u => u.isActive === isActiveFilter);
  }
  
  // Apply search filter if specified
  if (search) {
    const searchLower = search.toLowerCase();
    filteredUsers = filteredUsers.filter(u => 
      u.email.toLowerCase().includes(searchLower) ||
      u.firstName.toLowerCase().includes(searchLower) ||
      u.lastName.toLowerCase().includes(searchLower)
    );
  }
  
  // Calculate pagination
  const totalCount = filteredUsers.length;
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);
  
  return HttpResponse.json({
    data: paginatedUsers,
    total: totalCount,
    page,
    limit,
  });
});

// Get user by ID handler
const getUserByIdHandler = rest.get('/api/users/:id', async ({ request, params }) => {
  await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
  
  // Check for token in Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return HttpResponse.json(
      {
        message: 'Authentication required',
        errors: {},
        status: 401,
        code: 'MISSING_TOKEN',
      },
      { status: 401 }
    );
  }
  
  const token = authHeader.split(' ')[1];
  
  // Validate token
  let isValidToken = false;
  let currentUser: User | undefined;
  
  for (const [id, tokens] of mockTokens.entries()) {
    if (tokens.accessToken === token) {
      isValidToken = true;
      currentUser = mockUsers.find(u => u.id === id);
      break;
    }
  }
  
  if (!isValidToken || !currentUser) {
    return HttpResponse.json(
      {
        message: 'Invalid or expired token',
        errors: {},
        status: 401,
        code: 'INVALID_TOKEN',
      },
      { status: 401 }
    );
  }
  
  // Check permissions based on role
  if (currentUser.role !== UserRole.ADMIN && params.id !== currentUser.id) {
    return HttpResponse.json(
      {
        message: 'You do not have permission to access this user',
        errors: {},
        status: 403,
        code: 'FORBIDDEN',
      },
      { status: 403 }
    );
  }
  
  // Find user by ID
  const user = mockUsers.find(u => u.id === params.id);
  
  if (!user) {
    return HttpResponse.json(
      {
        message: 'User not found',
        errors: {},
        status: 404,
        code: 'USER_NOT_FOUND',
      },
      { status: 404 }
    );
  }
  
  return HttpResponse.json({
    data: user,
    message: 'User retrieved successfully',
    status: 200,
  });
});

// Create user handler
const createUserHandler = rest.post('/api/users', async ({ request }) => {
  await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
  
  // Check for token in Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return HttpResponse.json(
      {
        message: 'Authentication required',
        errors: {},
        status: 401,
        code: 'MISSING_TOKEN',
      },
      { status: 401 }
    );
  }
  
  const token = authHeader.split(' ')[1];
  
  // Validate token
  let isValidToken = false;
  let currentUser: User | undefined;
  
  for (const [id, tokens] of mockTokens.entries()) {
    if (tokens.accessToken === token) {
      isValidToken = true;
      currentUser = mockUsers.find(u => u.id === id);
      break;
    }
  }
  
  if (!isValidToken || !currentUser) {
    return HttpResponse.json(
      {
        message: 'Invalid or expired token',
        errors: {},
        status: 401,
        code: 'INVALID_TOKEN',
      },
      { status: 401 }
    );
  }
  
  // Check if user has admin role
  if (currentUser.role !== UserRole.ADMIN) {
    return HttpResponse.json(
      {
        message: 'You do not have permission to create users',
        errors: {},
        status: 403,
        code: 'FORBIDDEN',
      },
      { status: 403 }
    );
  }
  
  try {
    const userData = await request.json();
    
    // Validate user data
    const validation = validateUserData(userData);
    
    if (!validation.isValid) {
      return HttpResponse.json(
        {
          message: 'Validation failed',
          errors: validation.errors,
          status: 400,
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }
    
    // Check if email already exists
    if (mockUsers.some(u => u.email === userData.email)) {
      return HttpResponse.json(
        {
          message: 'Email already exists',
          errors: { email: ['Email is already in use'] },
          status: 409,
          code: 'EMAIL_EXISTS',
        },
        { status: 409 }
      );
    }
    
    // Create new user
    const newUser = generateMockUser(userData);
    
    // Add to mock database
    mockUsers.push(newUser);
    
    return HttpResponse.json({
      data: newUser,
      message: 'User created successfully',
      status: 201,
    }, { status: 201 });
  } catch (error) {
    return HttpResponse.json(
      {
        message: 'Invalid request format',
        errors: {},
        status: 400,
        code: 'INVALID_REQUEST',
      },
      { status: 400 }
    );
  }
});

// Update user handler
const updateUserHandler = rest.put('/api/users/:id', async ({ request, params }) => {
  await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
  
  // Check for token in Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return HttpResponse.json(
      {
        message: 'Authentication required',
        errors: {},
        status: 401,
        code: 'MISSING_TOKEN',
      },
      { status: 401 }
    );
  }
  
  const token = authHeader.split(' ')[1];
  
  // Validate token
  let isValidToken = false;
  let currentUser: User | undefined;
  
  for (const [id, tokens] of mockTokens.entries()) {
    if (tokens.accessToken === token) {
      isValidToken = true;
      currentUser = mockUsers.find(u => u.id === id);
      break;
    }
  }
  
  if (!isValidToken || !currentUser) {
    return HttpResponse.json(
      {
        message: 'Invalid or expired token',
        errors: {},
        status: 401,
        code: 'INVALID_TOKEN',
      },
      { status: 401 }
    );
  }
  
  // Check permissions - only admins can update other users
  if (currentUser.role !== UserRole.ADMIN && params.id !== currentUser.id) {
    return HttpResponse.json(
      {
        message: 'You do not have permission to update this user',
        errors: {},
        status: 403,
        code: 'FORBIDDEN',
      },
      { status: 403 }
    );
  }
  
  // Find user by ID
  const userIndex = mockUsers.findIndex(u => u.id === params.id);
  
  if (userIndex === -1) {
    return HttpResponse.json(
      {
        message: 'User not found',
        errors: {},
        status: 404,
        code: 'USER_NOT_FOUND',
      },
      { status: 404 }
    );
  }
  
  try {
    const userData = await request.json();
    
    // Validate user data
    const validation = validateUserData(userData);
    
    if (!validation.isValid) {
      return HttpResponse.json(
        {
          message: 'Validation failed',
          errors: validation.errors,
          status: 400,
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }
    
    // Check if trying to update email to one that already exists
    if (userData.email !== mockUsers[userIndex].email && 
        mockUsers.some(u => u.email === userData.email)) {
      return HttpResponse.json(
        {
          message: 'Email already exists',
          errors: { email: ['Email is already in use'] },
          status: 409,
          code: 'EMAIL_EXISTS',
        },
        { status: 409 }
      );
    }
    
    // Update user
    const updatedUser = {
      ...mockUsers[userIndex],
      ...userData,
      updatedAt: new Date().toISOString(),
    };
    
    // Store updated user
    mockUsers[userIndex] = updatedUser;
    
    return HttpResponse.json({
      data: updatedUser,
      message: 'User updated successfully',
      status: 200,
    });
  } catch (error) {
    return HttpResponse.json(
      {
        message: 'Invalid request format',
        errors: {},
        status: 400,
        code: 'INVALID_REQUEST',
      },
      { status: 400 }
    );
  }
});

// Delete user handler
const deleteUserHandler = rest.delete('/api/users/:id', async ({ request, params }) => {
  await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
  
  // Check for token in Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return HttpResponse.json(
      {
        message: 'Authentication required',
        errors: {},
        status: 401,
        code: 'MISSING_TOKEN',
      },
      { status: 401 }
    );
  }
  
  const token = authHeader.split(' ')[1];
  
  // Validate token
  let isValidToken = false;
  let currentUser: User | undefined;
  
  for (const [id, tokens] of mockTokens.entries()) {
    if (tokens.accessToken === token) {
      isValidToken = true;
      currentUser = mockUsers.find(u => u.id === id);
      break;
    }
  }
  
  if (!isValidToken || !currentUser) {
    return HttpResponse.json(
      {
        message: 'Invalid or expired token',
        errors: {},
        status: 401,
        code: 'INVALID_TOKEN',
      },
      { status: 401 }
    );
  }
  
  // Only admins can delete users
  if (currentUser.role !== UserRole.ADMIN) {
    return HttpResponse.json(
      {
        message: 'You do not have permission to delete users',
        errors: {},
        status: 403,
        code: 'FORBIDDEN',
      },
      { status: 403 }
    );
  }
  
  // Find user by ID
  const userIndex = mockUsers.findIndex(u => u.id === params.id);
  
  if (userIndex === -1) {
    return HttpResponse.json(
      {
        message: 'User not found',
        errors: {},
        status: 404,
        code: 'USER_NOT_FOUND',
      },
      { status: 404 }
    );
  }
  
  // Prevent deleting the currently authenticated admin
  if (params.id === currentUser.id) {
    return HttpResponse.json(
      {
        message: 'You cannot delete your own account',
        errors: {},
        status: 403,
        code: 'CANNOT_DELETE_SELF',
      },
      { status: 403 }
    );
  }
  
  // Remove user from the collection
  mockUsers.splice(userIndex, 1);
  
  // Remove user tokens if they exist
  mockTokens.delete(params.id);
  
  return HttpResponse.json({
    message: 'User deleted successfully',
    status: 200,
  });
});

// Export all handlers
export const handlers = [
  loginHandler,
  registerHandler,
  refreshTokenHandler,
  logoutHandler,
  getUsersHandler,
  getUserByIdHandler,
  createUserHandler,
  updateUserHandler,
  deleteUserHandler
];