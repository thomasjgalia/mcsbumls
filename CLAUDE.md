# Claude Context & Instructions

This file contains important context and instructions for Claude to remember when working on this project.

## Project Overview

**Project Name:** UMLS Code Set Builder (mcsbumls)
**Type:** React + TypeScript web application
**Purpose:** A clinical code set builder that allows users to search UMLS (Unified Medical Language System) terminologies, navigate hierarchical relationships, and build domain-specific code sets for healthcare data analytics and OMOP CDM integration.

### What This Application Does
1. **Search UMLS Terminologies**: Search across 12+ medical vocabularies (ICD-10-CM, SNOMED CT, RxNorm, LOINC, CPT, etc.)
2. **Navigate Hierarchies**: Browse parent/child relationships in hierarchical vocabularies
3. **Build Code Sets**: Create domain-specific code sets (conditions, drugs, measurements, procedures, observations)
4. **RxNorm to NDC Mapping**: Special support for mapping RxNorm drug codes to NDC (National Drug Code) codes
5. **Export**: Export code sets for use in OMOP CDM and other data systems

## Tech Stack

- **Frontend**: React 19.2.0 + TypeScript 5.9.3
- **Build Tool**: Vite 7.2.4
- **Styling**: Tailwind CSS 4.1.18
- **Icons**: Lucide React 0.562.0
- **Backend/Auth**: Supabase 2.90.1 (currently in local dev mode, auth bypassed)
- **APIs Used**:
  - UMLS Terminology Services API (NLM) - 2025AB version
  - RxNav API (NLM) - for RxNorm drug hierarchies and NDC mappings

## Important Context

### Current State
- Application is in **local development mode** (authentication bypassed - see yellow "Local Dev Mode" badge)
- Two main views: "Search & Build" (implemented) and "Saved Code Sets" (placeholder)
- Recent features: RxNorm hierarchy support, NDC code mapping, dose form filtering, TTY labels

### Recent Development (from git history)
- `9d86ba3` - Add dose form filter and TTY labels for hierarchy view
- `58d6933` - Add consolidated dose form display for RxNorm/NDC codes
- `0fb2989` - Add RxNorm drug hierarchy support with NDC code mapping

### Key Files & Structure

**Core Application**
- `src/App.tsx` - Main app with header, navigation, view switching
- `src/main.tsx` - Application entry point
- `src/components/UMLSSearch.tsx` - Primary search & build interface (large, complex component)

**Library/Utilities**
- `src/lib/api.ts` - UMLS API client with all UMLS/RxNav interactions
- `src/lib/types.ts` - TypeScript interfaces for UMLS data, API requests/responses, UI state
- `src/lib/vocabularyMapping.ts` - Bidirectional mapping between UMLS codes ↔ OMOP vocabulary_id ↔ UI display names
- `src/lib/supabase.ts` - Supabase client configuration

**Configuration**
- `vite.config.ts` - Vite build configuration
- `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` - TypeScript configs
- `eslint.config.js` - ESLint configuration
- `.env` - Environment variables (VITE_UMLS_API_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)

## Coding Preferences & Guidelines

- **Components**: Functional components with React hooks
- **TypeScript**: Strict typing with explicit interfaces (see `src/lib/types.ts`)
- **State Management**: useState hooks (no Redux/Zustand - keep it simple)
- **API Calls**: Centralized in `src/lib/api.ts`
- **Error Handling**: Try/catch with user-friendly error messages
- **Console Logging**: Extensive logging in api.ts with prefixes like `[RXNORM→NDC]`, `[UMLS ATTRIBUTES]` for debugging
- **Naming Conventions**:
  - `camelCase` for variables/functions
  - `PascalCase` for components/interfaces
  - `UPPER_SNAKE_CASE` for constants/config objects

## Business Rules & Domain Knowledge

### UMLS Terminology System

**CUI (Concept Unique Identifier)**: A unique ID for a medical concept across all vocabularies
**AUI (Atom Unique Identifier)**: A unique ID for a specific term/code in a specific vocabulary
**Atoms**: The actual codes from source vocabularies that represent a concept

### Supported Vocabularies

The app uses a **three-layer vocabulary naming system**:

1. **UMLS Vocabulary** (API codes): `SNOMEDCT_US`, `LNC`, `RXNORM`, `ICD10CM`, etc.
2. **OMOP vocabulary_id** (database standard): `SNOMED`, `LOINC`, `RxNorm`, `ICD10CM`, etc.
3. **Display Name** (UI labels): `SNOMED`, `LOINC`, `RxNorm`, `ICD10CM`, etc.

See `src/lib/vocabularyMapping.ts` for complete mappings.

**12 Supported Vocabularies:**
- **ICD10CM** - ICD-10 Clinical Modification (diagnosis codes)
- **SNOMED** (SNOMEDCT_US) - SNOMED CT US Edition (clinical concepts)
- **ICD9CM** - ICD-9 Clinical Modification (legacy diagnosis codes)
- **LOINC** (LNC) - Logical Observation Identifiers (lab tests, clinical observations)
- **CPT4** (CPT) - Current Procedural Terminology (procedures)
- **HCPCS** - Healthcare Common Procedure Coding System
- **RxNorm** (RXNORM) - Drug terminology (ingredients, clinical drugs, branded drugs)
- **NDC** - National Drug Code (specific drug products)
- **CVX** - Vaccines Administered
- **ATC** - Anatomical Therapeutic Chemical Classification
- **ICD10PCS** - ICD-10 Procedure Coding System
- **ICD9Proc** (ICD9PCS) - ICD-9 Procedure Codes

