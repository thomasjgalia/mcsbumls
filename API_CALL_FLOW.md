# API Call Flow Analysis
## How UMLSSearch.tsx Orchestrates UMLS API Calls Based on User Interactions

This document explains how the application leverages `api.ts` and `UMLSSearch.tsx` to make UMLS API calls based on user clicks and application state.

---

## Architecture Overview

```
User Click → Component Handler → API Function → UMLS/RxNav API → Response Processing → State Update → UI Re-render
```

**Two Key Files:**
1. **`src/lib/api.ts`** - Pure API functions (no UI logic, no state)
2. **`src/components/UMLSSearch.tsx`** - UI orchestration with React state management

---

## The 4-Step User Journey & Associated API Calls

### Step 0: Initial Search

**User Action:** Types search term and clicks Search button

**UI Element:**
```tsx
<form onSubmit={handleSearch}>
  <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
  <button type="submit">Search</button>
</form>
```

**Handler Function:** `handleSearch()` (line 418)

**API Call:**
```tsx
const response = await searchUMLS({
  searchTerm: searchTerm.trim(),
  vocabularies: ALL_SEARCH_VOCABULARIES,  // All 12 vocabularies
  pageSize: 50,
  sortBy: sortBy,  // 'relevance' or 'alphabetical'
});
```

**API Function in api.ts:** `searchUMLS()` (line 18)
- Fetches 4 pages × 75 results = 300 total
- Parallel page fetches for performance
- Deduplicates by CUI
- Returns: `{ success, data: UMLSSearchResult[], total, ... }`

**State Updates:**
```tsx
setResults(response.data);      // Display search results
setRawResponse(response);
```

**What Happens:**
- UMLS API called: `https://uts-ws.nlm.nih.gov/rest/search/2025AB?string=diabetes&apiKey=XXX&pageSize=75&pageNumber=1&sabs=SNOMEDCT_US,ICD10CM,...`
- Results shown as clickable cards with CUI, name, and rootSource

---

### Step 1: View Concept Details (Atoms)

**User Action:** Clicks on a search result card to see all vocabulary codes

**UI Element:**
```tsx
<div onClick={() => handleViewDetails(result.ui)} className="cursor-pointer hover:bg-gray-50">
  <h3>{result.name}</h3>
  <p>CUI: {result.ui}</p>
</div>
```

**Handler Function:** `handleViewDetails(cui)` (line 473)

**API Call:**
```tsx
const details = await getConceptDetails(cui, ALL_SEARCH_VOCABULARIES);
```

**API Function in api.ts:** `getConceptDetails()` (line 98)
- Fetches concept metadata AND atoms (source codes) in parallel
- Calls two UMLS endpoints:
  1. `/CUI/{cui}` - concept details with semantic types
  2. `/CUI/{cui}/atoms` - all source codes from 12 vocabularies
- Processes atoms to extract actual codes from URLs
- Returns: `{ concept: {...}, atoms: [...] }`

**State Updates:**
```tsx
setSelectedConcept(details);
setExpandedDomains(new Set([primaryDomain])); // Auto-expand primary domain
```

**What Happens:**
- Two parallel API calls:
  - `https://uts-ws.nlm.nih.gov/rest/content/2025AB/CUI/C0011849?apiKey=XXX`
  - `https://uts-ws.nlm.nih.gov/rest/content/2025AB/CUI/C0011849/atoms?apiKey=XXX&sabs=SNOMEDCT_US,ICD10CM,...&pageSize=100`
- Atoms are grouped by domain (disease, drug, lab, procedure, vaccine)
- Displayed in expandable sections with vocabulary badges

---

### Step 2: Explore Hierarchy

**User Action:** Clicks "Explore Hierarchy" button next to an atom (source code)

**UI Element:**
```tsx
<button onClick={() => handleExploreHierarchy(atom)}>
  <GitBranch /> Explore Hierarchy
</button>
```

**Handler Function:** `handleExploreHierarchy(atom)` (line 502)

**API Calls (Parallel):**
```tsx
const [ancestors, descendants] = await Promise.all([
  getAncestors(vocabulary, code),
  getDescendants(vocabulary, code)
]);
```

**API Functions in api.ts:**
1. **`getAncestors()`** (line 186)
   - Single API call to get parent codes
   - Endpoint: `/source/{vocabulary}/{code}/ancestors`
   - Returns parent hierarchy (reversed to show broad → specific)

