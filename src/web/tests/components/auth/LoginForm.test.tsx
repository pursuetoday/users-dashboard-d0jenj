import React from 'react';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { axe } from 'jest-axe';

import LoginForm from '../../../src/components/auth/LoginForm';
import { renderWithProviders } from '../../utils/test-utils';

// Create mock for useAuth
vi.mock('../../../src/hooks/useAuth', () => ({
  useAuth: vi.fn()
}));

// Import the mocked module
import { useAuth } from '../../../src/hooks/useAuth';

describe('LoginForm Component', () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.resetAllMocks();
  });
  
  /**
   * Enhanced test setup function with provider configuration and mock utilities
   */
  const setup = (props = {}) => {
    // Create mock for login function
    const loginMock = vi.fn();
    
    // Set up auth state
    const authState = {
      isAuthenticated: false,
      user: null,
      loading: false
    };
    
    // Configure useAuth mock implementation
    (useAuth as vi.Mock).mockImplementation(() => ({
      ...authState,
      login: loginMock
    }));
    
    // Create success callback mock
    const onSuccessMock = vi.fn();
    
    // Setup userEvent
    const user = userEvent.setup();
    
    // Render component with providers
    const renderResult = renderWithProviders(
      <LoginForm 
        onSuccess={onSuccessMock}
        {...props}
      />
    );
    
    return {
      ...renderResult,
      user,
      loginMock,
      onSuccessMock,
      
      // Helper to update auth state
      updateAuthState: (newState) => {
        Object.assign(authState, newState);
        (useAuth as vi.Mock).mockImplementation(() => ({
          ...authState,
          login: loginMock
        }));
      },
      
      // Helper to fill form
      async fillForm(email = 'test@example.com', password = 'Password123!') {
        const emailInput = screen.getByLabelText(/email/i);
        const passwordInput = screen.getByLabelText(/password/i);
        
        await user.clear(emailInput);
        await user.type(emailInput, email);
        
        await user.clear(passwordInput);
        await user.type(passwordInput, password);
        
        return { emailInput, passwordInput };
      },
      
      // Helper to submit form
      async submitForm() {
        const submitButton = screen.getByRole('button', { name: /log in/i });
        await user.click(submitButton);
        return submitButton;
      }
    };
  };

  it('renders_login_form', async () => {
    // Render the login form
    const { container } = setup();
    
    // Verify form is present
    const form = screen.getByRole('form');
    expect(form).toHaveAttribute('aria-label', 'Login Form');
    
    // Verify input fields
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /log in/i });
    
    expect(emailInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(submitButton).toBeInTheDocument();
    
    // Verify help text
    expect(screen.getByText(/enter the email address associated with your account/i)).toBeInTheDocument();
    
    // Check for accessibility issues
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('validates_form_fields', async () => {
    const { user, submitForm } = setup();
    
    // Submit empty form to trigger validations
    await submitForm();
    
    // Check for required field validations
    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
    
    // Test email format validation
    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'invalid-email');
    
    // Move focus to trigger validation
    await user.tab();
    
    expect(await screen.findByText(/please enter a valid email address/i)).toBeInTheDocument();
    
    // Test valid email
    await user.clear(emailInput);
    await user.type(emailInput, 'test@example.com');
    await user.tab();
    
    // Wait for validation to clear
    await waitFor(() => {
      expect(screen.queryByText(/please enter a valid email address/i)).not.toBeInTheDocument();
    });
    
    // Test password field
    const passwordInput = screen.getByLabelText(/password/i);
    await user.clear(passwordInput);
    await user.type(passwordInput, 'Password123!');
    await user.tab();
    
    // Ensure no errors are displayed when form is valid
    await waitFor(() => {
      expect(screen.queryByText(/email is required/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/password is required/i)).not.toBeInTheDocument();
    });
  });

  it('handles_authentication_flow', async () => {
    const { user, loginMock, onSuccessMock, updateAuthState, fillForm, submitForm } = setup();
    
    // Fill form with valid data
    await fillForm();
    
    // Submit the form
    const submitButton = await submitForm();
    
    // Verify login function was called with correct values
    expect(loginMock).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'Password123!'
    });
    
    // Simulate successful login
    updateAuthState({
      loading: false,
      user: { id: '123', email: 'test@example.com', role: 'user' }
    });
    
    // Verify onSuccess callback was called with user data
    await waitFor(() => {
      expect(onSuccessMock).toHaveBeenCalledWith({ 
        id: '123', 
        email: 'test@example.com', 
        role: 'user' 
      });
    });
    
    // Test loading state
    updateAuthState({ loading: true, user: null });
    
    // Verify button is disabled during loading
    expect(submitButton).toBeDisabled();
    
    // Test error handling
    loginMock.mockRejectedValueOnce(new Error('Invalid email or password'));
    updateAuthState({ loading: false, user: null });
    
    await submitForm();
    
    // Wait for error message to appear
    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
  });

  it('handles rate limiting', async () => {
    // Create form with low rate limit threshold
    const { loginMock, fillForm, submitForm } = setup({ rateLimitAttempts: 2 });
    
    // Fill form with valid credentials
    await fillForm();
    
    // Submit multiple times to trigger rate limiting
    // First submission
    await submitForm();
    expect(loginMock).toHaveBeenCalledTimes(1);
    
    // Second submission
    await submitForm();
    expect(loginMock).toHaveBeenCalledTimes(2);
    
    // Third submission - should be rate limited
    await submitForm();
    
    // Check for rate limit error message
    expect(await screen.findByText(/too many login attempts/i)).toBeInTheDocument();
    
    // Verify login wasn't called a third time
    expect(loginMock).toHaveBeenCalledTimes(2);
  });

  it('supports custom aria attributes', async () => {
    const customAriaLabel = 'Custom Login Form';
    const customAriaDescribedBy = 'login-instructions';
    
    setup({ 
      'aria-label': customAriaLabel, 
      'aria-describedby': customAriaDescribedBy 
    });
    
    const form = screen.getByRole('form');
    expect(form).toHaveAttribute('aria-label', customAriaLabel);
    expect(form).toHaveAttribute('aria-describedby', customAriaDescribedBy);
  });

  it('respects the validationMode prop', async () => {
    // Create form with onBlur validation mode
    const { user } = setup({ validationMode: 'onBlur' });
    
    // Get email input
    const emailInput = screen.getByLabelText(/email/i);
    
    // Type invalid email
    await user.type(emailInput, 'invalid');
    
    // No validation error should appear yet (validation on blur)
    expect(screen.queryByText(/please enter a valid email address/i)).not.toBeInTheDocument();
    
    // Blur the field to trigger validation
    await user.tab();
    
    // Now the error should appear
    expect(await screen.findByText(/please enter a valid email address/i)).toBeInTheDocument();
  });
});