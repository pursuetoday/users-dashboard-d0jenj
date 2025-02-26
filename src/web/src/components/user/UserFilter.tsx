/**
 * @file UserFilter.tsx
 * @description A component that provides filtering controls for the user management table
 * with accessibility support and proper memoization.
 */

import React, { useCallback } from 'react';
import classNames from 'classnames'; // classnames v2.3.0
import Select from '../common/Select';
import { UserRole, UserFilters } from '../../types/user.types';

/**
 * Props for the UserFilter component
 */
interface UserFilterProps {
  /** Current filter state */
  filters: UserFilters;
  
  /** Callback function for filter changes */
  onFilterChange: (filters: UserFilters) => void;
  
  /** Additional CSS class name */
  className?: string;
}

/**
 * UserFilter component that provides accessible filter controls
 * for the user management table with role and status filtering.
 * 
 * Features:
 * - Role-based filtering with predefined roles
 * - Active status filtering
 * - Accessibility support with proper ARIA attributes
 * - Responsive design using Tailwind classes
 * - Memoized handlers and options for performance
 */
const UserFilter = React.memo<UserFilterProps>(({
  filters,
  onFilterChange,
  className = '',
}) => {
  // Memoized role options from UserRole enum
  const roleOptions = React.useMemo(() => [
    { value: UserRole.ADMIN, label: 'Admin' }, 
    { value: UserRole.MANAGER, label: 'Manager' }, 
    { value: UserRole.USER, label: 'User' }, 
    { value: UserRole.GUEST, label: 'Guest' }
  ], []);

  // Memoized status options
  const statusOptions = React.useMemo(() => [
    { value: true, label: 'Active' }, 
    { value: false, label: 'Inactive' }
  ], []);

  // Memoized role filter change handler
  const handleRoleChange = useCallback((role: UserRole | null) => {
    onFilterChange({
      ...filters,
      role
    });
  }, [filters, onFilterChange]);

  // Memoized status filter change handler
  const handleStatusChange = useCallback((isActive: boolean | null) => {
    onFilterChange({
      ...filters,
      isActive
    });
  }, [filters, onFilterChange]);

  return (
    <div 
      className={classNames(
        "flex flex-col sm:flex-row gap-4 mb-4",
        className
      )}
      aria-label="User filter controls"
    >
      <Select
        id="role-filter"
        name="role"
        label="Filter by Role"
        options={[{ value: null, label: 'All Roles' }, ...roleOptions]}
        value={filters.role}
        onChange={handleRoleChange}
        className="w-full sm:w-48"
        ariaLabel="Filter users by role"
      />
      
      <Select
        id="status-filter"
        name="status"
        label="Filter by Status"
        options={[{ value: null, label: 'All Statuses' }, ...statusOptions]}
        value={filters.isActive}
        onChange={handleStatusChange}
        className="w-full sm:w-48"
        ariaLabel="Filter users by status"
      />
    </div>
  );
});

// Display name for React DevTools
UserFilter.displayName = 'UserFilter';

export default UserFilter;