2. **`getDescendants()`** (line 215)
   - Paginated calls (5000 per page, max 20 pages = 100k descendants)
   - For RxNorm: Uses RxNav API instead (`getRxNormDescendants()`)
   - Endpoint: `/source/{vocabulary}/{code}/descendants`
   - Returns child codes with pagination handling

**Special RxNorm Handling:**
- Calls `getRxNormDescendants()` (line 283) which uses RxNav API
- Endpoint: `https://rxnav.nlm.nih.gov/REST/rxcui/{rxcui}/related.json?tty=IN+SCD+SBD+SCDC+SBDC`
- Gets related drug concepts (ingredients, clinical drugs, branded drugs)

**State Updates:**
```tsx
setHierarchyData({
  atom,
  ancestors: ancestors.reverse(),
  descendants
});
setSelectedAtom(atom);
```

**What Happens:**
- Two parallel API calls:
  - Ancestors: `https://uts-ws.nlm.nih.gov/rest/content/2025AB/source/SNOMEDCT_US/73211009/ancestors?apiKey=XXX`
  - Descendants: `https://uts-ws.nlm.nih.gov/rest/content/2025AB/source/SNOMEDCT_US/73211009/descendants?apiKey=XXX&pageSize=5000&pageNumber=1`
- Displays hierarchy tree with parent codes above and child codes below
- Each row has a "Re-explore" button to pivot the hierarchy view

---

### Step 2b: Re-explore Hierarchy from a Node

**User Action:** Clicks "Explore from here" button on an ancestor/descendant row

**UI Element:**
```tsx
<button onClick={(e) => handleReExploreHierarchy(node, e)}>
  <GitBranch /> Explore from here
</button>
```

**Handler Function:** `handleReExploreHierarchy(node, e)` (line 537)

**Same API Calls as Step 2:**
- Fetches ancestors and descendants for the selected node
- Makes that node the new "anchor" in the hierarchy view

**State Updates:**
```tsx
setHierarchyData({
  atom: { /* new anchor node */ },
  ancestors: ancestors.reverse(),
  descendants
});
```

---

### Step 3: Build Code Set

**User Action:** Clicks "Build from here" button on a hierarchy node

**UI Element:**
```tsx
<button onClick={() => handleBuildClick(node)}>
  <Play /> Build from here
</button>
```

**Handler Function:** `handleBuildClick(node)` (line 827)

**Pre-flight Check:**
```tsx
const estimate = await estimateDescendantCount(vocabulary, code);
if (estimate > WARNING_THRESHOLD) {
  setShowWarningModal(true); // Warn user about large code sets
}
```

**Main Build Function:** `handleBuildFromHierarchyNode(node, buildDomain)` (line 881)

**This is the MOST COMPLEX API orchestration - Multi-phase process:**

#### Phase 1: Find Standard Vocabulary Code (if needed)
```tsx
if (buildVocabulary !== standardVocab) {
  const conceptDetails = await getConceptDetails(cui, [standardVocab]);
  // Use standard vocab code for comprehensive coverage
}
```

**API Call:** `getConceptDetails()` to find SNOMED/RxNorm/LOINC code

#### Phase 2: Recursively Fetch ALL Descendants
```tsx
const allDescendants = await getAllDescendantsFromSourceCode(
  buildVocabulary,
  buildCode,
  new Set(),
  (current, phase) => setBuildProgress({ current, total: 0, phase })
);
```

**Custom Recursive Function:** `getAllDescendantsFromSourceCode()` (line 586)
- For **RxNorm**: Single non-recursive call to `getDescendants()` (RxNav API)
- For **Other Vocabularies**: Recursive tree traversal
  - Calls `getDescendants()` for each node
  - Tracks visited codes to prevent infinite loops
  - Updates progress indicator during traversal

**API Calls (Recursive):**
- Initial call: `getDescendants(vocabulary, code)`
- For each descendant: `getDescendants(vocabulary, descendant.code)`
- Continues until all branches exhausted

#### Phase 3: Convert Source Codes to CUIs
```tsx
const cuis = await convertSourceCodesToCUIs(
  allSourceCodes,
  (current, phase) => setBuildProgress({ current, total, phase })
);
```

