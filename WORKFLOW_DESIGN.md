# UMLS Code Set Builder - Workflow Design

## Date: 2026-01-18

---

## User Workflow (Step-by-Step)

### Step 1: Search for CUIs
- User enters search term (e.g., "heart failure")
- Optional: User selects vocabulary filters
- System calls UMLS search API with `sabs` parameter
- **Returns**: CUIs that contain atoms from selected vocabularies
- **Note**: The "rootSource" shown is just display source, may not match filter (this is expected)

**Current Status**: ✅ Implemented

---

### Step 2: View Atoms for Selected CUI
- User clicks "View Details" on a CUI
- System fetches all atoms for that CUI, filtered to our supported vocabularies
- **Displays**: Table of atoms (code, vocabulary, term)
- Each atom row shows:
  - Code (extracted from URL if needed)
  - Vocabulary (SNOMED, ICD10CM, etc.)
  - Term description

**Current Status**: ✅ Implemented

---

### Step 3: Explore Hierarchy for Selected Atom
- User clicks "Explore Hierarchy" button on an atom row
- System fetches ancestors AND descendants for that specific code in that vocabulary
- **API Calls**:
  ```
  GET /content/current/source/{vocabulary}/{code}/ancestors
  GET /content/current/source/{vocabulary}/{code}/descendants
  ```
- **Displays**: Hierarchical tree view showing:
  - Ancestors (parents, grandparents, etc.) - provides context
  - The selected code (highlighted)
  - Descendants (children, grandchildren, etc.)

**Current Status**: ❌ To be implemented

---

### Step 4: Select Starting Point & Build Code Set
- User browses hierarchy tree
- User selects a starting point node in the hierarchy
- User clicks "Get All Descendants" button
- System recursively fetches ALL descendants at all levels (full subtree)
- User reviews the codes that will be included
- User adds selected codes to shopping cart

**Current Status**: ❌ To be implemented

---

### Step 5: Save Code Set
- User reviews codes in shopping cart
- User provides code set name and description
- System saves to database with:
  - CUI
  - Code
  - vocabulary_id (OMOP-aligned)
  - umls_vocabulary (UMLS source)
  - Term
  - source_concept
  - code_url (original UMLS URL)

**Current Status**: ❌ To be implemented

---

## Key Differences from OMOP Approach

| Aspect | UMLS Approach (This App) | OMOP CDM Approach |
|--------|--------------------------|-------------------|
| **Starting Point** | CUI (Concept Unique Identifier) | concept_id |
| **Granularity** | CUI → Atoms (vocabulary-specific) | Directly to concept_id (similar to atom) |
| **Hierarchy** | Must choose vocabulary first, then navigate that vocabulary's hierarchy | Single unified hierarchy per domain |
| **Code Selection** | Select atom → explore its hierarchy → get descendants | Select concept → explore hierarchy → get descendants |
| **Cross-Vocabulary** | CUI links to multiple vocabularies, user picks which one | Concept mappings between vocabularies |

**Key Insight**: In UMLS, you start broader (CUI level) and drill down to vocabulary-specific atoms. In OMOP, you start at the concept_id level (analogous to atoms).

---

## Vocabularies with Hierarchical Support

### ✅ Hierarchical Vocabularies (Support Hierarchy Navigation)
- **SNOMED** (SNOMEDCT_US) - Excellent hierarchy
- **ICD10CM** - Hierarchical
- **ICD9CM** - Hierarchical
- **RxNorm** (RXNORM) - Ingredient/form relationships
- **ATC** - Drug classification hierarchy
- **LOINC** (LNC) - Has hierarchy
- **ICD10PCS** - Hierarchical

### ❌ Flat Vocabularies (No Hierarchy)
- **NDC** - Flat list
- **CPT** - Flat list
- **HCPCS** - Flat list
- **CVX** - Flat list

**Implementation Note**: Only show "Explore Hierarchy" button for atoms from hierarchical vocabularies.

---

## API Endpoints Summary

### Search (Step 1)
```
GET /search?string={term}&sabs={vocabularies}&pageSize=50
→ Returns CUIs
```

### Get Atoms (Step 2)
```
GET /content/current/CUI/{cui}/atoms?sabs={vocabularies}&pageSize=100
→ Returns atoms filtered to our vocabularies
```

### Get Hierarchy (Step 3)
```
GET /content/current/source/{vocabulary}/{code}/ancestors
GET /content/current/source/{vocabulary}/{code}/descendants
→ Returns related codes in that vocabulary's hierarchy
```

### Get All Descendants Recursively (Step 4)
```
Recursive algorithm:
1. Get immediate descendants for starting code
2. For each descendant, get its descendants
3. Continue until no more descendants
4. Return flattened list of all codes
```

---

## Implementation Phases

### Phase 1: Hierarchy Viewing ✅ (Next)
- Add "Explore Hierarchy" button to atom rows
- Implement API functions for ancestors/descendants
- Display hierarchy in simple expandable view
- Show ancestors + selected code + descendants

### Phase 2: Code Selection
- Add checkboxes to hierarchy nodes
- Implement "Get All Descendants" function
- Show count of codes that will be selected
- Add to shopping cart

### Phase 3: Shopping Cart
- Cart component showing selected codes
- Remove codes from cart
- Show count and vocabulary breakdown

### Phase 4: Save Code Set
- Modal for code set name/description
- Save to database (when backend ready)
- Export to TXT/CSV

---

## Technical Notes

- **Hierarchy depth**: No artificial limit, fetch full subtree
- **Performance**: May need loading indicators for deep hierarchies
- **Caching**: Consider caching hierarchy data (7-day TTL)
- **De-duplication**: When getting all descendants, avoid duplicate codes
- **Error handling**: Some codes may not have descendants (leaf nodes)

---

**Last Updated**: 2026-01-18
**Status**: Ready to implement Phase 1 (Hierarchy Viewing)
