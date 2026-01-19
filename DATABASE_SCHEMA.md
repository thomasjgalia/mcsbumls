# Azure SQL Database Schema

## Overview
This document defines the database schema for the UMLS Code Set Builder application.

## Design Philosophy
- **Minimal storage approach**: Store only user-generated code sets, not UMLS data
- **UMLS API as source of truth**: All concept data, hierarchies, and relationships fetched on-demand
- **Denormalized for export performance**: code_set_codes table includes all needed fields
- **Optional caching layer**: Can add API response caching if needed

---

## Core Tables

### 1. code_sets
Stores metadata about user-created code sets.

```sql
CREATE TABLE code_sets (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id NVARCHAR(255) NOT NULL,
    code_set_name NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    total_concepts INT NOT NULL,

    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
);
```

**Fields:**
- `id`: Primary key, auto-incrementing
- `user_id`: User identifier (from Supabase auth when implemented)
- `code_set_name`: User-provided name for the code set
- `description`: Optional description of the code set's purpose
- `created_at`: Timestamp when code set was created
- `updated_at`: Timestamp when code set was last modified
- `total_concepts`: Count of codes in this set (for quick display)

---

### 2. code_set_codes
Stores individual codes within each code set. **Denormalized for fast export.**
**Stores both OMOP-aligned and UMLS vocabulary identifiers for interoperability.**

```sql
CREATE TABLE code_set_codes (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code_set_id INT NOT NULL,
    cui NVARCHAR(20) NOT NULL,
    code NVARCHAR(100) NOT NULL,
    vocabulary_id NVARCHAR(50) NOT NULL,        -- OMOP-aligned vocabulary name
    umls_vocabulary NVARCHAR(100) NOT NULL,     -- Original UMLS source abbreviation
    term NVARCHAR(MAX) NOT NULL,
    source_concept NVARCHAR(MAX),
    code_url NVARCHAR(500),                     -- Original UMLS source URL (optional)
    created_at DATETIME2 DEFAULT GETDATE(),

    FOREIGN KEY (code_set_id) REFERENCES code_sets(id) ON DELETE CASCADE,
    INDEX idx_code_set_id (code_set_id),
    INDEX idx_cui (cui),
    INDEX idx_vocabulary_id (vocabulary_id),
    INDEX idx_umls_vocabulary (umls_vocabulary)
);
```

**Fields:**
- `id`: Primary key, auto-incrementing
- `code_set_id`: Foreign key to code_sets table
- `cui`: UMLS Concept Unique Identifier (e.g., "C0011849")
- `code`: Source vocabulary code (e.g., ICD10CM code, SNOMED code)
- `vocabulary_id`: **OMOP-aligned vocabulary name** (e.g., "ICD10CM", "SNOMED", "RxNorm") - Our standard
- `umls_vocabulary`: **UMLS source abbreviation** (e.g., "ICD10CM", "SNOMEDCT_US", "RXNORM") - Original API value
- `term`: Human-readable term/description
- `source_concept`: Original concept name that led to this code being added
- `code_url`: **Original UMLS source URL** (e.g., "https://uts-ws.nlm.nih.gov/rest/content/2025AB/source/ICD10CM/G43.909") - For traceability
- `created_at`: Timestamp when code was added to the set

**Cascade Delete**: When a code_set is deleted, all associated codes are automatically deleted.

**Vocabulary Dual Storage Rationale:**
- `vocabulary_id`: OMOP-aligned for consistency with existing OMOP workflows and integrations
- `umls_vocabulary`: Preserves original UMLS source for traceability and API consistency
- Enables seamless integration with OMOP CDM if needed in the future
- Allows filtering/grouping by either naming convention

---

## Future Enhancements (Optional)

### 3. api_response_cache (Optional)
Cache UMLS API responses to improve performance and reduce API calls.

```sql
CREATE TABLE api_response_cache (
    id INT IDENTITY(1,1) PRIMARY KEY,
    cache_key NVARCHAR(500) NOT NULL UNIQUE,
    response_data NVARCHAR(MAX) NOT NULL,  -- JSON string
    created_at DATETIME2 DEFAULT GETDATE(),
    expires_at DATETIME2 NOT NULL,

    INDEX idx_cache_key (cache_key),
    INDEX idx_expires_at (expires_at)
);
```

**Purpose**: Cache frequently-accessed data:
- Search results
- Hierarchy/relationship data
- Drug metadata from RxNorm API
- Concept details

