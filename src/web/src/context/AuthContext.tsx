/**
 * Authentication Context for User Management Dashboard
 * 
 * Provides a global authentication state and operations for the application.
 * Implements JWT-based authentication with access and refresh tokens,
 * role-based access control, and secure token management.
 * 
 * @packageDocumentation
 * @version 1.0.0
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
  useRef
} from 'react';
import { useQueryClient } from 'react-query'; // ^4.0.0
import TokenManager from '@auth/token-manager'; // ^1.0.0

// Internal imports
import {
  AuthState,
  LoginCredentials,
  AuthUser,
  UserRole
} from '../types/auth.types';
import { authService } from '../services/auth.service';

/**
 * Extended AuthState interface with error and permissions
 * Adds advanced properties to the base AuthState
 */
interface ExtendedAuthState extends AuthState {
  error: AuthError | null;
  permissions: UserPermissions[];
}

/**
 * AuthError interface for standardized error handling
 */
interface AuthError {
  message: string;
  code: string;
  timestamp?: string;
}

/**
 * Permissions enumeration for role-based access control
 */
enum UserPermissions {
  VIEW_USERS = 'view_users',
  EDIT_USERS = 'edit_users',
  DELETE_USERS = 'delete_users',
  CREATE_USERS = 'create_users',
  EDIT_SELF = 'edit_self',
  MANAGE_ROLES = 'manage_roles',
  VIEW_AUDIT_LOGS = 'view_audit_logs',
  ACCESS_SETTINGS = 'access_settings'
}

/**
 * Interface for authentication configuration options
 */
interface AuthConfig {
  /** Auto-refresh token interval in milliseconds (default: 4 minutes) */
  refreshInterval: number;
  /** Whether to automatically refresh the session on mount */
  autoRefresh: boolean;
  /** Whether to persist auth state to local storage */
  persistState: boolean;
  /** Maximum number of login retry attempts */
  maxRetryAttempts: number;
  /** Base redirect URL after successful login */
  redirectUrl: string;
}

/**
 * Interface for authentication context value
 * Contains state and methods for authentication operations
 */
interface AuthContextType {
  /** Current authentication state */
  authState: ExtendedAuthState;
  /** Function to login a user with credentials */
  login: (credentials: LoginCredentials) => Promise<void>;
  /** Function to register a new user */
  register: (data: any) => Promise<void>;
  /** Function to logout the current user */
  logout: () => Promise<void>;
  /** Function to refresh the current session */
  refreshSession: () => Promise<void>;
  /** Function to check if user has specific permission */
  hasPermission: (permission: UserPermissions) => boolean;
  /** Function to check if current user has a specific role */
  hasRole: (role: UserRole | UserRole[]) => boolean;
  /** Clear any authentication errors */
  clearError: () => void;
}

/**
 * Default authentication state
 */
const defaultAuthState: ExtendedAuthState = {
  isAuthenticated: false,
  user: null,
  loading: true,
  error: null,
  permissions: []
};

/**
 * Default authentication configuration
 */
const defaultAuthConfig: AuthConfig = {
  refreshInterval: 4 * 60 * 1000, // 4 minutes
  autoRefresh: true,
  persistState: true,
  maxRetryAttempts: 3,
  redirectUrl: '/dashboard'
};

/**
 * React Context for Authentication
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Authentication Provider Component
 * 
 * Provides global authentication state and functions for the application.
 * Implements secure token management, automatic token refresh, and
 * role-based access control.
 * 
 * @param children - Child components
 * @param config - Authentication configuration options
 * @returns AuthProvider component
 */
