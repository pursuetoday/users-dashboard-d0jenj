/**
 * Central Interface Exports
 * 
 * This file serves as a central point of access for all interface definitions
 * used throughout the backend application. It re-exports interfaces related to:
 * 
 * - Configuration: System-wide settings for various components
 * - Authentication: JWT payload, login credentials, and token management
 * - User Management: User data structures and role definitions
 * 
 * By centralizing these exports, it simplifies imports across the codebase
 * and ensures consistent type usage throughout the application.
 * 
 * @version 1.0.0
 */

// Configuration interfaces
export {
  Config,
  AuthConfig,
  DatabaseConfig,
  CacheConfig,
  LoggerConfig,
  RateLimitConfig,
  CorsConfig
} from './config.interface';

// JWT interfaces
export { JwtPayload } from './jwt-payload.interface';

// Authentication interfaces
export {
  ILoginCredentials,
  IAuthTokens,
  IPasswordReset,
  IRefreshTokenPayload
} from './auth.interface';

// User interfaces
export {
  IUser,
  IUserResponse,
  UserRole
} from './user.interface';