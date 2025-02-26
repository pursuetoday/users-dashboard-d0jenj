import { renderHook, act, waitFor } from '@testing-library/react';
import { server } from 'msw';
import { QueryClient } from '@tanstack/react-query';
import { useUser } from '../../src/hooks/useUser';
import { renderWithProviders } from '../utils/test-utils';
import { handlers as userHandlers } from '../mocks/handlers';
import { UserRole } from '../../src/types/user.types';
import { SortDirection } from '../../src/constants/table.constants';

describe('useUser hook', () => {
  let queryClient: QueryClient;

  beforeAll(() => {
    // Start MSW server before all tests
    server.listen({ onUnhandledRequest: 'error' });
  });

  beforeEach(() => {
    // Setup fresh QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          // Disable retries for predictable tests
          retry: false,
          // Keep data indefinitely in tests
          cacheTime: Infinity,
        },
      },
    });
  });

  afterEach(() => {
    // Reset MSW handlers after each test
    server.resetHandlers();
    // Clear React Query cache
    queryClient.clear();
  });

  afterAll(() => {
    // Cleanup MSW server after all tests
    server.close();
  });

  it('should fetch users successfully', async () => {
    // Render the hook with a query client provider
    const { result } = renderHook(() => useUser(), {
      wrapper: ({ children }) => renderWithProviders(children, {
        providerOptions: { queryClient }
      }),
    });

    // Verify initial loading state
    expect(result.current.loading).toBe(true);

    // Wait for the query to complete
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Verify users data is received
    expect(result.current.users).toBeDefined();
    expect(result.current.users.length).toBeGreaterThan(0);
    expect(result.current.tableState.totalItems).toBeGreaterThan(0);

    // Check if we received the correct mock users
    expect(result.current.users.some(user => user.email === 'admin@example.com')).toBe(true);
    expect(result.current.users.some(user => user.email === 'user@example.com')).toBe(true);
  });

  it('should handle pagination and filtering', async () => {
    // Render hook with initial filters
    const { result } = renderHook(() => useUser({
      role: null,
      isActive: null,
      search: ''
    }), {
      wrapper: ({ children }) => renderWithProviders(children, {
        providerOptions: { queryClient }
      }),
    });

    // Wait for initial data load
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Change page
    await act(async () => {
      await result.current.tableHandlers.onPageChange(2);
    });

    // Verify table state was updated correctly
    expect(result.current.tableState.page).toBe(2);

    // Apply active status filter
    await act(async () => {
      result.current.setFilters(prev => ({ ...prev, isActive: true }));
    });

    // Wait for data to reload with the filter
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Verify that only active users are shown (all users should have isActive = true)
    expect(result.current.users.every(user => user.isActive === true)).toBe(true);

    // Apply role filter
    await act(async () => {
      result.current.setFilters(prev => ({ ...prev, role: UserRole.ADMIN }));
    });

    // Wait for data to reload with role filter
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Verify filtering by role worked
    expect(result.current.users.every(user => user.role === UserRole.ADMIN)).toBe(true);

    // Test sorting functionality
    await act(async () => {
      await result.current.tableHandlers.onSort('email', SortDirection.ASC);
    });

    // Verify sort state is updated
    expect(result.current.tableState.sortField).toBe('email');
    expect(result.current.tableState.sortDirection).toBe(SortDirection.ASC);
  });

  it('should handle CRUD operations', async () => {
    // Mock localStorage for permissions
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn().mockImplementation(() => UserRole.ADMIN),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true
    });

    const { result } = renderHook(() => useUser(), {
      wrapper: ({ children }) => renderWithProviders(children, {
        providerOptions: { queryClient }
      }),
    });

    // Wait for initial data load
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Get initial users count
    const initialUserCount = result.current.users.length;

    // Create a new user
    const newUser = {
      email: 'newuser@example.com',
      firstName: 'New',
      lastName: 'User',
      role: UserRole.USER,
      isActive: true,
    };

    await act(async () => {
      await result.current.createUser(newUser);
    });

    // Wait for create operation to complete
    await waitFor(() => {
      // Should add the new user to the list (optimistic update)
      expect(result.current.users.length).toBeGreaterThan(initialUserCount);
      expect(result.current.users.some(user => user.email === newUser.email)).toBe(true);
    });

    // Select a user for editing
    const userToUpdate = result.current.users.find(user => user.email === newUser.email);
    
    await act(async () => {
      result.current.setSelectedUser(userToUpdate!);
    });

    // Verify user is selected
    expect(result.current.selectedUser).not.toBeNull();
    expect(result.current.selectedUser?.email).toBe(newUser.email);

    // Update the selected user
    const updatedFields = {
      firstName: 'Updated',
      lastName: 'Name',
    };

    await act(async () => {
      await result.current.updateUser(result.current.selectedUser!.id, updatedFields);
    });

    // Verify user was updated
    await waitFor(() => {
      expect(result.current.selectedUser?.firstName).toBe(updatedFields.firstName);
      expect(result.current.selectedUser?.lastName).toBe(updatedFields.lastName);
    });

    // Delete a user
    const userToDelete = result.current.users.find(user => user.email !== 'admin@example.com')!;
    
    await act(async () => {
      await result.current.deleteUser(userToDelete.id);
    });

    // Verify user was deleted
    await waitFor(() => {
      expect(result.current.users.some(user => user.id === userToDelete.id)).toBe(false);
    });
  });

  it('should handle error scenarios', async () => {
    // Override GET /api/users to return an error
    server.use(
      rest.get('/api/users', (_, res, ctx) => {
        return res(
          ctx.status(500),
          ctx.json({
            message: 'Server error',
            errors: {},
            code: 'SERVER_ERROR',
          })
        );
      })
    );

    const { result } = renderHook(() => useUser(), {
      wrapper: ({ children }) => renderWithProviders(children, {
        providerOptions: { queryClient }
      }),
    });

    // Wait for error state
    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe('Server error');
    });

    // Test error clearing
    act(() => {
      result.current.clearError();
    });

    // Verify error was cleared
    expect(result.current.error).toBeNull();

    // Test retry operation
    act(() => {
      result.current.retryOperation();
    });

    // Verify loading state is active during retry
    expect(result.current.loading).toBe(true);
  });

  it('should respect role-based access control', async () => {
    // Mock localStorage to simulate a regular user (not admin)
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn().mockImplementation(() => UserRole.USER),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true
    });

    const { result } = renderHook(() => useUser(), {
      wrapper: ({ children }) => renderWithProviders(children, {
        providerOptions: { queryClient }
      }),
    });

    // Wait for initial data load
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Try to create a user with ADMIN role (should be blocked by permission check)
    const newUser = {
      email: 'newadmin@example.com',
      firstName: 'New',
      lastName: 'Admin',
      role: UserRole.ADMIN,
      isActive: true,
    };

    await act(async () => {
      await result.current.createUser(newUser);
    });

    // Verify error was set due to permission check
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.code).toBe('AUTHENTICATION');
    expect(result.current.error?.message).toContain('permission');

    // Clear error for next test
    act(() => {
      result.current.clearError();
    });

    // Try to delete a user (also should be blocked)
    const userToDelete = result.current.users[0];
    
    await act(async () => {
      await result.current.deleteUser(userToDelete.id);
    });

    // Verify error was set
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.code).toBe('AUTHENTICATION');
  });

  it('should handle optimistic updates correctly', async () => {
    // Mock localStorage for admin permissions
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn().mockImplementation(() => UserRole.ADMIN),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true
    });

    const { result } = renderHook(() => useUser(), {
      wrapper: ({ children }) => renderWithProviders(children, {
        providerOptions: { queryClient }
      }),
    });

    // Wait for initial data load
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Get initial users count
    const initialUserCount = result.current.users.length;

    // Override POST /api/users to return an error after a delay
    server.use(
      rest.post('/api/users', (_, res, ctx) => {
        return res(
          ctx.delay(100),
          ctx.status(409),
          ctx.json({
            message: 'Email already exists',
            errors: { email: ['Email is already in use'] },
            code: 'EMAIL_EXISTS',
          })
        );
      })
    );

    // Create a new user (will trigger optimistic update)
    const newUser = {
      email: 'existing@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: UserRole.USER,
      isActive: true,
    };

    // Immediately after calling createUser, the list should be optimistically updated
    await act(async () => {
      result.current.createUser(newUser);
    });

    // Verify optimistic update happened
    expect(result.current.users.length).toBe(initialUserCount + 1);
    expect(result.current.users.some(user => user.email === newUser.email)).toBe(true);

    // Wait for the actual error response
    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toContain('Email already exists');
    });

    // Verify list returned to original state due to error
    expect(result.current.users.length).toBe(initialUserCount);
    expect(result.current.users.some(user => user.email === newUser.email)).toBe(false);
  });

  it('should update table state when users response changes', async () => {
    const { result } = renderHook(() => useUser(), {
      wrapper: ({ children }) => renderWithProviders(children, {
        providerOptions: { queryClient }
      }),
    });

    // Wait for initial data load
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Verify table state matches users response
    expect(result.current.tableState.data).toEqual(result.current.users);
    expect(result.current.tableState.totalItems).toBeGreaterThan(0);

    // Apply filter which will change the users response
    await act(async () => {
      result.current.setFilters(prev => ({ ...prev, isActive: true }));
    });

    // Wait for data to reload
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Verify table state was updated with new data
    expect(result.current.tableState.data).toEqual(result.current.users);
    expect(result.current.tableState.data.every(user => user.isActive === true)).toBe(true);
  });
});