import { useState, useCallback, useEffect, useMemo } from 'react'; // ^18.0.0
import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
} from 'react-query'; // ^4.0.0
import { userService } from '../services/user.service';
import {
  User,
  UserFormData,
  UserResponse,
  UsersResponse,
  UserFilters,
  UserRole,
} from '../types/user.types';
import { useTable } from './useTable';
import { ApiError, ErrorType } from '../types/api.types';

/**
 * Interface for the custom error with proper typing
 */
interface UserError {
  message: string;
  code: ErrorType;
  fields?: Record<string, string[]>;
}

// Define react-query cache keys
const USER_QUERY_KEY = 'users';
const USER_DETAIL_KEY = 'user-detail';

/**
 * Advanced custom hook for managing user data with optimistic updates,
 * cache invalidation, and comprehensive error handling
 * 
 * @param initialFilters - Initial filter criteria for user listing
 * @returns Object containing user data and management functions
 */
export function useUser(initialFilters: UserFilters = {
  role: null,
  isActive: null,
  search: ''
}) {
  // Initialize query client with retry configuration
  const queryClient = useQueryClient();
  
  // Local state for selected user (for viewing/editing)
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // State for current filters with defaults
  const [filters, setFilters] = useState<UserFilters>(initialFilters);
  
  // State for error handling
  const [error, setError] = useState<UserError | null>(null);
  
  // Track if we're performing a retry operation
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  // Setup table state with virtual scrolling
  const {
    state: tableState,
    handlers: tableHandlers,
    resetTable
  } = useTable<User>(
    [], // Initial data is empty, will be populated by query
    {
      // Initial table state
      page: 1,
      pageSize: 10,
      sortField: 'createdAt',
      sortDirection: 'desc',
      isLoading: true
    },
    {
      // Table options
      enableVirtualization: true,
      virtualScrollHeight: 600,
      onError: (error: Error) => {
        setError({
          message: error.message,
          code: ErrorType.UNKNOWN
        });
      }
    }
  );

  // Configure users query with caching and error boundaries
  const {
    data: usersResponse,
    isLoading,
    isError,
    refetch
  } = useQuery<UsersResponse, ApiError>(
    [USER_QUERY_KEY, tableState.page, tableState.pageSize, tableState.sortField, tableState.sortDirection, filters],
    async () => {
      // Convert table sort state to API parameters
      const sortField = tableState.sortField as string || 'createdAt';
      const sortDirection = tableState.sortDirection || 'desc';

      // Fetch users from service with optimized caching
      return userService.getUsers(
        tableState.page,
        tableState.pageSize,
        {
          ...filters,
          sort: {
            field: sortField,
            order: sortDirection
          }
        }
      );
    },
    {
      keepPreviousData: true, // Keep previous data while loading new data
      staleTime: 30000, // Consider data fresh for 30 seconds
      cacheTime: 5 * 60 * 1000, // Cache for 5 minutes
      refetchOnWindowFocus: false, // Don't refetch when window regains focus
      retry: 3, // Retry failed requests 3 times
      onError: (error: ApiError) => {
        // Convert API error to user-friendly error with type guards
        setError({
          message: error.message || 'An error occurred while fetching users',
          code: error.code || ErrorType.UNKNOWN,
          fields: error.errors
        });
      },
      onSuccess: () => {
        // Clear error state on successful fetch
        setError(null);
        setIsRetrying(false);
      }
    }
  );

  // Implement create user mutation with optimistic updates
  const createUserMutation = useMutation<UserResponse, ApiError, UserFormData>(
    (userData) => userService.createUser(userData),
    {
      onMutate: async (newUserData) => {
        // Cancel any outgoing refetches to avoid overwriting optimistic update
        await queryClient.cancelQueries([USER_QUERY_KEY]);

        // Snapshot the previous value
        const previousUsers = queryClient.getQueryData<UsersResponse>([
          USER_QUERY_KEY,
          tableState.page,
          tableState.pageSize,
          tableState.sortField,
          tableState.sortDirection,
          filters
        ]);

        // Optimistically update the cache with the new user
        if (previousUsers) {
          // Create a temporary ID for the optimistic update
          const tempId = `temp-${Date.now()}`;
          
          // Create a temporary user object
          const newUser: User = {
            id: tempId,
            email: newUserData.email,
            firstName: newUserData.firstName,
            lastName: newUserData.lastName,
            role: newUserData.role,
            isActive: newUserData.isActive,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          // Update the cache
          queryClient.setQueryData<UsersResponse>(
            [
              USER_QUERY_KEY,
              tableState.page,
              tableState.pageSize,
              tableState.sortField,
              tableState.sortDirection,
              filters
            ],
            {
              ...previousUsers,
              data: [newUser, ...previousUsers.data],
              total: previousUsers.total + 1
            }
          );
        }

        // Return a context with the previous users
        return { previousUsers };
      },
      onError: (error, variables, context) => {
        // Revert to previous state if the mutation fails
        if (context?.previousUsers) {
          queryClient.setQueryData(
            [
              USER_QUERY_KEY,
              tableState.page,
              tableState.pageSize,
              tableState.sortField,
              tableState.sortDirection,
              filters
            ],
            context.previousUsers
          );
        }

        // Set error state
        setError({
          message: error.message || 'An error occurred while creating the user',
          code: error.code || ErrorType.UNKNOWN,
          fields: error.errors
        });
      },
      onSuccess: () => {
        // Clear error state
        setError(null);

        // Setup automatic cache invalidation
        queryClient.invalidateQueries([USER_QUERY_KEY]);
      }
    }
  );

  // Implement update user mutation with optimistic updates
  const updateUserMutation = useMutation<
    UserResponse,
    ApiError,
    { id: string; data: Partial<UserFormData> }
  >(
    ({ id, data }) => userService.updateUser(id, data),
    {
      onMutate: async ({ id, data }) => {
        // Cancel any outgoing refetches to avoid overwriting optimistic update
        await queryClient.cancelQueries([USER_QUERY_KEY]);
        await queryClient.cancelQueries([USER_DETAIL_KEY, id]);

        // Snapshot the previous values
        const previousUsers = queryClient.getQueryData<UsersResponse>([
          USER_QUERY_KEY,
          tableState.page,
          tableState.pageSize,
          tableState.sortField,
          tableState.sortDirection,
          filters
        ]);
        
        const previousUserDetail = queryClient.getQueryData<UserResponse>([
          USER_DETAIL_KEY,
          id
        ]);

        // Optimistically update the cache with the updated user
        if (previousUsers) {
          const updatedUsers = {
            ...previousUsers,
            data: previousUsers.data.map((user) =>
              user.id === id
                ? { ...user, ...data, updatedAt: new Date().toISOString() }
                : user
            )
          };

          queryClient.setQueryData(
            [
              USER_QUERY_KEY,
              tableState.page,
              tableState.pageSize,
              tableState.sortField,
              tableState.sortDirection,
              filters
            ],
            updatedUsers
          );
        }

        // Update the user detail cache if it exists
        if (previousUserDetail) {
          queryClient.setQueryData([USER_DETAIL_KEY, id], {
            ...previousUserDetail,
            data: {
              ...previousUserDetail.data,
              ...data,
              updatedAt: new Date().toISOString()
            }
          });

          // Also update the selected user if it's the same one
          if (selectedUser && selectedUser.id === id) {
            setSelectedUser({
              ...selectedUser,
              ...data,
              updatedAt: new Date().toISOString()
            });
          }
        }

        // Return a context with the previous values
        return { previousUsers, previousUserDetail };
      },
      onError: (error, variables, context) => {
        // Revert to previous state if the mutation fails
        if (context?.previousUsers) {
          queryClient.setQueryData(
            [
              USER_QUERY_KEY,
              tableState.page,
              tableState.pageSize,
              tableState.sortField,
              tableState.sortDirection,
              filters
            ],
            context.previousUsers
          );
        }

        if (context?.previousUserDetail) {
          queryClient.setQueryData(
            [USER_DETAIL_KEY, variables.id],
            context.previousUserDetail
          );
        }

        // Set error state
        setError({
          message: error.message || 'An error occurred while updating the user',
          code: error.code || ErrorType.UNKNOWN,
          fields: error.errors
        });
      },
      onSuccess: (data) => {
        // Clear error state
        setError(null);

        // Update the selected user if it's the same one
        if (selectedUser && selectedUser.id === data.data.id) {
          setSelectedUser(data.data);
        }

        // Setup automatic cache invalidation
        queryClient.invalidateQueries([USER_QUERY_KEY]);
        queryClient.invalidateQueries([USER_DETAIL_KEY, data.data.id]);
      }
    }
  );

  // Implement delete user mutation with optimistic updates
  const deleteUserMutation = useMutation<boolean, ApiError, string>(
    (id) => userService.deleteUser(id),
    {
      onMutate: async (id) => {
        // Cancel any outgoing refetches to avoid overwriting optimistic update
        await queryClient.cancelQueries([USER_QUERY_KEY]);
        await queryClient.cancelQueries([USER_DETAIL_KEY, id]);

        // Snapshot the previous values
        const previousUsers = queryClient.getQueryData<UsersResponse>([
          USER_QUERY_KEY,
          tableState.page,
          tableState.pageSize,
          tableState.sortField,
          tableState.sortDirection,
          filters
        ]);
        
        const previousUserDetail = queryClient.getQueryData<UserResponse>([
          USER_DETAIL_KEY,
          id
        ]);

        // Optimistically update the cache by removing the deleted user
        if (previousUsers) {
          const updatedUsers = {
            ...previousUsers,
            data: previousUsers.data.filter((user) => user.id !== id),
            total: previousUsers.total - 1
          };

          queryClient.setQueryData(
            [
              USER_QUERY_KEY,
              tableState.page,
              tableState.pageSize,
              tableState.sortField,
              tableState.sortDirection,
              filters
            ],
            updatedUsers
          );
        }

        // Remove the user detail from cache
        queryClient.removeQueries([USER_DETAIL_KEY, id]);

        // If the selected user is the one being deleted, clear it
        if (selectedUser && selectedUser.id === id) {
          setSelectedUser(null);
        }

        // Return a context with the previous values
        return { previousUsers, previousUserDetail };
      },
      onError: (error, id, context) => {
        // Revert to previous state if the mutation fails
        if (context?.previousUsers) {
          queryClient.setQueryData(
            [
              USER_QUERY_KEY,
              tableState.page,
              tableState.pageSize,
              tableState.sortField,
              tableState.sortDirection,
              filters
            ],
            context.previousUsers
          );
        }

        if (context?.previousUserDetail) {
          queryClient.setQueryData(
            [USER_DETAIL_KEY, id],
            context.previousUserDetail
          );
        }

        // Set error state
        setError({
          message: error.message || 'An error occurred while deleting the user',
          code: error.code || ErrorType.UNKNOWN,
          fields: error.errors
        });
      },
      onSuccess: () => {
        // Clear error state
        setError(null);

        // Setup automatic cache invalidation
        queryClient.invalidateQueries([USER_QUERY_KEY]);
        
        // If we've deleted the last item on the page, go to the previous page
        if (usersResponse && usersResponse.data.length === 1 && tableState.page > 1) {
          tableHandlers.onPageChange(tableState.page - 1);
        }
      }
    }
  );

  // Implement debounced search/filter
  useEffect(() => {
    const timer = setTimeout(() => {
      if (initialFilters.search !== filters.search) {
        setFilters(prev => ({
          ...prev,
          search: initialFilters.search
        }));
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [initialFilters.search, filters.search]);

  // Setup role-based access validation
  const hasPermission = useCallback((action: 'view' | 'create' | 'edit' | 'delete', targetUserRole?: UserRole) => {
    // Get current user role from localStorage or context
    const currentUserRoleString = localStorage.getItem('userRole') || 'USER';
    const currentUserRole = currentUserRoleString as UserRole;
    
    // Admin can do everything
    if (currentUserRole === UserRole.ADMIN) {
      return true;
    }
    
    // Manager can view all, create/edit any except Admin, delete only Users/Guests
    if (currentUserRole === UserRole.MANAGER) {
      if (action === 'view') return true;
      if (action === 'create') return true;
      if (action === 'edit') return targetUserRole !== UserRole.ADMIN;
      if (action === 'delete') return targetUserRole === UserRole.USER || targetUserRole === UserRole.GUEST;
    }
    
    // User can only view all and edit self
    if (currentUserRole === UserRole.USER) {
      if (action === 'view') return true;
      // For edit self, we'd need to check if the target user is the current user
      // This would require additional context like the current user ID
    }
    
    // Guest can only view
    if (currentUserRole === UserRole.GUEST) {
      return action === 'view';
    }
    
    return false;
  }, []);

  // Create a user with role-based access control
  const createUser = useCallback(
    async (data: UserFormData) => {
      if (!hasPermission('create', data.role)) {
        setError({
          message: 'You do not have permission to create users with this role',
          code: ErrorType.AUTHENTICATION
        });
        return;
      }
      
      try {
        await createUserMutation.mutateAsync(data);
      } catch (error) {
        // Error is handled by the mutation onError callback
        console.error('Create user error:', error);
      }
    },
    [createUserMutation, hasPermission]
  );

  // Update a user with role-based access control
  const updateUser = useCallback(
    async (id: string, data: Partial<UserFormData>) => {
      // If role is being changed, check permission for the new role
      if (data.role && !hasPermission('edit', data.role)) {
        setError({
          message: 'You do not have permission to assign this role',
          code: ErrorType.AUTHENTICATION
        });
        return;
      }
      
      // Find the user to check current role
      const userToUpdate = usersResponse?.data.find(user => user.id === id);
      
      if (userToUpdate && !hasPermission('edit', userToUpdate.role)) {
        setError({
          message: 'You do not have permission to edit this user',
          code: ErrorType.AUTHENTICATION
        });
        return;
      }
      
      try {
        await updateUserMutation.mutateAsync({ id, data });
      } catch (error) {
        // Error is handled by the mutation onError callback
        console.error('Update user error:', error);
      }
    },
    [updateUserMutation, hasPermission, usersResponse?.data]
  );

  // Delete a user with role-based access control
  const deleteUser = useCallback(
    async (id: string) => {
      // Find the user to check role
      const userToDelete = usersResponse?.data.find(user => user.id === id);
      
      if (userToDelete && !hasPermission('delete', userToDelete.role)) {
        setError({
          message: 'You do not have permission to delete this user',
          code: ErrorType.AUTHENTICATION
        });
        return;
      }
      
      try {
        await deleteUserMutation.mutateAsync(id);
      } catch (error) {
        // Error is handled by the mutation onError callback
        console.error('Delete user error:', error);
      }
    },
    [deleteUserMutation, hasPermission, usersResponse?.data]
  );

  // Configure performance monitoring
  const loading = useMemo(
    () =>
      isLoading ||
      createUserMutation.isLoading ||
      updateUserMutation.isLoading ||
      deleteUserMutation.isLoading ||
      isRetrying,
    [
      isLoading,
      createUserMutation.isLoading,
      updateUserMutation.isLoading,
      deleteUserMutation.isLoading,
      isRetrying
    ]
  );

  // Handle error states with type guards
  const retryOperation = useCallback(() => {
    setIsRetrying(true);
    setError(null);
    refetch();
  }, [refetch]);

  // Function to clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Memoized list of users from the query response
  const users = useMemo(() => {
    return usersResponse?.data || [];
  }, [usersResponse]);

  // Effect to update table data when users response changes
  useEffect(() => {
    if (usersResponse) {
      // Update table state with the new data
      tableState.data = usersResponse.data;
      tableState.totalItems = usersResponse.total;
    }
  }, [usersResponse, tableState]);

  // Return enhanced user management interface
  return {
    users,
    loading,
    error,
    tableState,
    tableHandlers,
    createUser,
    updateUser,
    deleteUser,
    selectedUser,
    setSelectedUser,
    retryOperation,
    clearError
  };
}