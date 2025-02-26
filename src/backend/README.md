# User Management Dashboard - Backend Service

Enterprise-grade backend service for the User Management Dashboard, providing secure user administration and authentication capabilities.

## Features

- JWT-based authentication with refresh token support
- Role-based access control with granular permissions
- RESTful API for user management operations
- Request validation and sanitization
- Rate limiting with Redis-based tracking
- Comprehensive audit logging system

## Technology Stack

Core technologies and frameworks:

- Node.js 18.x LTS
- TypeScript 5.x
- Express.js 4.18.x
- PostgreSQL 15.x
- Redis 7.x
- Prisma ORM 5.x
- Jest Testing Framework 29.x
- Docker & Docker Compose

## Prerequisites

Required software and tools:

- Node.js >= 18.0.0
- npm >= 9.0.0
- Docker >= 20.10.0
- Docker Compose >= 2.0.0
- PostgreSQL 15.x
- Redis 7.x

## Getting Started

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and configure environment variables:
   ```bash
   cp .env.example .env
   ```
4. Generate Prisma client:
   ```bash
   npx prisma generate
   ```
5. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

### Development

- Start development server:
  ```bash
  npm run dev
  ```
- Run tests:
  ```bash
  npm test
  ```
- Lint code:
  ```bash
  npm run lint
  ```
- Format code:
  ```bash
  npm run format
  ```
- Generate API docs:
  ```bash
  # API documentation is generated with Swagger
  # Access at http://localhost:3000/api-docs after starting the server
  ```

## Docker Setup

### Services

- **api**: Node.js application
- **postgres**: PostgreSQL database
- **redis**: Redis instance

### Commands

```bash
# Build containers
docker-compose build

# Start services in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop and remove containers
docker-compose down
```

## API Documentation

### Authentication

- **POST /api/v1/auth/login** - Authenticate user and receive tokens
- **POST /api/v1/auth/register** - Register a new user
- **POST /api/v1/auth/refresh** - Refresh access token
- **POST /api/v1/auth/logout** - Invalidate user session

### Users

- **GET /api/v1/users** - Retrieve paginated list of users
- **GET /api/v1/users/:id** - Get user details by ID
- **PUT /api/v1/users/:id** - Update user information
- **DELETE /api/v1/users/:id** - Delete or deactivate a user

## Testing

### Test Types

- **Unit tests**: Component testing
- **Integration tests**: API testing
- **E2E tests**: Full flow testing

### Commands

```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Deployment

### Build

1. Build TypeScript project:
   ```bash
   npm run build
   ```
2. Build Docker image:
   ```bash
   docker build -t user-mgmt-api .
   ```
3. Push image to registry:
   ```bash
   docker push user-mgmt-api
   ```

### Environment Variables

Critical environment variables for production:

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Secret for signing JWT tokens
- `JWT_REFRESH_SECRET` - Secret for refresh tokens
- `API_RATE_LIMIT` - Rate limiting configuration

## Project Structure

```
src/
├── app.ts                  # Application entry point
├── config/                 # Configuration files
├── controllers/            # Route controllers
├── middleware/             # Express middleware
├── models/                 # Data models
├── routes/                 # API routes
├── services/               # Business logic
├── utils/                  # Utility functions
└── types/                  # TypeScript type definitions
```

## Security Considerations

- All passwords are hashed using bcrypt (10+ rounds)
- JWT tokens are short-lived (15 minutes by default)
- Refresh tokens are stored in Redis with user binding
- API endpoints are protected with role-based access control
- Rate limiting protects against brute force and DoS attacks
- All requests are validated and sanitized

## Troubleshooting

### Common Issues

- **Database connection errors**: Verify DATABASE_URL is correctly set
- **Redis connection issues**: Check REDIS_URL and ensure Redis is running
- **Authentication failures**: Validate JWT_SECRET is consistent across deployments
- **Rate limiting problems**: Adjust RATE_LIMIT_WINDOW and RATE_LIMIT_MAX

### Logs

- Development logs are output to the console
- Production logs use Winston for structured logging
- Log levels can be configured with LOG_LEVEL environment variable

## Contributing

1. Ensure all code passes linting and tests
2. Follow the established code style and patterns
3. Include tests for new functionality
4. Update documentation for API changes