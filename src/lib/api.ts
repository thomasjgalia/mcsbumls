// ============================================================================
// API Client for UMLS Code Set Builder
// ============================================================================
import type {
  SearchUMLSRequest,
  SearchUMLSResponse,
  GetHierarchyRequest,
  GetHierarchyResponse,
  SaveCodeSetRequest,
  SaveCodeSetResponse,
  GetCodeSetsResponse,
  GetCodeSetDetailResponse,
} from './types';

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:5173';

// UMLS Search - Multi-page fetch with sorting
export async function searchUMLS(params: SearchUMLSRequest): Promise<SearchUMLSResponse> {
  const apiKey = import.meta.env.VITE_UMLS_API_KEY;

  if (!apiKey || apiKey === 'your_umls_api_key_here') {
    throw new Error('UMLS API key not configured. Please add your API key to .env file.');
  }

  const pageSize = 75; // Fetch 75 per page
  const maxPages = 4;  // Fetch 4 pages = 300 total results

  // Fetch multiple pages in parallel
  const pagePromises = [];
  for (let page = 1; page <= maxPages; page++) {
    const queryParams = new URLSearchParams({
      string: params.searchTerm,
      apiKey: apiKey,
      pageSize: String(pageSize),
      pageNumber: String(page),
    });

    // Add vocabulary filters if provided
    if (params.vocabularies && params.vocabularies.length > 0) {
      queryParams.append('sabs', params.vocabularies.join(','));
    }

    pagePromises.push(
      fetch(`https://uts-ws.nlm.nih.gov/rest/search/current?${queryParams.toString()}`)
        .then(response => {
          if (!response.ok) {
            throw new Error(`UMLS search failed: ${response.statusText}`);
          }
          return response.json();
        })
    );
  }

  // Wait for all pages to complete
  const responses = await Promise.all(pagePromises);

  // Combine all results
  let allResults: any[] = [];
  responses.forEach(data => {
    if (data.result?.results) {
      allResults = allResults.concat(data.result.results);
    }
  });

  // Filter out "NO RESULTS" markers and transform
  let transformedResults = allResults
    .filter((r: any) => r.ui !== 'NONE')
    .map((result: any) => ({
      ui: result.ui,
      name: result.name,
      rootSource: result.rootSource,
      uri: result.uri,
    }));

  // Remove duplicates by CUI (ui field)
  const uniqueResults = Array.from(
    new Map(transformedResults.map(item => [item.ui, item])).values()
  );

  // Sort results based on preference
  if (params.sortBy === 'alphabetical') {
    uniqueResults.sort((a, b) => a.name.localeCompare(b.name));
  }
  // If 'relevance' or undefined, keep API's default order

  return {
    success: true,
    data: uniqueResults,
    pageNumber: 1,
    pageSize: uniqueResults.length,
    total: uniqueResults.length,
  };
}

// Get detailed concept information including atoms (source codes)
export async function getConceptDetails(cui: string, vocabularies?: string[]): Promise<any> {
  const apiKey = import.meta.env.VITE_UMLS_API_KEY;

  if (!apiKey || apiKey === 'your_umls_api_key_here') {
    throw new Error('UMLS API key not configured.');
  }

  // Default vocabularies (includes all supported vocabularies for general browsing)
  const defaultVocabs = 'SNOMEDCT_US,ICD10CM,ICD9CM,RXNORM,LNC,CPT,HCPCS,NDC,CVX,ICD10PCS,ATC';
  const vocabFilter = vocabularies && vocabularies.length > 0 ? vocabularies.join(',') : defaultVocabs;

  try {
    // Fetch concept details and atoms in parallel
    // IMPORTANT: includeSuppressible=true AND includeObsolete=true to get ALL codes
    // - Suppressible codes: category codes, unspecified codes that UMLS marks as redundant
    // - Obsolete codes: deprecated codes that may still appear in historical data
    const [conceptResponse, atomsResponse] = await Promise.all([
      fetch(`https://uts-ws.nlm.nih.gov/rest/content/current/CUI/${cui}?apiKey=${apiKey}`),
      fetch(`https://uts-ws.nlm.nih.gov/rest/content/current/CUI/${cui}/atoms?apiKey=${apiKey}&sabs=${vocabFilter}&pageSize=100&includeSuppressible=true&includeObsolete=true`)
    ]);

    if (!conceptResponse.ok || !atomsResponse.ok) {
      throw new Error('Failed to fetch concept details');
    }

    const [conceptData, atomsData] = await Promise.all([
      conceptResponse.json(),
      atomsResponse.json()
    ]);

    // Process atoms to extract actual codes from URLs
    const processedAtoms = (atomsData.result || []).map((atom: any) => {
      // Extract code from URL if code field is a URL
      let actualCode = atom.code;
      let codeUrl = null;

      if (typeof atom.code === 'string' && atom.code.startsWith('http')) {
        // Store original URL for reference
        codeUrl = atom.code;
        // Extract the last part of the URL which is usually the code
        const urlParts = atom.code.split('/');
        actualCode = urlParts[urlParts.length - 1];
      }

      return {
        ...atom,
        actualCode,           // The extracted code value
        codeUrl,              // Original URL (if code was a URL)
        displayName: atom.name,
      };
    });

    return {
      concept: conceptData.result,
      atoms: processedAtoms
    };
  } catch (error) {
    console.error('Error fetching concept details:', error);
    throw error;
  }
}

