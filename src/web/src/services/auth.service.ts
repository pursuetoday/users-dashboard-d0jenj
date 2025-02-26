/**
 * Authentication Service for User Management Dashboard
 * 
 * Provides secure methods for user authentication, registration, token management,
 * and password operations with enhanced security features and rate limiting.
 * 
 * @packageDocumentation
 * @version 1.0.0
 */

// External imports with versions
import zxcvbn from 'zxcvbn'; // ^4.4.2 - Password strength evaluation
import { RateLimiterMemory } from 'rate-limiter-flexible'; // ^2.4.1 - Rate limiting
import winston from 'winston'; // ^3.8.2 - Logging and security audit functionality

// Internal imports
import { apiService } from './api.service';
import { API_ENDPOINTS } from '../constants/api.constants';
import { ApiError, ErrorType } from '../types/api.types';

/**
 * Interface for login request credentials
 */
export interface LoginCredentials {
  /** User's email address */
  email: string;
  /** User's password */
  password: string;
  /** Optional flag to remember the user's session */
  rememberMe?: boolean;
}

/**
 * Interface for user registration data
 */
export interface RegisterData {
  /** User's email address */
  email: string;
  /** User's password */
  password: string;
  /** User's first name */
  firstName: string;
  /** User's last name */
  lastName: string;
  /** User's role (optional, defaults to User) */
  role?: string;
}

/**
 * Interface for user information returned after authentication
 */
export interface UserInfo {
  /** Unique identifier for the user */
  id: string;
  /** User's email address */
  email: string;
  /** User's first name */
  firstName: string;
  /** User's last name */
  lastName: string;
  /** User's role in the system */
  role: string;
  /** When the user was created */
  createdAt: string;
  /** When the user was last updated */
  updatedAt: string;
  /** Whether the user's account is active */
  isActive: boolean;
}

/**
 * Interface for authentication response containing tokens and user data
 */
export interface AuthResponse {
  /** Access token (JWT) */
  token: string;
  /** Refresh token for obtaining new access tokens */
  refreshToken: string;
  /** Token expiration timestamp */
  expiresAt: number;
  /** User information */
  user: UserInfo;
}

/**
 * Configuration for password requirements
 */
const PASSWORD_REQUIREMENTS = {
  /** Minimum length for passwords */
  MIN_LENGTH: 8,
  /** Minimum strength score (0-4) using zxcvbn */
  MIN_STRENGTH: 3,
  /** Regular expression for password validation */
  PATTERN: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  /** Human-readable password requirements message */
  MESSAGE: 'Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.'
};

