import React, { ReactNode } from 'react'; // v18.x
import classNames from 'classnames'; // v2.x
import { useTheme } from '../../hooks/useTheme';

/**
 * Props interface for the Card component defining its customization options
 */
interface CardProps {
  /** Content to be rendered inside the card */
  children: ReactNode;
  /** Additional CSS classes to apply to the card */
  className?: string;
  /** When true, removes the default padding inside the card */
  noPadding?: boolean;
  /** Visual style variant of the card */
  variant?: 'default' | 'elevated' | 'outlined';
}

/**
 * A themeable card container component that adapts to system preferences and supports multiple visual variants.
 * Provides consistent styling and responsive layout for content organization.
 * 
 * Features:
 * - Theme-aware background and text colors
 * - Multiple visual variants (default, elevated, outlined)
 * - Consistent padding with option to remove
 * - Responsive design with mobile-first approach
 * - Accessible structure with semantic ARIA roles
 * 
 * @param {CardProps} props - Card component properties
 * @returns {JSX.Element} Rendered card component with theme-aware styling
 */
const Card = React.memo<CardProps>(({
  children,
  className = '',
  noPadding = false,
  variant = 'default'
}: CardProps): JSX.Element => {
  // Get current theme from context
  const { theme } = useTheme();
  
  // Base classes for responsive padding and transitions
  const baseClasses = classNames(
    'rounded-lg',
    'transition-all duration-200',
    'w-full',
    !noPadding && 'p-4 sm:p-5 md:p-6', // Responsive padding based on breakpoints
  );
  
  // Variant-specific styles
  const variantClasses = {
    default: 'border',
    elevated: 'shadow-md',
    outlined: 'border-2'
  }[variant];
  
  // Theme-specific styling classes
  const themeClasses = classNames(
    // Light theme styles
    'bg-white text-gray-800 border-gray-200',
    // Dark theme styles - applied when theme.isDark is true
    theme.isDark && 'dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700'
  );
  
  // Compose final className
  const cardClassName = classNames(
    baseClasses,
    variantClasses,
    themeClasses,
    className // Allow overriding with custom className
  );

  return (
    <div 
      className={cardClassName}
      role="article"
      data-theme={theme.isDark ? 'dark' : 'light'}
    >
      {children}
    </div>
  );
});

// Display name for debugging
Card.displayName = 'Card';

export default Card;