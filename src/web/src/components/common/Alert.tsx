import React, { ReactNode, useEffect, useRef, useState } from 'react';
import classNames from 'classnames'; // v2.x - Utility for conditional class name composition

/**
 * Props interface for Alert component defining all possible configuration options
 */
export interface AlertProps {
  /**
   * Content to be displayed within the alert
   */
  children: ReactNode;
  
  /**
   * Visual style variant of the alert
   * @default 'info'
   */
  variant?: 'info' | 'success' | 'warning' | 'error';
  
  /**
   * Whether the alert can be dismissed
   * @default false
   */
  dismissible?: boolean;
  
  /**
   * Callback function when alert is dismissed
   */
  onDismiss?: () => void;
  
  /**
   * Additional CSS classes to apply
   */
  className?: string;
  
  /**
   * Enable/disable entrance/exit animations
   * @default true
   */
  animate?: boolean;
  
  /**
   * Unique identifier for the alert
   */
  id?: string;
}

/**
 * A flexible alert component that displays messages with different visual styles based on the variant type.
 * 
 * Features:
 * - Multiple visual variants (info, success, warning, error)
 * - Optional dismiss button with callback
 * - Animations for entrance/exit
 * - Full keyboard navigation and screen reader support
 * - Dark mode compatible
 * - RTL language support
 * 
 * @example
 * <Alert variant="success" dismissible onDismiss={() => console.log('dismissed')}>
 *   Operation completed successfully!
 * </Alert>
 */
export const Alert: React.FC<AlertProps> = React.memo(({
  children,
  variant = 'info',
  dismissible = false,
  onDismiss,
  className = '',
  animate = true,
  id,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);
  const dismissButtonRef = useRef<HTMLButtonElement>(null);

  // Variant-specific styling
  const variantStyles = {
    info: 'bg-blue-50 text-blue-800 dark:bg-blue-900 dark:text-blue-100 focus-within:ring-2 focus-within:ring-blue-500',
    success: 'bg-green-50 text-green-800 dark:bg-green-900 dark:text-green-100 focus-within:ring-2 focus-within:ring-green-500',
    warning: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 focus-within:ring-2 focus-within:ring-yellow-500',
    error: 'bg-red-50 text-red-800 dark:bg-red-900 dark:text-red-100 focus-within:ring-2 focus-within:ring-red-500',
  };

  // Animation classes
  const animationClasses = animate
    ? {
        enter: 'opacity-100 transition-opacity duration-200',
        exit: isExiting ? 'opacity-0 transition-opacity duration-200' : '',
      }
    : { enter: '', exit: '' };

  // Handle dismiss action with debounce to prevent multiple calls
  const handleDismiss = React.useCallback(() => {
    if (dismissible && isVisible && !isExiting) {
      setIsExiting(true);
      
      // Add a small delay to allow animation to complete
      setTimeout(() => {
        setIsVisible(false);
        if (onDismiss) {
          onDismiss();
        }
      }, 200); // Match the duration of the exit animation
    }
  }, [dismissible, isVisible, isExiting, onDismiss]);

  // Handle keyboard events for accessibility
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (dismissible) {
        // Close alert on Escape key when the alert is focused
        if (e.key === 'Escape' && document.activeElement === alertRef.current) {
          handleDismiss();
        }
        
        // Handle Enter/Space on dismiss button
        if ((e.key === 'Enter' || e.key === ' ') && 
            document.activeElement === dismissButtonRef.current) {
          e.preventDefault();
          handleDismiss();
        }
      }
    },
    [dismissible, handleDismiss]
  );

  // Focus alert element on mount for screen readers when it's an error
  useEffect(() => {
    if (alertRef.current && variant === 'error') {
      alertRef.current.focus();
    }
  }, [variant]);

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  return (
    <div
      ref={alertRef}
      id={id}
      role="alert"
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      tabIndex={variant === 'error' ? 0 : -1}
      onKeyDown={handleKeyDown}
      className={classNames(
        'rounded-lg p-4 mb-4 flex items-center justify-between transition-all duration-300',
        variantStyles[variant],
        animationClasses.enter,
        animationClasses.exit,
        className
      )}
    >
      <div className="flex-1">
        {children}
      </div>
      
      {dismissible && (
        <button
          ref={dismissButtonRef}
          type="button"
          aria-label="Close alert"
          onClick={handleDismiss}
          className="p-1 ml-4 rounded-md hover:bg-opacity-20 hover:bg-current focus:outline-none focus:ring-2 focus:ring-current rtl:ml-0 rtl:mr-4"
        >
          <svg
            className="w-4 h-4"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
    </div>
  );
});

// Display name for debugging purposes
Alert.displayName = 'Alert';

export default Alert;