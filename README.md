# TherapyGenius

A comprehensive therapy practice management application with AI-powered document analysis, calendar integration, and client management features.

## Features

- **Client Management**: Track client information, demographics, and treatment history
- **Session Management**: Document therapy sessions with notes and interventions
- **Document Processing**: AI-powered analysis of therapy documents with automatic tagging
- **Assessment Tracking**: Extract and track PHQ-9, GAD-7, and other clinical assessments
- **Google Calendar Integration**: Automatic sync of calendar events to sessions
- **Treatment Plans**: Create and manage treatment plans with goals and progress tracking
- **HIPAA Compliance**: Encrypted data storage, audit logging, and compliance features
- **AI-Powered Insights**: Automatic tagging, document categorization, and client insights

## Tech Stack

- **Frontend**: React 18, TypeScript, TailwindCSS, Radix UI, Tanstack Query
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL (via Neon), Drizzle ORM
- **AI**: OpenAI GPT-5, Anthropic Claude, Google GenAI
- **Authentication**: Passport.js with session management
- **Build Tools**: Vite, esbuild

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (Neon recommended)
- OpenAI API key
- Google Cloud Console project (for Calendar integration)
- Anthropic API key (optional, for fallback)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd therapygenius
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and configure all required variables:
   - `DATABASE_URL`: PostgreSQL connection string
   - `ENCRYPTION_KEY`: 64-character hex key for encryption
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: OAuth credentials
   - See `.env.example` for all configuration options

4. **Set up the database**
   ```bash
   npm run db:push
   ```

5. **Run in development mode**
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:5000`

## Production Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Start the production server**
   ```bash
   npm start
   ```

3. **Environment Setup**
   - Ensure all environment variables are configured
   - Set `NODE_ENV=production`
   - Configure secure `ENCRYPTION_KEY`
   - Set `HIPAA_SAFE_AI=true` for compliance
   - Configure timezone: `TZ=America/New_York`

## Database Schema

The application uses Drizzle ORM with PostgreSQL. Key tables include:

- `users`: Therapist accounts and settings
- `clients`: Client demographics and information
- `sessions`: Therapy session records
- `documents`: Uploaded documents with AI analysis
- `assessments`: Extracted assessment scores (PHQ-9, GAD-7, etc.)
- `treatment_plans`: Treatment plans with goals and progress
- `calendar_sync_history`: Calendar synchronization logs
- `audit_logs`: HIPAA-compliant audit trail

## API Endpoints

### Authentication
- `POST /api/auth/register`: Register new therapist
- `POST /api/auth/login`: Login
- `POST /api/auth/logout`: Logout

### Clients
- `GET /api/clients`: List all clients
- `POST /api/clients`: Create new client
- `GET /api/clients/:id`: Get client details
- `PUT /api/clients/:id`: Update client

### Documents
- `POST /api/documents/upload`: Upload document
- `GET /api/documents`: List documents
- `GET /api/documents/:id`: Get document details
- `POST /api/documents/:id/link-session`: Link to session

### Calendar
- `GET /api/calendar/auth`: Get OAuth URL
- `POST /api/calendar/sync`: Trigger calendar sync
- `GET /api/calendar/status`: Get sync status

### Assessments
- `GET /api/assessments`: List assessments
- `GET /api/assessments/stats`: Get assessment statistics

## Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm start`: Start production server
- `npm run check`: Run TypeScript type checking
- `npm run db:push`: Push database schema changes

## Security Features

- **Encryption**: AES-256-GCM encryption for sensitive data (OAuth tokens, etc.)
- **Audit Logging**: Comprehensive audit trail for HIPAA compliance
- **Rate Limiting**: Protection against API abuse
- **Session Management**: Secure session handling with httpOnly cookies
- **Input Validation**: Zod schemas for all API inputs

## Google Calendar Integration

1. Create a project in Google Cloud Console
2. Enable Google Calendar API
3. Create OAuth 2.0 credentials
4. Set redirect URI to: `http://your-domain/api/calendar/callback`
5. Configure credentials in `.env`

## Troubleshooting

### Build Errors
- Ensure all dependencies are installed: `npm install`
- Clear node_modules and reinstall if needed
- Check Node.js version (18+ required)

### Database Connection Issues
- Verify DATABASE_URL is correct
- Ensure database is accessible
- Run `npm run db:push` to sync schema

### Calendar Sync Issues
- Verify Google OAuth credentials
- Check that redirect URI matches configuration
- Ensure ENCRYPTION_KEY is set for token storage

## Contributing

This is a private therapy practice management application. For issues or feature requests, please contact the development team.

## License

MIT License - See LICENSE file for details

## Support

For support or questions, please contact your system administrator.
