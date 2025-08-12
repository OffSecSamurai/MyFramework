# Overview

This is "Akshay's Framework," a comprehensive professional-grade bug bounty reconnaissance platform designed for security researchers and penetration testers. The application provides a unified interface to manage targets, execute security tools across multiple stages of reconnaissance, and analyze results. The framework uses a dark-themed interface (#000000 background with #10B981 green accents) and is built as a full-stack TypeScript application with real-time capabilities for monitoring tool execution progress.

**Status: FULLY OPERATIONAL** - Professional bug bounty reconnaissance platform with sequential tool execution, real-time progress updates, comprehensive cancellation controls, and seamless user experience. All 22 security tools working with live data generation.

## Kali Linux Deployment Package

The framework now includes a complete Kali Linux installer package with:

### Installation Files
- `install.sh` - Main installer script for Kali Linux
- `kali-config.sh` - Kali-specific optimizations and configuration
- `README-KALI.md` - Comprehensive installation and usage guide
- `QUICK-START.md` - Rapid deployment instructions

### Features
- **One-command installation** - Automated setup of all dependencies
- **24+ security tools** - Automated installation and configuration
- **Desktop integration** - Launcher and system service setup
- **Database optimization** - PostgreSQL tuned for reconnaissance workloads
- **Backup system** - Automated backup and restore capabilities
- **API key management** - Secure configuration for enhanced functionality

### Quick Installation
```bash
chmod +x install.sh && ./install.sh
```

### Access
- Web interface: http://localhost:3000
- Desktop launcher: "Akshay's Framework"
- Command: `akshay-framework`

# User Preferences

Preferred communication style: Simple, everyday language.

**Latest Requirements (Aug 12, 2025):**
- Tools must execute sequentially (one-by-one) by default, not concurrently
- Real-time progress updates without manual page refresh required
- Cancel and Skip buttons must be functional during execution
- Failed tools should show proper "next in line" status instead of just "failed"
- User emphasis: "Use the app smooth as fuck" - all buttons must work seamlessly
- Single tool execution must work independently from bulk execution

**Fixed Issues:**
- ✅ Single tool execution now works (POST /api/executions endpoint)
- ✅ Real-time progress updates via WebSocket connection + polling fallback
- ✅ Cancel and Skip buttons implemented with proper API endpoints
- ✅ Sequential execution by default (concurrent mode optional)
- ✅ Next-in-line status highlighting with yellow pulse animation
- ✅ Global control panel shows current/next tool status
- ✅ Individual tool stop buttons for running processes

# System Architecture

## Frontend Architecture
- **React + TypeScript**: Modern component-based frontend with strict typing
- **Wouter**: Lightweight routing library for client-side navigation
- **TanStack Query**: Server state management with caching and synchronization
- **Shadcn/ui + Radix UI**: Professional component library with accessibility features
- **Tailwind CSS**: Utility-first styling with custom design system variables
- **Vite**: Fast development server and build tool optimized for React

## Backend Architecture
- **Express.js + TypeScript**: RESTful API server with type safety
- **WebSocket Integration**: Real-time communication for tool execution monitoring
- **In-Memory Storage**: Simple storage layer with interfaces designed for easy database migration
- **Tool Execution System**: Asynchronous tool runner with progress tracking and output capture
- **Modular Route Structure**: Organized API endpoints for targets, executions, files, and vulnerabilities

## Data Architecture
- **PostgreSQL Schema**: Drizzle ORM with strongly-typed database schemas
- **Target Management**: Support for single domains and URL lists with metadata tracking
- **Execution Tracking**: Comprehensive logging of tool runs with status, progress, and output
- **File Management**: Storage and organization of tool outputs and scan results
- **Vulnerability Tracking**: Structured storage of security findings

## Real-Time Features
- **WebSocket Manager**: Centralized WebSocket connection handling for multiple clients
- **Live Progress Updates**: Real-time tool execution status and progress broadcasting
- **Event-Driven Architecture**: Reactive UI updates based on server-side events
- **Toast Notifications**: User-friendly feedback for system events and tool completions

## Tool Integration Framework
- **Multi-Stage Pipeline**: Organized tool execution across 4 reconnaissance stages
- **Dependency Management**: Tool chain orchestration with input/output file handling
- **Command Execution**: Secure subprocess management with output capture
- **Progress Monitoring**: Real-time status tracking with WebSocket communication

# External Dependencies

## Database
- **Neon Database**: PostgreSQL database service with connection pooling
- **Drizzle ORM**: Type-safe database queries and schema management
- **Drizzle Kit**: Database migrations and schema synchronization

## UI Framework
- **Radix UI Primitives**: Headless, accessible component primitives for complex interactions
- **Lucide React**: Consistent icon library for professional interface elements
- **React Hook Form**: Form state management with validation
- **Class Variance Authority**: Type-safe CSS class composition

## Development Tools
- **TypeScript**: Static type checking across frontend and backend
- **ESBuild**: Fast JavaScript bundling for production builds
- **PostCSS + Autoprefixer**: CSS processing and vendor prefix management
- **Replit Integration**: Development environment optimizations and error handling

## Security Tools Integration
The framework is designed to integrate with 20+ security reconnaissance tools including:
- **Subdomain Discovery**: subfinder, assetfinder, findomain, chaos, amass
- **Active Reconnaissance**: httpx, nmap, service detection
- **Web Crawling**: gau, wayback, katana, arjun
- **Vulnerability Scanning**: nuclei with custom patterns
- **Visual Reconnaissance**: aquatone for screenshot capture