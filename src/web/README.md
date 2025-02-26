# User Management Dashboard - Frontend

Modern web application built with React.js and Tailwind UI for efficient user management and authentication. Features include user data visualization, role-based access control, and real-time updates.

## Features

- Secure JWT-based authentication
- Role-based access control
- Interactive data tables with real-time editing
- Responsive design with Tailwind UI
- Type-safe development with TypeScript
- Optimized build process with Vite

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Git
- Modern web browser (Chrome/Firefox/Safari/Edge latest 2 versions)

## Installation

1. Clone the repository
   ```bash
   git clone [repository-url]
   cd user-management-dashboard
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Configure environment variables
   ```bash
   cp .env.example .env
   # Edit .env file with your configuration
   ```

4. Start the development server
   ```bash
   npm run dev
   ```

## Development

### Available Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run test` - Run test suite
- `npm run test:coverage` - Generate test coverage report
- `npm run lint` - Run ESLint code analysis
- `npm run lint:fix` - Automatically fix linting issues
- `npm run format` - Format code with Prettier
- `npm run typecheck` - Check TypeScript types

### Development Guidelines

- Follow TypeScript strict mode rules
- Use React Query for data fetching and state management
- Write tests for all components and business logic
- Follow Tailwind CSS best practices for styling
- Use React Hook Form for form handling with Yup validation
- Implement proper error boundaries for component failures
- Follow accessibility best practices (WCAG 2.1 AA compliance)

## Project Structure

```
src/
├── components/       # Reusable React components
├── hooks/            # Custom React hooks
├── services/         # API integration services
├── utils/            # Utility functions
├── types/            # TypeScript type definitions
├── styles/           # Tailwind and CSS styles
├── context/          # React context providers
├── pages/            # Page components 
└── constants/        # Application constants
```

## Testing

### Frameworks
- Jest for unit testing
- React Testing Library for components
- MSW for API mocking

### Commands
- `npm run test` - Run all tests
- `npm run test:watch` - Watch mode
- `npm run test:coverage` - Generate coverage report

### Requirements
- Minimum 80% code coverage required
- Critical user flows must have integration tests
- Accessibility testing with axe-core