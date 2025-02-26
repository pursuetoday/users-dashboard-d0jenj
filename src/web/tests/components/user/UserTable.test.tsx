import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import UserTable from '../../src/components/user/UserTable';
import { renderWithProviders } from '../../utils/test-utils';
import { useUser } from '../../src/hooks/useUser';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock user data with all required properties
const mockUsers = [
  { 
    id: '1', 
    firstName: 'John', 
    lastName: 'Doe', 
    email: 'john@example.com', 
    role: 'ADMIN', 
    isActive: true, 
    createdAt: '2023-01-01',
    updatedAt: '2023-01-01'
  },
  { 
    id: '2', 
    firstName: 'Jane', 
    lastName: 'Smith', 
    email: 'jane@example.com', 
    role: 'USER', 
    isActive: false, 
    createdAt: '2023-01-02',
    updatedAt: '2023-01-02'
  }
];

// Mock the useUser hook
vi.mock('../../src/hooks/useUser');

describe('UserTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementation for useUser
    (useUser as jest.Mock).mockReturnValue({
      users: mockUsers,
      loading: false,
      error: null,
      tableState: {
        totalItems: mockUsers.length,
        page: 1,
        pageSize: 10,
        sortField: 'createdAt',
        sortDirection: 'desc'
      },
      tableHandlers: {
        onSort: vi.fn(),
        onPageChange: vi.fn(),
        onPageSizeChange: vi.fn()
      },
      retryOperation: vi.fn(),
      clearError: vi.fn()
    });
  });

  it('should render user table with proper accessibility', async () => {
    const { container } = renderWithProviders(
      <UserTable 
        onEdit={vi.fn()} 
        onDelete={vi.fn()}
      />
    );
    
    // Run accessibility tests
    const results = await axe(container);
    expect(results).toHaveNoViolations();
    
    // Verify table has proper ARIA attributes
    const tableRegion = screen.getByRole('region', { name: /user management/i });
    expect(tableRegion).toBeInTheDocument();
  });

  it('should handle theme changes', () => {
    // Mock useTheme hook for testing theme changes
    vi.mock('../../src/hooks/useTheme', () => ({
      useTheme: () => ({ theme: { isDark: true } })
    }));
    
    // Render with mocked dark theme
    const { rerender, unmount } = renderWithProviders(
      <UserTable 
        onEdit={vi.fn()} 
        onDelete={vi.fn()}
      />
    );
    
    expect(screen.getByRole('region')).toBeInTheDocument();
    
    // Clean up and reset
    unmount();
    vi.resetModules();
    
    // Mock light theme
    vi.mock('../../src/hooks/useTheme', () => ({
      useTheme: () => ({ theme: { isDark: false } })
    }));
    
    // Re-render with light theme
    renderWithProviders(
      <UserTable 
        onEdit={vi.fn()} 
        onDelete={vi.fn()}
      />
    );
    
    expect(screen.getByRole('region')).toBeInTheDocument();
  });

  it('should handle error states', () => {
    // Mock error state
    const mockError = { message: 'Failed to load users' };
    const mockRetryOperation = vi.fn();
    const mockClearError = vi.fn();
    
    (useUser as jest.Mock).mockReturnValue({
      users: [],
      loading: false,
      error: mockError,
      tableState: {
        totalItems: 0,
        page: 1,
        pageSize: 10
      },
      tableHandlers: {
        onSort: vi.fn(),
        onPageChange: vi.fn(),
        onPageSizeChange: vi.fn()
      },
      retryOperation: mockRetryOperation,
      clearError: mockClearError
    });
    
    renderWithProviders(
      <UserTable 
        onEdit={vi.fn()} 
        onDelete={vi.fn()}
      />
    );
    
    // Error message should be displayed
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/error loading users/i)).toBeInTheDocument();
    expect(screen.getByText(/failed to load users/i)).toBeInTheDocument();
    
    // Test retry button functionality
    const retryButton = screen.getByText(/retry loading users/i);
    fireEvent.click(retryButton);
    expect(mockRetryOperation).toHaveBeenCalled();
    
    // Test dismiss button functionality
    const dismissButton = screen.getByLabelText(/dismiss error/i);
    fireEvent.click(dismissButton);
    expect(mockClearError).toHaveBeenCalled();
  });
  
  it('should show empty state when no users are available', () => {
    // Mock empty users array
    (useUser as jest.Mock).mockReturnValue({
      users: [],
      loading: false,
      error: null,
      tableState: {
        totalItems: 0,
        page: 1,
        pageSize: 10
      },
      tableHandlers: {
        onSort: vi.fn(),
        onPageChange: vi.fn(),
        onPageSizeChange: vi.fn()
      },
      retryOperation: vi.fn(),
      clearError: vi.fn()
    });
    
    renderWithProviders(
      <UserTable 
        onEdit={vi.fn()} 
        onDelete={vi.fn()}
      />
    );
    
    // Check empty state message
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/no users found/i)).toBeInTheDocument();
    expect(screen.getByText(/get started by creating a new user/i)).toBeInTheDocument();
  });
  
  it('should display loading state when data is loading', () => {
    // Mock loading state
    (useUser as jest.Mock).mockReturnValue({
      users: [],
      loading: true,
      error: null,
      tableState: {
        totalItems: 0,
        page: 1,
        pageSize: 10
      },
      tableHandlers: {
        onSort: vi.fn(),
        onPageChange: vi.fn(),
        onPageSizeChange: vi.fn()
      },
      retryOperation: vi.fn(),
      clearError: vi.fn()
    });
    
    renderWithProviders(
      <UserTable 
        onEdit={vi.fn()} 
        onDelete={vi.fn()}
      />
    );
    
    // Loading indicator should be visible
    const loadingIndicator = screen.getByRole('status');
    expect(loadingIndicator).toBeInTheDocument();
  });
  
  it('should apply custom className when provided', () => {
    const customClass = 'custom-table-class';
    
    const { container } = renderWithProviders(
      <UserTable 
        className={customClass}
        onEdit={vi.fn()} 
        onDelete={vi.fn()}
      />
    );
    
    // Custom class should be applied to the container
    const tableContainer = container.querySelector(`.user-table-container.${customClass}`);
    expect(tableContainer).toBeInTheDocument();
  });
  
  it('should handle user edit action', () => {
    const onEditMock = vi.fn();
    
    // We'll need to mock UserActions component behavior
    vi.mock('../../src/components/user/UserActions', () => ({
      default: ({ user, onEdit }) => (
        <div data-testid="user-actions">
          <button onClick={() => onEdit(user)} aria-label="Edit user">Edit</button>
        </div>
      )
    }));
    
    renderWithProviders(
      <UserTable 
        onEdit={onEditMock} 
        onDelete={vi.fn()}
      />
    );
    
    // Find and click edit button
    const editButton = screen.getByLabelText('Edit user');
    fireEvent.click(editButton);
    
    // Check that onEdit was called with the first user
    expect(onEditMock).toHaveBeenCalledWith(mockUsers[0]);
    
    // Clean up
    vi.resetModules();
  });
  
  it('should handle sorting when column headers are clicked', async () => {
    const onSortMock = vi.fn();
    
    (useUser as jest.Mock).mockReturnValue({
      users: mockUsers,
      loading: false,
      error: null,
      tableState: {
        totalItems: mockUsers.length,
        page: 1,
        pageSize: 10,
        sortField: 'createdAt',
        sortDirection: 'desc'
      },
      tableHandlers: {
        onSort: onSortMock,
        onPageChange: vi.fn(),
        onPageSizeChange: vi.fn()
      },
      retryOperation: vi.fn(),
      clearError: vi.fn()
    });
    
    // Mock Table component to test sort functionality
    vi.mock('../../src/components/common/Table', () => ({
      default: ({ columns, onSort }) => (
        <div data-testid="mock-table">
          <div className="mock-header">
            {columns.map(col => (
              <button 
                key={col.id}
                onClick={() => col.sortable && onSort(col.field, 'asc')}
                data-testid={`sort-${col.id}`}
              >
                {col.header}
              </button>
            ))}
          </div>
        </div>
      )
    }));
    
    renderWithProviders(
      <UserTable 
        onEdit={vi.fn()} 
        onDelete={vi.fn()}
      />
    );
    
    // Click name column to sort
    const nameHeader = screen.getByTestId('sort-name');
    fireEvent.click(nameHeader);
    
    // Check that onSort was called with the correct parameters
    expect(onSortMock).toHaveBeenCalledWith('firstName', 'asc');
    
    // Clean up
    vi.resetModules();
  });
});