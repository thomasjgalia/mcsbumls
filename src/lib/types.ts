// ============================================================================
// Type Definitions for UMLS Code Set Builder
// ============================================================================

// UMLS Search Result from API
export interface UMLSSearchResult {
  ui: string;              // Unique identifier (CUI)
  name: string;            // Concept name
  rootSource: string;      // Root source vocabulary
  sources?: UMLSSource[];  // All vocabulary sources for this concept
  semanticTypes?: Array<{ name: string; uri: string }>;  // Semantic types (STY)
}

export interface UMLSSource {
  code: string;
  vocabulary: string;
  term: string;
  sourceConcept: string;
}

// UMLS Hierarchy/Relationship data
export interface UMLSRelationship {
  cui: string;
  name: string;
  relationshipLabel: string;  // e.g., "PAR" (parent), "CHD" (child)
  additionalRelationLabel?: string;
}

// UMLS Hierarchy Node (for ancestors/descendants)
export interface UMLSHierarchyNode {
  ui: string;              // AUI
  name: string;            // Term
  code?: string;           // Source code
  rootSource: string;      // Vocabulary
  relationLabel?: string;  // Relationship type (e.g., "PAR", "CHD")
}

// Code Set Management
export interface CodeSet {
  id: number;
  user_id: string;
  code_set_name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  total_concepts: number;
}

export interface CodeSetCode {
  id: number;
  code_set_id: number;
  cui: string;
  code: string;
  vocabulary_id: string;      // OMOP-aligned vocabulary name (e.g., "SNOMED", "RxNorm")
  umls_vocabulary: string;    // UMLS source abbreviation (e.g., "SNOMEDCT_US", "RXNORM")
  term: string;
  source_concept: string;
  code_url?: string;          // Original UMLS source URL (optional)
  created_at: string;
}

// API Request/Response Types
export interface SearchUMLSRequest {
  searchTerm: string;
  vocabularies?: string[];
  pageNumber?: number;
  pageSize?: number;
  sortBy?: 'relevance' | 'alphabetical';
}

export interface SearchUMLSResponse {
  success: boolean;
  data: UMLSSearchResult[];
  pageNumber: number;
  pageSize: number;
  total: number;
}

export interface GetHierarchyRequest {
  cui: string;
  source: string;
}

export interface GetHierarchyResponse {
  success: boolean;
  data: {
    parents: UMLSRelationship[];
    children: UMLSRelationship[];
  };
}

export interface SaveCodeSetRequest {
  code_set_name: string;
  description?: string;
  codes: Array<{
    cui: string;
    code: string;
    vocabulary_id: string;      // OMOP-aligned vocabulary name
    umls_vocabulary: string;    // UMLS source abbreviation
    term: string;
    source_concept: string;
    code_url?: string;          // Original UMLS source URL (optional)
  }>;
}

export interface SaveCodeSetResponse {
  success: boolean;
  data: {
    code_set_id: number;
  };
}

export interface GetCodeSetsResponse {
  success: boolean;
  data: CodeSet[];
}

export interface GetCodeSetDetailResponse {
  success: boolean;
  data: {
    code_set: CodeSet;
    codes: CodeSetCode[];
  };
}

// UI State Types
export interface ShoppingCartItem {
  cui: string;
  name: string;
  vocabulary_id: string;      // OMOP-aligned vocabulary name
  umls_vocabulary: string;    // UMLS source abbreviation
  code: string;
  term: string;
  source_concept: string;
  code_url?: string;          // Original UMLS source URL (optional)
}
