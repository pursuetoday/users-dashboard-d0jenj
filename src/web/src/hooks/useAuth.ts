/**
 * Custom React hook that provides secure authentication functionality by consuming the AuthContext,
 * implementing JWT-based authentication with role-based access control, and exposing authentication
 * methods and state with comprehensive error handling and security measures.
 * 
 * @packageDocumentation
 * @version 1.0.0
 */

import { useCallback } from 'react'; // ^18.0.0
import { 
  useAuth as useAuthContext,
} from '../context/AuthContext';
import { 
  AuthState, 
  LoginCredentials, 
  RegisterData 
} from '../types/auth.types';

/**
 * Custom hook that provides secure authentication functionality with comprehensive
 * error handling and security measures
 * 
 * @returns Authentication state and methods with security enhancements
 */
export function useAuth() {
  // Get authentication context from the existing hook
  const {
    authState,
    login: contextLogin,
    register: contextRegister,
    logout: contextLogout,
    refreshSession,
    hasPermission,
    hasRole,
    clearError
  } = useAuthContext();

  /**
   * Secure login handler with rate limiting and error handling
   * 
   * @param credentials - Login credentials
   * @returns Promise that resolves on successful login
   */
  const login = useCallback(async (credentials: LoginCredentials): Promise<void> => {
    try {
      // Check rate limiting for login attempts
      const rateLimitKey = `auth_ratelimit_${credentials.email}`;
      const currentAttempts = JSON.parse(localStorage.getItem(rateLimitKey) || '{"count": 0, "timestamp": 0}');
      
      // Reset count if last attempt was more than 15 minutes ago
      if (Date.now() - currentAttempts.timestamp > 15 * 60 * 1000) {
        currentAttempts.count = 0;
      }
      
      // Increment attempt count
      currentAttempts.count += 1;
      currentAttempts.timestamp = Date.now();
      
      // Store updated attempt count
      localStorage.setItem(rateLimitKey, JSON.stringify(currentAttempts));
      
      // Check if rate limit is exceeded (5 attempts in 15 minutes)
      if (currentAttempts.count > 5) {
        throw new Error('Too many login attempts. Please try again later.');
      }
      
      // Validate login credentials
      if (!credentials.email || !credentials.password) {
        throw new Error('Email and password are required');
      }
      
      // Call login function from auth context
      await contextLogin(credentials);
      
      // Setup token refresh interval
      setupTokenRefreshInterval();
      
      // Initialize session monitoring
      initializeSessionMonitoring();
      
    } catch (error) {
      // Handle authentication errors with proper logging
      console.error('Authentication error:', {
        type: 'LOGIN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      
      // Rethrow for component-level handling
      throw error;
    }
  }, [contextLogin]);

  /**
   * Secure registration handler with validation and error handling
   * 
   * @param data - Registration data
   * @returns Promise that resolves on successful registration
   */
  const register = useCallback(async (data: RegisterData): Promise<void> => {
    try {
      // Validate registration data
      if (!data.email || !data.password || !data.firstName || !data.lastName) {
        throw new Error('All fields are required');
      }
      
      // Email format validation
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(data.email)) {
        throw new Error('Invalid email format');
      }
      
      // Password strength validation
      const passwordStrength = validatePasswordStrength(data.password);
      if (!passwordStrength.valid) {
        throw new Error(passwordStrength.message);
      }
      
      // Check for existing user
      await checkForExistingUser(data.email);
      
      // Call register function from auth context
      await contextRegister(data);
      
      // Setup initial security measures
      setupInitialSecurityMeasures();
      
    } catch (error) {
      // Handle registration errors with proper logging
      console.error('Registration error:', {
        type: 'REGISTER_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      
      // Rethrow for component-level handling
      throw error;
    }
  }, [contextRegister]);

  /**
   * Secure logout handler with session cleanup
   * 
   * @returns Promise that resolves on successful logout
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      // Clear authentication tokens
      clearAuthTokens();
      
      // Clear session data
      clearSessionData();
      
      // Stop token refresh interval
      stopTokenRefreshInterval();
      
      // Clear security headers
      clearSecurityHeaders();
      
      // Call logout function from auth context
      await contextLogout();
      
    } catch (error) {
      // Handle logout errors with proper logging
      console.error('Logout error:', {
        type: 'LOGOUT_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      
      // Force logout cleanup even on error
      clearAuthTokens();
      clearSessionData();
      clearSecurityHeaders();
      stopTokenRefreshInterval();
      
      // Rethrow for component-level handling
      throw error;
    }
  }, [contextLogout]);

  /**
   * Validates password strength
   * 
   * @param password - Password to validate
   * @returns Object with validity flag and message
   */
  function validatePasswordStrength(password: string): { valid: boolean; message: string } {
    // Check for minimum length
    if (password.length < 8) {
      return {
        valid: false,
        message: 'Password must be at least 8 characters long'
      };
    }

    // Check for uppercase letter
    if (!/[A-Z]/.test(password)) {
      return {
        valid: false,
        message: 'Password must contain at least one uppercase letter'
      };
    }

    // Check for lowercase letter
    if (!/[a-z]/.test(password)) {
      return {
        valid: false,
        message: 'Password must contain at least one lowercase letter'
      };
    }

    // Check for number
    if (!/[0-9]/.test(password)) {
      return {
        valid: false,
        message: 'Password must contain at least one number'
      };
    }

    // Check for special character
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return {
        valid: false,
        message: 'Password must contain at least one special character'
      };
    }

    return {
      valid: true,
      message: 'Password meets strength requirements'
    };
  }

  /**
   * Checks if a user with the given email already exists
   * 
   * @param email - Email to check
   */
  async function checkForExistingUser(email: string): Promise<void> {
    // This would typically be an API call, but for this example
    // we'll simulate it with local storage
    const existingUsers = JSON.parse(localStorage.getItem('existing_users') || '[]');
    
    if (existingUsers.includes(email)) {
      throw new Error('A user with this email already exists');
    }
  }

  /**
   * Sets up initial security measures after registration
   */
  function setupInitialSecurityMeasures(): void {
    // Setup token refresh interval
    setupTokenRefreshInterval();
    
    // Initialize session monitoring
    initializeSessionMonitoring();
  }

  /**
   * Sets up the token refresh interval
   */
  function setupTokenRefreshInterval(): void {
    // Clear any existing interval
    stopTokenRefreshInterval();
    
    // Set up a new interval for token refresh
    window.tokenRefreshInterval = setInterval(() => {
      if (authState.isAuthenticated) {
        // Refresh the token every 4 minutes
        refreshSession().catch(error => {
          console.error('Token refresh failed:', error);
          handleSessionTimeout();
        });
      }
    }, 4 * 60 * 1000); // 4 minutes
  }

  /**
   * Stops the token refresh interval
   */
  function stopTokenRefreshInterval(): void {
    if (window.tokenRefreshInterval) {
      clearInterval(window.tokenRefreshInterval);
      delete window.tokenRefreshInterval;
    }
  }

  /**
   * Initializes session monitoring
   */
  function initializeSessionMonitoring(): void {
    // Record session start time
    sessionStorage.setItem('session_start', Date.now().toString());
    
    // Add activity listeners for session management
    document.addEventListener('click', recordUserActivity);
    document.addEventListener('keypress', recordUserActivity);
  }

  /**
   * Records user activity for session management
   */
  function recordUserActivity(): void {
    sessionStorage.setItem('last_activity', Date.now().toString());
  }

  /**
   * Handles session timeout
   */
  const handleSessionTimeout = useCallback(async (): Promise<void> => {
    try {
      // Log the session timeout securely
      console.warn('Session timeout detected', {
        timestamp: new Date().toISOString()
      });
      
      // Clear all auth data
      clearAuthTokens();
      clearSessionData();
      clearSecurityHeaders();
      stopTokenRefreshInterval();
      
      // Remove activity listeners
      document.removeEventListener('click', recordUserActivity);
      document.removeEventListener('keypress', recordUserActivity);
      
    } catch (error) {
      console.error('Error handling session timeout:', error);
    }
  }, []);

  /**
   * Clears authentication tokens
   */
  function clearAuthTokens(): void {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tokenExpiry');
  }

  /**
   * Clears session data
   */
  function clearSessionData(): void {
    sessionStorage.removeItem('session_start');
    sessionStorage.removeItem('last_activity');
  }

  /**
   * Clears security headers
   */
  function clearSecurityHeaders(): void {
    // In a real application, this would clear HTTP-only cookies
    // Here we just simulate it with a regular cookie
    document.cookie = 'auth_secure=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Strict; Secure';
  }

  // Return authentication state and methods with security enhancements
  return {
    isAuthenticated: authState.isAuthenticated,
    user: authState.user,
    loading: authState.loading,
    login,
    register,
    logout,
    refreshToken: refreshSession,
    handleSessionTimeout
  };
}

// Add token refresh interval to Window interface
declare global {
  interface Window {
    tokenRefreshInterval?: number;
  }
}