# UMLS Code Set Builder - Project Status

## Initial Setup Complete ✓

**Date**: 2026-01-18

### What's Been Set Up

1. **Project Foundation**
   - React 18 + TypeScript + Vite
   - Tailwind CSS for styling
   - Lucide React for icons
   - Basic app structure with header and navigation

2. **Directory Structure**
   ```
   mcsbumls/
   ├── src/
   │   ├── components/     (empty - ready for components)
   │   ├── lib/
   │   │   ├── api.ts     (API client functions defined)
   │   │   ├── types.ts   (Complete TypeScript types)
   │   │   └── supabase.ts (configured but not used yet)
   │   ├── App.tsx        (Main app with nav - LOCAL DEV MODE)
   │   └── index.css      (Tailwind setup + utility classes)
   ├── api/               (empty - ready for serverless functions)
   ├── .env               (created for local dev)
   ├── .env.example       (template for deployment)
   └── README.md          (full documentation)
   ```

3. **Configuration Files**
   - `tailwind.config.js` - Tailwind CSS configuration
   - `postcss.config.js` - PostCSS configuration
   - `.gitignore` - Configured for Node.js, Vercel, environment variables
   - `.env` - Local development environment variables

4. **TypeScript Types Defined**
   - UMLSSearchResult, UMLSSource
   - UMLSRelationship (for hierarchy)
   - CodeSet, CodeSetCode (database models)
   - API Request/Response types
   - ShoppingCartItem (for UI state)

5. **API Client Functions Stubbed**
   - `searchUMLS()` - Search UMLS terminologies
   - `getHierarchy()` - Get parent/child relationships
   - `saveCodeSet()` - Save code set to database
   - `getCodeSets()` - Retrieve user's code sets
   - `getCodeSetDetail()` - Get detailed code set with all codes
   - `deleteCodeSet()` - Delete code set
   - `exportToTxt()` - Export codes to text file

### Current State

**The app runs successfully at http://localhost:5174**

- Basic UI with header showing "Local Dev Mode"
- Two-tab navigation: "Search & Build" and "Saved Code Sets"
- Both tabs show placeholder text
- **No Git, Supabase, or Vercel integration yet** (intentionally decoupled for local development)

### What's NOT Set Up Yet

1. **No actual UMLS integration** - API calls are defined but not implemented
2. **No database** - Azure SQL schema is documented but not created
3. **No backend API** - Serverless functions not created
4. **No authentication** - Supabase is stubbed but disabled
5. **No Git repository** - Waiting to build critical mass first
6. **No components** - Search, hierarchy, code set management components need to be built

### Database Schema (Ready to Create When Needed)

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
```

### Next Steps

1. **UMLS API Integration**
   - Research UMLS REST API endpoints
   - Implement search functionality
   - Handle pagination
   - Implement hierarchy/relationship fetching

2. **Build Core Components**
   - UMLSSearch component (with vocabulary filters)
   - HierarchyExplorer component
   - CodeSetBuilder component (shopping cart + filters)
   - SavedCodeSets component
   - SaveCodeSetModal component

3. **Local Data Management**
   - Consider localStorage for code sets initially
   - Or set up Azure SQL early and build backend endpoints

4. **When Ready for Production**
   - Initialize Git repository
   - Set up Azure SQL database
   - Create Vercel serverless functions
   - Configure Supabase authentication
   - Deploy to Vercel

### Development Environment

- **Dev Server**: `npm run dev` → http://localhost:5174
- **Build**: `npm run build`
- **Preview**: `npm run preview`

### Key Design Decisions

1. **Two-table database design** - `code_sets` (metadata) + `code_set_codes` (individual codes)
   - Allows fast retrieval and easy export
   - Denormalized for performance

2. **UMLS as primary data source** - No OMOP CDM dependency
   - Direct UMLS API integration
   - Support for UMLS hierarchies and relationships

3. **Vocabulary filtering** - Same approach as OMOP app
   - ICD10CM, SNOMED, LOINC, RxNorm, CPT4, HCPCS, etc.

4. **Local-first development** - Decouple infrastructure until features are solid
   - Build and test locally
   - Add Git/deployment when ready

## Questions for Next Session

1. Should we start with UMLS API integration or build UI components with mock data first?
2. Do you want to set up Azure SQL database now, or use localStorage initially?
3. What UMLS vocabularies are most important to support?
4. Should we focus on search first, or hierarchy exploration?
