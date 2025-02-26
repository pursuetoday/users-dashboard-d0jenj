import React from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.0
import { FormFieldType } from '../../types/form.types';

/**
 * Props interface for Checkbox component with comprehensive accessibility and theme support
 */
interface CheckboxProps {
  /** Unique identifier for the checkbox */
  id: string;
  /** Name attribute for the form field */
  name: string;
  /** Text label for the checkbox */
  label: string;
  /** Whether the checkbox is checked */
  checked: boolean;
  /** Event handler for checkbox changes */
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Whether the checkbox is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Error message to display */
  error?: string;
  /** Accessibility label (falls back to label if not provided) */
  ariaLabel?: string;
  /** Test identifier for automated testing */
  testId?: string;
}

/**
 * A controlled checkbox component with enhanced accessibility, theme support, and error handling
 * 
 * This component provides a consistent checkbox implementation that follows the application's
 * design system using Tailwind UI. It supports form integration, accessibility requirements (WCAG 2.1 AA),
 * and theme modes with enhanced error handling.
 */
const Checkbox: React.FC<CheckboxProps> = React.memo(({
  id,
  name,
  label,
  checked,
  onChange,
  disabled = false,
  className = '',
  required = false,
  error,
  ariaLabel,
  testId
}) => {
  // Combine default and custom classes with theme support
  const containerClasses = classNames(
    'flex items-start my-2', // Add vertical spacing for better touch targets
    disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
    className
  );

  // Checkbox input classes with theme awareness
  const checkboxClasses = classNames(
    'h-5 w-5 rounded', // Ensure touch target meets accessibility standards
    'focus:ring-2 focus:ring-offset-2 focus:outline-none', // Focus ring styles for keyboard navigation
    'transition-colors duration-200', // Smooth transition for state changes
    {
      'border-red-500 focus:ring-red-500 dark:border-red-400 dark:focus:ring-red-400': error, // Error state visualization
      'border-gray-300 focus:ring-primary-500 dark:border-gray-600 dark:focus:ring-primary-400': !error, // Theme-aware styling
      'bg-gray-100 dark:bg-gray-800': disabled, // Disabled state styling with better dark mode contrast
      'text-primary-600 dark:text-primary-400': !disabled && checked, // Checked state with better dark mode contrast
    }
  );

  // Label classes with theme support
  const labelClasses = classNames(
    'ml-3 text-sm font-medium select-none', // Make label text unselectable for better UX
    {
      'text-red-500 dark:text-red-400': error, // Error state with better dark mode contrast
      'text-gray-700 dark:text-gray-200': !error && !disabled, // Better dark mode contrast
      'text-gray-500 dark:text-gray-400': !error && disabled, // Disabled state for label
    }
  );

  // Error message classes with theme support
  const errorClasses = 'mt-1 text-sm text-red-500 dark:text-red-400';

  return (
    <div className={containerClasses}>
      <div className="flex items-center h-6"> {/* Increased height for better touch target */}
        <input
          id={id}
          name={name}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          required={required}
          className={checkboxClasses}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={!!error}
          aria-label={ariaLabel || label}
          data-testid={testId || `checkbox-${id}`}
          data-type={FormFieldType.CHECKBOX}
        />
      </div>
      <div className="ml-2">
        <label htmlFor={id} className={labelClasses}>
          {label}
          {required && <span className="ml-1 text-red-500 dark:text-red-400" aria-hidden="true">*</span>}
        </label>
        {error && (
          <p id={`${id}-error`} className={errorClasses} aria-live="polite" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
});

// Add display name for better debugging
Checkbox.displayName = 'Checkbox';

export default Checkbox;