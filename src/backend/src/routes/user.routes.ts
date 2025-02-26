/**
 * User Routes Configuration
 * 
 * Configures Express router with secure RESTful endpoints for user management operations
 * with comprehensive middleware chains for authentication, validation, authorization,
 * and rate limiting as specified in the API Design (Section 3.3).
 * 
 * Security features:
 * - JWT token validation for all protected routes
 * - Role-based access control with granular permissions
 * - Request validation with schema enforcement
 * - Rate limiting to prevent abuse
 * 
 * @version 1.0.0
 */

import { Router } from 'express'; // ^4.18.2
import { validateUserSchema } from 'joi'; // ^17.9.0

import { UserController } from '../controllers/user.controller';
import { 
  authenticate, 
  authorize, 
  validateRequest, 
  rateLimiter 
} from '../middleware/auth.middleware';
import { ROLES } from '../constants/roles';

// Create Express router instance
const router = Router();

/**
 * Initializes and configures all user management routes with comprehensive
 * middleware chains for security and validation
 * 
 * @param userController - Instance of UserController for route handlers
 * @returns Configured Express router instance with secured routes
 */
function initializeUserRoutes(userController: UserController): Router {
  // Create a new Express router instance
  const configuredRouter = Router();
  
  // GET /users - List all users with pagination and filtering
  configuredRouter.get(
    '/users',
    authenticate,
    authorize([ROLES.ADMIN, ROLES.MANAGER, ROLES.USER]),
    validateRequest(validateUserSchema.userList),
    rateLimiter,
    async (req, res, next) => {
      try {
        await userController.getUsers(req, res);
      } catch (error) {
        next(error);
      }
    }
  );
  
  // GET /users/:id - Get a specific user by ID
  configuredRouter.get(
    '/users/:id',
    authenticate,
    authorize([ROLES.ADMIN, ROLES.MANAGER, ROLES.USER]),
    validateRequest(validateUserSchema.userId),
    rateLimiter,
    async (req, res, next) => {
      try {
        await userController.getUser(req, res);
      } catch (error) {
        next(error);
      }
    }
  );
  
  // POST /users - Create a new user
  configuredRouter.post(
    '/users',
    authenticate,
    authorize([ROLES.ADMIN]),
    validateRequest(validateUserSchema.createUser),
    rateLimiter,
    async (req, res, next) => {
      try {
        await userController.createUser(req, res);
      } catch (error) {
        next(error);
      }
    }
  );
  
  // PUT /users/:id - Update an existing user
  configuredRouter.put(
    '/users/:id',
    authenticate,
    authorize([ROLES.ADMIN, ROLES.MANAGER, ROLES.USER]),
    validateRequest(validateUserSchema.updateUser),
    rateLimiter,
    async (req, res, next) => {
      try {
        await userController.updateUser(req, res);
      } catch (error) {
        next(error);
      }
    }
  );
  
  // DELETE /users/:id - Delete a user
  configuredRouter.delete(
    '/users/:id',
    authenticate,
    authorize([ROLES.ADMIN, ROLES.MANAGER]),
    validateRequest(validateUserSchema.userId),
    rateLimiter,
    async (req, res, next) => {
      try {
        await userController.deleteUser(req, res);
      } catch (error) {
        next(error);
      }
    }
  );
  
  return configuredRouter;
}

// Export router and initialization function
export { router, initializeUserRoutes };