// Get atom details including its CUI
export async function getAtomDetails(aui: string): Promise<any> {
  const apiKey = import.meta.env.VITE_UMLS_API_KEY;

  if (!apiKey || apiKey === 'your_umls_api_key_here') {
    throw new Error('UMLS API key not configured.');
  }

  try {
    const response = await fetch(
      `https://uts-ws.nlm.nih.gov/rest/content/current/AUI/${aui}?apiKey=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch atom details: ${response.statusText}`);
    }

    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error('Error fetching atom details:', error);
    throw error;
  }
}

// Get Ancestors for a code in a specific vocabulary
export async function getAncestors(vocabulary: string, code: string): Promise<any[]> {
  const apiKey = import.meta.env.VITE_UMLS_API_KEY;

  if (!apiKey || apiKey === 'your_umls_api_key_here') {
    throw new Error('UMLS API key not configured.');
  }

  try {
    const response = await fetch(
      `https://uts-ws.nlm.nih.gov/rest/content/current/source/${vocabulary}/${code}/ancestors?apiKey=${apiKey}`
    );

    if (!response.ok) {
      // If 404, this code may not have ancestors (could be root)
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Failed to fetch ancestors: ${response.statusText}`);
    }

    const data = await response.json();
    return data.result || [];
  } catch (error) {
    console.error('Error fetching ancestors:', error);
    throw error;
  }
}

// Get Descendants for a code in a specific vocabulary
export async function getDescendants(vocabulary: string, code: string): Promise<any[]> {
  const apiKey = import.meta.env.VITE_UMLS_API_KEY;

  if (!apiKey || apiKey === 'your_umls_api_key_here') {
    throw new Error('UMLS API key not configured.');
  }

  // Special handling for RxNorm - use RxNav API for better hierarchy support
  if (vocabulary === 'RXNORM') {
    return getRxNormDescendants(code);
  }

  try {
    const pageSize = 200;
    let allDescendants: any[] = [];
    let pageNumber = 1;
    let hasMorePages = true;

    // Fetch all pages of descendants
    while (hasMorePages) {
      const response = await fetch(
        `https://uts-ws.nlm.nih.gov/rest/content/current/source/${vocabulary}/${code}/descendants?apiKey=${apiKey}&pageSize=${pageSize}&pageNumber=${pageNumber}`
      );

      if (!response.ok) {
        // If 404, this code may not have descendants (could be leaf)
        if (response.status === 404) {
          return allDescendants;
        }
        throw new Error(`Failed to fetch descendants: ${response.statusText}`);
      }

      const data = await response.json();
      const results = data.result || [];

      if (results.length === 0) {
        // No more results
        hasMorePages = false;
      } else {
        allDescendants = allDescendants.concat(results);

        // Check if there might be more pages
        // If we got fewer results than pageSize, we're on the last page
        if (results.length < pageSize) {
          hasMorePages = false;
        } else {
          pageNumber++;

          // Safety limit to prevent infinite loops (max 50 pages = 10,000 descendants)
          if (pageNumber > 50) {
            console.warn(`Reached maximum page limit (50) for ${vocabulary}/${code}`);
            hasMorePages = false;
          }
        }
      }
    }

    console.log(`Fetched ${allDescendants.length} total descendants for ${vocabulary}/${code} across ${pageNumber} page(s)`);
    return allDescendants;
  } catch (error) {
    console.error('Error fetching descendants:', error);
    throw error;
  }
}

// Get RxNorm descendants using RxNav API
async function getRxNormDescendants(rxcui: string): Promise<any[]> {
  try {
    console.log(`[RXNORM] Using RxNav API to fetch descendants for RXCUI ${rxcui}`);

    const allDescendants: any[] = [];

    // Get all related RxNorm concepts
    // OMOP CDM uses: SCD, SBD, SCDC, SBDC (clinical & branded drugs + components)
    // Excludes: SCDG/SBDG (Drug Groups), SCDF/SBDF (Drug Forms), BPCK/GPCK (Packs)
    const response = await fetch(
      `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/related.json?tty=SCD+SBD+SCDC+SBDC`
    );

    if (!response.ok) {
      console.warn(`[RXNORM] RxNav API returned ${response.status} for ${rxcui}`);
      return [];
    }

    const data = await response.json();

    if (data.relatedGroup?.conceptGroup) {
      for (const group of data.relatedGroup.conceptGroup) {
        const concepts = group.conceptProperties || [];

        for (const concept of concepts) {
          allDescendants.push({
            ui: concept.rxcui,
            code: concept.rxcui,
            name: concept.name,
            rootSource: 'RXNORM',
            termType: concept.tty
          });
        }
      }
    }

    console.log(`[RXNORM] Found ${allDescendants.length} related RxNorm concepts for ${rxcui}`);
    return allDescendants;
  } catch (error) {
    console.error(`[RXNORM] Error fetching RxNorm descendants:`, error);
    return [];
  }
}

