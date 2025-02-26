/**
 * Test suite for UserForm component validating form functionality,
 * validation rules, accessibility compliance, and context integration.
 */

import React from 'react';
import { screen, render, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import axe from '@axe-core/react';

import UserForm from '../../../../src/components/user/UserForm';
import { renderWithProviders } from '../../utils/test-utils';
import { UserRole } from '../../../../src/types/user.types';

// Default form props used in tests
const defaultProps = {
  initialValues: {
    email: '',
    firstName: '',
    lastName: '',
    role: 'USER',
    isActive: true
  },
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
  isLoading: false
};

// Valid user data for form filling
const validUserData = {
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  role: 'USER',
  isActive: true
};

/**
 * Helper function to render UserForm with default props and required providers
 */
const setup = (customProps = {}) => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();
  
  const props = {
    ...defaultProps,
    onSubmit: mockOnSubmit,
    onCancel: mockOnCancel,
    ...customProps
  };
  
  const utils = renderWithProviders(<UserForm {...props} />);
  
  return {
    ...utils,
    mockOnSubmit,
    mockOnCancel
  };
};

/**
 * Helper function to fill form with valid data
 */
const fillForm = async (formData = validUserData) => {
  const user = userEvent.setup();
  
  // Fill email field
  await user.type(screen.getByLabelText(/email address/i), formData.email);
  
  // Fill firstName field
  await user.type(screen.getByLabelText(/first name/i), formData.firstName);
  
  // Fill lastName field
  await user.type(screen.getByLabelText(/last name/i), formData.lastName);
  
  // Select role if different from default
  if (formData.role !== 'USER') {
    await user.click(screen.getByLabelText(/user role/i));
    await user.click(screen.getByText(new RegExp(formData.role, 'i')));
  }
  
  // Toggle active status if needed
  if (!formData.isActive) {
    await user.click(screen.getByLabelText(/active account/i));
  }
};

describe('UserForm Rendering', () => {
  test('renders all form fields with correct labels', () => {
    setup();
    
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/user role/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/active account/i)).toBeInTheDocument();
    
    // Verify buttons are present
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });
  
  test('renders with proper heading based on isCreating prop', () => {
    setup({ isCreating: true });
    expect(screen.getByRole('heading', { name: /create new user/i })).toBeInTheDocument();
    
    setup({ isCreating: false });
    expect(screen.getByRole('heading', { name: /edit user/i })).toBeInTheDocument();
  });
  
  test('disables fields based on user role permissions', () => {
    setup({ 
      userRole: UserRole.USER,
      initialValues: { ...validUserData, role: UserRole.ADMIN }
    });
    
    // Regular users can't edit roles or statuses
    expect(screen.getByLabelText(/user role/i)).toBeDisabled();
    expect(screen.getByText(/you don't have permission to change this user's role/i)).toBeInTheDocument();
  });
  
  test('renders with pre-populated values when provided', () => {
    setup({ initialValues: validUserData });
    
    expect(screen.getByLabelText(/email address/i)).toHaveValue(validUserData.email);
    expect(screen.getByLabelText(/first name/i)).toHaveValue(validUserData.firstName);
    expect(screen.getByLabelText(/last name/i)).toHaveValue(validUserData.lastName);
  });
});

describe('Form Validation', () => {
  test('validates email format', async () => {
    setup();
    const user = userEvent.setup();
    
    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'invalid-email');
    await user.tab(); // trigger blur event
    
    expect(await screen.findByText(/please enter a valid email address/i)).toBeInTheDocument();
    
    // Clear and enter valid email
    await user.clear(emailInput);
    await user.type(emailInput, 'valid@example.com');
    await user.tab();
    
    await waitFor(() => {
      expect(screen.queryByText(/please enter a valid email address/i)).not.toBeInTheDocument();
    });
  });
  
  test('validates name fields length and format', async () => {
    setup();
    const user = userEvent.setup();
    
    // Test name too short
    const firstNameInput = screen.getByLabelText(/first name/i);
    await user.type(firstNameInput, 'A');
    await user.tab();
    
    expect(await screen.findByText(/name must be between 2 and 50 characters/i)).toBeInTheDocument();
    
    // Test name with invalid characters
    await user.clear(firstNameInput);
    await user.type(firstNameInput, 'John123');
    await user.tab();
    
    expect(await screen.findByText(/name can only contain letters and spaces/i)).toBeInTheDocument();
    
    // Test valid name
    await user.clear(firstNameInput);
    await user.type(firstNameInput, 'John');
    await user.tab();
    
    await waitFor(() => {
      expect(screen.queryByText(/name can only contain letters and spaces/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/name must be between 2 and 50 characters/i)).not.toBeInTheDocument();
    });
  });
  
  test('validates required fields', async () => {
    setup();
    const user = userEvent.setup();
    
    // Submit with empty fields
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    
    expect(await screen.findByText(/email address.*required/i)).toBeInTheDocument();
    expect(await screen.findByText(/first name.*required/i)).toBeInTheDocument();
    expect(await screen.findByText(/last name.*required/i)).toBeInTheDocument();
  });
});

