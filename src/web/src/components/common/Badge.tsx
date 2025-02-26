import React from 'react'; // v18.x - Core React functionality
import clsx from 'clsx'; // ^2.0.0 - Utility for constructing conditional className strings

/**
 * Props interface for Badge component defining all possible input properties
 */
export interface BadgeProps {
  /** Content to be displayed inside the badge */
  children: React.ReactNode;
  /** Visual style variant of the badge with theme-aware colors */
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  /** Size variant affecting padding and font size */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes to extend or override default styles */
  className?: string;
  /** Accessible label for screen readers */
  ariaLabel?: string;
}

/**
 * A theme-aware badge component that displays status indicators, labels, or counts
 * with support for different variants, sizes, and dark mode.
 */
const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className,
  ariaLabel,
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-full transition-colors duration-200';
  
  const variantStyles = {
    primary: 'bg-primary-100 text-primary-800 dark:bg-primary-800 dark:text-primary-100 ring-1 ring-primary-200 dark:ring-primary-700',
    success: 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 ring-1 ring-green-200 dark:ring-green-700',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100 ring-1 ring-yellow-200 dark:ring-yellow-700',
    danger: 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100 ring-1 ring-red-200 dark:ring-red-700',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100 ring-1 ring-blue-200 dark:ring-blue-700',
  };
  
  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5 min-w-[1.5rem]',
    md: 'text-sm px-2.5 py-0.5 min-w-[1.75rem]',
    lg: 'text-base px-3 py-1 min-w-[2rem]',
  };
  
  const badgeClasses = clsx(
    baseStyles,
    variantStyles[variant],
    sizeStyles[size],
    className
  );
  
  return (
    <span className={badgeClasses} aria-label={ariaLabel}>
      {children}
    </span>
  );
};

export default Badge;