import type { Config } from '@jest/types';

// Jest configuration for backend testing with TypeScript support
const config: Config.InitialOptions = {
  // Use ts-jest preset for TypeScript
  preset: 'ts-jest',
  
  // Node.js test environment (appropriate for backend)
  testEnvironment: 'node',
  
  // Define test file locations
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  
  // Test pattern matching for different test types
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/tests/**/*.spec.ts',
    '**/tests/**/*.integration.ts'
  ],
  
  // TypeScript transformation
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  
  // Path alias mapping for cleaner imports
  moduleNameMapper: {
    '@/(.*)': '<rootDir>/src/$1',
    '@test/(.*)': '<rootDir>/tests/$1'
  },
  
  // Supported file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Setup file for test environment preparation
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  
  // Code coverage configuration - enforcing 80% coverage threshold as per requirements
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json', 'html', 'cobertura'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Performance and debugging settings
  verbose: true,
  testTimeout: 10000,
  clearMocks: true,
  restoreMocks: true,
  detectOpenHandles: true,
  forceExit: true,
  bail: 1,
  maxWorkers: '50%',
  errorOnDeprecated: true,
  
  // Paths to ignore for testing and coverage
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/tests/fixtures/'
  ],
  
  // TypeScript configuration for ts-jest
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
      diagnostics: true
    }
  }
};

export default config;