import React, { useMemo, useCallback } from 'react';
import { format } from 'date-fns'; // ^2.30.0
import Table from '../common/Table';
import { useUser } from '../../hooks/useUser';
import UserActions from './UserActions';
import UserStatus from './UserStatus';
import { User } from '../../types/user.types';

/**
 * Props interface for UserTable component
 */
interface UserTableProps {
  /** Optional CSS class names */
  className?: string;
  /** Handler for edit user action */
  onEdit: (user: User) => void;
  /** Handler for delete user action */
  onDelete: (user: User) => void;
}

/**
 * Formats user's full name from first and last name
 */
const formatName = (user: User): string => {
  if (!user.firstName && !user.lastName) return 'N/A';
  return `${user.firstName} ${user.lastName}`.trim();
};

/**
 * Formats date string into readable format
 */
const formatDate = (dateString: string): string => {
  try {
    return format(new Date(dateString), 'MMM d, yyyy');
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
};

/**
 * Renders a table displaying user data with sorting, pagination, and action buttons
 */
const UserTable: React.FC<UserTableProps> = ({
  className = '',
  onEdit,
  onDelete
}) => {
  // Get user data and handlers from the hook
  const { 
    users, 
    loading, 
    error,
    tableState, 
    tableHandlers,
    retryOperation,
    clearError
  } = useUser();

  // Handle action completion callback
  const handleActionComplete = useCallback((success: boolean, message: string) => {
    // In a real implementation, this would show a notification/toast
    console.log(success ? message : `Error: ${message}`);
  }, []);

  // Define column configurations with sort and filter options
  const columns = useMemo(() => [
    {
      id: 'name',
      header: 'Name',
      field: 'firstName', // Using firstName for sorting, but rendering full name
      sortable: true,
      renderCell: (user: User) => (
        <div className="font-medium text-gray-900 dark:text-white">
          {formatName(user)}
        </div>
      ),
      ariaLabel: 'User name',
      className: 'max-w-xs truncate'
    },
    {
      id: 'email',
      header: 'Email',
      field: 'email',
      sortable: true,
      renderCell: (user: User) => (
        <div className="text-gray-500 dark:text-gray-400 truncate max-w-xs" title={user.email}>
          {user.email}
        </div>
      ),
      ariaLabel: 'User email',
      className: 'max-w-xs'
    },
    {
      id: 'role',
      header: 'Role',
      field: 'role',
      sortable: true,
      renderCell: (user: User) => {
        // Format role name for display (e.g., ADMIN -> Admin)
        const formattedRole = 
          user.role.charAt(0).toUpperCase() + 
          user.role.slice(1).toLowerCase();
        
        return (
          <div className="text-gray-700 dark:text-gray-300">
            {formattedRole}
          </div>
        );
      },
      ariaLabel: 'User role',
      className: 'hidden md:table-cell'
    },
    {
      id: 'status',
      header: 'Status',
      field: 'isActive',
      sortable: true,
      renderCell: (user: User) => <UserStatus isActive={user.isActive} />,
      ariaLabel: 'User status'
    },
    {
      id: 'createdAt',
      header: 'Created',
      field: 'createdAt',
      sortable: true,
      renderCell: (user: User) => (
        <div className="text-gray-500 dark:text-gray-400">
          {formatDate(user.createdAt)}
        </div>
      ),
      ariaLabel: 'User creation date',
      className: 'hidden lg:table-cell',
      hideOnMobile: true
    },
    {
      id: 'actions',
      header: 'Actions',
      field: 'id',
      sortable: false,
      renderCell: (user: User) => (
        <UserActions
          user={user}
          onEdit={() => onEdit(user)}
          onActionComplete={handleActionComplete}
        />
      ),
      width: 'w-24',
      ariaLabel: 'User actions'
    }
  ], [onEdit, handleActionComplete]);

  // Handle error state
  if (error) {
    return (
      <div role="alert" aria-live="assertive" className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-medium">Error loading users</h3>
            <p className="text-sm mt-1">{error.message}</p>
          </div>
          <button 
            className="text-red-500 hover:text-red-700 dark:hover:text-red-300"
            onClick={clearError}
            aria-label="Dismiss error"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <button 
          className="mt-3 px-4 py-2 bg-red-100 dark:bg-red-800 rounded-md text-sm font-medium text-red-700 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-900 transition-colors"
          onClick={retryOperation}
        >
          Retry loading users
        </button>
      </div>
    );
  }

  // Handle empty state (no users and not loading)
  if (users.length === 0 && !loading) {
    return (
      <div role="status" className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-8 text-center">
        <svg 
          className="mx-auto h-12 w-12 text-gray-400" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={1} 
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" 
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No users found</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Get started by creating a new user.
        </p>
      </div>
    );
  }

  return (
    <div 
      className={`user-table-container ${className}`}
      role="region" 
      aria-label="User management"
    >
      <Table
        data={users}
        columns={columns}
        isLoading={loading}
        totalItems={tableState.totalItems}
        onSort={tableHandlers.onSort}
        onPageChange={tableHandlers.onPageChange}
        onPageSizeChange={tableHandlers.onPageSizeChange}
        className="w-full"
        ariaLabel="Users table"
        themeVariant="striped"
      />
    </div>
  );
};

export default UserTable;