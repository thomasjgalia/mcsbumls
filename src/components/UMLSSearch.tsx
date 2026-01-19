import { useState, useEffect } from 'react';
import { Search, Loader2, GitBranch, CheckCircle2, ChevronDown, ChevronRight, Play, Download } from 'lucide-react';
import { searchUMLS, getConceptDetails, getAncestors, getDescendants, getRxNormToNDC, getRxNormAttributes } from '../lib/api';
import type { UMLSSearchResult } from '../lib/types';

// Vocabularies that support hierarchy navigation
const HIERARCHICAL_VOCABULARIES = [
  'SNOMEDCT_US',
  'ICD10CM',
  'ICD9CM',
  'RXNORM',
  'ATC',
  'LNC',
  'ICD10PCS'
];

// Standard vocabularies for each domain (following OMOP CDM standards)
// These vocabularies have the richest clinical hierarchies for their domains
const STANDARD_VOCABULARIES = {
  condition: 'SNOMEDCT_US',     // Most comprehensive clinical concepts
  drug: 'RXNORM',                // FDA-maintained drug terminology
  measurement: 'LNC',            // LOINC for lab/clinical observations
  procedure: 'SNOMEDCT_US',      // Clinical procedures
  observation: 'SNOMEDCT_US'     // General observations
};

// All vocabularies to search across (UMLS source abbreviations)
const ALL_SEARCH_VOCABULARIES = [
  'ICD10CM',
  'SNOMEDCT_US',
  'ICD9CM',
  'LNC',
  'CPT',
  'HCPCS',
  'RXNORM',
  'NDC',
  'CVX',
  'ATC',
  'ICD9PCS',
  'ICD10PCS'
];

// Domain to vocabulary mapping (used only for code set building)
const BUILD_DOMAIN_VOCABULARIES = {
  condition: ['ICD10CM', 'SNOMEDCT_US', 'ICD9CM'],
  observation: ['ICD10CM', 'SNOMEDCT_US', 'LNC', 'CPT', 'HCPCS'],
  drug: ['NDC', 'RXNORM', 'CPT', 'CVX', 'HCPCS', 'ATC'],
  measurement: ['LNC', 'CPT', 'SNOMEDCT_US', 'HCPCS'],
  procedure: ['CPT', 'HCPCS', 'SNOMEDCT_US', 'ICD9PCS', 'LNC', 'ICD10PCS']
};

// Display labels for build domains
const BUILD_DOMAIN_CONFIG = {
  condition: { label: 'Condition', icon: '🏥' },
  observation: { label: 'Observation', icon: '👁️' },
  drug: { label: 'Drug', icon: '💊' },
  measurement: { label: 'Measurement', icon: '📊' },
  procedure: { label: 'Procedure', icon: '⚕️' }
};

// Domain to vocabulary mapping for UI display/grouping
const DOMAIN_VOCABULARIES = {
  disease: ['SNOMEDCT_US', 'ICD10CM', 'ICD9CM'],
  drug: ['RXNORM', 'ATC', 'NDC'],
  lab: ['LNC'],
  procedure: ['CPT', 'HCPCS', 'ICD10PCS'],
  vaccine: ['CVX']
};

// Semantic type to build domain mapping
const SEMANTIC_TYPE_TO_BUILD_DOMAIN: Record<string, string> = {
  'T047': 'condition', // Disease or Syndrome
  'T046': 'condition', // Pathologic Function
  'T048': 'condition', // Mental or Behavioral Dysfunction
  'T191': 'condition', // Neoplastic Process
  'T200': 'drug',      // Clinical Drug
  'T121': 'drug',      // Pharmacologic Substance
  'T109': 'drug',      // Organic Chemical
  'T059': 'measurement', // Laboratory Procedure
  'T034': 'observation', // Laboratory or Test Result
  'T060': 'procedure', // Diagnostic Procedure
  'T061': 'procedure', // Therapeutic or Preventive Procedure
  'T062': 'procedure', // Research Activity
};

// Semantic type to domain mapping for UI display
const SEMANTIC_TYPE_TO_DOMAIN: Record<string, string> = {
  'T047': 'disease', // Disease or Syndrome
  'T046': 'disease', // Pathologic Function
  'T048': 'disease', // Mental or Behavioral Dysfunction
  'T191': 'disease', // Neoplastic Process
  'T200': 'drug',    // Clinical Drug
  'T121': 'drug',    // Pharmacologic Substance
  'T109': 'drug',    // Organic Chemical
  'T059': 'lab',     // Laboratory Procedure
  'T034': 'lab',     // Laboratory or Test Result
  'T060': 'procedure', // Diagnostic Procedure
  'T061': 'procedure', // Therapeutic or Preventive Procedure
};

// Domain display configuration for grouping atoms in UI
const DOMAIN_CONFIG = {
  disease: { label: 'Disease Codes', icon: '🏥', color: 'blue' },
  drug: { label: 'Medication Codes', icon: '💊', color: 'purple' },
  lab: { label: 'Lab Test Codes', icon: '🧪', color: 'green' },
  procedure: { label: 'Procedure Codes', icon: '⚕️', color: 'orange' },
  vaccine: { label: 'Vaccine Codes', icon: '💉', color: 'pink' }
};

