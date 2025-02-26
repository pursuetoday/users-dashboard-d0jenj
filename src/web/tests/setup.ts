/**
 * Global Jest test setup configuration for User Management Dashboard
 * 
 * This file configures:
 * 1. MSW server for API mocking with strict error handling
 * 2. Browser API mocks (ResizeObserver, matchMedia)
 * 3. Jest DOM matchers for enhanced component testing
 */

// Import the MSW server instance for API mocking with strict error handling
import { server } from './mocks/server';

// Import Jest DOM matchers for enhanced component testing (v6.1.0+)
import * as matchers from '@testing-library/jest-dom';

// Import ResizeObserver polyfill for modern component testing (v1.5.1+)
import ResizeObserver from 'resize-observer-polyfill';

// Polyfill ResizeObserver which is required by many UI components
global.ResizeObserver = ResizeObserver;

// Mock window.matchMedia for component tests that rely on media queries including dark mode
global.matchMedia = jest.fn().mockImplementation(query => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
  matches: query.includes('dark') ? true : false
}));

// Setup MSW before all tests
beforeAll(() => {
  // Start the MSW server with strict error handling for unhandled requests
  server.listen({ 
    onUnhandledRequest: 'error',
    onUnhandledRequest: (req) => { 
      throw new Error(`Found an unhandled ${req.method} request to ${req.url}`) 
    } 
  });
});

// Reset request handlers after each test
afterEach(() => {
  server.resetHandlers();
});

// Clean up after all tests are complete
afterAll(() => {
  server.close();
});