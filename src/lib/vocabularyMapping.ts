// ============================================================================
// Vocabulary Mapping Utilities
// ============================================================================
// Maintains bidirectional mapping between:
// - vocabulary_id: OMOP-aligned names (for database and OMOP integration)
// - UI Display Names: User-facing vocabulary names
// - umls_vocabulary: UMLS API source abbreviations

export interface VocabularyMapping {
  vocabulary_id: string;      // OMOP-aligned name
  displayName: string;        // UI-friendly name
  umls_vocabulary: string;    // UMLS API source abbreviation
  description: string;
}

// Master vocabulary mapping table
export const VOCABULARY_MAPPINGS: VocabularyMapping[] = [
  {
    vocabulary_id: 'ICD10CM',
    displayName: 'ICD10CM',
    umls_vocabulary: 'ICD10CM',
    description: 'ICD-10 Clinical Modification',
  },
  {
    vocabulary_id: 'SNOMED',
    displayName: 'SNOMED',
    umls_vocabulary: 'SNOMEDCT_US',
    description: 'SNOMED CT US Edition',
  },
  {
    vocabulary_id: 'ICD9CM',
    displayName: 'ICD9CM',
    umls_vocabulary: 'ICD9CM',
    description: 'ICD-9 Clinical Modification',
  },
  {
    vocabulary_id: 'LOINC',
    displayName: 'LOINC',
    umls_vocabulary: 'LNC',
    description: 'Logical Observation Identifiers',
  },
  {
    vocabulary_id: 'CPT4',
    displayName: 'CPT4',
    umls_vocabulary: 'CPT',
    description: 'Current Procedural Terminology',
  },
  {
    vocabulary_id: 'HCPCS',
    displayName: 'HCPCS',
    umls_vocabulary: 'HCPCS',
    description: 'Healthcare Common Procedure Coding System',
  },
  {
    vocabulary_id: 'RxNorm',
    displayName: 'RxNorm',
    umls_vocabulary: 'RXNORM',
    description: 'RxNorm (Drugs)',
  },
  {
    vocabulary_id: 'NDC',
    displayName: 'NDC',
    umls_vocabulary: 'NDC',
    description: 'National Drug Code',
  },
  {
    vocabulary_id: 'CVX',
    displayName: 'CVX',
    umls_vocabulary: 'CVX',
    description: 'Vaccines Administered',
  },
  {
    vocabulary_id: 'ATC',
    displayName: 'ATC',
    umls_vocabulary: 'ATC',
    description: 'Anatomical Therapeutic Chemical',
  },
  {
    vocabulary_id: 'ICD9Proc',
    displayName: 'ICD9PCS',
    umls_vocabulary: 'ICD9CM',
    description: 'ICD-9 Procedure Codes',
  },
  {
    vocabulary_id: 'ICD10PCS',
    displayName: 'ICD10PCS',
    umls_vocabulary: 'ICD10PCS',
    description: 'ICD-10 Procedure Coding System',
  },
];

// Lookup maps for efficient conversion
const displayNameToMapping = new Map<string, VocabularyMapping>(
  VOCABULARY_MAPPINGS.map(v => [v.displayName, v])
);

const umlsToMapping = new Map<string, VocabularyMapping>(
  VOCABULARY_MAPPINGS.map(v => [v.umls_vocabulary, v])
);

const vocabularyIdToMapping = new Map<string, VocabularyMapping>(
  VOCABULARY_MAPPINGS.map(v => [v.vocabulary_id, v])
);

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert UI display name to UMLS vocabulary code for API calls
 * Example: "LOINC" -> "LNC"
 */
export function displayNameToUmls(displayName: string): string {
  const mapping = displayNameToMapping.get(displayName);
  if (!mapping) {
    console.warn(`Unknown display name: ${displayName}`);
    return displayName;
  }
  return mapping.umls_vocabulary;
}

/**
 * Convert UMLS vocabulary code to OMOP vocabulary_id for database storage
 * Example: "SNOMEDCT_US" -> "SNOMED"
 */
export function umlsToVocabularyId(umlsVocabulary: string): string {
  const mapping = umlsToMapping.get(umlsVocabulary);
  if (!mapping) {
    console.warn(`Unknown UMLS vocabulary: ${umlsVocabulary}`);
    return umlsVocabulary;
  }
  return mapping.vocabulary_id;
}

/**
 * Convert OMOP vocabulary_id to UMLS vocabulary for API calls
 * Example: "SNOMED" -> "SNOMEDCT_US"
 */
export function vocabularyIdToUmls(vocabularyId: string): string {
  const mapping = vocabularyIdToMapping.get(vocabularyId);
  if (!mapping) {
    console.warn(`Unknown vocabulary_id: ${vocabularyId}`);
    return vocabularyId;
  }
  return mapping.umls_vocabulary;
}

/**
 * Convert UMLS vocabulary to UI display name
 * Example: "LNC" -> "LOINC"
 */
export function umlsToDisplayName(umlsVocabulary: string): string {
  const mapping = umlsToMapping.get(umlsVocabulary);
  if (!mapping) {
    console.warn(`Unknown UMLS vocabulary: ${umlsVocabulary}`);
    return umlsVocabulary;
  }
  return mapping.displayName;
}

/**
 * Get full mapping details by display name
 */
export function getMappingByDisplayName(displayName: string): VocabularyMapping | undefined {
  return displayNameToMapping.get(displayName);
}

/**
 * Get full mapping details by UMLS vocabulary code
 */
export function getMappingByUmls(umlsVocabulary: string): VocabularyMapping | undefined {
  return umlsToMapping.get(umlsVocabulary);
}

/**
 * Get all display names for UI rendering (vocabulary filter buttons)
 */
export function getAllDisplayNames(): string[] {
  return VOCABULARY_MAPPINGS.map(v => v.displayName);
}

/**
 * Convert array of display names to UMLS codes for API request
 * Example: ["LOINC", "SNOMED"] -> ["LNC", "SNOMEDCT_US"]
 */
export function displayNamesToUmls(displayNames: string[]): string[] {
  return displayNames.map(displayNameToUmls);
}
