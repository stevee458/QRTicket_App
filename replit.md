# QRTicket App - Student Registration System

## Overview

QRTicket App is a student registration system that allows parents to register multiple students and receive unique QR codes for each student. The application captures parent information along with student details (name, phone, email, age, school) and generates downloadable QR codes for identification and tracking purposes.

The system is built as a full-stack web application with a React frontend, Express backend, and PostgreSQL database, following Material Design principles for a professional, trust-building user experience.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System:**
- React 18+ with TypeScript for type safety
- Vite as the build tool and development server
- Wouter for client-side routing (lightweight alternative to React Router)

**UI Component Strategy:**
- shadcn/ui component library based on Radix UI primitives
- Tailwind CSS for styling with custom design tokens
- Material Design principles following documented design guidelines
- Component composition pattern using Radix UI's composable primitives

**Form Management:**
- React Hook Form for form state management and validation
- Zod for schema validation with TypeScript type inference
- @hookform/resolvers for integrating Zod with React Hook Form
- Dynamic form fields supporting multiple student entries

**State Management:**
- TanStack Query (React Query) for server state management
- Local component state for UI interactions
- No global state management library (Redux/Zustand) - keeping state local and server-synced

**Design System:**
- Custom Tailwind configuration with CSS variables for theming
- Design tokens defined in index.css for consistent spacing, colors, and typography
- Inter/Roboto fonts from Google Fonts CDN
- Responsive design with mobile-first approach

### Backend Architecture

**Server Framework:**
- Express.js for HTTP server and API routing
- TypeScript for type safety across the entire stack
- ESM (ES Modules) for modern JavaScript imports

**API Design:**
- RESTful API endpoints
- `/api/register` POST endpoint for parent and student registration
- JSON request/response format
- Structured error handling with appropriate HTTP status codes

**Database Layer:**
- Drizzle ORM for type-safe database queries
- Neon serverless PostgreSQL as the database provider
- Schema-first approach with shared TypeScript types
- Database migrations managed through Drizzle Kit

**QR Code Generation:**
- QRCode library for generating QR code images
- QR codes generated server-side and returned as data URIs
- QR codes contain student identification data in JSON format
- QR codes stored in database for future retrieval

**Request Processing:**
- Raw body capture for request verification
- JSON body parsing middleware
- Request logging with timing information
- Transaction support for atomic parent-student creation

### Data Storage Solutions

**Database Schema:**

The application uses a relational schema with two main tables:

1. **Parents Table:**
   - UUID primary key
   - Name, ID number, phone, email
   - Timestamp for record creation
   - One-to-many relationship with students

2. **Students Table:**
   - UUID primary key
   - Foreign key reference to parent (with cascade delete)
   - Name, phone, email, age, school
   - QR code storage (text field for data URI)
   - QR code version tracking for regeneration support
   - Timestamp for record creation

**Database Provider:**
- Neon serverless PostgreSQL chosen for:
  - Serverless auto-scaling capabilities
  - Built-in connection pooling
  - PostgreSQL compatibility
  - Separation of storage and compute

**ORM Strategy:**
- Drizzle ORM provides:
  - Type-safe query building
  - Schema definition in TypeScript
  - Automatic type inference from schema
  - Migration generation and management
  - Transaction support for data consistency

### External Dependencies

**UI Component Libraries:**
- Radix UI primitives (@radix-ui/*) for accessible, unstyled components
- shadcn/ui configuration for pre-styled component variants
- Lucide React for icon system
- class-variance-authority for component variant management

**Styling & Design:**
- Tailwind CSS for utility-first styling
- PostCSS with Autoprefixer for CSS processing
- Custom CSS variables for theming support
- Google Fonts CDN for typography (Inter/Roboto)

**Form & Validation:**
- React Hook Form for performant form handling
- Zod for runtime type validation
- drizzle-zod for schema-to-validator conversion

**Data Fetching:**
- TanStack Query for async state management
- Built-in fetch API for HTTP requests
- Custom query client configuration with error handling

**Database & ORM:**
- @neondatabase/serverless for Neon PostgreSQL connection
- drizzle-orm for database operations
- drizzle-kit for migrations and schema management

**Development Tools:**
- TypeScript for static typing
- Vite plugins for Replit integration
- tsx for TypeScript execution in development
- esbuild for production builds

**Utility Libraries:**
- qrcode for QR code generation
- html5-qrcode for camera-based QR code scanning
- date-fns for date manipulation
- nanoid for unique ID generation
- clsx and tailwind-merge for class name management

## Key Features

### Parent Registration & QR Code Generation
- Multi-student registration per parent
- Unique QR codes generated for each student
- QR codes contain JSON data: studentId, name, school, version
- Downloadable QR codes for offline use

### Transport Management System
- **Vehicles**: Bus number, registration, depot management
- **Shifts**: Shift scheduling with titles and descriptions
- **Drivers**: Driver registration with company numbers
- Admin portal for full CRUD operations on transport data

### Driver Portal (Offline-Capable)
- **Authentication**: Driver login with name + company number
- **Session Management**: Vehicle and shift selection
- **Camera QR Scanning**: Real-time camera-based QR code scanning using html5-qrcode
  - Board/Alight modes with separate buttons
  - Validation prevents duplicate boarding or invalid alighting
  - Manual fallback input for camera failures
  - Automatic retry on validation errors (500ms cooldown)
- **Audio Feedback**: Text-to-speech announcements ("Hi [Name]" / "Goodbye [Name]")
- **Offline Support**: Full offline operation with localStorage persistence
  - Unique scan IDs (crypto.randomUUID()) prevent duplicates
  - Pending scans queue with manual/auto-sync capabilities
  - Sync triggers: Manual button, 3-minute periodic, reconnection (2s delay)
  - 30-second retry after failed submissions
- **Real-time Status**: Connection indicator, pending scans counter, sync timestamps
- **Onboard Tracking**: View currently boarded students

### Scan Data Capture
Each QR scan records:
- Date and time (ISO string)
- GPS location (placeholder implementation)
- Driver, vehicle, and shift details
- Student information from QR code
- Action type (Board/Alight)
- Forced override flag