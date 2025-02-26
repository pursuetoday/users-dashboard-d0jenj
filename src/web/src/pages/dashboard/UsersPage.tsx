import React, { useState, useCallback, useMemo } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import UserTable from '../../components/user/UserTable';
import { useUser } from '../../hooks/useUser';
import { useAuth } from '../../hooks/useAuth';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import { User, UserRole } from '../../types/user.types';

/**
 * Main page component for user management dashboard that provides a comprehensive
 * interface for viewing, filtering, and managing users with role-based access control,
 * accessibility support, and responsive design
 */
const UsersPage: React.FC = () => {
  // State for modal visibility and user selection
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Get user data and handlers from custom hook
  const { 
    users, 
    loading, 
    error, 
    updateUser, 
    deleteUser,
    tableState,
    tableHandlers,
    clearError,
    retryOperation
  } = useUser();

  // Get current user role for RBAC from auth context
  const { user: currentUser } = useAuth();
  const userRole = currentUser?.role || UserRole.GUEST;
  
  // Handle edit user action with security checks
  const handleEditUser = useCallback((user: User) => {
    // Verify permission based on role
    const canEdit = 
      userRole === UserRole.ADMIN || 
      (userRole === UserRole.MANAGER && user.role !== UserRole.ADMIN) ||
      (userRole === UserRole.USER && currentUser?.id === user.id);
      
    if (!canEdit) {
      console.error('Permission denied: You cannot edit this user');
      return;
    }
    
    // Sanitize user data before setting
    const sanitizedUser = { ...user };
    
    // Set selected user and open modal
    setSelectedUser(sanitizedUser);
    setIsModalOpen(true);
    
    // Log edit attempt for audit
    console.log(`Edit initiated for user ${user.id}`, { initiatedBy: currentUser?.id });
  }, [currentUser?.id, userRole]);
  
  // Handle delete user action with security checks
  const handleDeleteUser = useCallback(async (user: User) => {
    // Verify permission based on role
    const canDelete = 
      userRole === UserRole.ADMIN || 
      (userRole === UserRole.MANAGER && 
        (user.role === UserRole.USER || user.role === UserRole.GUEST));
        
    if (!canDelete) {
      console.error('Permission denied: You cannot delete this user');
      return;
    }
    
    try {
      await deleteUser(user.id);
    } catch (error) {
      console.error(`Error deleting user ${user.id}:`, error);
    }
  }, [deleteUser, userRole]);
  
  // Form initial values derived from selected user
  const formInitialValues = useMemo(() => ({
    email: selectedUser?.email || '',
    firstName: selectedUser?.firstName || '',
    lastName: selectedUser?.lastName || '',
    role: selectedUser?.role || UserRole.USER,
    isActive: selectedUser?.isActive ?? true
  }), [selectedUser]);
  
  // Form submission handler
  const handleFormSubmit = useCallback(async (formData: typeof formInitialValues) => {
    if (!selectedUser) return;
    
    try {
      await updateUser(selectedUser.id, formData);
      setIsModalOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error(`Error updating user ${selectedUser.id}:`, error);
    }
  }, [selectedUser, updateUser]);
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4" id="page-title">
            User Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            View, edit, and manage users with role-based permissions
          </p>
        </header>
        
        <main>
          {/* User table with edit/delete handlers */}
          <UserTable 
            onEdit={handleEditUser}
            onDelete={handleDeleteUser}
          />
          
          {/* Edit user modal */}
          <Modal
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setSelectedUser(null);
            }}
            title={selectedUser ? `Edit ${selectedUser.firstName} ${selectedUser.lastName}` : 'Edit User'}
            initialFocus={undefined}
          >
            {selectedUser && (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleFormSubmit(formInitialValues);
                }} 
                className="space-y-4"
              >
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    value={formInitialValues.email}
                    onChange={(e) => {
                      const newValues = {...formInitialValues, email: e.target.value};
                      setSelectedUser({...selectedUser, ...newValues});
                    }}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    required
                    aria-required="true"
                  />
                </div>
                
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    id="firstName"
                    value={formInitialValues.firstName}
                    onChange={(e) => {
                      const newValues = {...formInitialValues, firstName: e.target.value};
                      setSelectedUser({...selectedUser, ...newValues});
                    }}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    required
                    aria-required="true"
                  />
                </div>
                
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    id="lastName"
                    value={formInitialValues.lastName}
                    onChange={(e) => {
                      const newValues = {...formInitialValues, lastName: e.target.value};
                      setSelectedUser({...selectedUser, ...newValues});
                    }}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    required
                    aria-required="true"
                  />
                </div>
                
                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Role
                  </label>
                  <select
                    name="role"
                    id="role"
                    value={formInitialValues.role}
                    onChange={(e) => {
                      const newValues = {...formInitialValues, role: e.target.value as UserRole};
                      setSelectedUser({...selectedUser, ...newValues});
                    }}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    aria-required="true"
                  >
                    {/* Only show roles the current user can assign */}
                    {userRole === UserRole.ADMIN && (
                      <option value={UserRole.ADMIN}>Admin</option>
                    )}
                    {(userRole === UserRole.ADMIN || userRole === UserRole.MANAGER) && (
                      <option value={UserRole.MANAGER}>Manager</option>
                    )}
                    <option value={UserRole.USER}>User</option>
                    <option value={UserRole.GUEST}>Guest</option>
                  </select>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="isActive"
                    id="isActive"
                    checked={formInitialValues.isActive}
                    onChange={(e) => {
                      const newValues = {...formInitialValues, isActive: e.target.checked};
                      setSelectedUser({...selectedUser, ...newValues});
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                    Active
                  </label>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsModalOpen(false);
                      setSelectedUser(null);
                    }}
                    type="button"
                    ariaLabel="Cancel editing user"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    loading={loading}
                    ariaLabel="Save user changes"
                  >
                    Save
                  </Button>
                </div>
              </form>
            )}
          </Modal>
        </main>
      </div>
    </DashboardLayout>
  );
};

export default UsersPage;