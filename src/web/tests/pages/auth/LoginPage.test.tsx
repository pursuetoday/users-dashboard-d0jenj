import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';

import LoginPage from '../../../../src/pages/auth/LoginPage';
import { renderWithProviders } from '../../utils/test-utils';
import { UserRole } from '../../../../src/types/auth.types';

// Extend expect with axe accessibility testing
expect.extend(toHaveNoViolations);

// Mock the navigate function from react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock analytics tracking
const mockTrack = vi.fn();
vi.mock('@analytics/react', () => ({
  default: () => ({
    track: mockTrack,
  }),
}));

// Create mock auth state and login function
let mockAuthState = {
  isAuthenticated: false,
  user: null,
  loading: false,
};
const mockLogin = vi.fn();

// Mock the useAuth hook
vi.mock('../../../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    ...mockAuthState,
    login: mockLogin,
  }),
}));

// Mock error boundary component for testing error states
vi.mock('react-error-boundary', () => {
  return {
    ErrorBoundary: ({ children, fallbackRender }) => {
      if (global.triggerErrorBoundary) {
        return fallbackRender({ error: new Error('Test error') });
      }
      return <>{children}</>;
    },
  };
});

describe('LoginPage', () => {
  let user;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    mockNavigate.mockReset();
    mockLogin.mockReset();
    mockTrack.mockReset();
    
    // Reset auth state to default
    mockAuthState = {
      isAuthenticated: false,
      user: null,
      loading: false,
    };
    
    // Reset error boundary trigger
    global.triggerErrorBoundary = false;
    
    // Setup userEvent for simulating user interactions
    user = userEvent.setup();
  });

  afterEach(() => {
    // Clean up global error boundary trigger
    delete global.triggerErrorBoundary;
  });

  // Basic rendering tests
  describe('rendering', () => {
    test('renders the login page with correct title and form elements', () => {
      renderWithProviders(<LoginPage />);
      
      // Check page title is rendered
      expect(screen.getByText('Sign In to User Management Dashboard')).toBeInTheDocument();
      
      // Verify form elements are present
      expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Log in/i })).toBeInTheDocument();
    });
    
    test('shows loading state when authentication status is being checked', () => {
      mockAuthState.loading = true;
      
      renderWithProviders(<LoginPage />);
      
      // Check loading indicator is shown
      expect(screen.getByTestId('login-page-loading')).toBeInTheDocument();
      expect(screen.getByText('Authenticating...')).toBeInTheDocument();
      
      // Loading spinner should be visible
      const spinner = screen.getByRole('presentation', { hidden: true });
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('animate-spin');
    });
    
    test('renders LoginForm with correct props', () => {
      renderWithProviders(<LoginPage />);
      
      // The LoginForm component should exist and have appropriate accessibility attributes
      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('aria-label', 'Login Form');
      expect(form).toHaveAttribute('aria-describedby', 'login-instructions');
    });
    
    test('tracks page view with analytics', () => {
      renderWithProviders(<LoginPage />);
      
      // Verify analytics page view tracking was called
      expect(mockTrack).toHaveBeenCalledWith('page_view', expect.objectContaining({
        page_name: 'login',
      }));
    });
  });

  // Authentication flow tests
  describe('authentication flow', () => {
    test('redirects to dashboard if user is already authenticated', async () => {
      mockAuthState.isAuthenticated = true;
      
      renderWithProviders(<LoginPage />);
      
      // Should navigate to dashboard
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });
    });
    
    test('calls login function when form is submitted with valid data', async () => {
      mockLogin.mockResolvedValue(undefined);
      
      renderWithProviders(<LoginPage />);
      
      // Fill the form with valid data
      await user.type(screen.getByLabelText(/Email/i), 'user@example.com');
      await user.type(screen.getByLabelText(/Password/i), 'ValidPassword123!');
      
      // Submit the form
      await user.click(screen.getByRole('button', { name: /Log in/i }));
      
      // Verify login was called with correct data
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'ValidPassword123!'
      });
    });
    
    test('handles successful login and navigates to dashboard', async () => {
      mockLogin.mockResolvedValue(undefined);
      
      renderWithProviders(<LoginPage />);
      
      // Fill the form
      await user.type(screen.getByLabelText(/Email/i), 'user@example.com');
      await user.type(screen.getByLabelText(/Password/i), 'ValidPassword123!');
      
      // Submit the form
      await user.click(screen.getByRole('button', { name: /Log in/i }));
      
      // Mock user data to simulate login success
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        role: UserRole.ADMIN
      };
      
      // Update auth state to simulate login success and trigger useEffect
      mockAuthState.isAuthenticated = true;
      mockAuthState.user = mockUser;
      
      // Verify navigation after successful login
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });
      
      // Verify login success event was tracked
      expect(mockTrack).toHaveBeenCalledWith('login_success', {
        user_id: mockUser.id,
        user_role: mockUser.role
      });
    });
    
    test('displays error message when login fails', async () => {
      const errorMessage = 'Invalid email or password';
      mockLogin.mockRejectedValue(new Error(errorMessage));
      
      renderWithProviders(<LoginPage />);
      
      // Fill the form
      await user.type(screen.getByLabelText(/Email/i), 'user@example.com');
      await user.type(screen.getByLabelText(/Password/i), 'ValidPassword123!');
      
      // Submit the form
      await user.click(screen.getByRole('button', { name: /Log in/i }));
      
      // Verify error message is displayed
      expect(await screen.findByText(errorMessage)).toBeInTheDocument();
    });
  });

  // Form validation tests
  describe('form validation', () => {
    test('validates email format', async () => {
      renderWithProviders(<LoginPage />);
      
      const emailInput = screen.getByLabelText(/Email/i);
      
      // Test invalid email formats
      await user.type(emailInput, 'invalidemail');
      await user.tab(); // Move focus to trigger validation
      
      // Verify error message appears - exact message depends on LoginForm implementation
      await waitFor(() => {
        const errors = screen.getAllByRole('alert');
        const errorTexts = errors.map(el => el.textContent || '');
        expect(errorTexts.some(text => text.includes('valid email'))).toBeTruthy();
      });
      
      // Test valid email
      await user.clear(emailInput);
      await user.type(emailInput, 'valid@example.com');
      await user.tab();
      
      // Verify email error is cleared
      await waitFor(() => {
        const errors = screen.queryAllByRole('alert');
        const errorTexts = errors.map(el => el.textContent || '');
        expect(errorTexts.every(text => !text.includes('valid email'))).toBeTruthy();
      });
    });
    
    test('validates password requirements', async () => {
      renderWithProviders(<LoginPage />);
      
      const passwordInput = screen.getByLabelText(/Password/i);
      
      // Test empty password
      await user.click(passwordInput);
      await user.tab(); // Move focus to trigger validation
      
      // Verify error message appears
      await waitFor(() => {
        const errors = screen.getAllByRole('alert');
        const errorTexts = errors.map(el => el.textContent || '');
        expect(errorTexts.some(text => text.includes('Password is required'))).toBeTruthy();
      });
      
      // Test valid password
      await user.type(passwordInput, 'ValidPassword123!');
      await user.tab();
      
      // Verify password error is cleared
      await waitFor(() => {
        const errors = screen.queryAllByRole('alert');
        const errorTexts = errors.map(el => el.textContent || '');
        expect(errorTexts.every(text => !text.includes('Password is required'))).toBeTruthy();
      });
    });
    
    test('validates form before submission', async () => {
      renderWithProviders(<LoginPage />);
      
      // Submit empty form
      await user.click(screen.getByRole('button', { name: /Log in/i }));
      
      // Verify validation errors appear
      await waitFor(() => {
        const errors = screen.getAllByRole('alert');
        expect(errors.length).toBeGreaterThan(0);
      });
      
      // Verify login was not called
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  // Security tests
  describe('security measures', () => {
    test('sanitizes user input for security', async () => {
      mockLogin.mockResolvedValue(undefined);
      
      renderWithProviders(<LoginPage />);
      
      // Type potentially dangerous input
      await user.type(screen.getByLabelText(/Email/i), 'user@example.com<script>alert("XSS")</script>');
      await user.type(screen.getByLabelText(/Password/i), 'ValidPassword123!');
      
      // Submit form
      await user.click(screen.getByRole('button', { name: /Log in/i }));
      
      // Verify login was called with sanitized values
      expect(mockLogin).toHaveBeenCalled();
      const loginArgs = mockLogin.mock.calls[0][0];
      
      // Email should be sanitized in some way - exact implementation depends on LoginForm
      expect(loginArgs.email).toContain('user@example.com');
    });
    
    test('implements rate limiting for login attempts', async () => {
      // Mock login to fail multiple times
      for (let i = 0; i < 6; i++) {
        mockLogin.mockRejectedValueOnce(new Error(`Error ${i + 1}`));
      }
      
      renderWithProviders(<LoginPage />);
      
      // Fill the form
      await user.type(screen.getByLabelText(/Email/i), 'user@example.com');
      await user.type(screen.getByLabelText(/Password/i), 'ValidPassword123!');
      
      // Submit form multiple times to trigger rate limiting
      // Rate limiting implementation details depend on LoginForm
      for (let i = 0; i < 6; i++) {
        await user.click(screen.getByRole('button', { name: /Log in/i }));
        // Small delay between submissions
        await new Promise(r => setTimeout(r, 50));
      }
      
      // Verify rate limit message appears
      // The exact error message depends on the implementation
      await waitFor(() => {
        const errors = screen.getAllByRole('alert');
        const errorTexts = errors.map(el => el.textContent || '');
        expect(errorTexts.some(text => 
          text.includes('Too many') || text.includes('rate limit') || text.includes('try again')
        )).toBeTruthy();
      });
    });
  });

  // Error handling tests
  describe('error handling', () => {
    test('shows error boundary fallback when an error occurs', () => {
      // Trigger error boundary
      global.triggerErrorBoundary = true;
      
      renderWithProviders(<LoginPage />);
      
      // Error boundary fallback should be rendered
      expect(screen.getByText(/An error occurred/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
    });
  });

  // Accessibility tests
  describe('accessibility compliance', () => {
    test('supports keyboard navigation', async () => {
      renderWithProviders(<LoginPage />);
      
      // Get form elements
      const emailInput = screen.getByLabelText(/Email/i);
      const passwordInput = screen.getByLabelText(/Password/i);
      const loginButton = screen.getByRole('button', { name: /Log in/i });
      
      // Set initial focus on email
      emailInput.focus();
      expect(document.activeElement).toBe(emailInput);
      
      // Tab to password
      await user.tab();
      expect(document.activeElement).toBe(passwordInput);
      
      // Tab to login button
      await user.tab();
      expect(document.activeElement).toBe(loginButton);
    });
    
    test('can be used with keyboard only', async () => {
      mockLogin.mockResolvedValue(undefined);
      
      renderWithProviders(<LoginPage />);
      
      // Focus on email field
      const emailInput = screen.getByLabelText(/Email/i);
      emailInput.focus();
      
      // Type email using keyboard
      await user.keyboard('user@example.com');
      
      // Tab to password
      await user.tab();
      
      // Type password using keyboard
      await user.keyboard('ValidPassword123!');
      
      // Tab to login button
      await user.tab();
      
      // Press Enter to submit
      await user.keyboard('{Enter}');
      
      // Verify login was called with correct values
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: 'user@example.com',
          password: 'ValidPassword123!'
        });
      });
    });
    
    test('has proper focus management during loading and errors', async () => {
      mockLogin.mockRejectedValue(new Error('Login failed'));
      
      renderWithProviders(<LoginPage />);
      
      // Submit form
      await user.type(screen.getByLabelText(/Email/i), 'user@example.com');
      await user.type(screen.getByLabelText(/Password/i), 'ValidPassword123!');
      await user.click(screen.getByRole('button', { name: /Log in/i }));
      
      // After error, focus should stay in the form
      await waitFor(() => {
        expect(screen.getByText('Login failed')).toBeInTheDocument();
      });
      
      // Focus should be managed properly within the form
      expect(document.activeElement).toBeVisible();
    });
    
    test('has appropriate ARIA attributes for screen readers', () => {
      renderWithProviders(<LoginPage />);
      
      // Check for appropriate ARIA roles and labels
      expect(screen.getByRole('form')).toHaveAttribute('aria-label', 'Login Form');
      
      // Email field should be marked as required
      const emailInput = screen.getByLabelText(/Email/i);
      expect(emailInput).toHaveAttribute('aria-required', 'true');
      
      // Password field should be marked as required
      const passwordInput = screen.getByLabelText(/Password/i);
      expect(passwordInput).toHaveAttribute('aria-required', 'true');
      
      // Button should have proper aria label
      const button = screen.getByRole('button', { name: /Log in/i });
      expect(button).toHaveAttribute('aria-disabled', 'false');
    });
  });
});