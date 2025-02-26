import React, { useMemo } from 'react'; // v18.x - Core React functionality
import Badge from '../common/Badge'; // Display status indicator with appropriate styling and accessibility support

/**
 * Configuration interface for badge status
 */
interface StatusConfig {
  /** Badge variant (success/danger) */
  variant: 'success' | 'danger';
  /** Display text for status */
  text: string;
  /** Accessibility label */
  ariaLabel: string;
}

/**
 * Props interface for UserStatus component with strict typing
 */
export interface UserStatusProps {
  /** Current status of the user account */
  isActive: boolean;
  /** Optional CSS classes for custom styling */
  className?: string;
  /** Optional custom tooltip text for hover state */
  tooltipText?: string;
}

/**
 * Determines badge configuration based on user status with proper i18n support
 * @param isActive - Current status of the user account
 * @returns Badge variant, text, and accessibility label based on status
 */
const getStatusConfig = (isActive: boolean): StatusConfig => {
  // In a real implementation, these strings would come from an i18n library
  if (isActive) {
    return {
      variant: 'success',
      text: 'Active',
      ariaLabel: 'User account is active',
    };
  } else {
    return {
      variant: 'danger',
      text: 'Inactive',
      ariaLabel: 'User account is inactive',
    };
  }
};

/**
 * Displays a user's active/inactive status using a Badge component with proper 
 * accessibility and theme support.
 */
const UserStatus: React.FC<UserStatusProps> = ({
  isActive,
  className = '',
  tooltipText,
}) => {
  // Memoize status configuration for performance
  const statusConfig = useMemo(() => getStatusConfig(isActive), [isActive]);
  
  // Use the tooltip text provided or fall back to the aria label
  const tooltip = tooltipText || statusConfig.ariaLabel;
  
  return (
    <div 
      className={`inline-block transition-opacity duration-200 hover:opacity-90 ${className}`}
      title={tooltip}
      role="status"
    >
      <Badge 
        variant={statusConfig.variant} 
        size="sm"
        ariaLabel={statusConfig.ariaLabel}
        className="font-medium"
      >
        {statusConfig.text}
      </Badge>
    </div>
  );
};

export default UserStatus;