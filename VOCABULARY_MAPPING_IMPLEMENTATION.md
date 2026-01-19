# Vocabulary Mapping Implementation

## Overview
The UMLS Code Set Builder now maintains **dual vocabulary naming** to support both OMOP CDM integration and UMLS API consistency.

---

## Three-Way Mapping System

Each vocabulary concept is tracked with three identifiers:

1. **vocabulary_id** (OMOP-aligned)
   - Used for database storage
   - Aligns with OMOP CDM naming conventions
   - Example: `SNOMED`, `RxNorm`, `LOINC`

2. **displayName** (UI-friendly)
   - Shown to users in the interface
   - Usually matches vocabulary_id
   - Example: `SNOMED`, `RxNorm`, `LOINC`

3. **umls_vocabulary** (UMLS API)
   - Original UMLS source abbreviation
   - Used for UMLS REST API calls
   - Example: `SNOMEDCT_US`, `RXNORM`, `LNC`

---

## Complete Mapping Table

| vocabulary_id | displayName | umls_vocabulary | Description |
|--------------|-------------|-----------------|-------------|
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

---

## Implementation Files

### 1. vocabularyMapping.ts
**Location**: `src/lib/vocabularyMapping.ts`

Centralized vocabulary mapping utilities with bidirectional conversion functions:

```typescript
// Convert UI display name to UMLS for API calls
displayNameToUmls("LOINC") // → "LNC"
displayNameToUmls("SNOMED") // → "SNOMEDCT_US"

// Convert UMLS to OMOP vocabulary_id for database
umlsToVocabularyId("SNOMEDCT_US") // → "SNOMED"
umlsToVocabularyId("LNC") // → "LOINC"

// Convert vocabulary_id to UMLS for API calls
vocabularyIdToUmls("SNOMED") // → "SNOMEDCT_US"

// Get all display names for UI
getAllDisplayNames() // → ["ICD10CM", "SNOMED", ...]

// Batch convert display names to UMLS codes
displayNamesToUmls(["LOINC", "SNOMED"]) // → ["LNC", "SNOMEDCT_US"]
```

### 2. Updated Database Schema
**Location**: `DATABASE_SCHEMA.md`

The `code_set_codes` table now stores **both** vocabulary identifiers:

```sql
CREATE TABLE code_set_codes (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code_set_id INT NOT NULL,
    cui NVARCHAR(20) NOT NULL,
    code NVARCHAR(100) NOT NULL,
    vocabulary_id NVARCHAR(50) NOT NULL,        -- OMOP-aligned
    umls_vocabulary NVARCHAR(100) NOT NULL,     -- UMLS source
    term NVARCHAR(MAX) NOT NULL,
    source_concept NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETDATE(),
    ...
);
```

### 3. Updated TypeScript Types
**Location**: `src/lib/types.ts`

```typescript
export interface CodeSetCode {
  vocabulary_id: string;      // OMOP-aligned
  umls_vocabulary: string;    // UMLS source
  // ... other fields
}

export interface ShoppingCartItem {
  vocabulary_id: string;      // OMOP-aligned
  umls_vocabulary: string;    // UMLS source
  // ... other fields
}
```

### 4. Updated Components
**Location**: `src/components/UMLSSearch.tsx`

Now uses centralized vocabulary mapping:

```typescript
import { getAllDisplayNames, displayNamesToUmls } from '../lib/vocabularyMapping';

// Get vocabulary filter buttons
const vocabularies = getAllDisplayNames();

// Convert selected vocabularies for API call
const umlsVocabs = displayNamesToUmls(selectedVocabularies);
```

---

## Data Flow Examples

### Searching with Vocabulary Filters

1. **User selects**: `LOINC` and `SNOMED` in UI
2. **displayNamesToUmls()** converts to: `["LNC", "SNOMEDCT_US"]`
3. **UMLS API call**: `?sabs=LNC,SNOMEDCT_US`
4. **API returns**: Results with `rootSource: "LNC"` or `rootSource: "SNOMEDCT_US"`

### Saving a Code to Database

```typescript
// When user adds a code to their code set:
const codeToSave = {
  cui: "C0011849",
  code: "250.00",
  vocabulary_id: "ICD9CM",           // OMOP-aligned for database
  umls_vocabulary: "ICD9CM",         // UMLS source for traceability
  term: "Diabetes mellitus",
  source_concept: "Diabetes"
};

// INSERT into code_set_codes with both vocabulary fields
```

### Exporting Code Set

```typescript
// Export uses vocabulary_id (OMOP-aligned)
exportToTxt(codes);

// Output format:
// 250.00    ICD9CM    Diabetes mellitus
// 401.9     ICD9CM    Hypertension
```

---

## Benefits of Dual Storage

1. **OMOP Integration**: `vocabulary_id` matches OMOP CDM conventions
2. **UMLS Traceability**: `umls_vocabulary` preserves original API source
3. **Flexible Querying**: Can filter by either naming convention
4. **Future-Proof**: Supports both ecosystems without data loss

---

## Usage Guidelines

### For Frontend Development:
- Use `getAllDisplayNames()` to populate UI filters
- Use `displayNamesToUmls()` before UMLS API calls
- Display `vocabulary_id` to users (OMOP-aligned)

### For Database Operations:
- Store both `vocabulary_id` and `umls_vocabulary`
- Query by `vocabulary_id` for OMOP consistency
- Use `umls_vocabulary` for UMLS API correlation

### For API Integration:
- Convert vocabulary_id → umls_vocabulary before API calls
- Convert umls_vocabulary → vocabulary_id after API responses

---

## Migration Notes

When creating the Azure SQL database:
1. Use the updated schema from `DATABASE_SCHEMA.md`
2. Both vocabulary fields are required (NOT NULL)
3. Indexes on both fields for query performance
4. Export functions use `vocabulary_id` (OMOP-aligned)

---

**Last Updated**: 2026-01-18
**Status**: Implemented and ready for use
