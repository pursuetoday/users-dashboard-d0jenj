import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query'; // v4.x

// Internal imports
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card from '../../components/common/Card';
import { useAuth } from '../../hooks/useAuth';
import ErrorBoundary from '../../components/common/ErrorBoundary';

/**
 * Interface for dashboard metric data
 */
interface DashboardMetric {
  title: string;
  value: number;
  description: string;
  requiredRole: string;
  isRealTime: boolean;
  updateInterval: number;
}

/**
 * API service for dashboard data
 */
const dashboardService = {
  /**
   * Fetches dashboard metrics from the API
   * @returns Promise resolving to an array of dashboard metrics
   */
  getMetrics: async (): Promise<DashboardMetric[]> => {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock metrics data - in a real app, this would come from an API
    return [
      {
        title: 'Total Users',
        value: 458,
        description: 'Total number of registered users',
        requiredRole: 'user',
        isRealTime: false,
        updateInterval: 0
      },
      {
        title: 'Active Sessions',
        value: 42,
        description: 'Current active user sessions',
        requiredRole: 'manager',
        isRealTime: true,
        updateInterval: 60000 // 1 minute
      },
      {
        title: 'New Users (Today)',
        value: 12,
        description: 'Users registered in the last 24 hours',
        requiredRole: 'user',
        isRealTime: false,
        updateInterval: 0
      },
      {
        title: 'Admin Actions',
        value: 156,
        description: 'Administrative actions performed this month',
        requiredRole: 'admin',
        isRealTime: false,
        updateInterval: 0
      },
      {
        title: 'Failed Logins',
        value: 7,
        description: 'Failed login attempts in the last 24 hours',
        requiredRole: 'admin',
        isRealTime: true,
        updateInterval: 300000 // 5 minutes
      },
      {
        title: 'Average Session Duration',
        value: 28,
        description: 'Average session duration in minutes',
        requiredRole: 'manager',
        isRealTime: false,
        updateInterval: 0
      }
    ];
  },
  
  /**
   * Fetches a specific real-time metric
   * @param metricId Identifier for the metric to fetch
   * @returns Promise resolving to the updated metric value
   */
  getRealTimeMetric: async (metricId: string): Promise<number> => {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return a random value for simulation purposes
    const metrics: Record<string, number> = {
      'Active Sessions': Math.floor(Math.random() * 10) + 35, // 35-45
      'Failed Logins': Math.floor(Math.random() * 5) + 5, // 5-10
    };
    
    return metrics[metricId] || 0;
  }
};

/**
 * Main dashboard page component that displays user metrics and summary information with real-time updates
 * @returns JSX.Element - Rendered dashboard page with metrics and error handling
 */
