# UMLS Code Set Builder

A web application for searching UMLS medical terminologies and building custom code sets.

## Features

- 🔍 Search UMLS medical terminologies
- 🌳 Explore hierarchical relationships
- 📋 Build and manage code sets
- 💾 Save code sets to database
- 📤 Export code sets to TXT format
- 🔐 User authentication via Supabase

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Auth**: Supabase
- **Backend**: Vercel Serverless Functions
- **Database**: Azure SQL Database
- **API**: UMLS REST API

## Project Structure

```
mcsbumls/
├── src/
│   ├── components/        # React components
│   ├── lib/
│   │   ├── api.ts        # API client functions
│   │   ├── types.ts      # TypeScript type definitions
│   │   └── supabase.ts   # Supabase client configuration
│   ├── App.tsx           # Main application component
│   └── index.css         # Global styles with Tailwind
├── api/                  # Vercel serverless functions
│   ├── lib/
│   │   └── azuresql.ts  # Azure SQL connection utilities
│   ├── umls/
│   │   ├── search.ts    # UMLS search endpoint
│   │   └── hierarchy.ts # UMLS hierarchy endpoint
│   └── codesets.ts      # Code set CRUD endpoints
└── public/              # Static assets
```

## Setup Instructions

### Local Development Setup

For initial development, we're building locally without Git, Supabase, or Vercel deployment.

### 1. Prerequisites

- Node.js 18+
- UMLS API key (https://uts.nlm.nih.gov/uts/)

**Optional (for later):**
- Azure SQL Database
- Supabase account
- Vercel account

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

The `.env` file is already created for local development. Update it with your UMLS API key:

```
VITE_UMLS_API_KEY=your_actual_umls_api_key
```

### 4. Run Development Server

```bash
npm run dev
```

The application will be available at http://localhost:5173

---

## Production Deployment (Future)

When ready to deploy, we'll set up:

### Database Setup

Run these SQL scripts on your Azure SQL Database:

```sql
-- Code Sets table
CREATE TABLE code_sets (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id NVARCHAR(255) NOT NULL,
    code_set_name NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    total_concepts INT NOT NULL
);

-- Code Set Codes table
CREATE TABLE code_set_codes (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code_set_id INT NOT NULL,
    cui NVARCHAR(20) NOT NULL,
    code NVARCHAR(100) NOT NULL,
    vocabulary NVARCHAR(100) NOT NULL,
    term NVARCHAR(MAX) NOT NULL,
    source_concept NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (code_set_id) REFERENCES code_sets(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_code_sets_user_id ON code_sets(user_id);
CREATE INDEX idx_code_set_codes_code_set_id ON code_set_codes(code_set_id);
```

### Production Environment Variables

When deploying, you'll need:
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `VITE_UMLS_API_KEY`: Your UMLS API key
- `AZURE_SQL_SERVER`: Azure SQL server address
- `AZURE_SQL_DATABASE`: Database name
- `AZURE_SQL_USER`: Database username
- `AZURE_SQL_PASSWORD`: Database password

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel
```

Add environment variables in Vercel dashboard.

## API Endpoints

### UMLS Search
`POST /api/umls/search`
- Search UMLS terminologies
- Supports vocabulary filtering
- Pagination support

### UMLS Hierarchy
`POST /api/umls/hierarchy`
- Get parent/child relationships for a CUI
- Returns hierarchical structure

### Code Sets
- `GET /api/codesets?userId={userId}` - List user's code sets
- `POST /api/codesets` - Create new code set
- `GET /api/codesets/{id}` - Get code set detail
- `DELETE /api/codesets/{id}` - Delete code set

## Development Notes

### UMLS API Integration

The UMLS REST API requires authentication and has rate limits. Key endpoints:

- Search: `https://uts-ws.nlm.nih.gov/rest/search/current`
- Concept: `https://uts-ws.nlm.nih.gov/rest/content/current/CUI/{cui}`
- Relations: `https://uts-ws.nlm.nih.gov/rest/content/current/CUI/{cui}/relations`

Pagination is handled via `pageNumber` and `pageSize` parameters.

### Database Schema

Two main tables:
1. **code_sets**: Stores metadata about code sets
2. **code_set_codes**: Stores individual codes (denormalized for performance)

This approach allows for:
- Fast retrieval of code sets
- Easy export functionality
- Efficient filtering and searching

## License

MIT
