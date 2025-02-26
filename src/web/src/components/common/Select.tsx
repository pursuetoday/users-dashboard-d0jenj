/**
 * @file Select.tsx
 * @description A reusable select component that provides a styled dropdown menu with options,
 * supporting form integration, validation, and accessibility features.
 */

import React, { Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react'; // @headlessui/react v1.7.0
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/20/solid'; // @heroicons/react v2.0.0
import classNames from 'classnames'; // classnames v2.3.0
import { FormField } from '../../types/form.types';

/**
 * Option item structure for select dropdown
 */
export interface SelectOption {
  /** Display label for the option */
  label: string;
  
  /** Value associated with the option */
  value: any;
  
  /** Whether the option is disabled */
  disabled?: boolean;
  
  /** Optional description for the option */
  description?: string;
}

/**
 * Props for the Select component
 */
export interface SelectProps {
  /** Unique identifier for the select element */
  id: string;
  
  /** Name of the form field */
  name: string;
  
  /** Label text to display */
  label: string;
  
  /** Array of options to display in the dropdown */
  options: SelectOption[];
  
  /** Current selected value */
  value: any;
  
  /** Change handler function */
  onChange: (value: any) => void;
  
  /** Whether the select is disabled */
  disabled?: boolean;
  
  /** Whether the field is required */
  required?: boolean;
  
  /** Error message to display */
  error?: string;
  
  /** Helper text to display below the select */
  helperText?: string;
  
  /** CSS class name to apply to the container */
  className?: string;
  
  /** Placeholder text when no option is selected */
  placeholder?: string;
  
  /** Aria label for screen readers */
  ariaLabel?: string;
}

/**
 * A reusable select component with enhanced accessibility and styling.
 * Built using Headless UI's Listbox for proper accessibility and keyboard navigation.
 * 
 * Features:
 * - Fully accessible (WCAG 2.1 AA compliant)
 * - Keyboard navigation support
 * - Error state handling and validation messages
 * - Support for disabled options
 * - Option descriptions
 * - Customizable placeholder
 * - Responsive design with Tailwind CSS
 */
const Select = React.memo<SelectProps>(({
  id,
  name,
  label,
  options,
  value,
  onChange,
  disabled = false,
  required = false,
  error,
  helperText,
  className = '',
  placeholder = 'Select an option',
  ariaLabel,
}) => {
  // Find the currently selected option to display its label
  const selectedOption = options.find(option => option.value === value);
  const displayValue = selectedOption?.label || placeholder;
  
  // Generate unique IDs for ARIA attributes to connect labels, errors, and inputs
  const errorId = error ? `${id}-error` : undefined;
  const helperId = helperText && !error ? `${id}-helper` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;
  
  return (
    <div className={classNames("w-full", className)}>
      {/* Label with required indicator if needed */}
      <Listbox.Label 
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
        {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
      </Listbox.Label>
      
      <div className="relative mt-1">
        <Listbox
          value={value}
          onChange={onChange}
          disabled={disabled}
          as="div"
        >
          {({ open }) => (
            <>
              {/* Dropdown button with current selection */}
              <Listbox.Button
                id={id}
                aria-invalid={!!error}
                aria-describedby={describedBy}
                aria-label={ariaLabel || label}
                aria-required={required}
                className={classNames(
                  "relative w-full cursor-default rounded-md bg-white py-2 pl-3 pr-10 text-left",
                  "border shadow-sm focus:outline-none focus:ring-2 sm:text-sm",
                  {
                    "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500": !error && !disabled,
                    "border-red-300 focus:border-red-500 focus:ring-red-500": !!error && !disabled,
                    "bg-gray-50 text-gray-500 border-gray-200 cursor-not-allowed": disabled,
                  }
                )}
              >
                <span className={classNames("block truncate", {
                  "text-gray-500": !selectedOption
                })}>
                  {displayValue}
                </span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  <ChevronUpDownIcon 
                    className={classNames("h-5 w-5", {
                      "text-gray-400": !disabled,
                      "text-gray-300": disabled
                    })} 
                    aria-hidden="true" 
                  />
                </span>
              </Listbox.Button>
              
              {/* Dropdown menu with smooth transition */}
              <Transition
                show={open}
                as={Fragment}
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                {/* Options list with scrolling for long lists */}
                <Listbox.Options 
                  className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
                >
                  {options.length === 0 ? (
                    <div className="py-2 px-3 text-gray-400 italic">No options available</div>
                  ) : (
                    options.map((option, index) => (
                      <Listbox.Option
                        key={`${option.value}-${index}`}
                        value={option.value}
                        disabled={option.disabled}
                        className={({ active, selected, disabled }) =>
                          classNames(
                            "relative cursor-default select-none py-2 pl-10 pr-4",
                            {
                              "bg-indigo-50 text-indigo-900": active && !disabled,
                              "text-gray-900": !disabled && !selected,
                              "bg-indigo-100 text-indigo-900": selected && !disabled,
                              "text-gray-400 bg-gray-50": disabled,
                              "cursor-not-allowed": disabled,
                              "cursor-pointer": !disabled,
                            }
                          )
                        }
                      >
                        {({ selected, active, disabled }) => (
                          <>
                            <span
                              className={classNames("block truncate", {
                                "font-medium": selected,
                                "font-normal": !selected,
                              })}
                            >
                              {option.label}
                            </span>
                            
                            {/* Description if provided */}
                            {option.description && (
                              <span className="block truncate text-xs text-gray-500 mt-0.5">
                                {option.description}
                              </span>
                            )}
                            
                            {/* Checkmark indicator for selected item */}
                            {selected && (
                              <span 
                                className={classNames(
                                  "absolute inset-y-0 left-0 flex items-center pl-3", 
                                  { "text-indigo-600": !disabled, "text-gray-400": disabled }
                                )}
                              >
                                <CheckIcon className="h-5 w-5" aria-hidden="true" />
                              </span>
                            )}
                          </>
                        )}
                      </Listbox.Option>
                    ))
                  )}
                </Listbox.Options>
              </Transition>
            </>
          )}
        </Listbox>
      </div>
      
      {/* Error message or helper text for additional context */}
      {(error || helperText) && (
        <p 
          className={classNames("mt-1 text-sm", {
            "text-red-600": error,
            "text-gray-500": !error && helperText
          })} 
          id={error ? errorId : helperId}
        >
          {error || helperText}
        </p>
      )}
    </div>
  );
});

// Display name for debugging in React DevTools
Select.displayName = 'Select';

export default Select;