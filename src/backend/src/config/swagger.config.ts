/**
 * Swagger/OpenAPI Configuration
 * 
 * This configuration defines the OpenAPI specifications for the User Management
 * Dashboard API documentation. It includes endpoint definitions, data models,
 * and security schemes that provide comprehensive API documentation.
 * 
 * @version 1.0.0
 */

import swaggerJsdoc from 'swagger-jsdoc'; // v6.2.0
import swaggerUi from 'swagger-ui-express'; // v4.6.0
import { HTTP_STATUS } from '../constants/http-status';

/**
 * OpenAPI specification configuration
 * Defines the API documentation structure, including endpoints, models,
 * security schemes, and example responses
 */
export const swaggerConfig = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'User Management Dashboard API',
      version: '1.0.0',
      description: 'Comprehensive API documentation for User Management Dashboard including authentication, user management, and system operations',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: '/api/v1',
        description: 'API Version 1',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token authentication',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'object' },
          },
        },
        ValidationError: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            fields: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            role: { type: 'string', enum: ['admin', 'manager', 'user', 'guest'] },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
      responses: {
        // Success responses
        [HTTP_STATUS.OK]: {
          description: 'Operation completed successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', example: 'success' },
                  data: { type: 'object' },
                },
              },
            },
          },
        },
        // Error responses using HTTP status constants
        [HTTP_STATUS.BAD_REQUEST]: {
          description: 'Bad request due to invalid input',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        [HTTP_STATUS.UNAUTHORIZED]: {
          description: 'Authentication failed',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        [HTTP_STATUS.FORBIDDEN]: {
          description: 'Permission denied',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
      parameters: {
        pageSize: {
          name: 'pageSize',
          in: 'query',
          description: 'Number of items per page',
          schema: {
            type: 'integer',
            default: 10,
          },
        },
        pageNumber: {
          name: 'page',
          in: 'query',
          description: 'Page number',
          schema: {
            type: 'integer',
            default: 1,
          },
        },
        sortField: {
          name: 'sort',
          in: 'query',
          description: 'Field to sort by',
          schema: {
            type: 'string',
          },
        },
        sortOrder: {
          name: 'order',
          in: 'query',
          description: 'Sort order (asc or desc)',
          schema: {
            type: 'string',
            enum: ['asc', 'desc'],
            default: 'asc',
          },
        },
      },
      examples: {
        // User response example
        UserResponse: {
          value: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            email: 'user@example.com',
            firstName: 'John',
            lastName: 'Doe',
            role: 'admin',
            isActive: true,
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-02T00:00:00Z',
          },
        },
        // Error response examples
        BadRequestExample: {
          value: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            fields: [
              { field: 'email', message: 'Invalid email format' },
            ],
          },
        },
        UnauthorizedExample: {
          value: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            details: {},
          },
        },
        ForbiddenExample: {
          value: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions',
            details: {},
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: 'Auth',
        description: 'Authentication endpoints',
      },
      {
        name: 'Users',
        description: 'User management endpoints',
      },
      {
        name: 'System',
        description: 'System management endpoints',
      },
    ],
  },
  // API files paths pattern
  apis: [
    './src/backend/src/routes/*.ts', 
    './src/backend/src/controllers/*.ts', 
    './src/backend/src/models/*.ts'
  ],
};

/**
 * Swagger UI display configuration
 * Customizes the appearance and behavior of the Swagger documentation interface
 */
export const swaggerUiOptions = {
  explorer: true,
  customSiteTitle: 'User Management Dashboard API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'none',
    filter: true,
    showCommonExtensions: true,
    syntaxHighlight: {
      activate: true,
      theme: 'monokai',
    },
    defaultModelsExpandDepth: 1,
    defaultModelExpandDepth: 1,
  },
};