**Custom Conversion Function:** `convertSourceCodesToCUIs()` (line 698)
- Loops through each source code
- For each code, makes TWO API calls:
  1. Get source atom: `GET /source/{vocabulary}/{code}`
  2. Get CUI from atoms: `GET {atomsUrl}?apiKey=XXX`

**API Calls (Sequential loop):**
```
For each of N source codes:
  → GET https://uts-ws.nlm.nih.gov/rest/content/2025AB/source/SNOMEDCT_US/{code}?apiKey=XXX
  → GET {atomsUrl}?apiKey=XXX
  → Extract CUI from result
```

#### Phase 4: Fetch Target Vocabulary Codes
```tsx
for (const cui of allCUIs) {
  const conceptDetails = await getConceptDetails(cui, targetVocabularies);
  // Extract codes from target vocabularies
}
```

**API Call:** `getConceptDetails()` for each CUI with target vocabularies

**Special RxNorm/NDC Handling:**
```tsx
if (vocabulary === 'RXNORM' && targetVocabularies.includes('NDC')) {
  const ndcCodes = await getRxNormToNDC(rxcui, cui);
  const { doseForm, strength } = await getRxNormAttributes(cui, drugName);
}
```

**API Functions:**
1. **`getRxNormToNDC()`** (line 458) - Fetches NDC codes from two sources:
   - RxNav API: `https://rxnav.nlm.nih.gov/REST/rxcui/{rxcui}/ndcs.json`
   - UMLS Attributes: `/source/RXNORM/{rxcui}/attributes` + `/CUI/{cui}/attributes`

2. **`getRxNormAttributes()`** (line 680) - Parses drug name for dose form and strength

**Final Processing:**
- Deduplicates codes by vocabulary + code combination
- Groups codes by vocabulary
- Filters by selected dose forms (if RxNorm)
- Updates build data state

**State Updates:**
```tsx
setBuildData({
  rootNode: buildNode,
  allCodes: processedCodes,
  buildDomain: domainToUse,
  targetVocabularies
});
setBuildProgress(null); // Clear progress indicator
```

**Total API Calls for Build:**
- 1 call to find standard vocab code (if needed)
- N recursive calls to get descendants (where N = total nodes in hierarchy tree)
- 2M calls to convert source codes to CUIs (where M = number of descendants)
- P calls to fetch target vocabulary codes (where P = number of unique CUIs)
- For RxNorm drugs: 2-3 additional calls per drug for NDC codes and attributes

**Example for SNOMED code with 50 descendants building to ICD-10-CM:**
- 1 call (get standard vocab if needed)
- ~50 calls (recursive descendant fetching)
- ~100 calls (convert 50 codes to CUIs = 50×2)
- ~40 calls (fetch ICD-10-CM codes for 40 unique CUIs)
- **Total: ~191 API calls**

---

## State Management Architecture

**Primary State Variables:**
```tsx
const [searchTerm, setSearchTerm] = useState('');
const [results, setResults] = useState<UMLSSearchResult[]>([]);
const [selectedConcept, setSelectedConcept] = useState<any>(null);
const [hierarchyData, setHierarchyData] = useState<any>(null);
const [buildData, setBuildData] = useState<any>(null);
const [loading, setLoading] = useState(false);
const [buildProgress, setBuildProgress] = useState<{current, total, phase} | null>(null);
```

**State Determines Current View:**
```tsx
const getCurrentStep = () => {
  if (buildData) return 4;              // Build view
  if (hierarchyData) return 3;          // Hierarchy view
  if (selectedConcept) return 2;        // Atom details view
  if (results.length > 0) return 1;     // Search results
  return 0;                             // Initial search
};
```

**Navigation Between Steps:**
- Step 0 → 1: `handleSearch()` sets `results`
- Step 1 → 2: `handleViewDetails()` sets `selectedConcept`
- Step 2 → 3: `handleExploreHierarchy()` sets `hierarchyData`
- Step 3 → 4: `handleBuildFromHierarchyNode()` sets `buildData`

**Back Navigation:**
```tsx
const handleBackToSearch = () => {
  setSelectedConcept(null);
  setHierarchyData(null);
  setSelectedAtom(null);
};
```

---

## API Function Design Patterns in api.ts

### Pattern 1: Simple Single Request
```typescript
export async function searchUMLS(params: SearchUMLSRequest): Promise<SearchUMLSResponse> {
  // Build query params
  // Fetch from UMLS API
  // Transform response
  // Return typed response
}
```