describe('Form Submission', () => {
  test('handles successful submission', async () => {
    const { mockOnSubmit } = setup();
    const user = userEvent.setup();
    
    await fillForm();
    
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining(validUserData));
    });
  });
  
  test('shows loading state during submission', async () => {
    const { mockOnSubmit } = setup();
    mockOnSubmit.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    const user = userEvent.setup();
    
    await fillForm();
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    
    // Check that button shows loading state
    expect(screen.getByRole('button', { name: /save changes/i })).toHaveAttribute('aria-busy', 'true');
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
    });
  });
  
  test('handles submission errors', async () => {
    const { mockOnSubmit } = setup();
    mockOnSubmit.mockRejectedValue(new Error('Submission failed'));
    
    const user = userEvent.setup();
    
    await fillForm();
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
      expect(screen.getByText(/submission failed/i)).toBeInTheDocument();
    });
  });
  
  test('calls onCancel when cancel button is clicked', async () => {
    const { mockOnCancel } = setup();
    const user = userEvent.setup();
    
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    
    expect(mockOnCancel).toHaveBeenCalled();
  });
  
  test('shows confirmation dialog when canceling with dirty form', async () => {
    const { mockOnCancel } = setup();
    const user = userEvent.setup();
    
    // Fill form to make it dirty
    await user.type(screen.getByLabelText(/first name/i), 'John');
    
    // Mock window.confirm to return true
    const confirmSpy = vi.spyOn(window, 'confirm');
    confirmSpy.mockImplementation(() => true);
    
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('unsaved changes'));
    expect(mockOnCancel).toHaveBeenCalled();
    
    confirmSpy.mockRestore();
  });
});

describe('Accessibility', () => {
  test('meets WCAG 2.1 AA requirements', async () => {
    const { container } = setup();
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
  
  test('supports keyboard navigation', async () => {
    setup();
    const user = userEvent.setup();
    
    // Start with first element
    await user.tab();
    expect(screen.getByLabelText(/email address/i)).toHaveFocus();
    
    // Tab through all focusable elements
    await user.tab();
    expect(screen.getByLabelText(/first name/i)).toHaveFocus();
    
    await user.tab();
    expect(screen.getByLabelText(/last name/i)).toHaveFocus();
    
    await user.tab();
    expect(screen.getByLabelText(/user role/i)).toHaveFocus();
    
    await user.tab();
    expect(screen.getByLabelText(/active account/i)).toHaveFocus();
    
    await user.tab();
    expect(screen.getByRole('button', { name: /cancel/i })).toHaveFocus();
    
    await user.tab();
    expect(screen.getByRole('button', { name: /save changes/i })).toHaveFocus();
  });
  
  test('displays validation errors accessibly', async () => {
    setup();
    const user = userEvent.setup();
    
    // Submit empty form to trigger validation errors
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    
    // Check for aria-invalid attributes
    await waitFor(() => {
      const emailInput = screen.getByLabelText(/email address/i);
      expect(emailInput).toHaveAttribute('aria-invalid', 'true');
      
      // Check for aria-describedby pointing to error message
      const errorId = emailInput.getAttribute('aria-describedby')?.split(' ')[0];
      expect(document.getElementById(errorId)).toHaveTextContent(/required/i);
    });
  });
});

describe('Role-based Access Control', () => {
  test('admin users can edit all fields', async () => {
    setup({ userRole: UserRole.ADMIN });
    
    expect(screen.getByLabelText(/email address/i)).not.toBeDisabled();
    expect(screen.getByLabelText(/user role/i)).not.toBeDisabled();
    expect(screen.getByLabelText(/active account/i)).not.toBeDisabled();
  });
  
  test('manager users cannot edit admin roles', async () => {
    setup({ 
      userRole: UserRole.MANAGER,
      initialValues: { ...validUserData, role: UserRole.ADMIN }
    });
    
    expect(screen.getByLabelText(/user role/i)).toBeDisabled();
    expect(screen.getByText(/you don't have permission to change this user's role/i)).toBeInTheDocument();
  });
  
  test('regular users can only edit their own fields', async () => {
    setup({ 
      userRole: UserRole.USER,
      initialValues: validUserData
    });
    
    expect(screen.getByLabelText(/user role/i)).toBeDisabled();
    expect(screen.getByLabelText(/active account/i)).toBeDisabled();
  });
});

describe('Theme Integration', () => {
  test('applies correct theme styles', async () => {
    // This test would require more complex setup to check theme integration.
    // Using jsdom in tests makes it difficult to check computed styles.
    // This is a placeholder for a real theme integration test.
    
    // In a real test, we would:
    // 1. Mock useTheme hook to return different themes
    // 2. Check that the component renders with appropriate theme classes
    
    // For now, we'll just verify the form renders with a base class that should change with theme
    const { container } = setup();
    
    expect(container.firstChild).toHaveClass('bg-white dark:bg-gray-800');
  });
});