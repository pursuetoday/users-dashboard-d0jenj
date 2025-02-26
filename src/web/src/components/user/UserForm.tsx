/**
 * A comprehensive form component for creating and editing user data with 
 * real-time validation, error handling, role-based access control, 
 * accessibility features, and security measures.
 * 
 * @packageDocumentation
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import classNames from 'classnames'; // v2.3.2
import Input from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import useForm from '../../hooks/useForm';
import { UserRole } from '../../types/user.types';
import { userSchema } from '../../validations/user.schema';

/**
 * Props interface for UserForm component
 */
export interface UserFormProps {
  /** Initial form values */
  initialValues?: UserFormData;
  /** Function called on successful form submission */
  onSubmit: (data: UserFormData) => Promise<void>;
  /** Function called when form is canceled */
  onCancel?: () => void;
  /** Whether the form is in a loading state */
  isLoading?: boolean;
  /** Current user's role for permission checks */
  userRole?: UserRole;
  /** Whether this is a new user creation form */
  isCreating?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * User form data structure
 */
export interface UserFormData {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
}

/**
 * Default form values when creating a new user
 */
const defaultValues: UserFormData = {
  email: '',
  firstName: '',
  lastName: '',
  role: UserRole.USER,
  isActive: true
};

/**
 * Form component for creating and editing users with validation,
 * security measures, and accessibility features.
 */
const UserForm: React.FC<UserFormProps> = ({
  initialValues,
  onSubmit,
  onCancel,
  isLoading = false,
  userRole = UserRole.ADMIN,
  isCreating = false,
  className
}) => {
  // Track submission attempts for security and user experience
  const [submissionAttempts, setSubmissionAttempts] = useState(0);
  const [securityDelay, setSecurityDelay] = useState(false);
  
  // Initialize form with validation schema and initial values
  const form = useForm({
    fields: [
      {
        name: 'email',
        type: 'email',
        label: 'Email Address',
        required: true,
        aria: { 
          description: 'Enter a valid email address with maximum 255 characters' 
        }
      },
      {
        name: 'firstName',
        type: 'text',
        label: 'First Name',
        required: true,
        aria: { 
          description: 'Enter first name between 2 and 50 characters, alphabets only' 
        }
      },
      {
        name: 'lastName',
        type: 'text',
        label: 'Last Name',
        required: true,
        aria: { 
          description: 'Enter last name between 2 and 50 characters, alphabets only' 
        }
      },
      {
        name: 'role',
        type: 'select',
        label: 'User Role',
        required: true,
        aria: { 
          description: 'Select the appropriate user role' 
        }
      },
      {
        name: 'isActive',
        type: 'checkbox',
        label: 'Active Status',
        required: true,
        aria: { 
          description: 'Toggle whether this user account is active' 
        }
      }
    ],
    initialValues: initialValues || defaultValues,
    validationSchema: userSchema,
    onSubmit: handleSubmit,
    validateOnChange: true,
    validateOnBlur: true
  });

  // Determine if current user can edit specific fields based on role
  const canEditRole = 
    userRole === UserRole.ADMIN || 
    (userRole === UserRole.MANAGER && initialValues?.role !== UserRole.ADMIN);
  
  const canEditStatus = userRole === UserRole.ADMIN || userRole === UserRole.MANAGER;

  // Prepare user role options based on current user's role
  const roleOptions = useCallback(() => {
    const allRoles = Object.values(UserRole).map(role => ({
      label: role.charAt(0) + role.slice(1).toLowerCase(),
      value: role,
      // Prevent managers from creating/editing admins
      disabled: userRole === UserRole.MANAGER && role === UserRole.ADMIN
    }));

    // Filter roles based on permissions
    if (userRole === UserRole.ADMIN) {
      return allRoles;
    } else if (userRole === UserRole.MANAGER) {
      return allRoles.filter(option => option.value !== UserRole.ADMIN);
    } else {
      // Other roles can only see, not edit
      return allRoles;
    }
  }, [userRole]);

  /**
   * Form submission handler with security measures and validation
   */
  async function handleSubmit(values: UserFormData): Promise<void> {
    try {
      // Security: Add submission tracking for rate limiting
      setSubmissionAttempts(prev => prev + 1);
      
      // Security: Implement rate limiting for repeated submissions
      if (submissionAttempts > 5) {
        setSecurityDelay(true);
        await new Promise(resolve => setTimeout(resolve, 2000));
        setSecurityDelay(false);
      }
      
      // Validate form data with schema
      await userSchema.validate(values, { abortEarly: false });
      
      // Role-based security check to ensure users can't elevate privileges
      if (userRole !== UserRole.ADMIN && values.role === UserRole.ADMIN) {
        throw new Error('You do not have permission to assign admin role');
      }
      
      // Submit sanitized data to parent component
      await onSubmit(values);
      
      // Reset submission count on successful submission
      setSubmissionAttempts(0);
    } catch (error) {
      console.error('Form submission error:', error);
      throw error;
    }
  }

  /**
   * Cancel handler with confirmation for dirty form
   */
  const handleCancel = () => {
    // Check if form is dirty before canceling
    const isDirty = Object.values(form.dirty).some(Boolean);
    
    if (isDirty && window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
      onCancel?.();
    } else if (!isDirty) {
      onCancel?.();
    }
  };

  // Effect to announce form errors to screen readers
  useEffect(() => {
    const hasErrors = Object.values(form.errors).some(error => !!error);
    if (hasErrors && form.submitCount > 0) {
      // This would be announced by screen readers
      document.getElementById('form-error-summary')?.focus();
    }
  }, [form.errors, form.submitCount]);

  return (
    <div className={classNames('max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow', className)}>
      <h2 className="text-xl font-semibold mb-6 text-gray-800 dark:text-white" id="form-heading">
        {isCreating ? 'Create New User' : 'Edit User'}
      </h2>
      
      {/* Accessibility announcement region */}
      {(form.errors.form || form.security.suspicious) && (
        <div 
          id="form-error-summary"
          className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded"
          role="alert"
          aria-live="assertive"
          tabIndex={-1}
        >
          <p className="font-medium">Please correct the following errors:</p>
          <ul className="mt-1 list-disc list-inside">
            {form.errors.form && <li>{form.errors.form}</li>}
            {form.security.suspicious && <li>Suspicious activity detected. Please try again later.</li>}
            {Object.entries(form.errors)
              .filter(([key, value]) => key !== 'form' && value)
              .map(([key, value]) => (
                <li key={key}>{key}: {value}</li>
              ))
            }
          </ul>
        </div>
      )}
      
      <form 
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        noValidate
        aria-labelledby="form-heading"
        className="space-y-4"
      >
        {/* Email Field */}
        <Input
          name="email"
          label="Email Address"
          type="email"
          required
          placeholder="email@example.com"
          error={form.touched.email ? form.errors.email : undefined}
          touched={form.touched.email}
          value={form.values.email}
          onChange={(name, value) => form.setFieldValue(name, value)}
          onBlur={() => form.handleBlur('email')}
          disabled={isLoading || (!isCreating && userRole !== UserRole.ADMIN)}
          helpText="Must be a valid email address (max 255 characters)"
          validateOnChange
          ariaProps={{
            required: true,
            invalid: !!form.errors.email && form.touched.email
          }}
        />
        
        {/* First Name Field */}
        <Input
          name="firstName"
          label="First Name"
          type="text"
          required
          placeholder="Enter first name"
          error={form.touched.firstName ? form.errors.firstName : undefined}
          touched={form.touched.firstName}
          value={form.values.firstName}
          onChange={(name, value) => form.setFieldValue(name, value)}
          onBlur={() => form.handleBlur('firstName')}
          disabled={isLoading}
          helpText="2-50 characters, alphabets and spaces only"
          validateOnChange
          ariaProps={{
            required: true,
            invalid: !!form.errors.firstName && form.touched.firstName
          }}
        />
        
        {/* Last Name Field */}
        <Input
          name="lastName"
          label="Last Name"
          type="text"
          required
          placeholder="Enter last name"
          error={form.touched.lastName ? form.errors.lastName : undefined}
          touched={form.touched.lastName}
          value={form.values.lastName}
          onChange={(name, value) => form.setFieldValue(name, value)}
          onBlur={() => form.handleBlur('lastName')}
          disabled={isLoading}
          helpText="2-50 characters, alphabets and spaces only"
          validateOnChange
          ariaProps={{
            required: true,
            invalid: !!form.errors.lastName && form.touched.lastName
          }}
        />
        
        {/* Role Field */}
        <div>
          <Select
            id="role"
            name="role"
            label="User Role"
            options={roleOptions()}
            value={form.values.role}
            onChange={(value) => form.setFieldValue('role', value)}
            error={form.touched.role ? form.errors.role : undefined}
            required
            helperText="Select the appropriate role for this user"
            disabled={isLoading || !canEditRole}
            ariaLabel="Select user role"
          />
          
          {/* Accessibility help text for role restrictions */}
          {!canEditRole && (
            <p className="mt-1 text-sm text-amber-600" id="role-restrictions">
              You don't have permission to change this user's role.
            </p>
          )}
        </div>
        
        {/* Active Status */}
        <div className="flex items-center space-x-2 mt-4">
          <input
            id="isActive"
            name="isActive"
            type="checkbox"
            checked={form.values.isActive}
            onChange={(e) => form.setFieldValue('isActive', e.target.checked)}
            disabled={isLoading || !canEditStatus}
            className={classNames(
              "h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500",
              { "cursor-not-allowed opacity-60": !canEditStatus }
            )}
            aria-describedby={!canEditStatus ? "status-restrictions" : undefined}
          />
          <label 
            htmlFor="isActive" 
            className={classNames(
              "font-medium text-gray-700 dark:text-gray-300",
              { "cursor-not-allowed opacity-60": !canEditStatus }
            )}
          >
            Active Account
          </label>
          
          {/* Accessibility help text for status restrictions */}
          {!canEditStatus && (
            <p className="ml-6 text-sm text-amber-600" id="status-restrictions">
              You don't have permission to change account status.
            </p>
          )}
        </div>
        
        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
            ariaLabel="Cancel form"
          >
            Cancel
          </Button>
          
          <Button
            type="submit"
            variant="primary"
            disabled={isLoading || form.security.suspicious || securityDelay}
            loading={isLoading || securityDelay}
            ariaLabel="Save user information"
          >
            {isCreating ? 'Create User' : 'Save Changes'}
          </Button>
        </div>
      </form>
      
      {/* Hidden form status announcer for screen readers */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {isLoading ? 'Form is submitting...' : ''}
        {form.security.suspicious ? 'Security issue detected. Form submission blocked.' : ''}
        {form.isValid && form.submitCount > 0 ? 'Form validated successfully' : ''}
      </div>
    </div>
  );
};

export default UserForm;