// Get NDC codes for an RxNorm code using RxNav API
export async function getRxNormToNDC(rxcui: string): Promise<any[]> {
  try {
    console.log(`[RXNORM→NDC] Fetching NDC codes for RXCUI ${rxcui}`);

    // Use RxNav API to get NDC codes for this RxNorm concept
    const response = await fetch(
      `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/ndcs.json`
    );

    if (!response.ok) {
      console.warn(`[RXNORM→NDC] RxNav API returned ${response.status} for ${rxcui}`);
      return [];
    }

    const data = await response.json();
    const ndcCodes: any[] = [];

    // Check if there's an ndcGroup in the response
    if (!data.ndcGroup) {
      console.log(`[RXNORM→NDC] No NDC codes found for RXCUI ${rxcui}`);
      return [];
    }

    // The RxNav API response structure is: data.ndcGroup.ndcList.ndc (array of NDC strings)
    let ndcList: string[] = [];

    if (data.ndcGroup.ndcList && data.ndcGroup.ndcList.ndc) {
      // Standard structure: { ndcGroup: { ndcList: { ndc: ["12345-6789-10", ...] } } }
      ndcList = Array.isArray(data.ndcGroup.ndcList.ndc)
        ? data.ndcGroup.ndcList.ndc
        : [data.ndcGroup.ndcList.ndc];
    } else if (Array.isArray(data.ndcGroup.ndcList)) {
      // Alternative structure: direct array
      ndcList = data.ndcGroup.ndcList;
    }

    for (const ndc of ndcList) {
      ndcCodes.push({
        ui: ndc,
        code: ndc,
        name: `NDC ${ndc}`,  // NDC codes don't have inherent names
        rootSource: 'NDC',
        rxcui: rxcui
      });
    }

    console.log(`[RXNORM→NDC] Found ${ndcCodes.length} NDC codes for RXCUI ${rxcui}`);
    return ndcCodes;
  } catch (error) {
    console.error(`[RXNORM→NDC] Error fetching NDC codes:`, error);
    return [];
  }
}

// Get Concept Relations (for CUI-level hierarchy traversal)
export async function getConceptRelations(cui: string): Promise<any[]> {
  const apiKey = import.meta.env.VITE_UMLS_API_KEY;

  if (!apiKey || apiKey === 'your_umls_api_key_here') {
    throw new Error('UMLS API key not configured.');
  }

  try {
    const response = await fetch(
      `https://uts-ws.nlm.nih.gov/rest/content/current/CUI/${cui}/relations?apiKey=${apiKey}`
    );

    if (!response.ok) {
      // If 404, this CUI may not have relations
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Failed to fetch concept relations: ${response.statusText}`);
    }

    const data = await response.json();
    return data.result || [];
  } catch (error) {
    console.error('Error fetching concept relations:', error);
    throw error;
  }
}

// Get UMLS Hierarchy (legacy, kept for backwards compatibility)
export async function getHierarchy(params: GetHierarchyRequest): Promise<GetHierarchyResponse> {
  const response = await fetch(`${API_BASE}/api/umls/hierarchy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Hierarchy fetch failed: ${response.statusText}`);
  }

  return response.json();
}

// Save Code Set
export async function saveCodeSet(userId: string, params: SaveCodeSetRequest): Promise<SaveCodeSetResponse> {
  const response = await fetch(`${API_BASE}/api/codesets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, ...params }),
  });

  if (!response.ok) {
    throw new Error(`Code set save failed: ${response.statusText}`);
  }

  return response.json();
}

// Get User's Code Sets
export async function getCodeSets(userId: string): Promise<GetCodeSetsResponse> {
  const response = await fetch(`${API_BASE}/api/codesets?userId=${userId}`);

  if (!response.ok) {
    throw new Error(`Code sets fetch failed: ${response.statusText}`);
  }

  return response.json();
}

// Get Code Set Detail
export async function getCodeSetDetail(codeSetId: number): Promise<GetCodeSetDetailResponse> {
  const response = await fetch(`${API_BASE}/api/codesets/${codeSetId}`);

  if (!response.ok) {
    throw new Error(`Code set detail fetch failed: ${response.statusText}`);
  }

  return response.json();
}

// Delete Code Set
export async function deleteCodeSet(codeSetId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/api/codesets/${codeSetId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Code set delete failed: ${response.statusText}`);
  }
}

// Export to TXT
export function exportToTxt(codes: Array<{ code: string; term: string; vocabulary_id: string }>): void {
  const content = codes.map(c => `${c.code}\t${c.vocabulary_id}\t${c.term}`).join('\n');
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `codes_${Date.now()}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}
