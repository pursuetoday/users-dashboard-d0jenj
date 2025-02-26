import React, { useState, useRef, useEffect } from 'react';
import Button from '../common/Button';
import Modal from '../common/Modal';
import { useUser } from '../../hooks/useUser';
import ErrorBoundary from '../common/ErrorBoundary';
import { User, UserRole } from '../../types/user.types';

/**
 * Props interface for UserActions component with enhanced type safety
 */
interface UserActionsProps {
  /** User object containing user data with required fields */
  user: User;
  /** Callback function for edit action with error handling */
  onEdit: () => void;
  /** Callback for action completion status */
  onActionComplete: (success: boolean, message: string) => void;
}

/**
 * Component for rendering user action buttons with enhanced features
 * Provides edit and delete functionality with confirmation modals,
 * enhanced error handling, accessibility features, and loading states.
 * 
 * Features:
 * - Edit and delete operations with permission checks
 * - Confirmation modal for delete operations
 * - Comprehensive error handling with user feedback
 * - Loading states and progress indicators
 * - Keyboard navigation and screen reader support
 * - Retry mechanism for transient errors
 * - Focus management for accessibility
 */
const UserActions: React.FC<UserActionsProps> = ({ user, onEdit, onActionComplete }) => {
  // State management
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // Refs for focus management
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  
  // Get user management functions from hook
  const { deleteUser, setSelectedUser } = useUser();

  // Focus management for modal - move focus to confirm button when modal opens
  useEffect(() => {
    if (isDeleteModalOpen && confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    }
  }, [isDeleteModalOpen]);
  
  // Reset focus after modal closes - return focus to delete button
  useEffect(() => {
    if (!isDeleteModalOpen && deleteButtonRef.current) {
      deleteButtonRef.current.focus();
    }
  }, [isDeleteModalOpen]);

  /**
   * Handles the user deletion process with error handling and retries
   * 
   * @param userId - ID of the user to delete
   */
  const handleDelete = async (userId: string) => {
    // Set loading state for delete operation
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      // Validate user permissions for delete action based on role-based access control
      const userRoleString = localStorage.getItem('userRole') || '';
      const hasPermission = 
        userRoleString === UserRole.ADMIN || 
        (userRoleString === UserRole.MANAGER && 
          (user.role === UserRole.USER || user.role === UserRole.GUEST));
      
      if (!hasPermission) {
        throw new Error('You do not have permission to delete this user');
      }
      
      // Show confirmation modal with accessibility focus
      setIsDeleteModalOpen(true);
      
      // Update audit log with action attempt
      console.info(`Delete action initiated for user: ${userId}`);
    } catch (error) {
      // Handle errors with appropriate messages
      const errorMsg = error instanceof Error ? error.message : 'An error occurred while preparing to delete the user';
      setErrorMessage(errorMsg);
      onActionComplete(false, errorMsg);
      
      // Log error for debugging
      console.error(`Error preparing to delete user ${userId}:`, error);
    } finally {
      // Reset loading state
      setIsLoading(false);
    }
  };

  /**
   * Confirms user deletion after modal confirmation with retry mechanism
   * Implements a retry system for transient errors
   */
  const confirmDelete = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      // Call API to delete user with retry mechanism
      await deleteUser(user.id);
      
      // Reset retry count on success
      setRetryCount(0);
      
      // Close modal
      setIsDeleteModalOpen(false);
      
      // Notify parent of successful deletion
      onActionComplete(true, `${user.firstName} ${user.lastName} has been deleted successfully`);
      
      // Log successful deletion
      console.info(`User deleted successfully: ${user.id}`);
    } catch (error) {
      // Implement retry logic for certain types of errors (not permission or not found errors)
      if (retryCount < 2 && error instanceof Error && 
          !error.message.includes('permission') && 
          !error.message.includes('not found')) {
        setRetryCount(prevCount => prevCount + 1);
        
        // Show retry message
        setErrorMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}. Retrying... (${retryCount + 1}/3)`);
        
        // Add a small delay before retry to avoid overwhelming the server
        setTimeout(() => {
          confirmDelete();
        }, 1000);
        
        return;
      }
      
      // If retries exhausted or permanent error, show final error
      const errorMsg = error instanceof Error ? error.message : 'An error occurred while deleting the user';
      setErrorMessage(errorMsg);
      onActionComplete(false, errorMsg);
      
      // Reset retry count
      setRetryCount(0);
      
      // Log error for debugging
      console.error(`Error deleting user ${user.id}:`, error);
    } finally {
      // Only reset loading state if we're not retrying
      if (retryCount >= 2) {
        setIsLoading(false);
      }
    }
  };

  /**
   * Handles the edit user action with validation
   * 
   * @param user - User object to edit
   */
  const handleEdit = (user: User) => {
    // Validate user permissions for edit action based on role-based access control
    const userRoleString = localStorage.getItem('userRole') || '';
    const hasPermission = 
      userRoleString === UserRole.ADMIN || 
      (userRoleString === UserRole.MANAGER && user.role !== UserRole.ADMIN) ||
      (userRoleString === UserRole.USER && localStorage.getItem('userId') === user.id);
    
    if (!hasPermission) {
      const errorMsg = 'You do not have permission to edit this user';
      setErrorMessage(errorMsg);
      onActionComplete(false, errorMsg);
      return;
    }
    
    // Set loading state for edit operation
    setIsLoading(true);
    
    try {
      // Validate user data completeness
      if (!user.id || !user.email) {
        throw new Error('User data is incomplete');
      }
      
      // Set selected user in context - this populates the edit form in the parent component
      setSelectedUser(user);
      
      // Call onEdit callback with error handling
      onEdit();
      
      // Notify parent of successful action
      onActionComplete(true, 'User edit mode activated');
      
      // Log edit action for audit trail
      console.info(`Edit action initiated for user: ${user.id}`);
    } catch (error) {
      // Handle any errors during the process
      const errorMsg = error instanceof Error ? error.message : 'An error occurred while preparing to edit the user';
      setErrorMessage(errorMsg);
      onActionComplete(false, errorMsg);
      
      // Log error for debugging
      console.error(`Error preparing to edit user ${user.id}:`, error);
    } finally {
      // Reset loading state
      setIsLoading(false);
    }
  };

  /**
   * Renders the action buttons and confirmation modal with accessibility
   * Uses ErrorBoundary for robustness
   */
  return (
    <ErrorBoundary>
      <div className="flex items-center space-x-2 rtl:space-x-reverse" data-testid="user-actions">
        {/* Edit button with loading state */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleEdit(user)}
          disabled={isLoading}
          ariaLabel={`Edit ${user.firstName} ${user.lastName}`}
          tabIndex={0}
        >
          <span className="sr-only">Edit</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </Button>

        {/* Delete button with danger variant */}
        <Button
          ref={deleteButtonRef}
          variant="danger"
          size="sm"
          onClick={() => handleDelete(user.id)}
          disabled={isLoading}
          ariaLabel={`Delete ${user.firstName} ${user.lastName}`}
          tabIndex={0}
        >
          <span className="sr-only">Delete</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </Button>

        {/* Confirmation modal with focus trap */}
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setErrorMessage(null);
            setRetryCount(0);
          }}
          title={`Delete ${user.firstName} ${user.lastName}`}
          size="sm"
          initialFocus={confirmButtonRef}
        >
          <div>
            <p className="mb-4">
              Are you sure you want to delete this user? This action cannot be undone.
            </p>
            {errorMessage && (
              <div 
                className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-red-600 text-sm dark:bg-red-900 dark:border-red-800 dark:text-red-200" 
                role="alert"
                aria-live="polite"
              >
                {errorMessage}
              </div>
            )}
            <div className="flex justify-end space-x-3 rtl:space-x-reverse">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setErrorMessage(null);
                  setRetryCount(0);
                }}
                disabled={isLoading && retryCount < 2}
                ariaLabel="Cancel deletion"
              >
                Cancel
              </Button>
              <Button
                ref={confirmButtonRef}
                variant="danger"
                onClick={confirmDelete}
                loading={isLoading}
                disabled={isLoading && retryCount >= 2}
                ariaLabel="Confirm delete"
              >
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </ErrorBoundary>
  );
};

export default UserActions;