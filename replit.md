# CRM SaaS Dashboard - WhatsApp Business Manager

## Overview

This is a professional CRM SaaS platform designed for managing WhatsApp chatbots, conversations, and automated responses for business use. The application provides a comprehensive dashboard for connecting WhatsApp accounts, managing customer conversations, building chatbot rules, and monitoring business communications in real-time.

The platform is built as a modern web application with a clean, professional interface inspired by established CRM solutions like LeadSales.io and Kommo.com, focusing on efficient workflows and real-time WhatsApp integration.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, using Vite as the build tool for fast development and optimized production builds.

**UI Component System**: The application uses shadcn/ui (New York style variant) built on Radix UI primitives, providing a comprehensive set of accessible, customizable components. All components follow a consistent design system with Tailwind CSS for styling.

**State Management**: TanStack Query (React Query) handles server state management, providing caching, synchronization, and real-time updates for data fetching. No global client-side state management library is used - component state is managed locally with React hooks.

**Routing**: Uses Wouter for lightweight, hook-based routing without the overhead of React Router.

**Design System**: Professional SaaS dashboard with modular organization, using Inter font family. The color palette emphasizes clarity with primary blue (#2563EB), success green (#10B981), WhatsApp green (#25D366), and accent purple (#7C3AED). Layout follows a fixed sidebar navigation pattern with responsive grid-based content areas.

**Key Pages**:
- Dashboard: Overview with statistics and metrics
- WhatsApp Connections: QR code scanning and session management
- Conversations: Real-time message view with conversation list
- Chatbot Builder: Rule creation and automation management
- Settings: User profile and configuration

### Backend Architecture

**Runtime**: Node.js with Express framework for REST API endpoints.

**Language**: TypeScript with ES modules for type safety and modern JavaScript features.

**Authentication**: JWT-based authentication using JSON Web Tokens stored in HTTP-only cookies. Passwords are hashed using bcrypt with salt rounds for security. The auth middleware (`requireAuth`) protects all authenticated routes.

**API Design**: RESTful API structure with routes organized by feature domain (auth, whatsapp, conversations, chatbot, dashboard). Request/response validation uses Zod schemas shared between frontend and backend.

**Development vs Production**: Separate entry points (`index-dev.ts` and `index-prod.ts`) handle different environments. Development mode includes Vite middleware for HMR, while production serves pre-built static assets.

### Data Storage

**Database**: PostgreSQL (via Neon serverless) with connection pooling for efficient resource usage.

**ORM**: Drizzle ORM provides type-safe database queries and migrations. Schema definitions are shared across the application via the `shared/schema.ts` file.

**Database Schema**:
- `users`: User accounts with authentication credentials
- `whatsapp_sessions`: WhatsApp connection states and session data
- `conversations`: Customer conversation threads linked to sessions
- `messages`: Individual messages within conversations
- `chatbot_rules`: Automated response rules with keyword triggers

**Storage Pattern**: Repository pattern implemented through the `storage` module, abstracting database operations and providing a clean interface for data access. This allows for easier testing and potential database changes.

### External Dependencies

**WhatsApp Integration**: `@whiskeysockets/baileys` library provides the core WhatsApp Web API functionality. The WhatsAppManager class handles multiple concurrent sessions, QR code generation, connection states, and message handling. Session authentication data is persisted to the filesystem in `.auth-sessions` directory using multi-file auth state.

**Database Service**: Neon serverless PostgreSQL with WebSocket support for connection management. The application uses connection pooling to manage database connections efficiently.

**UI Component Library**: Radix UI primitives provide accessible, unstyled components that are then styled with Tailwind CSS through shadcn/ui patterns. This gives full design control while maintaining accessibility standards.

**Form Management**: React Hook Form with Zod resolver for type-safe form validation. All forms share validation schemas defined in the shared schema file.

**Styling**: Tailwind CSS with custom configuration for the design system. PostCSS with Autoprefixer ensures browser compatibility.

**Build Tools**: 
- Vite for frontend development and building
- esbuild for backend bundling in production
- tsx for TypeScript execution in development

**Real-time Updates**: TanStack Query's polling and invalidation patterns provide real-time data updates without WebSockets. Query invalidation triggers refetches when data changes (e.g., new messages, connection status updates).

**Session Management**: QR code generation uses the `qrcode` library to convert WhatsApp pairing data into scannable images displayed in the UI.