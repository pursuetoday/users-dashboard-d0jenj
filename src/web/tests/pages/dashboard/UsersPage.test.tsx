import React from 'react';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import UsersPage from '../../src/pages/dashboard/UsersPage';
import { renderWithProviders } from '../../utils/test-utils';
import { server } from '../../mocks/server';
import { rest } from 'msw';

// Global setup before all tests
beforeAll(() => {
  // Initialize MSW server
  server.listen();
});

// Setup before each test
beforeEach(() => {
  // Reset any runtime handlers for clean test state
  server.resetHandlers();
  // Clear React Query cache
  // Reset mock functions
  // Setup user event instance
  userEvent.setup();
});

// Cleanup after each test
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
  // Reset MSW handlers
  server.resetHandlers();
  // Cleanup rendered components
});

// Test suite for UsersPage component
describe('UsersPage', () => {
  
  // Test 1: Verifies initial table render with user data
  test('renders_user_table_with_data', async () => {
    const user = userEvent.setup();
    
    // Render UsersPage with providers
    renderWithProviders(<UsersPage />);
    
    // Verify loading state appears
    expect(screen.getByText('User Management')).toBeInTheDocument();
    
    // Wait for user data to load
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    
    // Verify table headers presence and order
    const headers = screen.getAllByRole('columnheader');
    expect(headers.length).toBeGreaterThan(0);
    expect(headers[0]).toHaveTextContent(/name/i);
    expect(headers[1]).toHaveTextContent(/email/i);
    expect(headers[2]).toHaveTextContent(/role/i);
    expect(headers[3]).toHaveTextContent(/status/i);
    
    // Verify user data rows display correctly
    const rows = screen.getAllByRole('row').slice(1); // Skip header row
    expect(rows.length).toBeGreaterThan(0);
    
    // First row should contain admin user data
    const firstRow = rows[0];
    expect(within(firstRow).getByText(/admin/i)).toBeInTheDocument();
    expect(within(firstRow).getByText(/admin@example.com/i)).toBeInTheDocument();
    
    // Check pagination controls
    const paginationControls = screen.getByRole('navigation');
    expect(paginationControls).toBeInTheDocument();
    
    // Verify accessibility compliance
    // Note: In a real test, we would use axe-core here
    expect(screen.getByRole('table')).toHaveAttribute('aria-label');
  });
  
  // Test 2: Tests search and filter functionality
  test('handles_user_search_and_filters', async () => {
    const user = userEvent.setup();
    
    renderWithProviders(<UsersPage />);
    
    // Wait for user data to load
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    
    // Type search query
    // Note: The exact selector will depend on your implementation
    const searchInput = screen.getByRole('searchbox', { name: /search/i }) || 
                        screen.getByLabelText(/search/i) || 
                        screen.getByPlaceholderText(/search/i);
    
    await user.type(searchInput, 'admin');
    
    // Verify debounced search behavior
    await waitFor(() => {
      const rows = screen.getAllByRole('row').slice(1);
      // Check that only rows containing 'admin' are shown
      expect(rows.every(row => row.textContent.toLowerCase().includes('admin'))).toBe(true);
    });
    
    // Apply role filter
    const roleFilter = screen.getByLabelText(/role/i) || 
                      screen.getByRole('combobox', { name: /filter by role/i });
    
    await user.selectOptions(roleFilter, 'ADMIN');
    
    // Verify combined search and filter results
    await waitFor(() => {
      const rows = screen.getAllByRole('row').slice(1);
      // Should only show admin users
      expect(rows.every(row => {
        return row.textContent.toLowerCase().includes('admin');
      })).toBe(true);
    });
    
    // Clear filters
    const clearButton = screen.getByRole('button', { name: /clear/i });
    await user.click(clearButton);
    
    // Verify original data restored
    await waitFor(() => {
      const rows = screen.getAllByRole('row').slice(1);
      expect(rows.length).toBeGreaterThan(1);
      // Should include non-admin users now
      expect(rows.some(row => !row.textContent.toLowerCase().includes('admin'))).toBe(true);
    });
  });
  
  // Test 3: Tests user creation, update, and deletion
  test('manages_user_crud_operations', async () => {
    const user = userEvent.setup();
    
    renderWithProviders(<UsersPage />);
    
    // Wait for user data to load
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    
    // Test user creation flow
    const addButton = screen.getByRole('button', { name: /add user/i });
    await user.click(addButton);
    
    // Verify form validation
    const emailInput = screen.getByLabelText(/email/i);
    const firstNameInput = screen.getByLabelText(/first name/i);
    const lastNameInput = screen.getByLabelText(/last name/i);
    const roleSelect = screen.getByLabelText(/role/i);
    
    // Submit without filling required fields
    const submitButton = screen.getByRole('button', { name: /save/i });
    await user.click(submitButton);
    
    // Validation errors should appear
    expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    
    // Fill out the form
    await user.type(emailInput, 'newuser@example.com');
    await user.type(firstNameInput, 'New');
    await user.type(lastNameInput, 'User');
    await user.selectOptions(roleSelect, 'USER');
    
    // Submit valid form
    await user.click(submitButton);
    
    // Verify new user appears
    await waitFor(() => {
      expect(screen.getByText('newuser@example.com')).toBeInTheDocument();
    });
    
    // Test user update with edit modal
    const userRow = screen.getByText('newuser@example.com').closest('tr');
    const editButton = within(userRow).getByRole('button', { name: /edit/i });
    await user.click(editButton);
    
    // Edit modal should appear
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    
    // Update the user
    await user.clear(screen.getByLabelText(/first name/i));
    await user.type(screen.getByLabelText(/first name/i), 'Updated');
    
    // Save changes
    await user.click(screen.getByRole('button', { name: /save/i }));
    
    // Verify optimistic updates
    await waitFor(() => {
      expect(screen.getByText('Updated')).toBeInTheDocument();
    });
    
    // Test user deletion with confirmation
    const updatedUserRow = screen.getByText('Updated').closest('tr');
    const deleteButton = within(updatedUserRow).getByRole('button', { name: /delete/i });
    await user.click(deleteButton);
    
    // Confirmation modal should appear
    expect(screen.getByText(/delete/i)).toBeInTheDocument();
    
    // Confirm deletion
    await user.click(screen.getByRole('button', { name: /delete/i }));
    
    // Verify cache invalidation
    await waitFor(() => {
      expect(screen.queryByText('Updated')).not.toBeInTheDocument();
    });
    
    // Check success notifications
    expect(screen.getByText(/success/i)).toBeInTheDocument();
  });
  
  // Test 4: Tests error handling scenarios
  test('handles_error_states', async () => {
    const user = userEvent.setup();
    
    // Mock API errors for various operations
    server.use(
      rest.get('/api/users', (req, res, ctx) => {
        return res(
          ctx.status(500),
          ctx.json({
            message: 'Error loading users',
            status: 500
          })
        );
      })
    );
    
    renderWithProviders(<UsersPage />);
    
    // Verify error state displays
    await waitFor(() => {
      expect(screen.getByText(/error loading users/i)).toBeInTheDocument();
    });
    
    // Test retry functionality
    const retryButton = screen.getByRole('button', { name: /retry/i });
    await user.click(retryButton);
    
    // Loading state should appear
    expect(screen.getByRole('status')).toBeInTheDocument();
    
    // Error should reappear since the mock response is still an error
    await waitFor(() => {
      expect(screen.getByText(/error loading users/i)).toBeInTheDocument();
    });
    
    // Reset handlers to allow data to load
    server.resetHandlers();
    
    // Try again
    await user.click(retryButton);
    
    // Wait for data to load successfully
    await waitFor(() => {
      expect(screen.queryByText(/error loading users/i)).not.toBeInTheDocument();
    });
    
    // Test error during user update
    server.use(
      rest.put('/api/users/:id', (req, res, ctx) => {
        return res(
          ctx.status(403),
          ctx.json({
            message: 'Permission denied',
            status: 403
          })
        );
      })
    );
    
    // Click edit on a user
    const editButton = screen.getAllByRole('button', { name: /edit/i })[0];
    await user.click(editButton);
    
    // Make a change and try to save
    const nameInput = screen.getByLabelText(/first name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Error Test');
    
    await user.click(screen.getByRole('button', { name: /save/i }));
    
    // Verify error notifications
    await waitFor(() => {
      expect(screen.getByText(/permission denied/i)).toBeInTheDocument();
    });
    
    // Test network error handling
    server.use(
      rest.delete('/api/users/:id', (req, res) => {
        return res.networkError('Network error');
      })
    );
    
    // Try to delete a user
    const deleteButton = screen.getAllByRole('button', { name: /delete/i })[0];
    await user.click(deleteButton);
    
    // Confirm deletion
    await user.click(screen.getByRole('button', { name: /delete/i }));
    
    // Verify graceful degradation
    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });
  
  // Test 5: Tests role-based permissions
  test('enforces_role_based_access', async () => {
    const user = userEvent.setup();
    
    // Test admin user permissions
    const adminProviderOptions = {
      authOptions: {
        user: {
          id: '1',
          email: 'admin@example.com',
          role: 'ADMIN'
        }
      }
    };
    
    const { unmount } = renderWithProviders(<UsersPage />, { providerOptions: adminProviderOptions });
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    
    // Admin should see all action buttons
    const adminEditButtons = screen.getAllByRole('button', { name: /edit/i });
    expect(adminEditButtons.length).toBeGreaterThan(0);
    
    const adminDeleteButtons = screen.getAllByRole('button', { name: /delete/i });
    expect(adminDeleteButtons.length).toBeGreaterThan(0);
    
    // Clean up
    unmount();
    
    // Test regular user restrictions
    const userProviderOptions = {
      authOptions: {
        user: {
          id: '2',
          email: 'user@example.com',
          role: 'USER'
        }
      }
    };
    
    renderWithProviders(<UsersPage />, { providerOptions: userProviderOptions });
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    
    // Verify edit/delete button visibility
    const userEditButtons = screen.queryAllByRole('button', { name: /edit/i });
    expect(userEditButtons.length).toBeLessThan(adminEditButtons.length);
    
    const userDeleteButtons = screen.queryAllByRole('button', { name: /delete/i });
    expect(userDeleteButtons.length).toBe(0);
    
    // Test unauthorized access handling
    if (userEditButtons.length > 0) {
      // Try to edit a user that this user shouldn't be able to edit
      await user.click(userEditButtons[0]);
      
      // If the form appears, try to submit it
      if (screen.queryByRole('dialog')) {
        await user.type(screen.getByLabelText(/first name/i), 'Unauthorized Test');
        await user.click(screen.getByRole('button', { name: /save/i }));
        
        // Expect permission error
        await waitFor(() => {
          expect(screen.getByText(/permission denied/i)).toBeInTheDocument();
        });
      } else {
        // If the form doesn't appear, it means the action was blocked
        expect(screen.getByText(/permission denied/i)).toBeInTheDocument();
      }
    }
    
    // Verify permission-based notifications
    expect(screen.getByText(/permission denied/i)).toBeInTheDocument();
  });
});