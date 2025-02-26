import request from 'supertest'; // ^6.3.3
import { app } from '../../src/app';
import { UserModel } from '../../src/models/user.model';
import { ROLES } from '../../src/constants/roles';

// Global variables for test state
let testUsers: { [key: string]: IUser } = {};
let authTokens: { [key: string]: string } = {};
let server;

/**
 * Creates test users with different roles and generates auth tokens
 */
async function setupTestData(): Promise<void> {
  // Create admin test user
  testUsers.admin = await UserModel.create({
    email: 'admin.test@example.com',
    password: 'Admin123!',
    firstName: 'Admin',
    lastName: 'Test',
    role: ROLES.ADMIN,
    isActive: true
  });
  
  // Create manager test user
  testUsers.manager = await UserModel.create({
    email: 'manager.test@example.com',
    password: 'Manager123!',
    firstName: 'Manager',
    lastName: 'Test',
    role: ROLES.MANAGER,
    isActive: true
  });
  
  // Create regular user test user
  testUsers.user = await UserModel.create({
    email: 'user.test@example.com',
    password: 'User123!',
    firstName: 'Regular',
    lastName: 'Test',
    role: ROLES.USER,
    isActive: true
  });
  
  // Create guest test user
  testUsers.guest = await UserModel.create({
    email: 'guest.test@example.com',
    password: 'Guest123!',
    firstName: 'Guest',
    lastName: 'Test',
    role: ROLES.GUEST,
    isActive: true
  });
  
  // Generate auth tokens for all test users
  for (const role of Object.keys(testUsers)) {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUsers[role].email,
        password: role === 'admin' ? 'Admin123!' : 
                 role === 'manager' ? 'Manager123!' : 
                 role === 'user' ? 'User123!' : 'Guest123!'
      });
    
    authTokens[role] = response.body.accessToken;
  }
}

/**
 * Cleans up test data after tests complete
 */
async function cleanupTestData(): Promise<void> {
  // Delete all test users
  for (const role of Object.keys(testUsers)) {
    await UserModel.delete(testUsers[role].id);
  }
  
  // Clear test variables
  testUsers = {};
  authTokens = {};
}

// Global setup before all tests
beforeAll(async () => {
  // Start test server
  server = app.listen(0);
  
  // Create test data and auth tokens
  await setupTestData();
});

// Global cleanup after all tests
afterAll(async () => {
  // Clean up test data
  await cleanupTestData();
  
  // Stop test server
  await server.close();
});

// Reset before each test
beforeEach(() => {
  // Reset request counters or mocks if needed
});

// User Management API Tests
describe('User Management API Tests', () => {
  describe('GET /api/users', () => {
    it('should retrieve paginated list of users with proper filtering and sorting', async () => {
      const response = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${authTokens.admin}`)
        .query({ page: 1, limit: 10 });
      
      // Verify 200 response status
      expect(response.status).toBe(200);
      
      // Verify pagination metadata
      expect(response.body.data).toHaveProperty('users');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('page', 1);
      expect(response.body.data).toHaveProperty('limit', 10);
      
      // Verify user data structure
      if (response.body.data.users.length > 0) {
        const user = response.body.data.users[0];
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('firstName');
        expect(user).toHaveProperty('lastName');
        expect(user).toHaveProperty('role');
        expect(user).toHaveProperty('isActive');
      }
      
      // Verify sorting order
      if (response.body.data.users.length > 1) {
        const dateA = new Date(response.body.data.users[0].createdAt);
        const dateB = new Date(response.body.data.users[1].createdAt);
        expect(dateA.getTime()).toBeGreaterThanOrEqual(dateB.getTime());
      }
      
      // Verify filtering results
      const filteredResponse = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${authTokens.admin}`)
        .query({ role: ROLES.ADMIN });
      
      expect(filteredResponse.status).toBe(200);
      expect(filteredResponse.body.data.users.every(user => user.role === ROLES.ADMIN)).toBe(true);
    });
  });
  
  describe('POST /api/users', () => {
    it('should create new user with proper validation', async () => {
      const newUser = {
        email: 'new.test@example.com',
        password: 'NewUser123!',
        firstName: 'New',
        lastName: 'User',
        role: ROLES.USER
      };
      
      const response = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${authTokens.admin}`)
        .send(newUser);
      
      // Verify 201 response status
      expect(response.status).toBe(201);
      
      // Verify created user data
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('email', newUser.email);
      
      // Verify password hashing
      const createdUser = await UserModel.findById(response.body.data.id);
      expect(createdUser.password).not.toBe(newUser.password);
      
      // Verify audit log creation
      // This would depend on how audit logs are implemented in the system
      
      // Clean up - delete test user
      await UserModel.delete(response.body.data.id);
    });
  });
});

// Authorization Tests
describe('Authorization Tests', () => {
  describe('Role Permissions', () => {
    it('should enforce role-based access restrictions', async () => {
      // Verify admin access to all endpoints
      const adminAccess = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${authTokens.admin}`);
      
      expect(adminAccess.status).toBe(200);
      
      // Verify manager limited access
      const managerAccess = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${authTokens.manager}`);
      
      expect(managerAccess.status).toBe(200);
      
      // Test manager can't create admin users
      const managerCreateAdmin = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${authTokens.manager}`)
        .send({
          email: 'newadmin@example.com',
          password: 'Admin123!',
          firstName: 'New',
          lastName: 'Admin',
          role: ROLES.ADMIN
        });
      
      expect(managerCreateAdmin.status).toBe(403);
      
      // Verify user self-access only
      const userSelfAccess = await request(app)
        .get(`/api/v1/users/${testUsers.user.id}`)
        .set('Authorization', `Bearer ${authTokens.user}`);
      
      expect(userSelfAccess.status).toBe(200);
      
      // Verify user can't access admin data
      const userAccessAdmin = await request(app)
        .get(`/api/v1/users/${testUsers.admin.id}`)
        .set('Authorization', `Bearer ${authTokens.user}`);
      
      expect(userAccessAdmin.status).toBe(403);
      
      // Verify guest read-only access
      const guestAccess = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${authTokens.guest}`);
      
      expect(guestAccess.status).toBe(200);
      
      // Verify guest can't create users
      const guestCreate = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${authTokens.guest}`)
        .send({
          email: 'newuser@example.com',
          password: 'User123!',
          firstName: 'New',
          lastName: 'User',
          role: ROLES.USER
        });
      
      expect(guestCreate.status).toBe(403);
    });
  });
});