### Hierarchical Vocabularies

These vocabularies support parent/child navigation:
- `SNOMEDCT_US`, `ICD10CM`, `ICD9CM`, `RXNORM`, `ATC`, `LNC`, `ICD10PCS`

### Build Domains

The app supports building code sets for 5 clinical domains:

1. **Condition** 🏥 - Diseases, disorders (uses ICD10CM, SNOMED, ICD9CM)
2. **Drug** 💊 - Medications (uses NDC, RxNorm, CPT, CVX, HCPCS, ATC)
3. **Measurement** 📊 - Lab tests, vitals (uses LOINC, CPT, SNOMED, HCPCS)
4. **Procedure** ⚕️ - Clinical procedures (uses CPT, HCPCS, SNOMED, ICD9PCS, LOINC, ICD10PCS)
5. **Observation** 👁️ - Clinical observations (uses ICD10CM, SNOMED, LOINC, CPT, HCPCS)

### RxNorm Specifics

**RxNorm TTY (Term Types):**
- `IN` - Ingredient (e.g., "Aspirin")
- `SCD` - Semantic Clinical Drug (e.g., "Aspirin 81 MG Oral Tablet")
- `SBD` - Semantic Branded Drug (e.g., "Bayer Aspirin 81 MG Oral Tablet")
- `SCDC/SBDC` - Drug Components
- `SCDF/SBDF` - Drug Forms
- `GPCK/BPCK` - Generic/Branded Packs

**Dose Forms** (consolidated categories):
- Oral Solid, Oral Liquid, Injectable, Topical, Inhalation, Ophthalmic, Otic, Other

**RxNorm → NDC Mapping:**
The app fetches NDC codes from **two sources**:
1. RxNav API (`/rxcui/{rxcui}/ndcs.json`)
2. UMLS Attributes (both RxNorm source-level and CUI-level attributes)

### API Behavior

**Search:**
- Fetches 4 pages × 75 results = 300 total results max
- Parallel page fetches for performance
- Deduplicates by CUI
- Supports relevance or alphabetical sorting
- Includes suppressible and obsolete codes (`includeSuppressible=true`, `includeObsolete=true`)

**Hierarchy:**
- Ancestors: Single API call (usually small result set)
- Descendants: Paginated with 5000 results/page, up to 20 pages max (100k descendants)
- RxNorm uses RxNav API instead of UMLS for better hierarchy support

**Code Extraction:**
- If `atom.code` is a URL, extract the last path segment as the actual code
- Store original URL in `codeUrl` field for reference

## Common Tasks & Commands

```bash
npm run dev          # Start development server (localhost:5173)
npm run build        # Build for production (TypeScript compile + Vite build)
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

## Things to Remember

### API Integration
- **Always include** `includeSuppressible=true` and `includeObsolete=true` in UMLS API calls to get all codes
- UMLS API key is required (stored in `.env` as `VITE_UMLS_API_KEY`)
- UMLS API version is `2025AB` (hardcoded in api.ts)
- Handle URL-based codes by extracting the last path segment

### RxNorm/NDC
- Use RxNav API for RxNorm hierarchies (more complete than UMLS)
- Check both RxNav and UMLS attributes for NDC codes (union of both sources)
- Parse drug names for dose forms and strengths (see `parseRxNormName` function)

### Vocabulary Mapping
- Always use `vocabularyMapping.ts` functions to convert between naming systems
- Never hardcode vocabulary name conversions
- UI uses Display Names, API uses UMLS codes, database uses OMOP vocabulary_id

### UI/UX
- Extensive use of Lucide React icons
- Tailwind CSS utility classes for styling
- Multi-step workflow: Search → View Atoms → Navigate Hierarchy → Build Code Set
- Progress indicators for long-running operations (large hierarchy fetches)

### TypeScript
- All UMLS data types are in `src/lib/types.ts`
- Use existing interfaces instead of `any` types
- Component props should have explicit type definitions

## Future Plans

- ✅ RxNorm hierarchy navigation (completed)
- ✅ NDC code mapping (completed)
- ✅ Dose form filtering (completed)
- 🔲 Implement Supabase authentication (when ready to deploy)
- 🔲 Complete "Saved Code Sets" functionality (database integration)
- 🔲 Code set export to CSV/JSON
- 🔲 Sharing/collaboration features

## Environment Variables Required

Create a `.env` file with:
```env
VITE_UMLS_API_KEY=your_umls_api_key_here
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**UMLS API Key**: Obtain from [UTS Account](https://uts.nlm.nih.gov/uts/login)

## Domain-Specific Notes

### OMOP CDM Integration
This app is designed to support OMOP Common Data Model workflows:
- vocabulary_id values align with OMOP standard vocabularies
- Code sets can be exported for use in OMOP concept_id mappings
- Hierarchical relationships support concept ancestor/descendant tables

### Clinical Use Cases
- Building condition cohorts for research studies
- Creating drug formularies for EHR systems
- Mapping lab test panels to LOINC codes
- Standardizing procedure coding across systems

---

**Last Updated:** 2026-01-20 (auto-generated from codebase analysis)
**Update this file when major architectural changes occur!**