**TTL Strategy**:
- Search results: 24 hours
- Hierarchy data: 7 days
- Concept details: 7 days

**Cleanup**: Implement scheduled job to delete expired cache entries.

---

## Vocabulary Mapping

The application maintains three-way mapping between OMOP vocabulary IDs, UI-friendly names, and UMLS source abbreviations:

| vocabulary_id (OMOP) | UI Display Name | umls_vocabulary (UMLS API) | Description |
|---------------------|-----------------|---------------------------|-------------|
| ICD10CM | ICD10CM | ICD10CM | ICD-10 Clinical Modification |
| SNOMED | SNOMED | SNOMEDCT_US | SNOMED CT US Edition |
| ICD9CM | ICD9CM | ICD9CM | ICD-9 Clinical Modification |
| LOINC | LOINC | LNC | Logical Observation Identifiers |
| CPT4 | CPT4 | CPT | Current Procedural Terminology |
| HCPCS | HCPCS | HCPCS | Healthcare Common Procedure Coding System |
| RxNorm | RxNorm | RXNORM | RxNorm (Drugs) |
| NDC | NDC | NDC | National Drug Code |
| CVX | CVX | CVX | Vaccines Administered |
| ATC | ATC | ATC | Anatomical Therapeutic Chemical |
| ICD9Proc | ICD9PCS | ICD9CM | ICD-9 Procedure Codes |
| ICD10PCS | ICD10PCS | ICD10PCS | ICD-10 Procedure Coding System |

**Column Explanations:**
- **vocabulary_id**: OMOP-aligned naming convention (stored in database, used for OMOP integration)
- **UI Display Name**: User-facing name shown in the application interface
- **umls_vocabulary**: UMLS source abbreviation (returned by UMLS API, stored for traceability)

**Usage Examples:**
```sql
-- Query by OMOP vocabulary ID (for OMOP integration)
SELECT * FROM code_set_codes WHERE vocabulary_id = 'SNOMED';

-- Query by UMLS vocabulary (for UMLS API consistency)
SELECT * FROM code_set_codes WHERE umls_vocabulary = 'SNOMEDCT_US';

-- Both queries return the same data, enabling dual interoperability
```

---

## Data Flow

### Creating a Code Set:
1. User searches UMLS, selects concepts
2. User saves code set with name/description
3. INSERT into `code_sets` table
4. INSERT multiple rows into `code_set_codes` table
5. Return code_set_id to user

### Retrieving Code Sets:
1. Query `code_sets` WHERE user_id = ?
2. For detail view: JOIN with `code_set_codes`
3. Return complete code set data

### Exporting:
1. Query `code_set_codes` WHERE code_set_id = ?
2. Format as TXT/CSV with columns: code, vocabulary, term
3. Download file

---

## What We DON'T Store

The following data is **NOT stored** in the database (fetched from UMLS API on-demand):

- ❌ Full UMLS concept data
- ❌ Concept hierarchies/relationships
- ❌ Semantic types
- ❌ Synonyms and alternate terms
- ❌ Drug ingredients, dose forms, classifications (from RxNorm)
- ❌ Cross-vocabulary mappings

**Rationale**:
- No 6-month update cycles needed
- Always reflects latest UMLS release
- Much smaller database footprint
- Lower maintenance burden

---

## Future Considerations

### User Management (when Supabase auth is enabled):
- `user_id` will be populated from Supabase JWT
- Consider adding user profile table for preferences
- Consider sharing/collaboration features

### Analytics (optional):
- Track popular searches
- Track frequently-used vocabularies
- Usage metrics per user

### Performance Optimization:
- Consider materialized views for user dashboard
- Implement read replicas for production
- Add caching layer (Redis) for API responses

---

## Notes for Implementation

1. **Start with 2 tables**: `code_sets` and `code_set_codes`
2. **Add caching later**: Only if performance requires it
3. **Test with sample data**: Create a few code sets to validate schema
4. **Monitor query performance**: Adjust indexes as needed
5. **Plan for scale**: Current schema supports thousands of users and code sets

---

## Connection Information

Store in `.env` file:
```
AZURE_SQL_SERVER=your_server.database.windows.net
AZURE_SQL_DATABASE=umls_code_sets
AZURE_SQL_USER=your_username
AZURE_SQL_PASSWORD=your_password
```

---

**Last Updated**: 2026-01-18
**Status**: Ready for implementation
