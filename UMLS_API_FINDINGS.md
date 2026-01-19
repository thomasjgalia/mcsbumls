# UMLS API Findings & Observations

## Date: 2026-01-18

---

## Key Findings from Testing

### 1. Search API Behavior

**Endpoint**: `/rest/search/current`

**What it returns**:
- `ui` (CUI): UMLS Concept Unique Identifier
- `name`: Concept name
- `rootSource`: The "primary" vocabulary source (e.g., "MTH", "SNOMEDCT_US")
- `uri`: Link to full concept details

**Vocabulary Filtering**:
- The `sabs` parameter filters concepts that **exist** in the specified vocabularies
- However, the `rootSource` returned may not match your filter
- This is because UMLS concepts can exist in multiple vocabularies
- The `rootSource` is just which vocabulary UMLS considers "primary" for that concept

**Example**:
```
Search: "migraine" with filter: ICD10CM
Result: CUI C0149931, rootSource: "MTH"
```
This is CORRECT - the concept exists in ICD10CM (you'll see it in the atoms), but MTH is the root source.

---

### 2. Concept Details & Atoms

**Endpoint**: `/rest/content/current/CUI/{CUI}`

**Returns**:
- Concept metadata (name, semantic types, date added, etc.)
- Atom count, relation count
- Links to atoms, definitions, relations

**Endpoint**: `/rest/content/current/CUI/{CUI}/atoms`

**Critical Finding**: This is where the actual source codes live!

**Atoms contain**:
- `code`: **This is often a URL, not the actual code!**
- `rootSource`: The vocabulary (e.g., "ICD10CM", "SNOMEDCT_US")
- `name`: The term/description
- `termType`: Type of term (e.g., "PT" = Preferred Term)
- `language`: Language code

**Code Extraction**:
The `code` field format varies:
- Sometimes it's a URL: `https://uts-ws.nlm.nih.gov/rest/content/2025AB/source/ICD10CM/G43.909`
- Sometimes it's the actual code: `G43.909`
- **Solution**: Extract the last segment of the URL if it's a URL

**Filtering Atoms**:
- You can filter atoms by vocabulary using `sabs` parameter
- This is more reliable than filtering the search results
- Example: `&sabs=ICD10CM,SNOMEDCT_US,RXNORM`

---

### 3. Data Structure for Database

Based on testing, here's what we need to store:

```typescript
{
  cui: "C0149931",                           // From search
  code: "G43.909",                           // From atoms (extracted)
  vocabulary_id: "ICD10CM",                  // OMOP-aligned
  umls_vocabulary: "ICD10CM",                // From atom.rootSource
  term: "Migraine, unspecified, not intractable, without status migrainosus",
  source_concept: "Migraine Disorders"       // Original search term name
}
```

---

### 4. Vocabulary Filtering Strategy

**CRITICAL UNDERSTANDING (2026-01-18 Testing & Clarification)**:

**The "Source" Field in CUI Results is Misleading**:
- When you see a CUI result with "rootSource": "SNOMEDCT_US", this does NOT mean you're looking at a SNOMED-specific atom
- The "rootSource" indicates which vocabulary's preferred term is being shown for display
- That same CUI still contains atoms from MANY other vocabularies
- Example: CUI C0004057 shows "rootSource": "RXNORM" but has atoms in SNOMED, ATC, NDC, ICD-10, etc.

**What `sabs` Parameter Actually Does**:
- `sabs=RXNORM,ATC` returns CUIs that contain at least one atom from RXNORM or ATC
- But those CUIs may also contain atoms from other vocabularies (MTH, SNOMED, etc.)
- The "rootSource" shown may not match your filter (this is expected!)
- You're filtering which concepts to return, not which vocabularies they contain

**Example**:
```
Search: "heart failure" with sabs=ICD10CM
Result: CUI C0018801, rootSource: "MTH"
Explanation: This CUI has ICD10CM atoms, but MTH is shown as the display source
When you fetch atoms for this CUI, you'll find both MTH and ICD10CM atoms
```

**Two Search Approaches**:

**Approach 1: Search for CUIs, then filter atoms** (Current implementation)
```
GET /search?string=aspirin&sabs=RXNORM,ATC
→ Returns CUIs that have at least one RXNORM or ATC atom
→ Then fetch atoms with vocabulary filter to get only desired codes
```

**Approach 2: Get source codes directly** (Alternative)
```
GET /search?string=aspirin&sabs=RXNORM&returnIdType=sourceUi
→ Returns source codes directly (e.g., "RXNORM/1191")
→ Ready for immediate hierarchy navigation
→ No need to fetch atoms separately
```

**Recommended Workflow**:
1. User searches with optional vocabulary filter (sabs parameter)
2. Get CUI results (rootSource may not match filter - this is OK!)
3. User clicks "View Details"
4. Fetch atoms **filtered by our supported vocabularies**
5. Show user ONLY the codes from our vocabularies
6. User selects a specific code/vocabulary to explore hierarchy

**For Drug-Specific Searches**:
```javascript
// Search only drug vocabularies
const drugResults = await search(searchTerm, {
  sabs: 'RXNORM,ATC,NDC',  // Only return CUIs with drug codes
  returnIdType: 'sourceUi'  // Get codes directly
});
```

---

### 5. Current Implementation

**What works**:
- ✅ Search with vocabulary filtering
- ✅ Fetching concept details
- ✅ Fetching atoms filtered by our vocabulary list
- ✅ Extracting actual codes from URL-formatted code fields
- ✅ Displaying up to 50 atoms per concept

**API calls being made**:
```javascript
// Search
GET /rest/search/current?string=migraine&apiKey=XXX&pageSize=50&sabs=ICD10CM

// Concept + Atoms (parallel)
GET /rest/content/current/CUI/C0149931?apiKey=XXX
GET /rest/content/current/CUI/C0149931/atoms?apiKey=XXX&sabs=SNOMEDCT_US,ICD10CM,...&pageSize=100
```

---

### 6. Atoms Response Structure

**Example atom**:
```json
{
  "ui": "A35274732",
  "rootSource": "ICD10CM",
  "termType": "PT",
  "code": "https://uts-ws.nlm.nih.gov/rest/content/2025AB/source/ICD10CM/G43.909",
  "language": "ENG",
  "name": "Migraine, unspecified, not intractable, without status migrainosus"
}
```

**After processing**:
```json
{
  "actualCode": "G43.909",   // Extracted from URL
  "rootSource": "ICD10CM",
  "displayName": "Migraine, unspecified, not intractable, without status migrainosus"
}
```

---

### 7. Supported Vocabularies

Our application filters atoms to these vocabularies:
- SNOMEDCT_US (SNOMED)
- ICD10CM
- ICD9CM
- RXNORM (RxNorm)
- LNC (LOINC)
- CPT
- HCPCS
- NDC
- CVX
- ICD10PCS

**Why filter atoms?**
- UMLS has 200+ source vocabularies
- We only care about the ~12 vocabularies we support
- Filtering atoms reduces noise and improves performance
- Ensures we only store relevant codes in our database

---

### 8. Database Schema Validation

Based on testing, our schema is correct:

```sql
CREATE TABLE code_set_codes (
    cui NVARCHAR(20) NOT NULL,              -- From concept
    code NVARCHAR(100) NOT NULL,            -- From atom (extracted)
    vocabulary_id NVARCHAR(50) NOT NULL,    -- OMOP-aligned
    umls_vocabulary NVARCHAR(100) NOT NULL, -- From atom.rootSource
    term NVARCHAR(MAX) NOT NULL,            -- From atom.name
    source_concept NVARCHAR(MAX),           -- From search concept.name
    ...
);
```

All fields map directly to UMLS API responses.

---

### 9. Next Steps for Implementation

1. **Add "Add to Cart" functionality**
   - Allow users to select specific atoms (codes) to add
   - Store selected codes in shopping cart state

2. **Shopping Cart Component**
   - Display selected codes
   - Allow removal
   - Show count

3. **Save Code Set**
   - Collect cart items
   - Prompt for name/description
   - Save to database (when backend is ready)

4. **Export Functionality**
   - Export selected codes to TXT/CSV
   - Format: `code\tvocabulary_id\tterm`

---

### 10. Important Notes

**Rate Limiting**:
- UMLS API has a limit of 20 requests/second
- Implement caching for frequently accessed concepts
- Consider debouncing search input

**Pagination**:
- Search results: max 200 per request (no pagination supported)
- Atoms: paginated, default 25, max 100 per page
- For concepts with many atoms, may need multiple requests

**Performance**:
- Parallel API calls for concept + atoms (already implemented)
- Cache concept details for 24 hours
- Cache atoms for 24 hours

---

### 11. UMLS Hierarchical Organization (Critical Understanding)

**Hierarchy Levels** (Top to Bottom):
1. **CUI** (Concept Unique Identifier) - Unified concept across all vocabularies
   - Example: C0018681 = "Heart Failure" as a concept
   - Has semantic types
   - Cross-vocabulary linking mechanism

2. **AUI** (Atom Unique Identifier) - Vocabulary-specific terms
   - Each source vocabulary has its own atoms
   - Example: "Heart Failure" from SNOMED = one AUI, from ICD-10 = different AUI
   - Both link to same CUI

3. **Source Code** - The actual code in the vocabulary
   - Example: SNOMED code "84114007", ICD-10 code "I50.9"
   - Used for hierarchy navigation

**CRITICAL: Hierarchies are Source-Specific**
- Each vocabulary (SNOMED, ICD10, RxNorm, ATC) has its OWN hierarchy
- Hierarchies are expressed at the ATOM level (AUI-to-AUI), NOT at concept level
- You must specify which vocabulary's hierarchy you want to navigate
- SNOMED hierarchy ≠ ICD-10 hierarchy (different organizational structures)

**API Endpoints for Hierarchy Navigation**:
```
# Get ancestors (parents) in specific vocabulary
GET /content/current/source/{vocabulary}/{code}/ancestors

# Get descendants (children) in specific vocabulary
GET /content/current/source/{vocabulary}/{code}/descendants

# Example: Get SNOMED hierarchy for code 84114007
GET /content/current/source/SNOMEDCT_US/84114007/ancestors
GET /content/current/source/SNOMEDCT_US/84114007/descendants
```

**User Workflow** (Based on 2026-01-18 discussion):
1. User searches a term → Returns CUIs
2. User clicks "View Details" → Shows atoms (codes) from our supported vocabularies
3. User selects a specific atom/code to explore hierarchy
4. User views hierarchy tree for that code's vocabulary
5. User selects a starting point in the hierarchy
6. System fetches all descendants of that starting point
7. User adds selected codes to cart → Saves as code set

**Implementation Notes**:
- Hierarchy navigation requires source vocabulary + code
- Cannot navigate hierarchy at CUI level (must pick a vocabulary)
- Each vocabulary has different hierarchical depth and structure
- Need to implement tree view UI for hierarchy navigation
- Need "Get All Descendants" functionality for bulk code selection

---

**Last Updated**: 2026-01-18
**Status**: Search and atom display working. Next: Hierarchy navigation + cart functionality