### Pattern 2: Parallel Multi-Request
```typescript
export async function getConceptDetails(cui: string, vocabularies?: string[]): Promise<any> {
  const [conceptResponse, atomsResponse] = await Promise.all([
    fetch(conceptUrl),
    fetch(atomsUrl)
  ]);
  // Process both responses
  // Return combined data
}
```

### Pattern 3: Paginated Fetch with Loop
```typescript
export async function getDescendants(vocabulary: string, code: string): Promise<any[]> {
  let allDescendants: any[] = [];
  let pageNumber = 1;
  let hasMorePages = true;

  while (hasMorePages) {
    const response = await fetch(url + `&pageNumber=${pageNumber}`);
    allDescendants = allDescendants.concat(results);

    if (results.length < pageSize) hasMorePages = false;
    else pageNumber++;
  }

  return allDescendants;
}
```

### Pattern 4: Multi-Source Aggregation
```typescript
export async function getRxNormToNDC(rxcui: string, cui?: string): Promise<any[]> {
  const allNdcCodes: any[] = [];

  // Source 1: RxNav API
  const rxnavNdcs = await fetch(rxNavUrl);
  allNdcCodes.push(...rxnavNdcs);

  // Source 2: UMLS Attributes
  const attributeNdcs = await getRxNormAttributesNDC(rxcui, cui);
  allNdcCodes.push(...attributeNdcs);

  // Deduplicate and return
  return Array.from(new Set(allNdcCodes));
}
```

---

## Key Design Principles

### 1. Separation of Concerns
- **api.ts**: Pure API functions, no React hooks, no UI state
- **UMLSSearch.tsx**: UI orchestration, state management, user interaction handling

### 2. Progressive Disclosure
- User sees results immediately at each step
- Loading states provide feedback during long operations
- Progress indicators show multi-phase operations

### 3. Error Handling
- Try/catch at handler level
- User-friendly error messages via `setError()`
- Graceful degradation (continue on partial failures)

### 4. Performance Optimization
- Parallel API calls wherever possible (`Promise.all()`)
- Pagination for large result sets
- Deduplication to reduce redundant data
- Progress callbacks for user feedback

### 5. Domain-Specific Logic
- Vocabulary mapping (UMLS ↔ OMOP ↔ Display)
- Special RxNorm handling (RxNav API instead of UMLS)
- Build domain auto-detection from semantic types
- Standard vocabulary selection for comprehensive coverage

---

## API Call Summary Table

| User Action | Handler Function | API Function(s) | UMLS Endpoint(s) | # of Calls |
|-------------|------------------|-----------------|------------------|------------|
| Search | `handleSearch()` | `searchUMLS()` | `/search/2025AB` | 4 (parallel pages) |
| View Details | `handleViewDetails()` | `getConceptDetails()` | `/CUI/{cui}`, `/CUI/{cui}/atoms` | 2 (parallel) |
| Explore Hierarchy | `handleExploreHierarchy()` | `getAncestors()`, `getDescendants()` | `/source/{vocab}/{code}/ancestors`, `/source/{vocab}/{code}/descendants` | 2+ (parallel + pagination) |
| Re-explore | `handleReExploreHierarchy()` | `getAncestors()`, `getDescendants()` | Same as above | 2+ |
| Build Code Set | `handleBuildFromHierarchyNode()` | Multiple (see Phase 1-4 above) | Multiple endpoints | 100s (recursive + sequential) |
| RxNorm → NDC | (part of build) | `getRxNormToNDC()`, `getRxNormAttributes()` | RxNav API, UMLS attributes | 2-3 per drug |

---

## Conclusion

The application uses a **state-driven architecture** where:
1. User clicks trigger handler functions
2. Handlers call API functions from `api.ts`
3. API responses update React state
4. State changes trigger UI re-renders
5. Current step is determined by which state variables are populated

The most complex orchestration is the **Build Code Set** flow, which involves:
- Recursive hierarchy traversal
- Source code → CUI conversion (2 API calls per code)
- CUI → Target vocabulary mapping
- Special RxNorm/NDC handling
- Progress tracking across 100s of API calls

This design allows for **flexible navigation** (users can jump between views) while maintaining **clear data flow** (API → State → UI).
