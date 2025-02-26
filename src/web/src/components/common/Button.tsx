import React from 'react'; // v18.x
import classNames from 'classnames'; // v2.x
import { useTheme } from '../../hooks/useTheme';
import { Theme } from '../../types/theme.types';

/**
 * Props interface for Button component with accessibility and theme support
 */
export interface ButtonProps {
  /** Button content */
  children: React.ReactNode;
  /** Visual style variant */
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Makes button take full width of container */
  fullWidth?: boolean;
  /** Disables the button */
  disabled?: boolean;
  /** Shows a loading spinner */
  loading?: boolean;
  /** HTML button type */
  type?: 'button' | 'submit' | 'reset';
  /** Click handler */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Additional CSS classes */
  className?: string;
  /** Accessibility label */
  ariaLabel?: string;
  /** ID of element that describes the button */
  ariaDescribedBy?: string;
  /** Indicates if button controls expandable content */
  ariaExpanded?: boolean;
  /** ARIA role */
  role?: string;
  /** Tab index for keyboard navigation */
  tabIndex?: number;
}

/**
 * Generates Tailwind classes based on button props and theme with dark mode support
 * 
 * @param props - Button properties
 * @param theme - Current theme state
 * @returns Concatenated Tailwind classes with theme-specific styles
 */
export const getButtonClasses = (props: ButtonProps, theme: Theme): string => {
  const { 
    variant = 'primary', 
    size = 'md', 
    fullWidth, 
    disabled, 
    loading, 
    className = '' 
  } = props;
  
  // Base button classes
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-md focus:outline-none';
  
  // Size-specific classes
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };
  
  // Variant-specific classes with dark mode support
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-400 dark:focus:ring-blue-400',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800 focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white dark:focus:ring-gray-500',
    outline: 'bg-transparent hover:bg-gray-100 text-gray-700 border border-gray-300 focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 dark:border-gray-400 dark:hover:bg-gray-800 dark:text-gray-300 dark:focus:ring-gray-500',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:bg-red-700 dark:hover:bg-red-600 dark:focus:ring-red-400'
  };
  
  // Width classes
  const widthClasses = fullWidth ? 'w-full' : '';
  
  // State classes
  const stateClasses = {
    'opacity-50 cursor-not-allowed': disabled,
    'cursor-wait': loading
  };
  
  // Dark mode specific adjustment classes
  const darkModeAdjustments = theme.isDark ? 'focus:ring-offset-gray-900' : '';
  
  // Transition classes for smooth theme changes
  const transitionClasses = 'transition-colors transition-shadow duration-200';
  
  // Accessibility focus styles
  const accessibilityClasses = 'focus-visible:ring-2 focus-visible:ring-offset-2';
  
  // Combine all class groups with clean formatting
  return classNames(
    baseClasses,
    sizeClasses[size],
    variantClasses[variant],
    widthClasses,
    stateClasses,
    darkModeAdjustments,
    transitionClasses,
    accessibilityClasses,
    className
  );
};

/**
 * Reusable button component with theme support, accessibility features, and error handling
 * 
 * @param props - Button properties
 * @returns JSX.Element - Rendered button element with theme-aware styling
 */
const Button: React.FC<ButtonProps> = (props) => {
  const {
    children,
    disabled = false,
    loading = false,
    type = 'button',
    onClick,
    ariaLabel,
    ariaDescribedBy,
    ariaExpanded,
    role,
    tabIndex,
    ...restProps
  } = props;
  
  // Get current theme with error handling
  let theme: Theme;
  try {
    const { theme: currentTheme } = useTheme();
    theme = currentTheme;
  } catch (error) {
    console.error('Button: Failed to access theme context:', error);
    // Fallback to light theme if theme context is not available
    theme = { mode: 'light', isDark: false };
  }
  
  // Generate button classes
  const buttonClasses = getButtonClasses(props, theme);
  
  // Handle click with loading and disabled states
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };
  
  // Loading spinner component
  const LoadingSpinner = () => (
    <svg
      className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
      data-testid="loading-spinner"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
  
  return (
    <button
      type={type}
      className={buttonClasses}
      onClick={handleClick}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-expanded={ariaExpanded}
      role={role || 'button'}
      tabIndex={tabIndex}
      data-testid="button"
      {...restProps}
    >
      {loading && <LoadingSpinner />}
      <span className={loading ? 'opacity-90' : ''}>{children}</span>
    </button>
  );
};

export default Button;