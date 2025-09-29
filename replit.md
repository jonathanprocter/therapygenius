# Overview

TherapyFlow is a comprehensive practice management system designed for mental health professionals. The application provides tools for client management, document storage and analysis, session tracking, assessments, and treatment planning. It features AI-powered document analysis capabilities that can automatically categorize documents, extract key insights, and generate case conceptualizations to enhance clinical decision-making.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The frontend is built using React with TypeScript and follows a component-based architecture:

- **Build System**: Vite for fast development and optimized production builds
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Form Management**: React Hook Form with Zod for validation

The frontend uses a modern component structure with TypeScript for type safety and follows the shadcn/ui design system patterns. The application supports both light and dark themes through CSS custom properties.

## Backend Architecture

The backend follows a REST API architecture built with Express.js:

- **Runtime**: Node.js with TypeScript and ES modules
- **Framework**: Express.js with middleware for authentication, file uploads, and error handling
- **Authentication**: JWT-based authentication with HTTP-only cookies
- **File Processing**: Multer for file uploads with support for PDFs, Word documents, and images
- **Document Processing**: Integration with OpenAI GPT-5 for AI-powered document analysis

The server implements a layered architecture with separate modules for authentication, document processing, and storage operations. It includes comprehensive error handling and logging middleware.

## Data Storage Solutions

The application uses PostgreSQL as the primary database:

- **ORM**: Drizzle ORM for type-safe database operations
- **Database**: PostgreSQL hosted on Neon (serverless PostgreSQL)
- **Migrations**: Drizzle Kit for schema management and migrations
- **Connection**: Neon serverless driver with WebSocket support

The database schema includes tables for users (therapists), clients, documents, sessions, assessments, and treatment plans with proper foreign key relationships and UUID primary keys.

## Authentication and Authorization

Security is implemented through a multi-layered approach:

- **Password Hashing**: bcrypt for secure password storage
- **Session Management**: JWT tokens with 7-day expiration
- **Cookie Security**: HTTP-only cookies with secure flags in production
- **Route Protection**: Middleware-based authentication for API endpoints
- **User Context**: Request-level user information injection

The authentication system supports both header-based and cookie-based token validation for flexibility across different client types.

## External Dependencies

### AI Services
- **OpenAI GPT-5**: Primary AI model for document analysis, case conceptualization, and content extraction
- **Anthropic Claude**: Secondary AI provider for additional analysis capabilities
- **Google Generative AI**: Alternative AI service integration

### Document Processing
- **pdf-parse**: PDF text extraction
- **mammoth**: Microsoft Word document processing
- **Sharp**: Image processing and optimization

### Database and Infrastructure
- **Neon Database**: Serverless PostgreSQL hosting
- **WebSocket**: Real-time connection support for database operations

### Development Tools
- **Replit Plugins**: Development environment integration with cartographer and dev banner
- **ESBuild**: Fast JavaScript bundling for production
- **PostCSS**: CSS processing with Tailwind and Autoprefixer

The system is designed to be highly scalable with serverless database connections and modular AI service integrations that can be easily swapped or extended based on requirements.

# Recent Changes

## September 29, 2025
- **Richard Hayes Comprehensive Session Upload**: Successfully uploaded complete therapeutic record with 10 detailed therapy sessions from 2024 (April-August), including comprehensive progress notes and structured AI tags for longitudinal case conceptualization. All sessions standardized with consistent schema and proper JSON formatting for advanced analytics and clinical insights tracking.