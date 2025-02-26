/**
 * RegisterForm Component Tests
 * 
 * Comprehensive test suite for the RegisterForm component that validates:
 * - Form rendering and accessibility
 * - Input validation for all fields
 * - Error handling
 * - Successful registration flow
 * - Form submission behavior
 * - Password strength indicator
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import RegisterForm from '../../../src/components/auth/RegisterForm';
import { renderWithProviders } from '../../utils/test-utils';
import { server } from '../../mocks/server';
import { rest, HttpResponse } from 'msw';

// Valid user data for tests
const validUserData = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'test@example.com',
  password: 'Test123!@#'
};

// Invalid email formats for testing validation
const invalidEmailFormats = [
  'invalid-email',
  'test@',
  '@example.com',
  'test@.com',
  'test@example.'
];

// Invalid passwords for testing validation
const invalidPasswords = [
  'short',
  'nouppercase123!',
  'NOLOWERCASE123!',
  'NoSpecialChar123',
  'NoNumber!@#'
];

// Mock error messages that match validation schema
const errorMessages = {
  required: 'This field is required',
  invalid_email: 'Please enter a valid email address',
  email_length: 'Email must be less than 255 characters',
  password_length: 'Password must be at least 8 characters',
  password_requirements: 'Password must include uppercase, number, and special character',
  name_length: 'Name must be between 2 and 50 characters', 
  name_format: 'Name can only contain letters and spaces'
};

// Mock responses for different API scenarios
const successful_registration_response = {
  status: 201,
  body: {
    message: 'Registration successful',
    user: {
      id: 'test-id',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe'
    }
  }
};

const registration_error_response = {
  status: 400,
  body: {
    message: 'Email already exists',
    errors: {
      email: 'This email is already registered'
    }
  }
};

// Setup function that handles common setup for tests
const setup = () => {
  const user = userEvent.setup();
  return {
    user,
    ...renderWithProviders(<RegisterForm />)
  };
};

describe('RegisterForm Component', () => {
  // Setup and teardown
  beforeEach(() => {
    // Listen for request interception
    server.listen();
  });

  afterEach(() => {
    // Reset handlers between tests
    server.resetHandlers();
  });

  it('renders all form fields with proper accessibility attributes', () => {
    // Render the component
    const { getByLabelText, getByRole, getByTestId } = setup();
    
    // Check if all form elements are rendered with proper accessibility attributes
    const firstNameInput = getByTestId('register-firstName');
    expect(firstNameInput).toBeInTheDocument();
    expect(firstNameInput).toHaveAttribute('aria-required', 'true');
    
    const lastNameInput = getByTestId('register-lastName');
    expect(lastNameInput).toBeInTheDocument();
    expect(lastNameInput).toHaveAttribute('aria-required', 'true');
    
    const emailInput = getByTestId('register-email');
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute('aria-required', 'true');
    expect(emailInput).toHaveAttribute('type', 'email');
    
    const passwordInput = getByTestId('register-password');
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute('aria-required', 'true');
    expect(passwordInput).toHaveAttribute('type', 'password');
    
    // Check if submit button exists with proper role
    const submitButton = getByTestId('register-submit');
    expect(submitButton).toBeInTheDocument();
  });

  it('validates required fields with proper error messages', async () => {
    // Render the component
    const { user, getByTestId, findByText } = setup();
    
    // Submit form without filling any fields
    const submitButton = getByTestId('register-submit');
    await user.click(submitButton);
    
    // Check for required field error messages
    const firstNameError = await findByText(/This field is required/i);
    expect(firstNameError).toBeInTheDocument();
    
    // Check for other required fields
    expect(await findByText(/This field is required/i)).toBeInTheDocument(); // lastName error
    expect(await findByText(/This field is required/i)).toBeInTheDocument(); // email error
    expect(await findByText(/This field is required/i)).toBeInTheDocument(); // password error
    
    // Check that error messages have proper accessibility attributes
    const errorMessages = screen.getAllByRole('alert');
    expect(errorMessages.length).toBeGreaterThan(0);
    errorMessages.forEach(message => {
      expect(message).toBeInTheDocument();
    });
    
    // Form should maintain focus on the first error field (firstName)
    expect(document.activeElement).toBe(getByTestId('register-firstName'));
  });

  it('validates email format with comprehensive rules', async () => {
    // Render the component
    const { user, getByTestId, findByText } = setup();
    
    const emailInput = getByTestId('register-email');
    const submitButton = getByTestId('register-submit');
    
    // Fill other required fields to prevent those errors
    const firstNameInput = getByTestId('register-firstName');
    const lastNameInput = getByTestId('register-lastName');
    const passwordInput = getByTestId('register-password');
    
    await user.type(firstNameInput, 'John');
    await user.type(lastNameInput, 'Doe');
    await user.type(passwordInput, 'Password123!');
    
    // Test with various invalid email formats
    for (const invalidEmail of invalidEmailFormats) {
      await user.clear(emailInput);
      await user.type(emailInput, invalidEmail);
      await user.click(submitButton);
      
      // Check for email format error message
      const emailError = await findByText(/Please enter a valid email address/i);
      expect(emailError).toBeInTheDocument();
    }
    
    // Test email maximum length validation (255 chars)
    const longEmail = 'a'.repeat(246) + '@test.com'; // 256 chars total
    await user.clear(emailInput);
    await user.type(emailInput, longEmail);
    await user.click(submitButton);
    
    expect(await findByText(/Email must not exceed 255 characters/i)).toBeInTheDocument();
    
    // Test with valid email
    await user.clear(emailInput);
    await user.type(emailInput, 'valid@example.com');
    await user.click(submitButton);
    
    // Ensure no email format error is shown
    await waitFor(() => {
      expect(screen.queryByText(/Please enter a valid email address/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Email must not exceed 255 characters/i)).not.toBeInTheDocument();
    });
  });

  it('validates password with security requirements', async () => {
    // Render the component
    const { user, getByTestId, findByText } = setup();
    
    const passwordInput = getByTestId('register-password');
    const submitButton = getByTestId('register-submit');
    
    // Fill other required fields to prevent those errors
    const firstNameInput = getByTestId('register-firstName');
    const lastNameInput = getByTestId('register-lastName');
    const emailInput = getByTestId('register-email');
    
    await user.type(firstNameInput, 'John');
    await user.type(lastNameInput, 'Doe');
    await user.type(emailInput, 'test@example.com');
    
    // Test minimum length requirement
    await user.type(passwordInput, 'short');
    await user.click(submitButton);
    expect(await findByText(/Password must be at least 8 characters/i)).toBeInTheDocument();
    
    // Test uppercase character requirement
    await user.clear(passwordInput);
    await user.type(passwordInput, 'nouppercase123!');
    await user.click(submitButton);
    expect(await findByText(/must contain at least one uppercase letter/i)).toBeInTheDocument();
    
    // Test number requirement
    await user.clear(passwordInput);
    await user.type(passwordInput, 'NoNumber!@#');
    await user.click(submitButton);
    expect(await findByText(/must contain at least one number/i)).toBeInTheDocument();
    
    // Test special character requirement
    await user.clear(passwordInput);
    await user.type(passwordInput, 'NoSpecialChar123');
    await user.click(submitButton);
    expect(await findByText(/must contain at least one special character/i)).toBeInTheDocument();
    
    // Test with valid password
    await user.clear(passwordInput);
    await user.type(passwordInput, 'ValidPassword123!');
    
    await user.click(submitButton);
    
    // Ensure no password errors remain
    await waitFor(() => {
      expect(screen.queryByText(/must be at least 8 characters/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/must contain at least one uppercase letter/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/must contain at least one number/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/must contain at least one special character/i)).not.toBeInTheDocument();
    });
  });

  it('validates name fields with proper rules', async () => {
    // Render the component
    const { user, getByTestId, findByText } = setup();
    
    const firstNameInput = getByTestId('register-firstName');
    const lastNameInput = getByTestId('register-lastName');
    const submitButton = getByTestId('register-submit');
    
    // Fill other required fields to prevent those errors
    const emailInput = getByTestId('register-email');
    const passwordInput = getByTestId('register-password');
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'Password123!');
    
    // Test minimum length (2 chars)
    await user.type(firstNameInput, 'J');
    await user.click(submitButton);
    expect(await findByText(/Name must be between 2 and 50 characters/i)).toBeInTheDocument();
    
    // Test maximum length (50 chars)
    await user.clear(firstNameInput);
    await user.type(firstNameInput, 'A'.repeat(51));
    await user.click(submitButton);
    expect(await findByText(/Name must be between 2 and 50 characters/i)).toBeInTheDocument();
    
    // Test invalid characters rejection
    await user.clear(firstNameInput);
    await user.type(firstNameInput, 'John123');
    await user.click(submitButton);
    expect(await findByText(/Name can only contain letters and spaces/i)).toBeInTheDocument();
    
    // Test valid name acceptance
    await user.clear(firstNameInput);
    await user.type(firstNameInput, 'John');
    await user.type(lastNameInput, 'Doe');
    
    await user.click(submitButton);
    
    // Ensure no name validation errors remain
    await waitFor(() => {
      expect(screen.queryByText(/Name must be between 2 and 50 characters/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Name can only contain letters and spaces/i)).not.toBeInTheDocument();
    });
  });

  it('displays password strength indicator when password is entered', async () => {
    // Render the component
    const { user, getByTestId, findByText } = setup();
    
    const passwordInput = getByTestId('register-password');
    
    // Type a weak password
    await user.type(passwordInput, 'weak');
    
    // Verify weak indicator is shown
    expect(await findByText(/Weak/i)).toBeInTheDocument();
    
    // Clear and type a moderate password
    await user.clear(passwordInput);
    await user.type(passwordInput, 'Moderate123');
    
    // Verify moderate indicator is shown
    expect(await findByText(/Moderate|Good/i)).toBeInTheDocument();
    
    // Clear and type a strong password
    await user.clear(passwordInput);
    await user.type(passwordInput, 'StrongPass123!@#');
    
    // Verify strong indicator is shown
    expect(await findByText(/Strong/i)).toBeInTheDocument();
    
    // Check accessibility of strength indicator
    const strengthElement = screen.getByText(/Strong|Moderate|Weak/i).closest('div');
    expect(strengthElement).toHaveAttribute('aria-live', 'polite');
  });

  it('handles successful registration flow', async () => {
    // Configure MSW to return a successful response
    server.use(
      rest.post('/auth/register', async () => {
        return HttpResponse.json(successful_registration_response.body, 
          { status: successful_registration_response.status });
      })
    );
    
    // Render the component
    const { user, getByTestId, findByText } = setup();
    
    // Fill form with valid data
    const firstNameInput = getByTestId('register-firstName');
    const lastNameInput = getByTestId('register-lastName');
    const emailInput = getByTestId('register-email');
    const passwordInput = getByTestId('register-password');
    const submitButton = getByTestId('register-submit');
    
    await user.type(firstNameInput, validUserData.firstName);
    await user.type(lastNameInput, validUserData.lastName);
    await user.type(emailInput, validUserData.email);
    await user.type(passwordInput, validUserData.password);
    
    // Submit form
    await user.click(submitButton);
    
    // Check for loading state
    expect(submitButton).toHaveAttribute('aria-busy', 'true');
    expect(submitButton).toBeDisabled();
    
    // Wait for success (this would typically involve checking for a success message or redirect)
    // In this case, the form resets on success, so we check that inputs are cleared
    await waitFor(() => {
      expect(firstNameInput).toHaveValue('');
      expect(lastNameInput).toHaveValue('');
      expect(emailInput).toHaveValue('');
      expect(passwordInput).toHaveValue('');
    });
    
    // Check navigation to next step
    const loginLink = screen.getByTestId('register-login-link');
    expect(loginLink).toBeInTheDocument();
  });

  it('handles registration errors appropriately', async () => {
    // Configure MSW to return an error response
    server.use(
      rest.post('/auth/register', async () => {
        return HttpResponse.json(registration_error_response.body, 
          { status: registration_error_response.status });
      })
    );
    
    // Render the component
    const { user, getByTestId, findByText } = setup();
    
    // Fill form with valid data
    const firstNameInput = getByTestId('register-firstName');
    const lastNameInput = getByTestId('register-lastName');
    const emailInput = getByTestId('register-email');
    const passwordInput = getByTestId('register-password');
    const submitButton = getByTestId('register-submit');
    
    await user.type(firstNameInput, validUserData.firstName);
    await user.type(lastNameInput, validUserData.lastName);
    await user.type(emailInput, validUserData.email);
    await user.type(passwordInput, validUserData.password);
    
    // Submit form
    await user.click(submitButton);
    
    // Check that the error message is displayed
    const errorMessage = await findByText(/email is already registered/i);
    expect(errorMessage).toBeInTheDocument();
    
    // Check error message accessibility
    expect(errorMessage).toHaveAttribute('role', 'alert');
    
    // Ensure form remains interactive
    expect(submitButton).not.toBeDisabled();
    expect(firstNameInput).toBeEnabled();
    expect(lastNameInput).toBeEnabled();
    expect(emailInput).toBeEnabled();
    expect(passwordInput).toBeEnabled();
  });
});