// Security Tests
describe('Security Tests', () => {
  describe('Rate Limiting', () => {
    it('should enforce rate limits on API endpoints', async () => {
      // Create array of promises for multiple requests
      const requests = [];
      const requestCount = 110; // Exceeds 100 requests/minute limit
      
      for (let i = 0; i < requestCount; i++) {
        requests.push(
          request(app)
            .get('/api/v1/users')
            .set('Authorization', `Bearer ${authTokens.admin}`)
        );
      }
      
      // Execute all requests simultaneously
      const responses = await Promise.all(requests);
      
      // Verify rate limit headers
      const successResponse = responses.find(r => r.status === 200);
      expect(successResponse.headers).toHaveProperty('x-ratelimit-limit');
      expect(successResponse.headers).toHaveProperty('x-ratelimit-remaining');
      
      // Verify rate limit enforcement
      const limitedResponses = responses.filter(r => r.status === 429);
      expect(limitedResponses.length).toBeGreaterThan(0);
      
      // Verify rate limit reset
      expect(successResponse.headers).toHaveProperty('x-ratelimit-reset');
      const resetTime = parseInt(successResponse.headers['x-ratelimit-reset']);
      expect(resetTime).toBeGreaterThan(0);
    });
  });
  
  describe('Input Validation', () => {
    it('should validate and sanitize input data', async () => {
      // Test email validation
      const invalidEmailResponse = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${authTokens.admin}`)
        .send({
          email: 'not-an-email',
          password: 'Valid123!',
          firstName: 'Test',
          lastName: 'User',
          role: ROLES.USER
        });
      
      expect(invalidEmailResponse.status).toBe(400);
      
      // Test password requirements
      const weakPasswordResponse = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${authTokens.admin}`)
        .send({
          email: 'valid@example.com',
          password: 'weak',
          firstName: 'Test',
          lastName: 'User',
          role: ROLES.USER
        });
      
      expect(weakPasswordResponse.status).toBe(400);
      
      // Test XSS protection
      const xssResponse = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${authTokens.admin}`)
        .send({
          email: 'valid@example.com',
          password: 'Valid123!',
          firstName: '<script>alert("XSS")</script>',
          lastName: 'User',
          role: ROLES.USER
        });
      
      if (xssResponse.status === 201) {
        // If it allows the request, check that the script was sanitized
        expect(xssResponse.body.data.firstName).not.toContain('<script>');
        
        // Clean up
        await UserModel.delete(xssResponse.body.data.id);
      } else {
        // Or it should be rejected
        expect(xssResponse.status).toBe(400);
      }
      
      // Test SQL injection protection
      const sqlInjectionResponse = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${authTokens.admin}`)
        .send({
          email: 'valid@example.com',
          password: 'Valid123!',
          firstName: "Robert'); DROP TABLE Users; --",
          lastName: 'User',
          role: ROLES.USER
        });
      
      if (sqlInjectionResponse.status === 201) {
        // If created, verify the database is still intact
        const checkUsersResponse = await request(app)
          .get('/api/v1/users')
          .set('Authorization', `Bearer ${authTokens.admin}`);
        
        expect(checkUsersResponse.status).toBe(200);
        expect(checkUsersResponse.body.data.users.length).toBeGreaterThan(0);
        
        // Clean up
        await UserModel.delete(sqlInjectionResponse.body.data.id);
      } else {
        // Or it should reject the input
        expect(sqlInjectionResponse.status).toBe(400);
      }
    });
  });
});