export const AuthProvider: React.FC<{
  children: ReactNode;
  config?: Partial<AuthConfig>;
}> = ({ children, config = {} }) => {
  // Merge default config with provided config
  const authConfig = { ...defaultAuthConfig, ...config };
  
  // Authentication state
  const [authState, setAuthState] = useState<ExtendedAuthState>(defaultAuthState);
  
  // Token manager for secure token operations
  const tokenManager = new TokenManager();
  
  // React Query client for cache invalidation
  const queryClient = useQueryClient();
  
  // Timer reference for token refresh
  const refreshTimerRef = useRef<number | null>(null);
  
  /**
   * Updates authentication state with new values
   * @param newState - Partial state to merge with current state
   */
  const updateAuthState = useCallback((newState: Partial<ExtendedAuthState>) => {
    setAuthState(prevState => ({
      ...prevState,
      ...newState
    }));
    
    // Persist state to local storage if enabled
    if (authConfig.persistState && !newState.loading) {
      try {
        const stateToStore = {
          ...prevState,
          ...newState,
          // Don't persist sensitive data or loading state
          error: null,
          loading: false
        };
        
        localStorage.setItem('authState', JSON.stringify(stateToStore));
      } catch (error) {
        console.error('Failed to persist auth state:', error);
      }
    }
  }, [authConfig.persistState]);
  
  /**
   * Restores authentication state from local storage
   */
  const restoreAuthState = useCallback(() => {
    if (!authConfig.persistState) {
      return false;
    }
    
    try {
      const storedState = localStorage.getItem('authState');
      if (storedState) {
        const parsedState = JSON.parse(storedState) as Partial<ExtendedAuthState>;
        
        setAuthState(prevState => ({
          ...prevState,
          ...parsedState,
          // Always start with loading true to validate the session
          loading: true
        }));
        
        return true;
      }
    } catch (error) {
      console.error('Failed to restore auth state:', error);
    }
    
    return false;
  }, [authConfig.persistState]);
  
  /**
   * Setup refresh timer for token refresh
   */
  const setupRefreshTimer = useCallback(() => {
    // Clear any existing timer
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    
    // Only setup timer if authenticated and auto-refresh is enabled
    if (authState.isAuthenticated && authConfig.autoRefresh) {
      refreshTimerRef.current = window.setTimeout(
        () => refreshSession(),
        authConfig.refreshInterval
      );
    }
  }, [authState.isAuthenticated, authConfig.autoRefresh, authConfig.refreshInterval]);
  
  /**
   * Cleanup function for refresh timer
   */
  const cleanupRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);
  
  /**
   * Derives permissions from a user role
   * Implements role-based access control mapping
   * 
   * @param role - User role
   * @returns Array of permissions for the role
   */
  const derivePermissionsFromRole = useCallback((role: string): UserPermissions[] => {
    switch (role) {
      case UserRole.ADMIN:
        return [
          UserPermissions.VIEW_USERS,
          UserPermissions.EDIT_USERS,
          UserPermissions.DELETE_USERS,
          UserPermissions.CREATE_USERS,
          UserPermissions.MANAGE_ROLES,
          UserPermissions.VIEW_AUDIT_LOGS,
          UserPermissions.ACCESS_SETTINGS
        ];
      case UserRole.MANAGER:
        return [
          UserPermissions.VIEW_USERS,
          UserPermissions.EDIT_USERS,
          UserPermissions.CREATE_USERS,
          UserPermissions.VIEW_AUDIT_LOGS
        ];
      case UserRole.USER:
        return [
          UserPermissions.VIEW_USERS,
          UserPermissions.EDIT_SELF
        ];
      case UserRole.GUEST:
        return [
          UserPermissions.VIEW_USERS
        ];
      default:
        return [];
    }
  }, []);
  
  /**
   * Login function with enhanced security and error handling
   * @param credentials - User login credentials
   */
  const login = useCallback(async (credentials: LoginCredentials) => {
    // Set loading state
    updateAuthState({ loading: true, error: null });
    
    try {
      // Validate credentials format
      if (!credentials.email || !credentials.password) {
        throw new Error('Email and password are required');
      }
      
      // Attempt login with retry mechanism
      let loginAttempts = 0;
      let loginSuccess = false;
      let lastError: any = null;
      
      while (!loginSuccess && loginAttempts < authConfig.maxRetryAttempts) {
        try {
          const response = await authService.login({
            ...credentials,
            rememberMe: !!credentials.rememberMe
          });
          
          // Store tokens securely using TokenManager
          tokenManager.setTokens({
            accessToken: response.token,
            refreshToken: response.refreshToken,
            expiresAt: response.expiresAt
          });
          
          // Extract user and convert to AuthUser type
          const user: AuthUser = {
            id: response.user.id,
            email: response.user.email,
            role: response.user.role as UserRole
          };
          
          // Setup permissions based on role
          const permissions = derivePermissionsFromRole(response.user.role);
          
          // Update auth state with user info
          updateAuthState({
            isAuthenticated: true,
            user,
            permissions,
            loading: false,
            error: null
          });
          
          // Reset React Query cache on login
          queryClient.invalidateQueries();
          
          // Setup automatic token refresh
          setupRefreshTimer();
          
          loginSuccess = true;
        } catch (error) {
          loginAttempts++;
          lastError = error;
          
          // Only retry network errors, not validation errors
          if (!isNetworkError(error)) {
            break;
          }
          
          // Wait before retry
          if (loginAttempts < authConfig.maxRetryAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000 * loginAttempts));
          }
        }
      }
      
      // If all attempts failed, throw the last error
      if (!loginSuccess) {
        throw lastError;
      }
    } catch (error) {
      // Format error for UI
      const authError: AuthError = {
        message: error instanceof Error ? error.message : 'Authentication failed',
        code: getErrorCode(error),
        timestamp: new Date().toISOString()
      };
      
      // Update state with error
      updateAuthState({
        isAuthenticated: false,
        user: null,
        permissions: [],
        loading: false,
        error: authError
      });
      
      throw error;
    }
  }, [
    authConfig.maxRetryAttempts, 
    derivePermissionsFromRole, 
    queryClient, 
    setupRefreshTimer, 
    tokenManager, 
    updateAuthState
  ]);
  
  /**
   * Register a new user
   * @param data - User registration data
   */
  const register = useCallback(async (data: any) => {
    // Set loading state
    updateAuthState({ loading: true, error: null });
    
    try {
      const response = await authService.register(data);
      
      // Store tokens securely
      tokenManager.setTokens({
        accessToken: response.token,
        refreshToken: response.refreshToken,
        expiresAt: response.expiresAt
      });
      
      // Extract user and convert to AuthUser type
      const user: AuthUser = {
        id: response.user.id,
        email: response.user.email,
        role: response.user.role as UserRole
      };
      
      // Setup permissions based on role
      const permissions = derivePermissionsFromRole(response.user.role);
      
      // Update auth state
      updateAuthState({
        isAuthenticated: true,
        user,
        permissions,
        loading: false,
        error: null
      });
      
      // Setup automatic token refresh
      setupRefreshTimer();
    } catch (error) {
      // Format error for UI
      const authError: AuthError = {
        message: error instanceof Error ? error.message : 'Registration failed',
        code: getErrorCode(error),
        timestamp: new Date().toISOString()
      };
      
      // Update state with error
      updateAuthState({
        loading: false,
        error: authError
      });
      
      throw error;
    }
  }, [
    derivePermissionsFromRole, 
    setupRefreshTimer, 
    tokenManager, 
    updateAuthState
  ]);
  
  /**
   * Logout the current user
   */
  const logout = useCallback(async () => {
    // Set loading state
    updateAuthState({ loading: true });
    
    try {
      // Call logout endpoint if authenticated
      if (authState.isAuthenticated) {
        await authService.logout();
      }
      
      // Clean up token refresh timer
      cleanupRefreshTimer();
      
      // Clear tokens
      tokenManager.clearTokens();
      
      // Reset auth state
      updateAuthState({
        isAuthenticated: false,
        user: null,
        permissions: [],
        loading: false,
        error: null
      });
      
      // Clear React Query cache
      queryClient.clear();
      
      // Remove persisted state if enabled
      if (authConfig.persistState) {
        localStorage.removeItem('authState');
      }
    } catch (error) {
      console.error('Logout error:', error);
      
      // Force logout even if API call fails
      tokenManager.clearTokens();
      
      updateAuthState({
        isAuthenticated: false,
        user: null,
        permissions: [],
        loading: false,
        error: null
      });
      
      queryClient.clear();
      
      if (authConfig.persistState) {
        localStorage.removeItem('authState');
      }
    }
  }, [
    authConfig.persistState, 
    authState.isAuthenticated, 
    cleanupRefreshTimer, 
    queryClient, 
    tokenManager, 
    updateAuthState
  ]);
  
  /**
   * Refresh the current session
   */
  const refreshSession = useCallback(async () => {
    // Skip refresh if not authenticated
    if (!authState.isAuthenticated) {
      return;
    }
    
    try {
      const response = await authService.refreshToken();
      
      // Update tokens
      tokenManager.setTokens({
        accessToken: response.token,
        refreshToken: response.refreshToken,
        expiresAt: response.expiresAt
      });
      
      // Extract user and convert to AuthUser type
      const user: AuthUser = {
        id: response.user.id,
        email: response.user.email,
        role: response.user.role as UserRole
      };
      
      // Only update user if user data has changed
      if (!authState.user || 
          authState.user.id !== user.id || 
          authState.user.role !== user.role) {
        
        // Setup permissions based on role
        const permissions = derivePermissionsFromRole(response.user.role);
        
        updateAuthState({
          user,
          permissions
        });
      }
      
      // Setup next refresh timer
      setupRefreshTimer();
    } catch (error) {
      console.error('Session refresh error:', error);
      
      // If refresh fails, log the user out
      await logout();
    }
  }, [
    authState.isAuthenticated, 
    authState.user, 
    derivePermissionsFromRole, 
    logout, 
    setupRefreshTimer, 
    tokenManager, 
    updateAuthState
  ]);
  
  /**
   * Check if user has specific permission
   * @param permission - Permission to check
   * @returns Boolean indicating if user has permission
   */
  const hasPermission = useCallback((permission: UserPermissions): boolean => {
    if (!authState.isAuthenticated || !authState.permissions) {
      return false;
    }
    
    return authState.permissions.includes(permission);
  }, [authState.isAuthenticated, authState.permissions]);
  
  /**
   * Check if user has specific role
   * @param role - Role or array of roles to check
   * @returns Boolean indicating if user has role
   */
  const hasRole = useCallback((role: UserRole | UserRole[]): boolean => {
    if (!authState.isAuthenticated || !authState.user) {
      return false;
    }
    
    if (Array.isArray(role)) {
      return role.includes(authState.user.role);
    }
    
    return authState.user.role === role;
  }, [authState.isAuthenticated, authState.user]);
  
  /**
   * Clear any authentication errors
   */
  const clearError = useCallback(() => {
    updateAuthState({ error: null });
  }, [updateAuthState]);
  
  /**
   * Effect to restore auth state on mount
   */
  useEffect(() => {
    restoreAuthState();
  }, [restoreAuthState]);
  
  /**
   * Effect to initialize authentication on mount
   */
  useEffect(() => {
    const initializeAuth = async () => {
      // If already initialized, skip
      if (!authState.loading) {
        return;
      }
      
      try {
        // Check if user is authenticated
        const isAuthenticated = authService.isAuthenticated();
        
        if (isAuthenticated) {
          // Get current user
          const currentUser = authService.getCurrentUser();
          
          if (currentUser) {
            // Convert to AuthUser type
            const user: AuthUser = {
              id: currentUser.id,
              email: currentUser.email,
              role: currentUser.role as UserRole
            };
            
            // Setup permissions based on role
            const permissions = derivePermissionsFromRole(currentUser.role);
            
            updateAuthState({
              isAuthenticated: true,
              user,
              permissions,
              loading: false
            });
            
            // Setup the refresh timer
            setupRefreshTimer();
            
            return;
          }
        }
        
        // No valid auth found
        updateAuthState({
          isAuthenticated: false,
          user: null,
          permissions: [],
          loading: false
        });
      } catch (error) {
        console.error('Auth initialization error:', error);
        
        // Reset to unauthenticated state
        updateAuthState({
          isAuthenticated: false,
          user: null,
          permissions: [],
          loading: false,
          error: {
            message: 'Failed to initialize authentication',
            code: 'AUTH_INIT_ERROR',
            timestamp: new Date().toISOString()
          }
        });
      }
    };
    
    initializeAuth();
    
    // Cleanup function to clear refresh timer
    return () => {
      cleanupRefreshTimer();
    };
  }, [
    authState.loading, 
    cleanupRefreshTimer, 
    derivePermissionsFromRole, 
    setupRefreshTimer, 
    updateAuthState
  ]);
  
  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<AuthContextType>(() => ({
    authState,
    login,
    register,
    logout,
    refreshSession,
    hasPermission,
    hasRole,
    clearError
  }), [
    authState,
    login,
    register,
    logout, 
    refreshSession,
    hasPermission,
    hasRole,
    clearError
  ]);
  
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Custom hook to use the authentication context
 * Provides type-safe access to authentication state and operations
 * 
 * @returns Authentication context value
 * @throws Error if used outside of AuthProvider
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

