/**
 * Comprehensive test suite for the useAuth custom hook
 * Tests authentication functionality including login, registration,
 * logout operations with extensive error handling and security validation
 */

import { renderHook, act, waitFor } from '@testing-library/react'; // ^14.0.0
import { expect } from '@jest/globals'; // ^29.0.0
import { useAuth } from '../../src/hooks/useAuth';
import { renderWithProviders } from '../utils/test-utils';
import { server } from '../mocks/server';
import { handlers } from '../mocks/handlers';

/**
 * Setup the test environment before all tests
 */
beforeAll(() => {
  // Start MSW server to intercept and mock API requests
  server.listen();
  
  // Initialize any required environment variables
  Object.defineProperty(window, 'tokenRefreshInterval', {
    writable: true,
    value: undefined
  });
  
  // Mock console methods to silence expected errors
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

/**
 * Clean up after each test to ensure isolated test environments
 */
afterEach(() => {
  // Reset all MSW handlers to default mock implementations
  server.resetHandlers();
  
  // Clean up any mocked responses
  jest.clearAllMocks();
  
  // Clear any authentication data in localStorage
  localStorage.clear();
  sessionStorage.clear();
  
  // Clear any token refresh intervals
  if (window.tokenRefreshInterval) {
    clearInterval(window.tokenRefreshInterval);
    delete window.tokenRefreshInterval;
  }
  
  // Remove event listeners added by the hook
  document.removeEventListener('click', expect.any(Function));
  document.removeEventListener('keypress', expect.any(Function));
});

/**
 * Final cleanup after all tests are completed
 */
afterAll(() => {
  // Close the MSW server
  server.close();
  
  // Restore console methods
  jest.restoreAllMocks();
});

describe('useAuth Hook', () => {
  // Test initial state values
  describe('Initial State', () => {
    test('should initialize with default unauthenticated state', async () => {
      // Render the hook with necessary providers
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => renderWithProviders(children)
      });

      // Verify initial state values
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  // Test login functionality
  describe('Login Functionality', () => {
    test('successful login should update isAuthenticated and user state', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => renderWithProviders(children)
      });

      // Act: Perform login
      await act(async () => {
        await result.current.login({
          email: 'admin@example.com',
          password: 'password123'
        });
      });

      // Assert: Check authentication state
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(
        expect.objectContaining({
          email: 'admin@example.com',
          role: expect.any(String)
        })
      );
      expect(result.current.loading).toBe(false);
      
      // Check token storage
      expect(localStorage.getItem('authToken')).toBeTruthy();
      
      // Check if token refresh interval was set
      expect(window.tokenRefreshInterval).toBeDefined();
    });

    test('should handle invalid credentials error', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => renderWithProviders(children)
      });

      // Act & Assert: Login with invalid credentials should throw
      await expect(async () => {
        await act(async () => {
          await result.current.login({
            email: 'admin@example.com',
            password: 'wrongpassword'
          });
        });
      }).rejects.toThrow();

      // State should remain unauthenticated
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    test('should handle missing credentials validation', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => renderWithProviders(children)
      });

      // Act & Assert: Login with missing credentials should throw
      await expect(async () => {
        await act(async () => {
          await result.current.login({
            email: '',
            password: 'password123'
          });
        });
      }).rejects.toThrow('Email and password are required');

      // State should remain unauthenticated
      expect(result.current.isAuthenticated).toBe(false);
    });

    test('should handle network errors gracefully', async () => {
      // Override default handler with one that returns a network error
      server.use(
        handlers.authHandlers.find(h => 
          h.info.path.toString().includes('/auth/login') && 
          h.info.method === 'POST'
        )?.disable()
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => renderWithProviders(children)
      });

      // Act & Assert: Network error should throw
      await expect(async () => {
        await act(async () => {
          await result.current.login({
            email: 'admin@example.com',
            password: 'password123'
          });
        });
      }).rejects.toThrow();

      // State should remain unauthenticated
      expect(result.current.isAuthenticated).toBe(false);
    });

    test('should enforce rate limiting for multiple attempts', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => renderWithProviders(children)
      });

      // Setup rate limiting state
      const testEmail = 'ratelimited@example.com';
      localStorage.setItem(`auth_ratelimit_${testEmail}`, JSON.stringify({
        count: 6,
        timestamp: Date.now()
      }));

      // Act & Assert: Rate limited login should throw
      await expect(async () => {
        await act(async () => {
          await result.current.login({
            email: testEmail,
            password: 'password123'
          });
        });
      }).rejects.toThrow('Too many login attempts');

      // State should remain unauthenticated
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  // Test registration functionality
  describe('Registration Process', () => {
    test('successful registration should create user and authenticate', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => renderWithProviders(children)
      });

      const validRegistrationData = {
        email: 'newuser@example.com',
        password: 'StrongP@ssw0rd',
        firstName: 'New',
        lastName: 'User'
      };

      // Act: Register a new user
      await act(async () => {
        await result.current.register(validRegistrationData);
      });

      // Assert: Should be authenticated with new user
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(
        expect.objectContaining({
          email: 'newuser@example.com'
        })
      );
    });

    test('should reject registration with duplicate email', async () => {
      // Mock a duplicate email error
      server.use(
        handlers.authHandlers.find(h => 
          h.info.path.toString().includes('/auth/register') && 
          h.info.method === 'POST'
        )?.disable()
      );

      // Setup existing user check to simulate a duplicate email
      localStorage.setItem('existing_users', JSON.stringify(['existing@example.com']));

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => renderWithProviders(children)
      });

      // Act & Assert: Duplicate email should throw
      await expect(async () => {
        await act(async () => {
          await result.current.register({
            email: 'existing@example.com',
            password: 'StrongP@ssw0rd',
            firstName: 'Existing',
            lastName: 'User'
          });
        });
      }).rejects.toThrow('already exists');

      // State should remain unauthenticated
      expect(result.current.isAuthenticated).toBe(false);
    });

    test('should validate email format during registration', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => renderWithProviders(children)
      });

      // Act & Assert: Invalid email should throw
      await expect(async () => {
        await act(async () => {
          await result.current.register({
            email: 'invalid-email',
            password: 'StrongP@ssw0rd',
            firstName: 'Test',
            lastName: 'User'
          });
        });
      }).rejects.toThrow('Invalid email format');

      // State should remain unauthenticated
      expect(result.current.isAuthenticated).toBe(false);
    });

    test('should validate password strength requirements', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => renderWithProviders(children)
      });

      // Test weak passwords
      const weakPasswordTests = [
        { password: 'short', error: 'at least 8 characters' },
        { password: 'nouppercase123!', error: 'uppercase letter' },
        { password: 'NOLOWERCASE123!', error: 'lowercase letter' },
        { password: 'NoNumbers!', error: 'number' },
        { password: 'NoSpecialChar123', error: 'special character' },
      ];

      for (const { password, error } of weakPasswordTests) {
        await expect(async () => {
          await act(async () => {
            await result.current.register({
              email: 'test@example.com',
              password,
              firstName: 'Test',
              lastName: 'User'
            });
          });
        }).rejects.toThrow(error);

        // State should remain unauthenticated
        expect(result.current.isAuthenticated).toBe(false);
      }
    });
  });

  // Test logout functionality
  describe('Logout Process', () => {
    test('should clear authentication state on logout', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => renderWithProviders(children)
      });

      // First login to set authenticated state
      await act(async () => {
        await result.current.login({
          email: 'admin@example.com',
          password: 'password123'
        });
      });

      // Verify logged in state
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).not.toBeNull();
      expect(localStorage.getItem('authToken')).toBeTruthy();

      // Act: Logout
      await act(async () => {
        await result.current.logout();
      });

      // Assert: Should be logged out
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(localStorage.getItem('authToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
      expect(window.tokenRefreshInterval).toBeUndefined();
    });

    test('should remove stored tokens', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => renderWithProviders(children)
      });

      // Setup tokens in storage
      localStorage.setItem('authToken', 'test-auth-token');
      localStorage.setItem('refreshToken', 'test-refresh-token');
      localStorage.setItem('tokenExpiry', '9999999999');
      sessionStorage.setItem('session_start', Date.now().toString());

      // Act: Logout
      await act(async () => {
        await result.current.logout();
      });

      // Assert: All tokens and session data should be cleared
      expect(localStorage.getItem('authToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
      expect(localStorage.getItem('tokenExpiry')).toBeNull();
      expect(sessionStorage.getItem('session_start')).toBeNull();
    });

    test('should handle logout errors', async () => {
      // Override the logout handler to simulate an error
      server.use(
        handlers.authHandlers.find(h => 
          h.info.path.toString().includes('/auth/logout') && 
          h.info.method === 'POST'
        )?.disable()
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => renderWithProviders(children)
      });

      // First login
      await act(async () => {
        await result.current.login({
          email: 'admin@example.com',
          password: 'password123'
        });
      });

      // Act: Even with error, should still complete logout
      await act(async () => {
        await result.current.logout();
      });

      // Assert: Should still be logged out and tokens cleared
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(localStorage.getItem('authToken')).toBeNull();
    });
  });

  // Test error handling
  describe('Error Handling', () => {
    test('API errors should be properly formatted', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => renderWithProviders(children)
      });

      // Act & Assert: API error should be handled
      await expect(async () => {
        await act(async () => {
          await result.current.login({
            email: 'admin@example.com',
            password: 'wrongpassword'
          });
        });
      }).rejects.toThrow();

      // Console error should have been called with properly formatted error
      expect(console.error).toHaveBeenCalledWith(
        'Authentication error:',
        expect.objectContaining({
          type: 'LOGIN_ERROR',
          message: expect.any(String),
          timestamp: expect.any(String)
        })
      );
    });

    test('network errors should be handled', async () => {
      // Disable the login handler to simulate network error
      server.use(
        handlers.authHandlers.find(h => 
          h.info.path.toString().includes('/auth/login') && 
          h.info.method === 'POST'
        )?.disable()
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => renderWithProviders(children)
      });

      // Act & Assert: Network error should be handled
      await expect(async () => {
        await act(async () => {
          await result.current.login({
            email: 'admin@example.com',
            password: 'password123'
          });
        });
      }).rejects.toThrow();
    });

    test('validation errors should be descriptive', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => renderWithProviders(children)
      });

      // Test email validation error
      await expect(async () => {
        await act(async () => {
          await result.current.register({
            email: 'invalid-email',
            password: 'StrongP@ssw0rd',
            firstName: 'Test',
            lastName: 'User'
          });
        });
      }).rejects.toThrow('Invalid email format');

      // Test password validation error
      await expect(async () => {
        await act(async () => {
          await result.current.register({
            email: 'valid@example.com',
            password: 'weak',
            firstName: 'Test',
            lastName: 'User'
          });
        });
      }).rejects.toThrow('Password must be at least 8 characters');
    });
  });

  // Test security measures
  describe('Security Measures', () => {
    test('tokens should be securely stored', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => renderWithProviders(children)
      });

      // Log in to set tokens
      await act(async () => {
        await result.current.login({
          email: 'admin@example.com',
          password: 'password123'
        });
      });

      // Password should not be stored anywhere in localStorage
      const allStorageKeys = Object.keys(localStorage);
      for (const key of allStorageKeys) {
        const value = localStorage.getItem(key);
        expect(value).not.toContain('password123');
      }

      // Session activity tracking should be enabled
      expect(sessionStorage.getItem('session_start')).toBeTruthy();
    });

    test('should prevent XSS vulnerabilities', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => renderWithProviders(children)
      });

      // Test with malicious XSS payload in login
      const xssPayload = '<script>alert("XSS")</script>';
      
      // Should throw validation error, not execute the script
      await expect(async () => {
        await act(async () => {
          await result.current.login({
            email: `user@example.com${xssPayload}`,
            password: 'password123'
          });
        });
      }).rejects.toThrow();

      // Check stored values don't contain unescaped script tags
      const allStorageKeys = Object.keys(localStorage);
      for (const key of allStorageKeys) {
        const value = localStorage.getItem(key);
        if (value) {
          expect(value).not.toMatch(/<script>/i);
        }
      }
    });

    test('session management should be secure', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => renderWithProviders(children)
      });

      // Log in to set up session
      await act(async () => {
        await result.current.login({
          email: 'admin@example.com',
          password: 'password123'
        });
      });

      // Session monitoring should be active
      expect(sessionStorage.getItem('session_start')).toBeTruthy();
      
      // Test session timeout handler
      await act(async () => {
        await result.current.handleSessionTimeout();
      });
      
      // Session should be cleared and user logged out
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(sessionStorage.getItem('session_start')).toBeNull();
      expect(localStorage.getItem('authToken')).toBeNull();
    });
  });
});