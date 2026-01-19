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
      includeSuppressible: 'true',
      includeObsolete: 'true'
    });

    // Add vocabulary filters if provided
    if (params.vocabularies && params.vocabularies.length > 0) {
      queryParams.append('sabs', params.vocabularies.join(','));
    }

    pagePromises.push(
      fetch(`https://uts-ws.nlm.nih.gov/rest/search/2025AB?${queryParams.toString()}`)
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
      fetch(`https://uts-ws.nlm.nih.gov/rest/content/2025AB/CUI/${cui}?apiKey=${apiKey}&includeSuppressible=true&includeObsolete=true`),
      fetch(`https://uts-ws.nlm.nih.gov/rest/content/2025AB/CUI/${cui}/atoms?apiKey=${apiKey}&sabs=${vocabFilter}&pageSize=100&includeSuppressible=true&includeObsolete=true`)
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
      `https://uts-ws.nlm.nih.gov/rest/content/2025AB/AUI/${aui}?apiKey=${apiKey}&includeSuppressible=true&includeObsolete=true`
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
      `https://uts-ws.nlm.nih.gov/rest/content/2025AB/source/${vocabulary}/${code}/ancestors?apiKey=${apiKey}&includeSuppressible=true&includeObsolete=true`
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
    // Use large page size to minimize API calls
    // UMLS API should support up to 10000, using 5000 to be safe
    const pageSize = 5000;
    let allDescendants: any[] = [];
    let pageNumber = 1;
    let hasMorePages = true;

    // Fetch all pages of descendants
    while (hasMorePages) {
      const response = await fetch(
        `https://uts-ws.nlm.nih.gov/rest/content/2025AB/source/${vocabulary}/${code}/descendants?apiKey=${apiKey}&pageSize=${pageSize}&pageNumber=${pageNumber}&includeSuppressible=true&includeObsolete=true`
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

          // Safety limit to prevent infinite loops (max 20 pages = 100,000 descendants)
          if (pageNumber > 20) {
            console.warn(`Reached maximum page limit (20) for ${vocabulary}/${code}`);
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
    // Request: IN (Ingredient), SCD (Clinical Drug), SBD (Branded Drug), SCDC/SBDC (Components)
    // Excludes: SCDG/SBDG (Drug Groups), SCDF/SBDF (Drug Forms), BPCK/GPCK (Packs)
    const response = await fetch(
      `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/related.json?tty=IN+SCD+SBD+SCDC+SBDC`
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

// Get NDC codes from UMLS attributes for an RxNorm code
async function getRxNormAttributesNDC(rxcui: string, cui?: string): Promise<any[]> {
  const apiKey = import.meta.env.VITE_UMLS_API_KEY;

  if (!apiKey || apiKey === 'your_umls_api_key_here') {
    throw new Error('UMLS API key not configured.');
  }

  const allNdcCodes: any[] = [];
  const ndcSet = new Set<string>();

  try {
    // Source 1: RxNorm source-specific attributes
    console.log(`[UMLS ATTRIBUTES] Fetching RXNORM source attributes for RXCUI ${rxcui}`);

    const rxnormResponse = await fetch(
      `https://uts-ws.nlm.nih.gov/rest/content/2025AB/source/RXNORM/${rxcui}/attributes?apiKey=${apiKey}&pageSize=1000&includeSuppressible=true&includeObsolete=true`
    );

    if (rxnormResponse.ok) {
      const data = await rxnormResponse.json();
      const results = data.result || [];

      console.log(`[UMLS ATTRIBUTES] Found ${results.length} total RXNORM attributes`);

      for (const attr of results) {
        const attrName = attr.attributeName || '';
        const attrValue = attr.attributeValue || '';
        const rootSource = attr.rootSource || '';

        // Expanded NDC detection
        const isNdcAttribute =
          attrName.toUpperCase().includes('NDC') ||
          attrName === 'NDC' ||
          attrName === 'RXNORM_NDC';

        // More lenient NDC format: 10-11 digits with optional dashes
        const cleanValue = attrValue.replace(/-/g, '');
        const isNdcFormat = /^\d{10,11}$/.test(cleanValue);

        if ((isNdcAttribute || isNdcFormat) && attrValue && !ndcSet.has(attrValue)) {
          console.log(`[UMLS ATTRIBUTES] Found NDC: ${attrValue} (attr: ${attrName}, rootSource: ${rootSource})`);
          ndcSet.add(attrValue);

          // Keep NDC in original format (no dash normalization per user request)
          const ndcCode = attrValue;

          allNdcCodes.push({
            ui: ndcCode,
            code: ndcCode,
            name: `NDC ${ndcCode}`,
            rootSource: 'NDC',
            rxcui: rxcui,
            source: 'umls_rxnorm_attributes',
            attributeName: attrName
          });
        }
      }

      console.log(`[UMLS ATTRIBUTES] RXNORM source: ${allNdcCodes.length} NDC codes`);
    } else if (rxnormResponse.status === 404) {
      console.log(`[UMLS ATTRIBUTES] No RXNORM attributes found for ${rxcui} (normal for non-product-level concepts)`);
    } else {
      console.warn(`[UMLS ATTRIBUTES] RXNORM attributes returned ${rxnormResponse.status}`);
    }

    // Source 2: CUI-level attributes (if CUI provided)
    if (cui) {
      console.log(`[UMLS ATTRIBUTES] Fetching CUI-level attributes for CUI ${cui}`);

      const cuiResponse = await fetch(
        `https://uts-ws.nlm.nih.gov/rest/content/2025AB/CUI/${cui}/attributes?apiKey=${apiKey}&pageSize=1000&includeSuppressible=true&includeObsolete=true`
      );

      if (cuiResponse.ok) {
        const data = await cuiResponse.json();
        const results = data.result || [];

        console.log(`[UMLS ATTRIBUTES] Found ${results.length} total CUI attributes`);

        for (const attr of results) {
          const attrName = attr.attributeName || '';
          const attrValue = attr.attributeValue || '';
          const rootSource = attr.rootSource || '';

          // Expanded NDC detection
          const isNdcAttribute =
            attrName.toUpperCase().includes('NDC') ||
            attrName === 'NDC' ||
            attrName === 'RXNORM_NDC';

          // More lenient NDC format: 10-11 digits with optional dashes
          const cleanValue = attrValue.replace(/-/g, '');
          const isNdcFormat = /^\d{10,11}$/.test(cleanValue);

          if ((isNdcAttribute || isNdcFormat) && attrValue && !ndcSet.has(attrValue)) {
            console.log(`[UMLS ATTRIBUTES] Found NDC from CUI: ${attrValue} (attr: ${attrName}, rootSource: ${rootSource})`);
            ndcSet.add(attrValue);

            // Keep NDC in original format (no dash normalization per user request)
            const ndcCode = attrValue;

            allNdcCodes.push({
              ui: ndcCode,
              code: ndcCode,
              name: `NDC ${ndcCode}`,
              rootSource: 'NDC',
              rxcui: rxcui,
              source: 'umls_cui_attributes',
              attributeName: attrName
            });
          }
        }

        console.log(`[UMLS ATTRIBUTES] CUI-level: ${allNdcCodes.length} total NDC codes`);
      } else if (cuiResponse.status === 404) {
        console.log(`[UMLS ATTRIBUTES] No CUI attributes found for ${cui} (normal for non-product-level concepts)`);
      } else {
        console.warn(`[UMLS ATTRIBUTES] CUI attributes returned ${cuiResponse.status}`);
      }
    }

    console.log(`[UMLS ATTRIBUTES] Total from attributes: ${allNdcCodes.length} NDC codes`);
    return allNdcCodes;
  } catch (error) {
    console.error(`[UMLS ATTRIBUTES] Error fetching attributes:`, error);
    return allNdcCodes; // Return what we got so far
  }
}

// Get NDC codes for an RxNorm code using both RxNav API and UMLS attributes
export async function getRxNormToNDC(rxcui: string, cui?: string): Promise<any[]> {
  try {
    console.log(`[RXNORM→NDC] Fetching NDC codes for RXCUI ${rxcui} (CUI: ${cui || 'not provided'}) from multiple sources`);

    const allNdcCodes: any[] = [];
    const ndcSet = new Set<string>(); // Track unique NDC codes

    // Source 1: RxNav API
    try {
      const response = await fetch(
        `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/ndcs.json`
      );

      if (response.ok) {
        const data = await response.json();

        if (data.ndcGroup) {
          let ndcList: string[] = [];

          if (data.ndcGroup.ndcList && data.ndcGroup.ndcList.ndc) {
            ndcList = Array.isArray(data.ndcGroup.ndcList.ndc)
              ? data.ndcGroup.ndcList.ndc
              : [data.ndcGroup.ndcList.ndc];
          } else if (Array.isArray(data.ndcGroup.ndcList)) {
            ndcList = data.ndcGroup.ndcList;
          }

          for (const ndc of ndcList) {
            if (!ndcSet.has(ndc)) {
              ndcSet.add(ndc);
              allNdcCodes.push({
                ui: ndc,
                code: ndc,
                name: `NDC ${ndc}`,
                rootSource: 'NDC',
                rxcui: rxcui,
                source: 'rxnav'
              });
            }
          }

          console.log(`[RXNORM→NDC] RxNav API: ${ndcList.length} NDC codes`);
        } else {
          console.log(`[RXNORM→NDC] RxNav API: No NDC group found`);
        }
      } else {
        console.warn(`[RXNORM→NDC] RxNav API returned ${response.status}`);
      }
    } catch (error) {
      console.error(`[RXNORM→NDC] Error fetching from RxNav:`, error);
    }

    // Source 2: UMLS Attributes (both RxNorm source and CUI-level)
    try {
      const attributeNdcs = await getRxNormAttributesNDC(rxcui, cui);
      let newFromAttributes = 0;

      for (const ndc of attributeNdcs) {
        if (!ndcSet.has(ndc.code)) {
          ndcSet.add(ndc.code);
          allNdcCodes.push(ndc);
          newFromAttributes++;
        }
      }

      console.log(`[RXNORM→NDC] UMLS Attributes: ${attributeNdcs.length} NDC codes (${newFromAttributes} new)`);
    } catch (error) {
      console.error(`[RXNORM→NDC] Error fetching from UMLS attributes:`, error);
    }

    console.log(`[RXNORM→NDC] ✓ Total: ${allNdcCodes.length} unique NDC codes for RXCUI ${rxcui}`);
    return allNdcCodes;
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
      `https://uts-ws.nlm.nih.gov/rest/content/2025AB/CUI/${cui}/relations?apiKey=${apiKey}&includeSuppressible=true&includeObsolete=true`
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

// Parse RxNorm drug name to extract dose form and strength
function parseRxNormName(drugName: string): {
  doseForm?: string;
  strength?: string;
} {
  const parsed: { doseForm?: string; strength?: string } = {};

  // Dose form categories with specific forms mapped to consolidated categories
  const doseFormMapping: { [key: string]: string } = {
    // Oral Solid Forms
    'Chewable Tablet': 'Oral Solid',
    'Disintegrating Oral Tablet': 'Oral Solid',
    'Extended Release Oral Tablet': 'Oral Solid',
    'Delayed Release Oral Capsule': 'Oral Solid',
    'Extended Release Oral Capsule': 'Oral Solid',
    'Oral Tablet': 'Oral Solid',
    'Oral Capsule': 'Oral Solid',
    'Oral Powder': 'Oral Solid',
    'Oral Granules': 'Oral Solid',
    'Sublingual Tablet': 'Oral Solid',
    'Buccal Tablet': 'Oral Solid',
    'Oral Lozenge': 'Oral Solid',
    'Tablet': 'Oral Solid',
    'Capsule': 'Oral Solid',

    // Oral Liquid Forms
    'Oral Solution': 'Oral Liquid',
    'Oral Suspension': 'Oral Liquid',
    'Oral Syrup': 'Oral Liquid',
    'Oral Elixir': 'Oral Liquid',
    'Oral Drops': 'Oral Liquid',
    'Oral Emulsion': 'Oral Liquid',

    // Injectable Forms
    'Injectable Solution': 'Injectable',
    'Injectable Suspension': 'Injectable',
    'Injection': 'Injectable',
    'Prefilled Syringe': 'Injectable',
    'Auto-Injector': 'Injectable',
    'Cartridge': 'Injectable',

    // Topical Forms
    'Topical Cream': 'Topical',
    'Topical Ointment': 'Topical',
    'Topical Gel': 'Topical',
    'Topical Lotion': 'Topical',
    'Topical Solution': 'Topical',
    'Topical Spray': 'Topical',
    'Transdermal System': 'Topical',
    'Transdermal Patch': 'Topical',
    'Medicated Patch': 'Topical',
    'Topical Powder': 'Topical',
    'Topical Foam': 'Topical',
    'Cream': 'Topical',
    'Ointment': 'Topical',
    'Gel': 'Topical',
    'Patch': 'Topical',
    'Lotion': 'Topical',

    // Inhalation Forms
    'Inhalant': 'Inhalation',
    'Metered Dose Inhaler': 'Inhalation',
    'Dry Powder Inhaler': 'Inhalation',
    'Nasal Spray': 'Inhalation',
    'Nasal Solution': 'Inhalation',
    'Inhalation Solution': 'Inhalation',
    'Inhalation Powder': 'Inhalation',
    'Aerosol': 'Inhalation',
    'Spray': 'Inhalation',

    // Ophthalmic Forms
    'Ophthalmic Solution': 'Ophthalmic',
    'Ophthalmic Ointment': 'Ophthalmic',
    'Ophthalmic Suspension': 'Ophthalmic',
    'Ophthalmic Gel': 'Ophthalmic',

    // Otic Forms
    'Otic Solution': 'Otic',
    'Otic Suspension': 'Otic',

    // Other Forms
    'Rectal Suppository': 'Other',
    'Vaginal Suppository': 'Other',
    'Vaginal Cream': 'Other',
    'Vaginal Tablet': 'Other',
    'Enema': 'Other',
    'Implant': 'Other',
    'Suppository': 'Other',
    'Powder': 'Other',
    'Film': 'Other',
    'Drops': 'Other',
    'Solution': 'Other',
    'Suspension': 'Other'
  };

  // Look for dose form in the drug name (check longer patterns first)
  const sortedForms = Object.keys(doseFormMapping).sort((a, b) => b.length - a.length);
  for (const form of sortedForms) {
    if (drugName.includes(form)) {
      parsed.doseForm = doseFormMapping[form];
      break;
    }
  }

  // Look for strength pattern: number + space + unit (e.g., "500 MG", "10 ML", "2.5 %")
  const strengthPattern = /(\d+(?:\.\d+)?)\s*(MG|MCG|G|ML|L|%|UNIT|MEQ|MMOL|MG\/ML|MCG\/ML|MG\/G|%)\b/i;
  const strengthMatch = drugName.match(strengthPattern);
  if (strengthMatch) {
    parsed.strength = `${strengthMatch[1]} ${strengthMatch[2].toUpperCase()}`;
  }

  return parsed;
}

// Get RxNorm-specific attributes by parsing the drug name
export async function getRxNormAttributes(cui: string, drugName?: string): Promise<{
  doseForm?: string;
  strength?: string;
}> {
  // If we have a drug name, parse it for dose form and strength
  if (drugName) {
    const parsed = parseRxNormName(drugName);
    if (parsed.doseForm || parsed.strength) {
      console.log(`[RXNORM ATTRS] Parsed from name "${drugName}":`, parsed);
      return parsed;
    }
  }

  // If no drug name provided or parsing failed, return empty
  console.log(`[RXNORM ATTRS] No attributes extracted for ${cui}`);
  return {};
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