const DashboardPage: React.FC = () => {
  // Get authenticated user data using useAuth hook
  const { user, isAuthenticated, loading } = useAuth();
  
  // Store real-time metric values in local state
  const [realTimeValues, setRealTimeValues] = useState<Record<string, number>>({});
  
  // Handle manual refresh state
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  
  // Track last update time
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Fetch metrics data using useQuery hook with real-time updates
  const { 
    data: metrics, 
    isLoading, 
    isError, 
    error,
    refetch,
    dataUpdatedAt
  } = useQuery<DashboardMetric[]>(
    ['dashboardMetrics'], 
    dashboardService.getMetrics,
    {
      staleTime: 30000, // Consider data stale after 30 seconds
      refetchOnWindowFocus: true,
      // Skip query if user is not authenticated or still loading
      enabled: isAuthenticated && !loading,
      onSuccess: () => {
        setLastUpdated(new Date());
      },
      onError: (err) => {
        console.error('Failed to fetch dashboard metrics:', err);
      }
    }
  );
  
  // Handle manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Filter metrics based on user role
  const filteredMetrics = useMemo(() => {
    if (!metrics || !user) return [];
    
    return metrics.filter(metric => canViewMetric(metric.requiredRole, user.role));
  }, [metrics, user]);
  
  // Setup real-time updates for metrics that require it
  useEffect(() => {
    if (!metrics || !user) return;
    
    // Identify real-time metrics that the user can view
    const realTimeMetrics = metrics.filter(
      metric => metric.isRealTime && canViewMetric(metric.requiredRole, user.role)
    );
    
    // Setup interval timers for each real-time metric
    const timers: Record<string, NodeJS.Timeout> = {};
    
    realTimeMetrics.forEach(metric => {
      if (metric.updateInterval > 0) {
        timers[metric.title] = setInterval(async () => {
          try {
            // In a real app, you would make an API call here with the metric ID
            const newValue = await dashboardService.getRealTimeMetric(metric.title);
            setRealTimeValues(prev => ({
              ...prev,
              [metric.title]: newValue
            }));
          } catch (error) {
            console.error(`Error updating real-time metric ${metric.title}:`, error);
          }
        }, metric.updateInterval);
      }
    });
    
    // Clean up timers on unmount
    return () => {
      Object.values(timers).forEach(timer => clearInterval(timer));
    };
  }, [metrics, user]);
  
  /**
   * Checks if a user with the given role can view a metric
   * @param requiredRole Minimum role required to view the metric
   * @param userRole Current user's role
   * @returns Boolean indicating if user can view the metric
   */
  const canViewMetric = (requiredRole: string, userRole: string): boolean => {
    if (!userRole) return false;
    
    // Role hierarchy for permission checking
    const roleHierarchy: Record<string, number> = {
      'admin': 3,
      'manager': 2,
      'user': 1,
      'guest': 0
    };
    
    // Check if user's role level is sufficient
    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  };
  
  /**
   * Formats metric values based on the metric type and context
   * @param value Numeric value to format
   * @param title Title of the metric for context
   * @returns Formatted string representation of the value
   */
  const formatMetricValue = (value: number, title: string): string => {
    // Format based on metric context (duration, counts, etc.)
    if (title.toLowerCase().includes('duration')) {
      return `${value} min`;
    }
    
    if (title.toLowerCase().includes('session')) {
      return value.toString();
    }
    
    // Format large numbers
    if (value > 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    
    // Default formatting
    return value.toString();
  };
  
  /**
   * Formats the last updated time in a human-readable format
   * @returns Formatted time string
   */
  const formatLastUpdated = (): string => {
    return lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  /**
   * Renders a single metric card with title, value, and description,
   * handling role-based visibility
   * @param metric Metric data to render
   * @param userRole User's role for permission checking
   * @returns JSX.Element - Rendered metric card component with role-based access
   */
  const renderMetricCard = (metric: DashboardMetric, userRole: string): JSX.Element | null => {
    // Check user role against metric required role
    if (!canViewMetric(metric.requiredRole, userRole)) {
      return null;
    }
    
    // Get the displayed value (use real-time value if available)
    const displayValue = metric.isRealTime && realTimeValues[metric.title] !== undefined
      ? realTimeValues[metric.title]
      : metric.value;
    
    // Handle real-time update configuration
    const isRealtimeActive = metric.isRealTime;
    
    // Determine if value has increased or decreased (for visual indicators)
    const hasIncreased = isRealtimeActive && realTimeValues[metric.title] !== undefined && 
      realTimeValues[metric.title] > metric.value;
    
    const hasDecreased = isRealtimeActive && realTimeValues[metric.title] !== undefined && 
      realTimeValues[metric.title] < metric.value;
    
    // Render Card component with elevated variant
    return (
      <Card 
        variant="elevated" 
        className="h-full transition-all duration-300 hover:shadow-lg"
      >
        <div className="h-full flex flex-col">
          <div className="flex justify-between items-start">
            <h3 
              className="text-lg font-semibold text-gray-900 dark:text-white mb-2" 
              aria-label={`${metric.title} metric`}
              title={metric.description}
            >
              {metric.title}
            </h3>
            
            {isRealtimeActive && (
              <span 
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100"
                title={`Updates every ${metric.updateInterval / 1000} seconds`}
              >
                <span className="relative flex h-2 w-2 mr-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                Live
              </span>
            )}
          </div>
          
          <div className="flex items-center my-2">
            <span className="text-3xl font-bold text-blue-600 dark:text-blue-400" 
                  aria-label={`${metric.title}: ${displayValue}`}>
              {formatMetricValue(displayValue, metric.title)}
            </span>
            
            {/* Show trend indicators for real-time metrics */}
            {hasIncreased && (
              <span className="ml-2 text-green-600 dark:text-green-400" aria-label="Increasing trend">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                </svg>
              </span>
            )}
            
            {hasDecreased && (
              <span className="ml-2 text-red-600 dark:text-red-400" aria-label="Decreasing trend">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12 13a1 1 0 100 2h5a1 1 0 001-1v-5a1 1 0 10-2 0v2.586l-4.293-4.293a1 1 0 00-1.414 0L8 9.586l-4.293-4.293a1 1 0 00-1.414 1.414l5 5a1 1 0 001.414 0L11 9.414 14.586 13H12z" clipRule="evenodd" />
                </svg>
              </span>
            )}
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-auto">
            {metric.description}
          </p>
        </div>
      </Card>
    );
  };
  
  // Handle loading state
  if (loading || isLoading) {
    return (
      <DashboardLayout>
        <div className="py-6">
          <div className="mb-6 animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/5"></div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array(6).fill(0).map((_, index) => (
              <div key={index} className="h-40">
                <Card variant="elevated" className="h-full">
                  <div className="animate-pulse flex flex-col h-full">
                    <div className="flex justify-between">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6"></div>
                    </div>
                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mt-auto"></div>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }
  
  // Handle authentication state
  if (!isAuthenticated) {
    return (
      <DashboardLayout>
        <div className="py-6">
          <Card variant="elevated" className="p-6 text-center">
            <p className="text-gray-600 dark:text-gray-300">
              You need to be logged in to view this dashboard.
            </p>
          </Card>
        </div>
      </DashboardLayout>
    );
  }
  
  // Handle error state gracefully
  if (isError) {
    return (
      <DashboardLayout>
        <div className="py-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Dashboard</h1>
          
          <Card variant="elevated" className="border-red-200 dark:border-red-800">
            <div className="text-red-600 dark:text-red-400">
              <h2 className="text-lg font-semibold mb-2">Error Loading Dashboard Data</h2>
              <p className="mb-4">
                {error instanceof Error 
                  ? error.message 
                  : 'An unexpected error occurred while loading dashboard data.'}
              </p>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-red-100 dark:bg-red-900 rounded-md text-red-800 dark:text-red-100 text-sm font-medium hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                aria-label="Retry loading dashboard data"
              >
                Retry
              </button>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    );
  }
  
  // Main dashboard content with welcome section and metrics grid
  return (
    <ErrorBoundary>
      <DashboardLayout>
        <div className="py-6">
          {/* Welcome section with user's name */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Welcome, {user?.email?.split('@')[0] || 'User'}!
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                Here's an overview of your system metrics and activity.
              </p>
            </div>
            
            {/* Refresh button and last updated time */}
            <div className="mt-4 sm:mt-0 flex items-center">
              <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">
                Last updated: {formatLastUpdated()}
              </span>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={`
                  inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                  dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700
                  ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                aria-label="Refresh dashboard data"
              >
                {isRefreshing ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700 dark:text-gray-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Refreshing...
                  </>
                ) : (
                  <>
                    <svg className="-ml-1 mr-2 h-4 w-4 text-gray-700 dark:text-gray-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* Render responsive grid of metric cards */}
          {filteredMetrics.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMetrics.map((metric, index) => (
                <div key={index} className="h-40">
                  {renderMetricCard(metric, user?.role || 'guest')}
                </div>
              ))}
            </div>
          ) : (
            <Card variant="elevated" className="p-6 text-center">
              <p className="text-gray-600 dark:text-gray-300">
                No metrics available for your role. Please contact an administrator for access.
              </p>
            </Card>
          )}
        </div>
      </DashboardLayout>
    </ErrorBoundary>
  );
};

export default DashboardPage;