/**
 * Central Configuration Module
 * 
 * Exports all application configuration modules in a unified interface,
 * acting as a single source of truth for frontend configurations.
 * 
 * This module centralizes:
 * - API configuration (base URL, Axios instance, headers)
 * - React Query configuration (client, options, cache settings)
 * - Theme configuration (system detection, class generation, theme modes)
 * 
 * @packageDocumentation
 * @version 1.0.0
 */

// API Configuration
import { axiosInstance, apiConfig as apiConfigBase, createAxiosInstance } from './api.config';

// Query Configuration
import { queryClient, queryConfig as queryConfigBase } from './query.config';

// Theme Configuration
import { themeConfig as themeConfigBase } from './theme.config';

// Types
import { ThemeMode } from '../types/theme.types';

/**
 * API configuration settings for consistent API communication setup
 * Contains base URL, authentication and request configuration
 */
export const apiConfig = {
  baseURL: apiConfigBase.baseURL,
  axiosInstance,
  apiHeaders: apiConfigBase.headers,
  createCustomInstance: createAxiosInstance
};

/**
 * React Query configuration for optimized state management and caching
 * Provides centralized query client and default cache settings
 */
export const queryConfig = {
  queryClient,
  defaultOptions: queryConfigBase,
  // Cache configuration is embedded in the default options
  cacheConfig: {
    staleTime: queryConfigBase.queries?.staleTime,
    cacheTime: queryConfigBase.queries?.cacheTime,
    refetchOnMount: queryConfigBase.queries?.refetchOnMount,
    refetchOnWindowFocus: queryConfigBase.queries?.refetchOnWindowFocus,
    refetchOnReconnect: queryConfigBase.queries?.refetchOnReconnect
  }
};

/**
 * Theme configuration utilities for consistent theme management
 * Provides system theme detection and theme class generation
 */
export const themeConfig = {
  getSystemTheme: themeConfigBase.getSystemTheme,
  getThemeClass: themeConfigBase.getThemeClass,
  ThemeMode
};

/**
 * Default export for convenience when importing all configurations
 */
export default {
  api: apiConfig,
  query: queryConfig,
  theme: themeConfig
};