export default function UMLSSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<UMLSSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<any>(null);
  const [selectedConcept, setSelectedConcept] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [hierarchyData, setHierarchyData] = useState<any>(null);
  const [loadingHierarchy, setLoadingHierarchy] = useState(false);
  const [selectedAtom, setSelectedAtom] = useState<any>(null);
  const [buildData, setBuildData] = useState<any>(null);
  const [loadingBuild, setLoadingBuild] = useState(false);
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'relevance' | 'alphabetical'>('relevance');
  const [selectedBuildDomain, setSelectedBuildDomain] = useState<keyof typeof BUILD_DOMAIN_VOCABULARIES>('condition');
  const [buildProgress, setBuildProgress] = useState<{current: number, total: number, phase: string} | null>(null);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [pendingBuildNode, setPendingBuildNode] = useState<any>(null);
  const [estimatedDescendants, setEstimatedDescendants] = useState<number>(0);
  const [showAncestors, setShowAncestors] = useState(false);
  const [showDescendants, setShowDescendants] = useState(false);
  const [buildFilterText, setBuildFilterText] = useState('');
  const [buildFilterVocabularies, setBuildFilterVocabularies] = useState<string[]>([]);

  // Determine current step based on state
  const getCurrentStep = () => {
    if (buildData) return 4; // Build view is active
    if (hierarchyData) return 3; // Hierarchy view is active
    if (selectedConcept) return 2; // Viewing atoms
    if (results.length > 0) return 1; // Search results shown
    return 0; // Initial search
  };

  const currentStep = getCurrentStep();

  // Filter build codes based on search text and vocabulary selection
  const getFilteredBuildCodes = () => {
    if (!buildData?.allCodes) return [];

    let filtered = [...buildData.allCodes];

    // Apply text filter (only if 3 or more characters)
    if (buildFilterText.trim().length >= 3) {
      const searchLower = buildFilterText.toLowerCase();
      filtered = filtered.filter((code: any) =>
        (code.cui || '').toLowerCase().includes(searchLower) ||
        (code.code || '').toLowerCase().includes(searchLower) ||
        (code.term || '').toLowerCase().includes(searchLower) ||
        (code.vocabulary || '').toLowerCase().includes(searchLower)
      );
    }

    // Apply vocabulary filter
    if (buildFilterVocabularies.length > 0) {
      filtered = filtered.filter((code: any) =>
        buildFilterVocabularies.includes(code.vocabulary)
      );
    }

    // Sort by Vocabulary first, then by Code
    return filtered.sort((a, b) => {
      const vocabCompare = (a.vocabulary || '').localeCompare(b.vocabulary || '');
      if (vocabCompare !== 0) return vocabCompare;
      return (a.code || '').localeCompare(b.code || '');
    });
  };

  // Get unique vocabularies from build data
  const getAvailableVocabularies = (): string[] => {
    if (!buildData?.allCodes) return [];
    const vocabs = new Set(buildData.allCodes.map((code: any) => code.vocabulary));
    return Array.from(vocabs).sort() as string[];
  };

  // Toggle vocabulary filter
  const toggleVocabularyFilter = (vocab: string) => {
    setBuildFilterVocabularies(prev =>
      prev.includes(vocab)
        ? prev.filter(v => v !== vocab)
        : [...prev, vocab]
    );
  };

  // Export filtered codes to tab-delimited .txt file
  const exportToTxt = () => {
    const filteredCodes = getFilteredBuildCodes();

    // Create tab-delimited content: Vocabulary [tab] Code
    const content = filteredCodes
      .map((code: any) => `${code.vocabulary}\t${code.code}`)
      .join('\n');

    // Create blob and download
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `code-set-${buildData?.rootNode?.ui || 'export'}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper: Get standard vocabulary for a domain
  const getStandardVocabularyForDomain = (domain: keyof typeof STANDARD_VOCABULARIES): string => {
    return STANDARD_VOCABULARIES[domain] || 'SNOMEDCT_US';
  };

  // Helper: Determine primary build domain from semantic types
  const determinePrimaryBuildDomain = (semanticTypes: any[]): keyof typeof BUILD_DOMAIN_VOCABULARIES => {
    if (!semanticTypes || semanticTypes.length === 0) return 'condition'; // default

    for (const st of semanticTypes) {
      const domain = SEMANTIC_TYPE_TO_BUILD_DOMAIN[st.uri?.split('/').pop() || ''];
      if (domain) return domain as keyof typeof BUILD_DOMAIN_VOCABULARIES;
    }
    return 'condition'; // fallback
  };

  // Helper: Determine primary domain from semantic types (for UI display)
  const determinePrimaryDomain = (semanticTypes: any[]): string => {
    if (!semanticTypes || semanticTypes.length === 0) return 'disease'; // default

    for (const st of semanticTypes) {
      const domain = SEMANTIC_TYPE_TO_DOMAIN[st.uri?.split('/').pop() || ''];
      if (domain) return domain;
    }
    return 'disease'; // fallback
  };

  // Vocabulary priority order for sorting
  const VOCAB_SORT_ORDER: Record<string, number> = {
    'SNOMEDCT_US': 1,
    'ICD10CM': 2,
    'ICD9CM': 3,
    'LNC': 4,
    'CPT': 5,
    'HCPCS': 6,
    'RXNORM': 7,
    'ATC': 8,
    'NDC': 9,
    'CVX': 10,
    'ICD10PCS': 11,
    'ICD9PCS': 12,
    'NDDF': 13
  };

  // Helper: Deduplicate and sort atoms
  const deduplicateAndSortAtoms = (atoms: any[]): any[] => {
    // Step 1: Deduplicate by code + vocabulary combination
    // Keep PT (Preferred Term) if available, otherwise keep first occurrence
    const uniqueAtoms = atoms.reduce((acc: Record<string, any>, atom: any) => {
      const key = `${atom.rootSource}-${atom.actualCode || atom.code}`;

      // Keep the first one, or prioritize PT > HT > FN > others
      if (!acc[key] || atom.termType === 'PT') {
        acc[key] = atom;
      }

      return acc;
    }, {});

    // Step 2: Sort by vocabulary priority
    return Object.values(uniqueAtoms).sort((a: any, b: any) => {
      const orderA = VOCAB_SORT_ORDER[a.rootSource] || 999;
      const orderB = VOCAB_SORT_ORDER[b.rootSource] || 999;
      return orderA - orderB;
    });
  };

  // Helper: Group atoms by domain
  const groupAtomsByDomain = (atoms: any[], semanticTypes: any[]) => {
    const primaryDomain = determinePrimaryDomain(semanticTypes);

    // First deduplicate and sort all atoms
    const processedAtoms = deduplicateAndSortAtoms(atoms);

    const grouped: Record<string, any[]> = {
      disease: [],
      drug: [],
      lab: [],
      procedure: [],
      vaccine: []
    };

    // Group atoms by their vocabulary's domain
    processedAtoms.forEach(atom => {
      const vocab = atom.rootSource;
      let assigned = false;

      for (const [domain, vocabs] of Object.entries(DOMAIN_VOCABULARIES)) {
        if (vocabs.includes(vocab)) {
          grouped[domain].push(atom);
          assigned = true;
          break;
        }
      }

      // If not assigned to any domain, put in primary domain
      if (!assigned) {
        grouped[primaryDomain].push(atom);
      }
    });

    // Filter out empty domains
    const nonEmptyDomains = Object.entries(grouped)
      .filter(([_, atoms]) => atoms.length > 0)
      .map(([domain, atoms]) => ({ domain, atoms }));

    return { grouped: nonEmptyDomains, primaryDomain };
  };

  // Toggle domain expansion
  const toggleDomain = (domain: string) => {
    const newExpanded = new Set(expandedDomains);
    if (newExpanded.has(domain)) {
      newExpanded.delete(domain);
    } else {
      newExpanded.add(domain);
    }
    setExpandedDomains(newExpanded);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchTerm.trim()) return;

    setLoading(true);
    setError(null);
    setRawResponse(null);

    try {
      // Search across all vocabularies
      console.log('[SEARCH] Searching for:', searchTerm.trim());
      const response = await searchUMLS({
        searchTerm: searchTerm.trim(),
        vocabularies: ALL_SEARCH_VOCABULARIES,
        pageSize: 50,
        sortBy: sortBy,
      });

      console.log('[SEARCH] Response:', response);
      setResults(response.data);
      setRawResponse(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Re-search when sort order changes
  useEffect(() => {
    if (results.length > 0 && searchTerm.trim()) {
      // Re-trigger search with new sort order
      const reSearch = async () => {
        setLoading(true);
        try {
          const response = await searchUMLS({
            searchTerm: searchTerm.trim(),
            vocabularies: ALL_SEARCH_VOCABULARIES,
            pageSize: 50,
            sortBy: sortBy,
          });
          setResults(response.data);
          setRawResponse(response);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Search failed');
        } finally {
          setLoading(false);
        }
      };
      reSearch();
    }
  }, [sortBy]);

  const handleViewDetails = async (cui: string) => {
    setLoadingDetails(true);
    setHierarchyData(null); // Clear previous hierarchy
    setSelectedAtom(null);
    setExpandedDomains(new Set()); // Reset expanded domains
    try {
      // Fetch atoms from all vocabularies
      const details = await getConceptDetails(cui, ALL_SEARCH_VOCABULARIES);
      setSelectedConcept(details);

      // Auto-expand primary domain
      if (details.concept.semanticTypes) {
        const primaryDomain = determinePrimaryDomain(details.concept.semanticTypes);
        setExpandedDomains(new Set([primaryDomain]));
      }
    } catch (err) {
      console.error('Failed to fetch concept details:', err);
      setError('Failed to load concept details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleBackToSearch = () => {
    setSelectedConcept(null);
    setHierarchyData(null);
    setSelectedAtom(null);
  };

  const handleExploreHierarchy = async (atom: any) => {
    setLoadingHierarchy(true);
    setSelectedAtom(atom);
    setError(null);

    try {
      const code = atom.actualCode || atom.code;
      const vocabulary = atom.rootSource;

      // Auto-detect appropriate build domain based on concept's semantic types
      if (selectedConcept?.concept?.semanticTypes) {
        const primaryBuildDomain = determinePrimaryBuildDomain(selectedConcept.concept.semanticTypes);
        setSelectedBuildDomain(primaryBuildDomain);
      }

      // Fetch ancestors and descendants in parallel
      const [ancestors, descendants] = await Promise.all([
        getAncestors(vocabulary, code),
        getDescendants(vocabulary, code)
      ]);

      setHierarchyData({
        atom,
        ancestors: ancestors.reverse(),  // Reverse to show broad → specific
        descendants
      });
    } catch (err) {
      console.error('Failed to fetch hierarchy:', err);
      setError('Failed to load hierarchy');
    } finally {
      setLoadingHierarchy(false);
    }
  };

  // Re-explore hierarchy from a hierarchy node (ancestor or descendant)
  const handleReExploreHierarchy = async (node: any, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click from firing
    setLoadingHierarchy(true);
    setError(null);

    try {
      // Use source code if available, otherwise fall back to AUI
      const code = node.code || node.ui;
      const vocabulary = node.rootSource;

      // Fetch ancestors and descendants for this node
      const [ancestors, descendants] = await Promise.all([
        getAncestors(vocabulary, code),
        getDescendants(vocabulary, code)
      ]);

      // Update hierarchy data with this node as the new anchor
      setHierarchyData({
        atom: {
          ui: node.ui,
          name: node.name,
          code: node.code || node.ui,
          actualCode: node.code || node.ui,
          rootSource: node.rootSource
        },
        ancestors: ancestors.reverse(),
        descendants
      });
    } catch (err) {
      console.error('Failed to re-explore hierarchy:', err);
      setError('Failed to load hierarchy');
    } finally {
      setLoadingHierarchy(false);
    }
  };

  // Estimate total descendants using breadth-first search (limited depth for estimation)
  const estimateDescendantCount = async (vocabulary: string, code: string): Promise<number> => {
    try {
      const immediateDescendants = await getDescendants(vocabulary, code);
      return immediateDescendants.length;
    } catch (err) {
      console.error(`Error estimating descendants for ${code}:`, err);
      return 0;
    }
  };

  // NEW: Recursively fetch ALL descendants using source-code descendants API
  // The descendants endpoint only returns immediate children, so we need to recurse
  const getAllDescendantsFromSourceCode = async (
    vocabulary: string,
    code: string,
    visited = new Set<string>(),
    onProgress?: (current: number, phase: string) => void
  ): Promise<Array<{vocabulary: string, code: string, term: string, termType?: string}>> => {
    // Special handling for RxNorm: NO RECURSION
    // RxNav API returns bidirectional relationships (SCD<->SBD) causing cycles
    // Just get all related codes in one call, no recursion needed
    if (vocabulary === 'RXNORM') {
      try {
        console.log(`[RXNORM FLAT] Fetching all related codes for ${code} (non-recursive)`);
        const immediateDescendants = await getDescendants(vocabulary, code);
        console.log(`[RXNORM FLAT] → Found ${immediateDescendants.length} related RxNorm codes`);

        return immediateDescendants.map(desc => ({
          vocabulary,
          code: desc.code || desc.ui,
          term: desc.name,
          termType: (desc as any).termType
        }));
      } catch (err) {
        console.error(`[RXNORM FLAT] Error fetching related codes:`, err);
        return [];
      }
    }

    // For other vocabularies, use recursive traversal
    // Avoid infinite loops
    if (visited.has(code)) {
      return [];
    }
    visited.add(code);

    try {
      console.log(`[RECURSIVE] Fetching descendants for ${vocabulary}/${code} (visited: ${visited.size} codes)`);

      if (onProgress) {
        onProgress(visited.size, `Fetching descendants (${visited.size} codes processed)...`);
      }

      // Get immediate descendants for this code
      const immediateDescendants = await getDescendants(vocabulary, code);
      console.log(`[RECURSIVE] → Found ${immediateDescendants.length} immediate descendants for ${code}`);

      // Log the structure of first descendant to debug
      if (immediateDescendants.length > 0) {
        console.log(`[RECURSIVE] → First descendant structure:`, immediateDescendants[0]);
      }

      const allDescendants: Array<{vocabulary: string, code: string, term: string, termType?: string}> = [];

      // Process each immediate descendant
      for (const desc of immediateDescendants) {
        // CRITICAL: Extract the actual source code from the descendant
        // For source-asserted identifiers API, the 'ui' field contains the actual source code
        // (e.g., SNOMED code "9468002", not an AUI)
        let descCode = desc.ui || desc.code;

        // If the code is a URL, extract the last part
        if (typeof descCode === 'string' && descCode.startsWith('http')) {
          const urlParts = descCode.split('/');
          descCode = urlParts[urlParts.length - 1];
          console.log(`[RECURSIVE] → Extracted code from URL: ${descCode}`);
        }

        const descTerm = desc.name;
        const descTermType = (desc as any).termType;

        if (!descCode) {
          console.warn(`[RECURSIVE] → Skipping descendant with no code:`, desc);
          continue;
        }

        // Skip if already visited
        if (visited.has(descCode)) {
          console.log(`[RECURSIVE] → Skipping already visited: ${descCode}`);
          continue;
        }

        console.log(`[RECURSIVE] → Processing descendant: ${descCode} - ${descTerm}`);

        // Add this descendant to results
        allDescendants.push({
          vocabulary,
          code: descCode,
          term: descTerm,
          termType: descTermType
        });

        // Recursively get descendants of this descendant (grandchildren, great-grandchildren, etc.)
        console.log(`[RECURSIVE] → Recursing into ${descCode} to find its children...`);
        const childDescendants = await getAllDescendantsFromSourceCode(
          vocabulary,
          descCode,
          visited,
          onProgress
        );

        console.log(`[RECURSIVE] → Got ${childDescendants.length} descendants from ${descCode}`);
        allDescendants.push(...childDescendants);
      }

      console.log(`[RECURSIVE] → Returning ${allDescendants.length} total descendants from ${code}`);
      return allDescendants;
    } catch (err) {
      console.error(`[RECURSIVE] Error fetching descendants for ${vocabulary}/${code}:`, err);
      return [];
    }
  };

  // Convert source codes to CUIs by fetching atom details
  const convertSourceCodesToCUIs = async (
    sourceCodes: Array<{vocabulary: string, code: string, term: string}>,
    onProgress?: (current: number, phase: string) => void
  ): Promise<Set<string>> => {
    const cuis = new Set<string>();
    const apiKey = import.meta.env.VITE_UMLS_API_KEY;

    for (let i = 0; i < sourceCodes.length; i++) {
      const {vocabulary, code} = sourceCodes[i];

      if (onProgress) {
        onProgress(i + 1, `Converting source codes to CUIs (${i + 1}/${sourceCodes.length})`);
      }

      try {
        // Fetch the source code to get its CUI
        const saiUrl = `https://uts-ws.nlm.nih.gov/rest/content/2025AB/source/${vocabulary}/${code}?apiKey=${apiKey}`;
        console.log(`[CUI CONVERT] Fetching source: ${vocabulary}/${code}`);
        const saiResponse = await fetch(saiUrl);

        if (saiResponse.ok) {
          const saiData = await saiResponse.json();
          const atomsUrl = saiData.result.atoms;
          console.log(`[CUI CONVERT] Atoms URL: ${atomsUrl}`);

          if (atomsUrl === 'NONE') {
            console.log(`[CUI CONVERT] No atoms for ${vocabulary}/${code}`);
            continue;
          }

          const atomsRequestUrl = `${atomsUrl}?apiKey=${apiKey}`;
          console.log(`[CUI CONVERT] Fetching atoms from: ${atomsRequestUrl.replace(apiKey, 'XXX')}`);
          const atomsResponse = await fetch(atomsRequestUrl);
          console.log(`[CUI CONVERT] Atoms response status: ${atomsResponse.status}`);

          if (atomsResponse.ok) {
            const atomsData = await atomsResponse.json();
            if (atomsData.result && atomsData.result.length > 0) {
              const firstAtom = atomsData.result[0];
              const conceptUri = firstAtom.concept;
              const cui = conceptUri?.split('/').pop();

              if (cui && cui.startsWith('C')) {
                console.log(`[CUI CONVERT] ✓ Found CUI: ${cui} for ${vocabulary}/${code}`);
                cuis.add(cui);
              }
            }
          } else {
            console.log(`[CUI CONVERT] Failed to fetch atoms: ${atomsResponse.status} ${atomsResponse.statusText}`);
          }
        } else {
          console.log(`[CUI CONVERT] Failed to fetch source: ${saiResponse.status} ${saiResponse.statusText}`);
        }
      } catch (error) {
        console.error(`Error converting ${vocabulary}/${code} to CUI:`, error);
      }
    }

    return cuis;
  };

  // OLD: Recursively fetch all descendants with progress tracking (DEPRECATED - use CUI-based approach)
  const getAllDescendantsRecursive = async (
    vocabulary: string,
    code: string,
    visited = new Set<string>(),
    onProgress?: (current: number, phase: string) => void
  ): Promise<any[]> => {
    // Avoid infinite loops
    if (visited.has(code)) {
      return [];
    }
    visited.add(code);

    try {
      const immediateDescendants = await getDescendants(vocabulary, code);
      let allDescendants = [...immediateDescendants];

      // Update progress
      if (onProgress) {
        onProgress(visited.size, 'Fetching hierarchy');
      }

      // Recursively fetch descendants of each child
      for (const descendant of immediateDescendants) {
        try {
          // CRITICAL: The 'ui' field in descendant nodes contains the source code (not AUI)
          // For SNOMED, it's the SNOMED code like "423279000"
          // This is ready to use directly for the next descendants API call
          const childCode = descendant.code || descendant.ui;

          console.log(`Recursing into child: ${childCode} (from ${code})`);
          const childDescendants = await getAllDescendantsRecursive(vocabulary, childCode, visited, onProgress);
          allDescendants = [...allDescendants, ...childDescendants];
        } catch (err) {
          console.error(`Error processing descendant ${descendant.ui}:`, err);
          // Continue with next descendant even if one fails
        }
      }

      return allDescendants;
    } catch (err) {
      console.error(`Error fetching descendants for ${code}:`, err);
      return [];
    }
  };

  // Helper: Auto-detect domain from vocabulary
  const getDomainFromVocabulary = (vocabulary: string): keyof typeof BUILD_DOMAIN_VOCABULARIES => {
    // Map vocabularies to their primary domains
    const vocabToDomain: Record<string, keyof typeof BUILD_DOMAIN_VOCABULARIES> = {
      'RXNORM': 'drug',
      'NDC': 'drug',
      'CVX': 'drug',
      'SNOMEDCT_US': 'condition',
      'ICD10CM': 'condition',
      'ICD9CM': 'condition',
      'LNC': 'measurement',
      'CPT': 'procedure',
      'HCPCS': 'procedure',
      'ICD10PCS': 'procedure',
      'ICD9PCS': 'procedure',
      'ATC': 'drug'
    };

    return vocabToDomain[vocabulary] || 'condition'; // default to condition if unknown
  };

  // Pre-flight check before building
  const handleBuildClick = async (node: any) => {
    // Use source code if available, otherwise fall back to AUI
    const code = node.code || node.ui;
    const vocabulary = hierarchyData.atom.rootSource;

    // Auto-detect domain from vocabulary
    const detectedDomain = getDomainFromVocabulary(vocabulary);

    // Show loading state while estimating
    setLoadingBuild(true);
    setError(null);

    try {
      // Estimate immediate descendants count
      const estimate = await estimateDescendantCount(vocabulary, code);
      setEstimatedDescendants(estimate);

      // Thresholds for warnings
      const WARNING_THRESHOLD = 100; // Warn if > 100 immediate descendants
      const DANGER_THRESHOLD = 500;  // Strong warning if > 500

      if (estimate > WARNING_THRESHOLD) {
        // Show warning modal
        setPendingBuildNode({ ...node, detectedDomain });
        setShowWarningModal(true);
        setLoadingBuild(false);
      } else {
        // Proceed directly with detected domain
        await handleBuildFromHierarchyNode(node, detectedDomain);
      }
    } catch (err) {
      console.error('Error estimating descendants:', err);
      setError('Failed to estimate code set size');
      setLoadingBuild(false);
    }
  };

  // Confirm and proceed with build after warning
  const confirmAndBuild = async () => {
    setShowWarningModal(false);
    if (pendingBuildNode) {
      const { detectedDomain, ...node } = pendingBuildNode;
      await handleBuildFromHierarchyNode(node, detectedDomain);
      setPendingBuildNode(null);
    }
  };

  // Cancel build
  const cancelBuild = () => {
    setShowWarningModal(false);
    setPendingBuildNode(null);
    setLoadingBuild(false);
  };

  const handleBuildFromHierarchyNode = async (node: any, buildDomain?: keyof typeof BUILD_DOMAIN_VOCABULARIES) => {
    setLoadingBuild(true);
    setError(null);
    setBuildProgress({ current: 0, total: 0, phase: 'Initializing...' });

    try {
      // Determine which domain vocabularies to filter by
      const domainToUse = buildDomain || selectedBuildDomain;
      const targetVocabularies = BUILD_DOMAIN_VOCABULARIES[domainToUse];

      // Get the standard vocabulary for this domain
      const standardVocab = getStandardVocabularyForDomain(domainToUse);

      let buildNode = node;
      let buildVocabulary = node.rootSource || hierarchyData.atom.rootSource;
      let buildCode = node.code || node.ui;

      // CRITICAL: If the selected node is NOT from the standard vocabulary,
      // we need to find the standard vocabulary atom for the same CUI
      if (buildVocabulary !== standardVocab) {
        console.log(`Selected vocabulary ${buildVocabulary} is not the standard (${standardVocab}). Looking for standard vocabulary atom...`);

        setBuildProgress({ current: 0, total: 0, phase: `Finding ${standardVocab} code for comprehensive coverage...` });

        try {
          // Get the CUI from selectedConcept if available
          const cui = selectedConcept?.concept?.ui;

          if (cui) {
            // Fetch atoms from the standard vocabulary for this CUI
            const conceptDetails = await getConceptDetails(cui, [standardVocab]);

            if (conceptDetails.atoms && conceptDetails.atoms.length > 0) {
              // Use the first atom from the standard vocabulary
              const standardAtom = conceptDetails.atoms[0];
              buildNode = {
                ui: standardAtom.ui,
                code: standardAtom.actualCode || standardAtom.code,
                name: standardAtom.name,
                rootSource: standardAtom.rootSource
              };
              buildVocabulary = standardAtom.rootSource;
              buildCode = standardAtom.actualCode || standardAtom.code;

              console.log(`✓ Found ${standardVocab} code: ${buildCode}`);
              console.log(`Building from ${standardVocab} code ${buildCode} for comprehensive coverage`);

              // Show user-friendly message
              setError(`Building from ${standardVocab} code ${buildCode} for comprehensive cross-vocabulary coverage`);
              setTimeout(() => setError(null), 3000); // Clear after 3 seconds
            } else {
              // No standard vocabulary code exists
              const errorMsg = `No ${standardVocab} code found for this concept. Cannot build comprehensive code set. Please select a different atom.`;
              setError(errorMsg);
              setLoadingBuild(false);
              setBuildProgress(null);
              return;
            }
          } else {
            console.warn('No CUI available to lookup standard vocabulary');
          }
        } catch (error) {
          console.error('Error finding standard vocabulary atom:', error);
          // Continue with original vocabulary if lookup fails
        }
      }

      console.log(`Starting build from ${buildVocabulary} code ${buildCode}`);

      console.log(`Building code set for domain: ${domainToUse}`);
      console.log(`Target vocabularies:`, targetVocabularies);

      // Step 1: Recursively fetch ALL descendants from the source vocabulary hierarchy
      setBuildProgress({ current: 0, total: 0, phase: 'Fetching descendants from hierarchy...' });

      const allDescendants = await getAllDescendantsFromSourceCode(
        buildVocabulary,
        buildCode,
        new Set(),
        (current: number, phase: string) => {
          setBuildProgress({ current, total: 0, phase });
        }
      );

      // Include the starting node itself
      const allSourceCodes = [
        { vocabulary: buildVocabulary, code: buildCode, term: buildNode.name },
        ...allDescendants
      ];

      console.log(`Found ${allSourceCodes.length} source codes in hierarchy (including root)`);

      // Step 2: Convert source codes to CUIs
      setBuildProgress({ current: 0, total: allSourceCodes.length, phase: 'Converting to CUIs...' });

      const cuis = await convertSourceCodesToCUIs(
        allSourceCodes,
        (current: number, phase: string) => {
          setBuildProgress({ current, total: allSourceCodes.length, phase });
        }
      );

      const allCUIs = Array.from(cuis);
      console.log(`Converted to ${allCUIs.length} unique CUIs`);

      // Step 3: Fetch atoms for all CUIs in target vocabularies
      const crossVocabResults: any[] = [];
      const totalCUIs = allCUIs.length;
      let processedCUIs = 0;

      setBuildProgress({
        current: 0,
        total: totalCUIs,
        phase: 'Fetching codes from target vocabularies...'
      });

      for (const cui of allCUIs) {
        try {
          // Get atoms ONLY from target domain vocabularies for this CUI
          const conceptDetails = await getConceptDetails(cui, targetVocabularies);

          // Add all atoms from this concept (already filtered by API)
          if (conceptDetails.atoms && conceptDetails.atoms.length > 0) {
            for (const atom of conceptDetails.atoms) {
              // Construct public UMLS browser URL instead of using REST API URL
              const publicUrl = `https://uts.nlm.nih.gov/uts/umls/concept/${cui}`;

              // Fetch RxNorm attributes by parsing the drug name
              let rxnormAttrs = {};
              if (atom.rootSource === 'RXNORM' || atom.rootSource === 'NDC') {
                rxnormAttrs = await getRxNormAttributes(cui, atom.name);
              }

              crossVocabResults.push({
                cui: cui,
                conceptName: conceptDetails.concept.name,
                aui: atom.ui,
                code: atom.actualCode || atom.code,
                vocabulary: atom.rootSource,
                term: atom.name,
                codeUrl: publicUrl,
                ...rxnormAttrs
              });
            }
          }

          // Update progress
          processedCUIs++;
          setBuildProgress({
            current: processedCUIs,
            total: totalCUIs,
            phase: `Processing ${processedCUIs}/${totalCUIs} concepts...`
          });
        } catch (error) {
          console.error(`Error processing CUI ${cui}:`, error);
          // Continue with next CUI even if one fails
        }
      }

      console.log(`Initial cross-vocabulary mapping: ${allCUIs.length} CUIs → ${crossVocabResults.length} codes`);

      // Step 4: EXPAND HIERARCHICALLY within target vocabularies
      // For each code found in target vocabularies, also get its descendants
      // This ensures we capture all granular codes (e.g., all G43.0xx codes under G43.0)
      setBuildProgress({
        current: 0,
        total: crossVocabResults.length,
        phase: 'Expanding hierarchies in target vocabularies...'
      });

      const hierarchicalExpansion: any[] = [];
      const processedCodesInExpansion = new Set<string>();

      for (let i = 0; i < crossVocabResults.length; i++) {
        const result = crossVocabResults[i];
        const codeKey = `${result.vocabulary}-${result.code}`;

        // Skip if already processed
        if (processedCodesInExpansion.has(codeKey)) {
          continue;
        }
        processedCodesInExpansion.add(codeKey);

        setBuildProgress({
          current: i + 1,
          total: crossVocabResults.length,
          phase: `Expanding ${i + 1}/${crossVocabResults.length} codes...`
        });

        // Only expand for hierarchical vocabularies
        if (HIERARCHICAL_VOCABULARIES.includes(result.vocabulary)) {
          try {
            console.log(`[HIERARCHY EXPAND] Getting descendants for ${result.vocabulary}/${result.code}`);

            // Get all descendants for this code in its vocabulary
            const descendants = await getAllDescendantsFromSourceCode(
              result.vocabulary,
              result.code,
              new Set()
            );

            console.log(`[HIERARCHY EXPAND] Found ${descendants.length} descendants for ${result.code}`);

            // Convert descendants to CUIs and fetch atoms
            for (const desc of descendants) {
              try {
                const descCodeKey = `${desc.vocabulary}-${desc.code}`;
                if (processedCodesInExpansion.has(descCodeKey)) {
                  continue;
                }
                processedCodesInExpansion.add(descCodeKey);

                // Get CUI for this descendant code
                const apiKey = import.meta.env.VITE_UMLS_API_KEY;
                const saiUrl = `https://uts-ws.nlm.nih.gov/rest/content/2025AB/source/${desc.vocabulary}/${desc.code}?apiKey=${apiKey}`;
                const saiResponse = await fetch(saiUrl);

                if (saiResponse.ok) {
                  const saiData = await saiResponse.json();
                  const atomsUrl = saiData.result.atoms;
                  const atomsResponse = await fetch(`${atomsUrl}?apiKey=${apiKey}`);

                  if (atomsResponse.ok) {
                    const atomsData = await atomsResponse.json();
                    if (atomsData.result && atomsData.result.length > 0) {
                      const firstAtom = atomsData.result[0];
                      const conceptUri = firstAtom.concept;
                      const descCui = conceptUri?.split('/').pop();

                      if (descCui && descCui.startsWith('C')) {
                        // Fetch concept details to get concept name
                        const descConceptDetails = await getConceptDetails(descCui, [desc.vocabulary]);

                        // Construct public UMLS browser URL
                        const publicUrl = `https://uts.nlm.nih.gov/uts/umls/concept/${descCui}`;

                        // Fetch RxNorm attributes by parsing the drug name if this is an RxNorm code
                        let rxnormAttrs = {};
                        if (desc.vocabulary === 'RXNORM') {
                          rxnormAttrs = await getRxNormAttributes(descCui, desc.term);
                        }

                        hierarchicalExpansion.push({
                          cui: descCui,
                          conceptName: descConceptDetails.concept.name,
                          code: desc.code,
                          vocabulary: desc.vocabulary,
                          term: desc.term,
                          termType: desc.termType,
                          codeUrl: publicUrl,
                          ...rxnormAttrs
                        });
                      }
                    }
                  }
                }
              } catch (error) {
                console.error(`Error expanding ${desc.vocabulary}/${desc.code}:`, error);
              }
            }
          } catch (error) {
            console.error(`Error getting descendants for ${result.vocabulary}/${result.code}:`, error);
          }
        }
      }

      console.log(`Hierarchical expansion added ${hierarchicalExpansion.length} additional codes`);

      // Combine initial results with hierarchical expansion
      let allCodesBeforeDedup = [...crossVocabResults, ...hierarchicalExpansion];

      // Step 5: Special RxNorm → NDC mapping (if NDC is in target vocabularies)
      if (targetVocabularies.includes('NDC')) {
        setBuildProgress({
          current: 0,
          total: 0,
          phase: 'Fetching NDC codes for RxNorm concepts...'
        });

        const ndcResults: any[] = [];
        const allRxnormCodes = allCodesBeforeDedup.filter(item => item.vocabulary === 'RXNORM');

        // Deduplicate RxNorm codes before fetching NDCs (to avoid fetching same RXCUI multiple times)
        const rxnormCodes = Array.from(
          new Map(allRxnormCodes.map(item => [item.code, item])).values()
        );

        console.log(`[NDC MAPPING] Found ${allRxnormCodes.length} RxNorm codes (${rxnormCodes.length} unique) to map to NDC`);

        let processedRxNorm = 0;
        for (const rxnormCode of rxnormCodes) {
          try {
            const ndcCodes = await getRxNormToNDC(rxnormCode.code, rxnormCode.cui);

            ndcCodes.forEach((ndc: any) => {
              // Construct UMLS URL for NDC code
              const ndcUrl = `https://uts.nlm.nih.gov/uts/umls/concept/${rxnormCode.cui}`;

              ndcResults.push({
                cui: rxnormCode.cui,
                conceptName: rxnormCode.conceptName,
                aui: ndc.ui,
                code: ndc.code,
                vocabulary: 'NDC',
                term: `${rxnormCode.term} [${ndc.code}]`,
                termType: rxnormCode.termType,
                doseForm: rxnormCode.doseForm,
                strength: rxnormCode.strength,
                ingredientCount: rxnormCode.ingredientCount,
                prescribable: rxnormCode.prescribable,
                codeUrl: ndcUrl,
                sourceRxcui: rxnormCode.code
              });
            });

            processedRxNorm++;
            setBuildProgress({
              current: processedRxNorm,
              total: rxnormCodes.length,
              phase: `Mapping RxNorm to NDC: ${processedRxNorm}/${rxnormCodes.length}...`
            });
          } catch (error) {
            console.error(`[NDC MAPPING] Error mapping RxNorm ${rxnormCode.code} to NDC:`, error);
          }
        }

        console.log(`[NDC MAPPING] Mapped ${rxnormCodes.length} RxNorm codes → ${ndcResults.length} NDC codes`);
        allCodesBeforeDedup = [...allCodesBeforeDedup, ...ndcResults];
      }

      // Remove duplicates by code+vocabulary combination
      console.log(`[DEDUP] Total codes before deduplication: ${allCodesBeforeDedup.length}`);
      console.log(`[DEDUP] Breakdown: ${crossVocabResults.length} initial + ${hierarchicalExpansion.length} hierarchical expansion + NDC codes`);

      const uniqueCodes = Array.from(
        new Map(allCodesBeforeDedup.map(item => [`${item.vocabulary}-${item.code}`, item])).values()
      );

      const duplicatesRemoved = allCodesBeforeDedup.length - uniqueCodes.length;
      console.log(`[DEDUP] Removed ${duplicatesRemoved} duplicate codes`);
      console.log(`Final result: ${allCUIs.length} CUIs → ${uniqueCodes.length} unique codes (${crossVocabResults.length} initial + ${hierarchicalExpansion.length} expanded - duplicates)`);

      // Show breakdown by vocabulary
      const vocabCounts = uniqueCodes.reduce((acc, code) => {
        acc[code.vocabulary] = (acc[code.vocabulary] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log(`[BREAKDOWN] Codes by vocabulary:`, vocabCounts);

      // Show all RxNorm codes for debugging
      const rxnormCodesList = uniqueCodes.filter(c => c.vocabulary === 'RXNORM');
      console.log(`[RXNORM CODES] All ${rxnormCodesList.length} RxNorm codes:`, rxnormCodesList.map(c => `${c.code}: ${c.term}`));

      setBuildProgress({
        current: uniqueCodes.length,
        total: uniqueCodes.length,
        phase: 'Complete!'
      });

      setBuildData({
        rootNode: buildNode,
        vocabulary: buildVocabulary,
        buildDomain: domainToUse,
        targetVocabularies,
        allCodes: uniqueCodes,
        totalCount: uniqueCodes.length,
        sourceHierarchyCount: allCUIs.length
      });
    } catch (err) {
      console.error('Failed to fetch all descendants:', err);
      setError('Failed to build code set');
    } finally {
      setLoadingBuild(false);
      setBuildProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step Navigation */}
      <div className="card">
        <div className="flex items-center justify-between">
          {/* Step 1: Search CUI */}
          <div className={`flex items-center gap-3 flex-1 rounded-lg p-2 -m-2 transition-colors ${
            currentStep === 0 ? 'bg-blue-100' : ''
          }`}>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm ${
              currentStep >= 0 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {currentStep > 0 ? <CheckCircle2 className="w-5 h-5" /> : '1'}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${currentStep >= 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                Search CUI
              </p>
              <p className="text-xs text-gray-500">Find concepts</p>
            </div>
          </div>

          {/* Connector */}
          <div className={`h-0.5 w-12 ${currentStep >= 1 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>

          {/* Step 2: Review Atoms */}
          <div className={`flex items-center gap-3 flex-1 rounded-lg p-2 -m-2 transition-colors ${
            currentStep === 2 ? 'bg-blue-100' : ''
          }`}>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm ${
              currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {currentStep > 2 ? <CheckCircle2 className="w-5 h-5" /> : '2'}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${currentStep >= 2 ? 'text-gray-900' : 'text-gray-400'}`}>
                Review Atoms
              </p>
              <p className="text-xs text-gray-500">View source codes</p>
            </div>
          </div>

          {/* Connector */}
          <div className={`h-0.5 w-12 ${currentStep >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>

          {/* Step 3: Hierarchy */}
          <div className={`flex items-center gap-3 flex-1 rounded-lg p-2 -m-2 transition-colors ${
            currentStep === 3 ? 'bg-blue-100' : ''
          }`}>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm ${
              currentStep >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {currentStep > 3 ? <CheckCircle2 className="w-5 h-5" /> : '3'}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${currentStep >= 3 ? 'text-gray-900' : 'text-gray-400'}`}>
                Hierarchy
              </p>
              <p className="text-xs text-gray-500">Explore relationships</p>
            </div>
          </div>

          {/* Connector */}
          <div className={`h-0.5 w-12 ${currentStep >= 4 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>

          {/* Step 4: Build */}
          <div className={`flex items-center gap-3 flex-1 rounded-lg p-2 -m-2 transition-colors ${
            currentStep === 4 ? 'bg-blue-100' : ''
          }`}>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm ${
              currentStep >= 4 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              4
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${currentStep >= 4 ? 'text-gray-900' : 'text-gray-400'}`}>
                Build
              </p>
              <p className="text-xs text-gray-500">Create code set</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Form - Only show when not viewing atoms or hierarchy */}
      {!selectedConcept && !hierarchyData && (
        <div className="card space-y-4">
          {/* Search Input */}
          <form onSubmit={handleSearch} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="UMLS Search (e.g., diabetes, acetaminophen)"
                  className="input pr-10 w-full"
                />
                <Search className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>

              <button
                type="submit"
                disabled={loading || !searchTerm.trim()}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {loading ? (
                  <>
                    <Loader2 className="inline h-4 w-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  'Search'
                )}
              </button>

              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setResults([]);
                    setRawResponse(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 whitespace-nowrap"
                >
                  Clear
                </button>
              )}
            </div>

            <p className="text-xs text-gray-600">
              <strong>Searching across:</strong> {ALL_SEARCH_VOCABULARIES.join(', ')}
            </p>
          </form>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="card bg-red-50 border border-red-200">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Results Table - Only show if no concept is selected */}
      {results.length > 0 && !selectedConcept && !hierarchyData && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              Results ({results.length})
            </h3>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'relevance' | 'alphabetical')}
              className="text-sm border border-gray-300 rounded px-3 py-1.5 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="relevance">Sort: Relevance</option>
              <option value="alphabetical">Sort: Alphabetical</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="text-left py-1 px-2 font-semibold text-gray-700 text-sm">Concept Unique Identifier</th>
                  <th className="text-left py-1 px-2 font-semibold text-gray-700 text-sm">Concept Name</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr
                    key={result.ui}
                    onClick={() => handleViewDetails(result.ui)}
                    className="border-b border-gray-100 hover:bg-green-50 transition-colors cursor-pointer"
                  >
                    <td className="py-1.5 px-2 font-mono text-xs text-gray-600">
                      {result.ui}
                    </td>
                    <td className="py-1.5 px-2 text-sm text-gray-900">
                      {result.name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Concept Details */}
      {selectedConcept && !hierarchyData && (
        <div id="concept-details" className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Atom Details for CUI: {selectedConcept.concept.ui}</h3>
              <p className="text-sm text-gray-600 mt-1">
                Select the atom closest to the starting point of your desired code set to review its hierarchy.
              </p>
            </div>
            <button
              onClick={handleBackToSearch}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to CUI Search Results
            </button>
          </div>

          <div className="space-y-4">
            {/* Concept Info - Compact */}
            <div className="bg-gray-50 p-3 rounded-md text-sm">
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <p><strong>Name:</strong> {selectedConcept.concept.name}</p>
                {selectedConcept.concept.semanticTypes && (
                  <p><strong>Semantic Types:</strong> {selectedConcept.concept.semanticTypes.map((st: any) => st.name).join(', ')}</p>
                )}
              </div>
            </div>

            {/* Atoms (Source Codes) - Grouped by Domain */}
            {selectedConcept.atoms && selectedConcept.atoms.length > 0 && (() => {
              const { grouped, primaryDomain } = groupAtomsByDomain(
                selectedConcept.atoms,
                selectedConcept.concept.semanticTypes || []
              );

              return (
                <div className="space-y-3">
                  {grouped.map(({ domain, atoms }) => {
                    const config = DOMAIN_CONFIG[domain as keyof typeof DOMAIN_CONFIG];
                    const isExpanded = expandedDomains.has(domain);
                    const isPrimary = domain === primaryDomain;

                    return (
                      <div key={domain} className="border border-gray-200 rounded-md">
                        {/* Domain Header - Clickable */}
                        <button
                          onClick={() => toggleDomain(domain)}
                          className="w-full flex items-center justify-between p-2 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-500" />
                            )}
                            <span className="text-lg">{config.icon}</span>
                            <span className="font-semibold text-gray-900 text-sm">
                              {config.label}
                            </span>
                            <span className="text-xs text-gray-500">
                              ({atoms.length} {atoms.length === 1 ? 'code' : 'codes'})
                            </span>
                            {isPrimary && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                Primary
                              </span>
                            )}
                          </div>
                        </button>

                        {/* Domain Content - Collapsible */}
                        {isExpanded && (
                          <div className="border-t border-gray-200">
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse text-sm">
                                <thead>
                                  <tr className="border-b border-gray-200 bg-gray-50">
                                    <th className="text-left py-1 px-2 font-semibold text-gray-700 text-xs">Code</th>
                                    <th className="text-left py-1 px-2 font-semibold text-gray-700 text-xs">Vocabulary</th>
                                    <th className="text-left py-1 px-2 font-semibold text-gray-700 text-xs">Term</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {atoms.map((atom: any, idx: number) => {
                                    const supportsHierarchy = HIERARCHICAL_VOCABULARIES.includes(atom.rootSource);
                                    const standardVocab = getStandardVocabularyForDomain(domain as keyof typeof STANDARD_VOCABULARIES);
                                    const isStandard = atom.rootSource === standardVocab;
                                    return (
                                      <tr
                                        key={idx}
                                        onClick={() => supportsHierarchy && handleExploreHierarchy(atom)}
                                        className={`border-b border-gray-100 ${
                                          supportsHierarchy
                                            ? 'hover:bg-green-100 transition-colors cursor-pointer'
                                            : 'opacity-50 cursor-not-allowed'
                                        }`}
                                      >
                                        <td className="py-1.5 px-2 font-mono text-xs">{atom.actualCode || atom.code}</td>
                                        <td className="py-1.5 px-2">
                                          <div className="flex items-center gap-1">
                                            <span className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded">
                                              {atom.rootSource}
                                            </span>
                                            {isStandard && (
                                              <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded font-semibold">
                                                Standard
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="py-1.5 px-2 text-sm">{atom.name}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <p className="text-xs text-gray-600 italic">
                    Total: {selectedConcept.atoms.length} atoms across {grouped.length} {grouped.length === 1 ? 'domain' : 'domains'}
                    {selectedConcept.atoms.length > 100 && ' (showing first 100)'}
                  </p>
                </div>
              );
            })()}

            {/* Raw Details */}
            <details>
              <summary className="cursor-pointer font-semibold text-gray-700 hover:text-gray-900">
                Raw Concept Data (for development)
              </summary>
              <pre className="mt-4 p-4 bg-gray-50 rounded-md overflow-auto text-xs">
                {JSON.stringify(selectedConcept, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      )}

      {/* Hierarchy View */}
      {hierarchyData && !buildData && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Hierarchy View</h3>
            <button
              onClick={() => setHierarchyData(null)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to Atoms
            </button>
          </div>

          <div className="space-y-4">
            {/* Ancestors - Collapsible (Default Collapsed) */}
            <div>
              <button
                onClick={() => setShowAncestors(!showAncestors)}
                className="flex items-center gap-2 w-full text-left font-semibold text-gray-900 hover:text-gray-700 transition-colors"
              >
                {showAncestors ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <span>Ancestors (Parents) - {hierarchyData.ancestors?.length || 0} found</span>
                <span className="text-xs text-gray-500 font-normal ml-2">Click to expand/collapse</span>
              </button>

              {showAncestors && hierarchyData.ancestors && hierarchyData.ancestors.length > 0 && (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-gray-300">
                        <th className="text-left py-1 px-2 font-semibold text-gray-700 text-sm">Code</th>
                        <th className="text-left py-1 px-2 font-semibold text-gray-700 text-sm">Name</th>
                        <th className="text-left py-1 px-2 font-semibold text-gray-700 text-sm">Vocabulary</th>
                        <th className="text-center py-1 px-2 font-semibold text-gray-700 text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hierarchyData.ancestors.map((ancestor: any, idx: number) => (
                        <tr
                          key={idx}
                          onClick={() => handleBuildClick(ancestor)}
                          className="border-b border-gray-100 hover:bg-green-50 transition-colors cursor-pointer"
                        >
                          <td className="py-1.5 px-2 font-mono text-xs">{ancestor.ui}</td>
                          <td className="py-1.5 px-2 text-sm">{ancestor.name}</td>
                          <td className="py-1.5 px-2">
                            <span className="inline-block bg-gray-100 text-gray-800 text-xs px-2 py-0.5 rounded">
                              {ancestor.rootSource}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <button
                              onClick={(e) => handleReExploreHierarchy(ancestor, e)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                              title="Re-anchor hierarchy from this code"
                            >
                              <GitBranch className="w-3 h-3" />
                              Re-anchor
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {showAncestors && hierarchyData.ancestors && hierarchyData.ancestors.length === 0 && (
                <div className="mt-2 text-sm text-gray-600 italic">
                  No ancestors found (this may be a root concept)
                </div>
              )}
            </div>

            {/* Anchor Code */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Anchor Code</h4>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-300">
                      <th className="text-left py-1 px-2 font-semibold text-gray-700 text-sm">Code</th>
                      <th className="text-left py-1 px-2 font-semibold text-gray-700 text-sm">Name</th>
                      <th className="text-left py-1 px-2 font-semibold text-gray-700 text-sm">Vocabulary</th>
                      <th className="text-center py-1 px-2 font-semibold text-gray-700 text-sm">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100 bg-blue-50">
                      <td className="py-1.5 px-2 font-mono text-xs font-semibold">{hierarchyData.atom.actualCode || hierarchyData.atom.code}</td>
                      <td className="py-1.5 px-2 text-sm font-semibold">{hierarchyData.atom.name}</td>
                      <td className="py-1.5 px-2">
                        <span className="inline-block bg-blue-600 text-white text-xs px-2 py-0.5 rounded font-semibold">
                          {hierarchyData.atom.rootSource}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <button
                          onClick={() => handleBuildClick({
                            ui: hierarchyData.atom.ui,
                            code: hierarchyData.atom.actualCode || hierarchyData.atom.code,
                            name: hierarchyData.atom.name,
                            rootSource: hierarchyData.atom.rootSource
                          })}
                          className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                        >
                          <Play className="w-4 h-4" />
                          Build Code Set
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Descendants - Collapsible (Default Collapsed) */}
            <div>
              <button
                onClick={() => setShowDescendants(!showDescendants)}
                className="flex items-center gap-2 w-full text-left font-semibold text-gray-900 hover:text-gray-700 transition-colors"
              >
                {showDescendants ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <span>Descendants (Children) - {hierarchyData.descendants?.length || 0} found</span>
                <span className="text-xs text-gray-500 font-normal ml-2">Click to expand/collapse</span>
              </button>

              {showDescendants && hierarchyData.descendants && hierarchyData.descendants.length > 0 && (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-gray-300">
                        <th className="text-left py-1 px-2 font-semibold text-gray-700 text-sm">Code</th>
                        <th className="text-left py-1 px-2 font-semibold text-gray-700 text-sm">Name</th>
                        <th className="text-left py-1 px-2 font-semibold text-gray-700 text-sm">Vocabulary</th>
                        <th className="text-center py-1 px-2 font-semibold text-gray-700 text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hierarchyData.descendants.map((descendant: any, idx: number) => (
                        <tr
                          key={idx}
                          onClick={() => handleBuildClick(descendant)}
                          className="border-b border-gray-100 hover:bg-green-50 transition-colors cursor-pointer"
                        >
                          <td className="py-1.5 px-2 font-mono text-xs">{descendant.ui}</td>
                          <td className="py-1.5 px-2 text-sm">{descendant.name}</td>
                          <td className="py-1.5 px-2">
                            <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">
                              {descendant.rootSource}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <button
                              onClick={(e) => handleReExploreHierarchy(descendant, e)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                              title="Re-anchor hierarchy from this code"
                            >
                              <GitBranch className="w-3 h-3" />
                              Re-anchor
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {showDescendants && hierarchyData.descendants && hierarchyData.descendants.length === 0 && (
                <div className="mt-2 text-sm text-gray-600 italic">
                  No descendants found (this may be a leaf concept)
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Build View */}
      {buildData && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Build Code Set</h3>
            <button
              onClick={() => {
                setBuildData(null);
                setBuildFilterText('');
                setBuildFilterVocabularies([]);
              }}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to Hierarchy
            </button>
          </div>

          <div className="space-y-4">
            {/* Build Info */}
            <div className="bg-green-50 p-3 rounded-md border border-green-200 text-sm space-y-2">
              {/* Header with Export Button */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex flex-wrap gap-x-6 gap-y-1 flex-1">
                  <p><strong>Root Code:</strong> <span className="font-mono">{buildData.rootNode.ui}</span></p>
                  <p><strong>Source Vocabulary:</strong> <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs">{buildData.vocabulary}</span></p>
                  <p><strong>Root Term:</strong> {buildData.rootNode.name}</p>
                </div>
                {!loadingBuild && (
                  <button
                    onClick={exportToTxt}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export to .txt file
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <p><strong>Medical Domain:</strong> {BUILD_DOMAIN_CONFIG[buildData.buildDomain as keyof typeof BUILD_DOMAIN_CONFIG]?.icon} {BUILD_DOMAIN_CONFIG[buildData.buildDomain as keyof typeof BUILD_DOMAIN_CONFIG]?.label}</p>
                {buildData.sourceHierarchyCount && (
                  <p><strong>Hierarchy Concepts:</strong> {buildData.sourceHierarchyCount}</p>
                )}
                <p><strong>Total Codes:</strong> {buildData.totalCount}</p>
              </div>
              <div>
                <p className="text-xs"><strong>Included Vocabularies:</strong> {buildData.targetVocabularies?.join(', ')}</p>
              </div>

              {/* Filters Section */}
              {!loadingBuild && (
                <div className="border-t border-green-300 pt-2 mt-2 space-y-1.5">
                  {/* Quick Filters - All on one line */}
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs font-semibold text-gray-900 whitespace-nowrap">
                      Quick Filters:
                    </label>
                    <label className="text-xs font-medium text-gray-700 whitespace-nowrap">
                      Dynamic Filter
                    </label>
                    <div className="relative" style={{ width: '240px' }}>
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={buildFilterText}
                        onChange={(e) => setBuildFilterText(e.target.value)}
                        placeholder="Search... (3+ chars)"
                        maxLength={30}
                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 bg-white rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                    {/* Vocabulary Filter Buttons on same line */}
                    {getAvailableVocabularies().map((vocab: string) => (
                      <button
                        key={vocab}
                        onClick={() => toggleVocabularyFilter(vocab)}
                        className={`text-xs px-2 py-1 rounded transition-colors ${
                          buildFilterVocabularies.includes(vocab)
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {vocab}
                      </button>
                    ))}
                    {buildFilterVocabularies.length > 0 && (
                      <button
                        onClick={() => setBuildFilterVocabularies([])}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Clear vocabulary filter
                      </button>
                    )}
                  </div>

                  {buildFilterText.length > 0 && buildFilterText.length < 3 && (
                    <p className="text-xs text-gray-500">Enter at least 3 characters to filter</p>
                  )}
                </div>
              )}
            </div>

            {loadingBuild && (
              <div className="space-y-4">
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <span className="ml-3 text-gray-600">
                    {buildProgress ? buildProgress.phase : 'Fetching descendants and cross-walking vocabularies...'}
                  </span>
                </div>
                {buildProgress && buildProgress.total > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Progress: {buildProgress.current} / {buildProgress.total}</span>
                      <span>{Math.round((buildProgress.current / buildProgress.total) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(buildProgress.current / buildProgress.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* All Codes Table */}
            {!loadingBuild && buildData.allCodes && buildData.allCodes.length > 0 && (() => {
              const filteredCodes = getFilteredBuildCodes();
              // Check if this build contains any drug codes (RxNorm or NDC)
              const hasDrugCodes = buildData.allCodes.some((code: any) =>
                code.vocabulary === 'RXNORM' || code.vocabulary === 'NDC'
              );

              return (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">
                    All Codes Across Vocabularies ({filteredCodes.length} of {buildData.allCodes.length} total)
                  </h4>
                  {filteredCodes.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>No codes match the current filters.</p>
                      <button
                        onClick={() => {
                          setBuildFilterText('');
                          setBuildFilterVocabularies([]);
                        }}
                        className="text-sm text-blue-600 hover:text-blue-800 mt-2"
                      >
                        Clear all filters
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-gray-300">
                            <th className="text-left py-1 px-2 font-semibold text-gray-700 text-xs">CUI</th>
                            <th className="text-left py-1 px-2 font-semibold text-gray-700 text-xs">Code</th>
                            <th className="text-left py-1 px-2 font-semibold text-gray-700 text-xs">Vocabulary</th>
                            <th className="text-left py-1 px-2 font-semibold text-gray-700 text-xs">Term</th>
                            {hasDrugCodes && (
                              <th className="text-left py-1 px-2 font-semibold text-gray-700 text-xs">Form</th>
                            )}
                            <th className="text-left py-1 px-2 font-semibold text-gray-700 text-xs">URL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCodes.map((code: any, idx: number) => (
                          <tr key={idx} className="border-b border-gray-100">
                            <td className="py-1.5 px-2 font-mono text-xs text-gray-600">{code.cui}</td>
                            <td className="py-1.5 px-2 font-mono text-xs">{code.code}</td>
                            <td className="py-1.5 px-2">
                              <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                                {code.vocabulary}
                              </span>
                            </td>
                            <td className="py-1.5 px-2 text-xs">{code.term}</td>
                            {hasDrugCodes && (
                              <td className="py-1.5 px-2 text-xs">
                                {code.doseForm ? (
                                  <span className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded">
                                    {code.doseForm}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 italic">-</span>
                                )}
                              </td>
                            )}
                            <td className="py-1.5 px-2 text-xs">
                              {code.codeUrl ? (
                                <a
                                  href={code.codeUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 hover:underline"
                                  title="Open in UMLS Browser"
                                >
                                  🔗 View
                                </a>
                              ) : (
                                <span className="text-gray-400 italic">-</span>
                              )}
                            </td>
                          </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Raw Response Inspector */}
      {rawResponse && (
        <details className="card">
          <summary className="cursor-pointer font-semibold text-gray-700 hover:text-gray-900">
            Raw Search Response (for development)
          </summary>
          <pre className="mt-4 p-4 bg-gray-50 rounded-md overflow-auto text-xs">
            {JSON.stringify(rawResponse, null, 2)}
          </pre>
        </details>
      )}

      {/* Warning Modal for Large Code Sets */}
      {showWarningModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              ⚠️ Large Code Set Warning
            </h3>
            <div className="space-y-3 text-sm text-gray-700">
              <p>
                This code has <strong>{estimatedDescendants} immediate descendants</strong> in the hierarchy.
              </p>
              <p>
                The total number of codes (including all nested descendants and cross-vocabulary mapping) could be <strong>significantly larger</strong>.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-xs">
                <p className="font-semibold text-yellow-900 mb-1">Estimated Processing:</p>
                <ul className="list-disc list-inside space-y-1 text-yellow-800">
                  {estimatedDescendants > 500 && (
                    <li>This may take several minutes to complete</li>
                  )}
                  {estimatedDescendants > 1000 && (
                    <li>Very large dataset - potential for 10,000+ final codes</li>
                  )}
                  <li>Multiple API calls will be made</li>
                  <li>You'll see progress updates during the build</li>
                </ul>
              </div>
              <p className="font-medium text-gray-900">
                Are you sure you want to continue?
              </p>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={cancelBuild}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmAndBuild}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Build Loading Modal */}
      {loadingBuild && !buildData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-center mb-4">
              <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 text-center">
              Building Code Set
            </h3>
            <div className="space-y-3 text-sm text-gray-700">
              <p className="text-center">
                Calling UMLS API to build code set. This could take up to a few minutes with large code sets.
              </p>
              {buildProgress && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <p className="font-semibold text-blue-900 text-xs mb-2">
                    {buildProgress.phase}
                  </p>
                  {buildProgress.total > 0 && (
                    <div className="space-y-1">
                      <div className="w-full bg-blue-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${(buildProgress.current / buildProgress.total) * 100}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-blue-800 text-center">
                        {buildProgress.current} / {buildProgress.total}
                      </p>
                    </div>
                  )}
                </div>
              )}
              <p className="text-xs text-gray-500 text-center italic">
                Please wait while we process your request...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Building Hierarchy Loading Modal */}
      {loadingHierarchy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-center mb-4">
              <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 text-center">
              Building Hierarchy
            </h3>
            <p className="text-sm text-gray-600 text-center mt-2">
              Fetching ancestors and descendants...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
