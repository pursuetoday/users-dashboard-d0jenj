/**
 * Form-related type definitions
 * 
 * This file contains TypeScript type definitions for form-related interfaces and types
 * used across the application's form components and validation.
 */

import { UserRole } from './auth.types';

/**
 * Enumeration of available form field types
 * Defines the supported input types for form field rendering
 */
export enum FormFieldType {
  TEXT = 'text',
  PASSWORD = 'password',
  EMAIL = 'email',
  SELECT = 'select',
  CHECKBOX = 'checkbox'
}

/**
 * Interface for form field validation rules
 * Provides a structure for defining validation constraints with error messages
 * Supports both synchronous and asynchronous validation
 */
export interface FormValidationRule {
  /** Type of validation rule (e.g., 'required', 'minLength', 'pattern') */
  type: string;
  
  /** Value associated with the validation rule (e.g., minimum length number) */
  value: any;
  
  /** Error message to display when validation fails */
  message: string;
  
  /** Custom validation function returning boolean or Promise<boolean> */
  validator?: (value: any) => boolean | Promise<boolean>;
  
  /** Unique error code for programmatic handling */
  errorCode?: string;
  
  /** Flag indicating if validation is asynchronous */
  async?: boolean;
}

/**
 * Interface for form field configuration
 * Defines the structure and behavior of individual form fields
 * Includes support for conditional rendering and accessibility
 */
export interface FormField {
  /** Unique field name/identifier */
  name: string;
  
  /** Type of form field from FormFieldType enum */
  type: FormFieldType;
  
  /** Display label for the field */
  label: string;
  
  /** Placeholder text for input fields */
  placeholder?: string;
  
  /** Whether the field is required */
  required?: boolean;
  
  /** Array of validation rules to apply to this field */
  validationRules?: FormValidationRule[];
  
  /** Options for select fields */
  options?: { label: string; value: any; disabled?: boolean }[];
  
  /** Controls field visibility (static or dynamic based on form values) */
  visible?: boolean | ((values: Record<string, any>) => boolean);
  
  /** Controls field disabled state (static or dynamic based on form values) */
  disabled?: boolean | ((values: Record<string, any>) => boolean);
  
  /** Accessibility attributes for the field */
  aria?: { label?: string; description?: string };
  
  /** Fields that this field depends on for conditional logic */
  dependencies?: string[];
}

/**
 * Interface for form state management
 * Tracks values, validation state, and interaction history
 */
export interface FormState {
  /** Current values of all form fields */
  values: Record<string, any>;
  
  /** Validation error messages mapped by field name */
  errors: Record<string, string>;
  
  /** Tracks which fields have been interacted with */
  touched: Record<string, boolean>;
  
  /** Whether form is currently submitting */
  isSubmitting: boolean;
  
  /** Whether all form fields are currently valid */
  isValid: boolean;
  
  /** Whether validation is in progress */
  isValidating: boolean;
  
  /** Number of submission attempts */
  submitCount: number;
  
  /** Tracks which fields have been modified from initial values */
  dirtyFields: Record<string, boolean>;
}

/**
 * Interface for form configuration
 * Defines the structure, behavior, and lifecycle hooks for a complete form
 */
export interface FormConfig {
  /** Array of field configurations */
  fields: FormField[];
  
  /** Initial values for form fields */
  initialValues?: Record<string, any>;
  
  /** Form submission handler */
  onSubmit: (values: Record<string, any>) => Promise<void>;
  
  /** Schema-based validation (compatible with Yup or similar) */
  validationSchema?: any;
  
  /** Custom validation function */
  onValidate?: (values: Record<string, any>) => Promise<Record<string, string>>;
  
  /** Whether to validate on field change events */
  validateOnChange?: boolean;
  
  /** Whether to validate on field blur events */
  validateOnBlur?: boolean;
  
  /** Whether to unregister fields when components unmount */
  shouldUnregister?: boolean;
}