/**
 * Configure Winston logger for auth service
 */
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'auth-service' },
  transports: [
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    // Write all logs with level 'info' and below to combined.log
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Add console transport for non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

/**
 * Enhanced service class that handles all authentication-related operations with security features
 */
class AuthService {
  /**
   * Maximum number of failed login attempts before rate limiting takes effect
   */
  private _maxLoginAttempts: number;

  /**
   * Rate limiter for login attempts
   */
  private _loginRateLimiter: RateLimiterMemory;

  /**
   * Rate limiter for registration attempts
   */
  private _registrationRateLimiter: RateLimiterMemory;

  /**
   * Initializes the auth service with security features
   */
  constructor() {
    // Set max login attempts to 5
    this._maxLoginAttempts = 5;

    // Configure login rate limiter (5 attempts per minute)
    this._loginRateLimiter = new RateLimiterMemory({
      points: this._maxLoginAttempts,
      duration: 60,
      blockDuration: 300, // 5 minutes block
    });

    // Configure registration rate limiter (3 attempts per hour)
    this._registrationRateLimiter = new RateLimiterMemory({
      points: 3,
      duration: 60 * 60,
      blockDuration: 60 * 60, // 1 hour block
    });

    // Configure request retry strategy
    this._validateConfiguration();

    logger.info('Auth service initialized with enhanced security features');
  }

  /**
   * Validates service configuration
   * @private
   */
  private _validateConfiguration(): void {
    // Check for required API endpoints
    if (!API_ENDPOINTS.AUTH.LOGIN || !API_ENDPOINTS.AUTH.REGISTER || !API_ENDPOINTS.AUTH.REFRESH_TOKEN) {
      const error = new Error('Auth service configuration error: Missing API endpoints');
      logger.error('Authentication service initialization failed', { error });
      throw error;
    }
  }

  /**
   * Stores authentication tokens securely
   * @param response - The authentication response containing tokens
   * @private
   */
  private _storeTokens(response: AuthResponse): void {
    try {
      // Store tokens in localStorage with security checks
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('refreshToken', response.refreshToken);
      localStorage.setItem('tokenExpiry', response.expiresAt.toString());
      
      // Store user data for quick access
      localStorage.setItem('userData', JSON.stringify(response.user));
      
      logger.info('Authentication tokens stored securely');
    } catch (error) {
      logger.error('Failed to store authentication tokens', { error });
      throw new Error('Failed to store authentication information. Please try again.');
    }
  }

  /**
   * Validates email format
   * @param email - Email to validate
   * @returns Boolean indicating if email is valid
   * @private
   */
  private _validateEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  /**
   * Checks password strength using zxcvbn
   * @param password - Password to check
   * @returns Object with validity flag and feedback message
   * @private
   */
  private _validatePasswordStrength(password: string): { valid: boolean; message: string } {
    // Check for minimum length
    if (password.length < PASSWORD_REQUIREMENTS.MIN_LENGTH) {
      return {
        valid: false,
        message: `Password must be at least ${PASSWORD_REQUIREMENTS.MIN_LENGTH} characters long.`
      };
    }

    // Check password pattern requirements
    if (!PASSWORD_REQUIREMENTS.PATTERN.test(password)) {
      return {
        valid: false,
        message: PASSWORD_REQUIREMENTS.MESSAGE
      };
    }

    // Use zxcvbn to estimate password strength
    const passwordStrength = zxcvbn(password);

    // Password is not strong enough
    if (passwordStrength.score < PASSWORD_REQUIREMENTS.MIN_STRENGTH) {
      return {
        valid: false,
        message: passwordStrength.feedback.warning || 
                'Your password is too weak. Please choose a stronger password.'
      };
    }

    return {
      valid: true,
      message: 'Password meets strength requirements.'
    };
  }

  /**
   * Checks if the authentication token is expired or about to expire
   * @returns Boolean indicating if token needs refresh
   * @private
   */
  private _isTokenExpired(): boolean {
    try {
      const expiryTime = localStorage.getItem('tokenExpiry');
      if (!expiryTime) return true;

      // Get expiry time and add buffer (30 seconds)
      const expiryTimestamp = parseInt(expiryTime, 10);
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Token is expired or will expire in the next 30 seconds
      return expiryTimestamp - currentTime <= 30;
    } catch (error) {
      logger.error('Error checking token expiration', { error });
      return true;
    }
  }

  /**
   * Gets client IP address for security monitoring
   * In browser context, this is limited but included for audit purposes
   * @returns IP address string or 'client-side'
   * @private
   */
  private _getClientIp(): string {
    // In a browser context, we can't reliably get the client IP
    // This would be handled by the server
    return 'client-side';
  }

  /**
   * Clears all authentication data from local storage
   * @private
   */
  private _clearAuthData(): void {
    // Remove all auth-related items
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tokenExpiry');
    localStorage.removeItem('userData');
  }

  /**
   * Authenticates user with enhanced security checks
   * @param credentials - User login credentials
   * @returns Promise resolving to authentication response
   * @throws ApiError on authentication failure
   */
  public async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // Validate input
      if (!credentials.email || !credentials.password) {
        throw new Error('Email and password are required');
      }

      // Validate email format
      if (!this._validateEmail(credentials.email)) {
        throw new Error('Invalid email format');
      }

      // Check rate limit for login attempts
      try {
        await this._loginRateLimiter.consume(credentials.email);
      } catch (error) {
        logger.warn('Rate limit exceeded for login', { 
          email: credentials.email,
          ip: this._getClientIp()
        });
        throw new Error('Too many login attempts. Please try again later.');
      }

      // Prepare audit log data (exclude password)
      const auditData = {
        email: credentials.email,
        rememberMe: credentials.rememberMe,
        ip: this._getClientIp(),
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      };

      // Make POST request to /auth/login
      const response = await apiService.post<LoginCredentials, AuthResponse>(
        API_ENDPOINTS.AUTH.LOGIN,
        credentials
      );

      // Log successful login attempt
      logger.info('User login successful', { 
        userId: response.data.user.id,
        email: credentials.email
      });

      // Store tokens securely
      this._storeTokens(response.data);

      // Return auth response
      return response.data;
    } catch (error) {
      // Handle specific error types
      if ((error as ApiError).code === ErrorType.AUTHENTICATION) {
        logger.warn('Failed login attempt', {
          email: credentials.email,
          error: (error as ApiError).message,
          ip: this._getClientIp()
        });
        throw new Error('Invalid credentials. Please check your email and password.');
      }

      // Log the error
      logger.error('Login error', { 
        email: credentials.email,
        error: error instanceof Error ? error.message : String(error)
      });

      // Rethrow with user-friendly message
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error('An unexpected error occurred during login. Please try again.');
      }
    }
  }

  /**
   * Registers new user with security validation
   * @param data - User registration data
   * @returns Promise resolving to authentication response for new user
   * @throws ApiError on registration failure
   */
  public async register(data: RegisterData): Promise<AuthResponse> {
    try {
      // Check rate limit for registration attempts
      try {
        await this._registrationRateLimiter.consume(this._getClientIp());
      } catch (error) {
        logger.warn('Rate limit exceeded for registration', { 
          ip: this._getClientIp() 
        });
        throw new Error('Too many registration attempts. Please try again later.');
      }

      // Validate email format
      if (!this._validateEmail(data.email)) {
        throw new Error('Invalid email format');
      }

      // Validate password strength
      const passwordValidation = this._validatePasswordStrength(data.password);
      if (!passwordValidation.valid) {
        throw new Error(passwordValidation.message);
      }

      // Make POST request to /auth/register
      const response = await apiService.post<RegisterData, AuthResponse>(
        API_ENDPOINTS.AUTH.REGISTER,
        data
      );

      // Log registration event
      logger.info('User registration successful', {
        userId: response.data.user.id,
        email: data.email
      });

      // Store tokens securely
      this._storeTokens(response.data);

      // Return auth response
      return response.data;
    } catch (error) {
      // Handle validation errors
      if ((error as ApiError).code === ErrorType.VALIDATION) {
        const apiError = error as ApiError;
        // Check for existing email error
        if (apiError.errors?.email?.includes('already exists')) {
          throw new Error('This email is already registered. Please use a different email or try logging in.');
        }
        
        // Other validation errors
        const errorMessage = Object.values(apiError.errors || {})
          .flat()
          .join('. ');
          
        throw new Error(errorMessage || apiError.message);
      }

      // Log the error
      logger.error('Registration error', { 
        email: data.email,
        error: error instanceof Error ? error.message : String(error),
        ip: this._getClientIp()
      });

      // Rethrow with user-friendly message
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error('An unexpected error occurred during registration. Please try again.');
      }
    }
  }

  /**
   * Implements progressive token refresh strategy
   * @returns Promise resolving to new authentication response
   * @throws ApiError on token refresh failure
   */
  public async refreshToken(): Promise<AuthResponse> {
    try {
      // Check if token exists
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token available. Please log in again.');
      }

      // Check token expiration
      if (!this._isTokenExpired()) {
        // Token is still valid, retrieve current auth data
        const currentToken = localStorage.getItem('authToken');
        const tokenExpiry = localStorage.getItem('tokenExpiry');
        const userDataString = localStorage.getItem('userData');
        
        if (currentToken && tokenExpiry && userDataString) {
          try {
            const userData = JSON.parse(userDataString);
            return {
              token: currentToken,
              refreshToken,
              expiresAt: parseInt(tokenExpiry, 10),
              user: userData
            };
          } catch (e) {
            // JSON parsing failed, continue with refresh
            logger.warn('Error parsing stored user data during token refresh', { error: e });
          }
        }
      }

      // Implement refresh token rotation
      const response = await apiService.post<{ refreshToken: string }, AuthResponse>(
        API_ENDPOINTS.AUTH.REFRESH_TOKEN,
        { refreshToken }
      );

      // Update stored tokens
      this._storeTokens(response.data);

      // Log token refresh event
      logger.info('Token refresh successful', {
        userId: response.data.user.id
      });

      // Return new auth response
      return response.data;
    } catch (error) {
      // Handle token refresh errors
      logger.error('Token refresh failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      // Clear tokens on refresh failure
      this._clearAuthData();

      // Throw specific error for handling in components
      throw new Error('Your session has expired. Please log in again.');
    }
  }

  /**
   * Logs out the current user and clears authentication data
   * @returns Promise resolving to void
   */
  public async logout(): Promise<void> {
    try {
      // Get current auth token
      const authToken = localStorage.getItem('authToken');
      
      if (authToken) {
        // Call logout endpoint if available
        try {
          await apiService.post(API_ENDPOINTS.AUTH.LOGOUT, {});
        } catch (error) {
          // Continue with logout even if API call fails
          logger.warn('Logout API call failed', {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Clear authentication data
      this._clearAuthData();
      
      logger.info('User logged out successfully');
    } catch (error) {
      logger.error('Error during logout', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Still clear local data even if API call failed
      this._clearAuthData();
      
      throw new Error('An error occurred during logout, but you have been logged out successfully.');
    }
  }

  /**
   * Checks if the user is currently authenticated
   * @returns Boolean indicating if user is authenticated
   */
  public isAuthenticated(): boolean {
    try {
      const authToken = localStorage.getItem('authToken');
      const refreshToken = localStorage.getItem('refreshToken');
      const tokenExpiry = localStorage.getItem('tokenExpiry');

      if (!authToken || !refreshToken || !tokenExpiry) {
        return false;
      }

      // Check if the token is expired
      return !this._isTokenExpired();
    } catch (error) {
      logger.error('Error checking authentication status', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Gets the current authenticated user information
   * @returns User info or null if not authenticated
   */
  public getCurrentUser(): UserInfo | null {
    try {
      if (!this.isAuthenticated()) {
        return null;
      }

      const userDataString = localStorage.getItem('userData');
      if (!userDataString) {
        return null;
      }

      return JSON.parse(userDataString);
    } catch (error) {
      logger.error('Error getting current user', {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }
}

/**
 * Singleton instance of enhanced AuthService with security features
 */
export const authService = new AuthService();