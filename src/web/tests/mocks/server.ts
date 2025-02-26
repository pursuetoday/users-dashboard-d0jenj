/**
 * Mock Service Worker (MSW) server setup for intercepting and mocking API requests during testing,
 * with enhanced error handling and type safety
 */

// Import the MSW setupServer utility for Node.js environment (v1.3.0)
import { setupServer } from 'msw/node';

// Import comprehensive API request handlers for mocking all user management endpoints
import { handlers } from './handlers';

/**
 * Configured MSW server instance with comprehensive API mocking capabilities
 * 
 * This server intercepts all API requests made during tests and responds with
 * mock data defined in the handlers. It's configured to throw errors for any
 * unhandled requests to ensure complete API coverage during testing.
 * 
 * Features:
 * - Type-safe handlers for all user management endpoints
 * - Strict error handling for unhandled requests
 * - Complete request/response validation
 * 
 * Use in test setup:
 * - beforeAll(() => server.listen())
 * - afterEach(() => server.resetHandlers())
 * - afterAll(() => server.close())
 */
export const server = setupServer(...handlers);

// Configure the server to throw errors for any unhandled requests
// This ensures all API endpoints are properly mocked during tests
server.onUnhandledRequest = 'error';