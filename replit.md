# Time Tracking Application

## Overview

This is a comprehensive time tracking web application built for businesses to manage employee working hours. The system allows employees to record, edit, and delete their time entries while providing administrators with user management, project oversight, and reporting capabilities. The application features role-based access control with distinct employee and admin roles, real-time time tracking with a timer widget, and comprehensive reporting with export functionality.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript for type safety and component-based development
- **Routing**: Wouter for lightweight client-side routing
- **UI Components**: Radix UI components with shadcn/ui for consistent, accessible design system
- **Styling**: Tailwind CSS with custom CSS variables for theming and responsive design
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Forms**: React Hook Form with Zod validation for type-safe form handling
- **Authentication**: Context-based auth provider with session management

### Backend Architecture
- **Runtime**: Node.js with Express.js framework for RESTful API development
- **Authentication**: Passport.js with local strategy using session-based authentication
- **Session Storage**: PostgreSQL-backed session store using connect-pg-simple
- **Password Security**: Built-in crypto module with scrypt for secure password hashing
- **API Structure**: RESTful endpoints organized by resource (users, projects, time-entries, etc.)

### Database Design
- **ORM**: Drizzle ORM for type-safe database operations and migrations
- **Database**: PostgreSQL with connection pooling via Neon serverless adapter
- **Schema**: Well-defined tables for users, projects, time entries, holidays, and working hours
- **Relationships**: Properly configured foreign keys and relations between entities
- **Data Validation**: Zod schemas for runtime type checking and API validation

### Key Features
- **Role-Based Access Control**: Distinct employee and admin roles with appropriate permissions
- **Time Tracking**: Real-time timer functionality with start/stop capabilities
- **Project Management**: Admin-controlled project creation and assignment
- **Balance Calculation**: Automatic overtime/undertime calculations against target hours
- **Reporting**: Flexible date range filtering and export capabilities
- **Responsive Design**: Mobile-friendly interface with adaptive layouts

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **connect-pg-simple**: PostgreSQL session store for Express sessions

### Authentication & Security
- **Passport.js**: Authentication middleware with local strategy
- **express-session**: Session management with secure cookie handling
- **Node.js crypto**: Built-in cryptographic functions for password hashing

### UI Framework & Components
- **Radix UI**: Headless UI components for accessibility and customization
- **shadcn/ui**: Pre-built component library built on Radix UI
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Lucide React**: Icon library for consistent iconography

### Development & Build Tools
- **Vite**: Fast build tool and development server with HMR
- **TypeScript**: Static type checking across frontend and backend
- **Drizzle Kit**: Database migration and introspection tools
- **esbuild**: Fast JavaScript bundler for production builds

### Data Validation & Forms
- **Zod**: Runtime type validation and schema definition
- **React Hook Form**: Performant forms with minimal re-renders
- **@hookform/resolvers**: Zod integration for form validation

### Date & Time Utilities
- **date-fns**: Lightweight date manipulation and formatting library with German locale support