/**
 * Determines if an error is a network error that can be retried
 * 
 * @param error - Error to check
 * @returns Boolean indicating if error is a network error
 */
function isNetworkError(error: any): boolean {
  return (
    error &&
    (error.code === 'NETWORK' ||
     error.message?.includes('network') ||
     error.message?.includes('Network') ||
     error.message?.includes('timeout') ||
     error.message?.includes('connection'))
  );
}

/**
 * Gets a standardized error code from an error object
 * 
 * @param error - Error to process
 * @returns Standardized error code string
 */
function getErrorCode(error: any): string {
  if (!error) {
    return 'UNKNOWN_ERROR';
  }
  
  if (error.code) {
    return error.code;
  }
  
  if (error.response?.status) {
    switch (error.response.status) {
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 422:
        return 'VALIDATION_ERROR';
      case 429:
        return 'TOO_MANY_REQUESTS';
      default:
        return `HTTP_ERROR_${error.response.status}`;
    }
  }
  
  if (error.message) {
    if (error.message.includes('network')) return 'NETWORK_ERROR';
    if (error.message.includes('timeout')) return 'TIMEOUT_ERROR';
    if (error.message.includes('password')) return 'PASSWORD_ERROR';
    if (error.message.includes('email')) return 'EMAIL_ERROR';
  }
  
  return 'UNKNOWN_ERROR';
}

export default AuthContext;