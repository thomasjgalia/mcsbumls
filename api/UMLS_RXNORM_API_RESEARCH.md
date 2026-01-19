# UMLS and RxNorm API Research Documentation

## Overview
This document provides comprehensive information about the UMLS REST API and RxNorm/RxClass APIs, including endpoints, authentication, response structures, and recommendations for database schema design.

---

## 1. UMLS REST API

### 1.1 Authentication

**Method**: API Key Authentication (simplified from the deprecated TGT/ST ticket system)

- Users need a UMLS account (free registration required)
- API key is found in UTS 'My Profile' area after signing in
- API key is passed as a query parameter: `?apiKey=YOUR_API_KEY`
- Base URL: `https://uts-ws.nlm.nih.gov/rest/`

**Validation Endpoint**:
```
https://utslogin.nlm.nih.gov/validateUser?validatorApiKey=YOUR_API_KEY&apiKey=USER_API_KEY
```

### 1.2 Search Concepts Endpoint

**Endpoint**: `GET /search/current`

**Full URL Example**:
```
https://uts-ws.nlm.nih.gov/rest/search/current?string=diabetes&apiKey=YOUR_API_KEY
```

**Query Parameters**:
- `string` (required): Search term
- `apiKey` (required): Your API key
- `returnIdType` (optional): Return type - default is CUI, can be `code`, `sourceConcept`, or `sourceDescriptor`
- `sabs` (optional): Filter by source vocabularies (comma-separated)
- `pageSize` (optional): Results per page (max 200, no pagination support)

**Response Structure**:
```json
{
  "pageSize": 200,
  "result": {
    "classType": "searchResults",
    "results": [
      {
        "ui": "C0011849",
        "rootSource": "SNOMEDCT_US",
        "uri": "https://uts-ws.nlm.nih.gov/rest/content/current/CUI/C0011849",
        "name": "Diabetes Mellitus"
      },
      {
        "ui": "C0011854",
        "rootSource": "NCI",
        "uri": "https://uts-ws.nlm.nih.gov/rest/content/current/CUI/C0011854",
        "name": "Type 1 Diabetes Mellitus"
      }
    ]
  }
}
```

**Key Fields Returned**:
- `ui`: Concept Unique Identifier (CUI) or source code
- `name`: Human-readable concept name
- `rootSource`: Source vocabulary (e.g., SNOMEDCT_US, NCI, MEDCIN)
- `uri`: Direct link to full concept resource
- `pageSize`: Number of results (max 200, pagination no longer supported)

**Empty Results**:
```json
{
  "result": {
    "results": [
      {
        "ui": "NONE",
        "name": "NO RESULTS"
      }
    ]
  }
}
```

### 1.3 Get Concept Information Endpoint

**Endpoint**: `GET /content/current/CUI/{CUI}`

**Full URL Example**:
```
https://uts-ws.nlm.nih.gov/rest/content/current/CUI/C0009044?apiKey=YOUR_API_KEY
```

**Response Structure**:
```json
{
  "pageSize": 25,
  "pageNumber": 1,
  "pageCount": 1,
  "result": {
    "classType": "Concept",
    "ui": "C0009044",
    "suppressible": false,
    "dateAdded": "09-30-1990",
    "majorRevisionDate": "03-16-2016",
    "status": "R",
    "name": "Closed fracture of carpal bone",
    "semanticTypes": [
      {
        "name": "Injury or Poisoning",
        "uri": "https://uts-ws.nlm.nih.gov/rest/semantic-network/current/TUI/T037"
      }
    ],
    "atomCount": 65,
    "attributeCount": 0,
    "cvMemberCount": 0,
    "atoms": "https://uts-ws.nlm.nih.gov/rest/content/current/CUI/C0009044/atoms",
    "definitions": "https://uts-ws.nlm.nih.gov/rest/content/current/CUI/C0009044/definitions",
    "relations": "https://uts-ws.nlm.nih.gov/rest/content/current/CUI/C0009044/relations"
  }
}
```

**Key Fields Returned**:
- `classType`: Object type ("Concept")
- `ui`: CUI identifier
- `name`: Preferred concept name
- `status`: Status code (e.g., "R" for current/active)
- `suppressible`: Boolean indicating if concept can be suppressed
- `dateAdded`: Date added to UMLS
- `majorRevisionDate`: Last major update
- `semanticTypes`: Array of semantic classifications with name and TUI
- `atomCount`: Number of associated atoms (terms from different vocabularies)
- `attributeCount`: Number of attributes
- `cvMemberCount`: Content view member count
- `atoms`, `definitions`, `relations`: URIs to retrieve related data

### 1.4 Get Concept Relations/Hierarchy Endpoint

**Endpoint**: `GET /content/current/CUI/{CUI}/relations`

**Full URL Examples**:
```
# All relationships
https://uts-ws.nlm.nih.gov/rest/content/current/CUI/C0009044/relations?apiKey=YOUR_API_KEY

# NLM-asserted relationships only
https://uts-ws.nlm.nih.gov/rest/content/current/CUI/C0009044/relations?sabs=MTH&apiKey=YOUR_API_KEY
```

**Query Parameters**:
- `apiKey` (required): Your API key
- `sabs` (optional): Filter by source vocabularies (e.g., "MTH" for NLM-asserted)
- `includeRelationLabels` (optional): Filter by relation types
- `includeAdditionalRelationLabels` (optional): Filter by relation attributes
- `pageNumber`, `pageSize` (optional): Pagination controls
- `includeObsolete`, `includeSuppressible` (optional): Include deprecated content

**Common Relationship Types**:
- `PAR`: Parent (has parent relationship)
- `CHD`: Child (has child relationship)
- `RB`: Broader (has a broader relationship)
- `RN`: Narrower (has a narrower relationship)
- `SIB`: Sibling (hierarchically-related)
- `RO`: Other (non-hierarchical associative)

**Response Structure**:
```json
{
  "pageSize": 25,
  "pageNumber": 1,
  "pageCount": 5,
  "result": [
    {
      "classType": "ConceptRelation",
      "ui": "R123456789",
      "relationLabel": "PAR",
      "relatedFromIdName": "Closed fracture of carpal bone",
      "relatedFromId": "C0009044",
      "relatedIdName": "Fracture of carpal bone",
      "relatedId": "C0016658",
      "rootSource": "SNOMEDCT_US"
    },
    {
      "classType": "ConceptRelation",
      "ui": "R987654321",
      "relationLabel": "CHD",
      "relatedFromIdName": "Closed fracture of carpal bone",
      "relatedFromId": "C0009044",
      "relatedIdName": "Closed fracture of scaphoid bone",
      "relatedId": "C0080093",
      "rootSource": "SNOMEDCT_US"
    }
  ]
}
```

**Key Fields Returned**:
- `ui`: Unique identifier for the relationship
- `classType`: Type of relation (AtomClusterRelation, AtomRelation, ConceptRelation)
- `relationLabel`: Type of relationship (PAR, CHD, RB, RN, SIB, RO, etc.)
- `relatedFromId`, `relatedFromIdName`: Source concept
- `relatedId`, `relatedIdName`: Target concept
- `rootSource`: Source vocabulary

**Important Notes**:
- NLM does not assert parent/child relationships between concepts
- Relationships come from source vocabularies (SNOMED CT, MeSH, FMA, etc.)
- Different vocabularies use different relation types (e.g., SNOMED uses PAR/CHD, MeSH uses RB/RN)

### 1.5 Additional UMLS Endpoints

**Get Concept Atoms**: `/content/current/CUI/{CUI}/atoms`
- Returns all terms (atoms) for a concept from different source vocabularies

**Get Concept Definitions**: `/content/current/CUI/{CUI}/definitions`
- Returns textual definitions from various sources

---

## 2. RxNorm API

### 2.1 Authentication
**No authentication required** - The RxNorm API is free and open for public use.

**Base URL**: `https://rxnav.nlm.nih.gov/REST/`

### 2.2 Key Endpoints

#### 2.2.1 Search for Drugs

**findRxcuiByString**: Find concepts with a specified name
```
GET /rxcui.json?name=lipitor
```

**getDrugs**: Get drug products associated with a specified name
```
GET /drugs.json?name=duloxetine
```

**Response Structure for getDrugs**:
```json
{
  "drugGroup": {
    "name": "duloxetine",
    "conceptGroup": [
      {
        "tty": "IN",
        "conceptProperties": [
          {
            "rxcui": "321988",
            "name": "duloxetine",
            "synonym": "",
            "tty": "IN",
            "language": "ENG",
            "suppress": "N",
            "umlscui": "C1100195"
          }
        ]
      },
      {
        "tty": "SCD",
        "conceptProperties": [
          {
            "rxcui": "615252",
            "name": "duloxetine 20 MG Delayed Release Oral Capsule",
            "synonym": "",
            "tty": "SCD",
            "language": "ENG",
            "suppress": "N",
            "umlscui": "C1721797"
          },
          {
            "rxcui": "615256",
            "name": "duloxetine 30 MG Delayed Release Oral Capsule",
            "synonym": "",
            "tty": "SCD",
            "language": "ENG",
            "suppress": "N",
            "umlscui": "C1721799"
          }
        ]
      },
      {
        "tty": "SBD",
        "conceptProperties": [
          {
            "rxcui": "615254",
            "name": "duloxetine 20 MG Delayed Release Oral Capsule [Cymbalta]",
            "synonym": "",
            "tty": "SBD",
            "language": "ENG",
            "suppress": "N",
            "umlscui": "C1721798"
          }
        ]
      }
    ]
  }
}
```

#### 2.2.2 Get All Related Information

**getAllRelatedInfo**: Get RxNorm concepts related by default paths
```
GET /rxcui/{rxcui}/allrelated.json
Example: /rxcui/321988/allrelated.json
```

**Query Parameters**:
- `expand` (optional): Include additional info like GENERAL_CARDINALITY (genCard) or Prescribable Name (psn)

**Response Structure**:
```json
{
  "allRelatedGroup": {
    "conceptGroup": [
      {
        "tty": "IN",
        "conceptProperties": [
          {
            "rxcui": "321988",
            "name": "duloxetine",
            "synonym": "",
            "tty": "IN",
            "language": "ENG",
            "suppress": "N",
            "umlscui": "C1100195"
          }
        ]
      },
      {
        "tty": "PIN",
        "conceptProperties": [
          {
            "rxcui": "321987",
            "name": "duloxetine hydrochloride",
            "synonym": "",
            "tty": "PIN",
            "language": "ENG",
            "suppress": "N",
            "umlscui": ""
          }
        ]
      },
      {
        "tty": "DF",
        "conceptProperties": [
          {
            "rxcui": "346463",
            "name": "Delayed Release Oral Capsule",
            "synonym": "",
            "tty": "DF",
            "language": "ENG",
            "suppress": "N",
            "umlscui": ""
          }
        ]
      },
      {
        "tty": "BN",
        "conceptProperties": [
          {
            "rxcui": "220667",
            "name": "Cymbalta",
            "synonym": "",
            "tty": "BN",
            "language": "ENG",
            "suppress": "N",
            "umlscui": "C0936455"
          }
        ]
      },
      {
        "tty": "SCD",
        "conceptProperties": [
          {
            "rxcui": "615252",
            "name": "duloxetine 20 MG Delayed Release Oral Capsule",
            "synonym": "",
            "tty": "SCD",
            "language": "ENG",
            "suppress": "N",
            "umlscui": "C1721797"
          }
        ]
      },
      {
        "tty": "SBD",
        "conceptProperties": [
          {
            "rxcui": "615254",
            "name": "duloxetine 20 MG Delayed Release Oral Capsule [Cymbalta]",
            "synonym": "",
            "tty": "SBD",
            "language": "ENG",
            "suppress": "N",
            "umlscui": "C1721798"
          }
        ]
      },
      {
        "tty": "GPCK",
        "conceptProperties": [
          {
            "rxcui": "847324",
            "name": "{30 (duloxetine 30 MG Delayed Release Oral Capsule)} Pack",
            "synonym": "",
            "tty": "GPCK",
            "language": "ENG",
            "suppress": "N",
            "umlscui": ""
          }
        ]
      },
      {
        "tty": "BPCK",
        "conceptProperties": [
          {
            "rxcui": "847326",
            "name": "{30 (duloxetine 30 MG Delayed Release Oral Capsule [Cymbalta])} Pack [Cymbalta]",
            "synonym": "",
            "tty": "BPCK",
            "language": "ENG",
            "suppress": "N",
            "umlscui": ""
          }
        ]
      }
    ]
  }
}
```

#### 2.2.3 Get Concept Properties

**getAllProperties**: Get complete concept details
```
GET /rxcui/{rxcui}/allProperties.json?prop=all
Example: /rxcui/321988/allProperties.json?prop=all
```

**getRxConceptProperties**: Get concept name, TTY, and synonym
```
GET /rxcui/{rxcui}/properties.json
```

#### 2.2.4 NDC Endpoints

**getNDCs**: List NDCs for a specific concept
```
GET /rxcui/{rxcui}/ndcs.json
```

**getNDCProperties**: Get National Drug Code details
```
GET /ndcproperties.json?id={ndc}
```

**getAllHistoricalNDCs**: Get all NDCs ever associated with a concept
```
GET /rxcui/{rxcui}/historicalndcs.json
```

### 2.3 RxNorm Term Types (TTY)

RxNorm uses term types to classify normalized names by concept type:

| TTY | Full Name | Description | Example |
|-----|-----------|-------------|---------|
| **IN** | Ingredient | Basic active pharmaceutical ingredient | duloxetine |
| **PIN** | Precise Ingredient | Specific form of ingredient | duloxetine hydrochloride |
| **MIN** | Multiple Ingredients | Combination of ingredients | acetaminophen / hydrocodone |
| **DF** | Dose Form | Physical form of medication | Delayed Release Oral Capsule |
| **SCDC** | Semantic Clinical Drug Component | Ingredient + Strength | duloxetine 20 MG |
| **SCD** | Semantic Clinical Drug | Ingredient + Strength + Dose Form | duloxetine 20 MG Delayed Release Oral Capsule |
| **SBD** | Semantic Branded Drug | Ingredient + Strength + Dose Form + Brand | duloxetine 20 MG Delayed Release Oral Capsule [Cymbalta] |
| **GPCK** | Generic Pack | Pack of generic drugs with quantities | {30 (duloxetine 30 MG Delayed Release Oral Capsule)} Pack |
| **BPCK** | Branded Pack | Pack of branded drugs with quantities | {30 (duloxetine 30 MG [Cymbalta])} Pack [Cymbalta] |
| **BN** | Brand Name | Commercial brand name | Cymbalta |

**Hierarchy**:
- Ingredients (IN, PIN, MIN) → Most general
- Dose Forms (DF) → Form only
- Components (SCDC, SBDC) → Ingredient + Strength
- Clinical Drugs (SCD, SBD) → Ingredient + Strength + Dose Form (dispensable level)
- Packs (GPCK, BPCK) → Multiple units packaged together

---

## 3. RxClass API

### 3.1 Authentication
**No authentication required** - Free and open for public use.

**Base URL**: `https://rxnav.nlm.nih.gov/REST/rxclass/`

### 3.2 Key Endpoints for Drug Classes

#### 3.2.1 Get Drug Classes by RxCUI

**getClassByRxNormDrugId**: Get classes containing a specific RxNorm drug ID
```
GET /class/byRxcui.json?rxcui={rxcui}

Full Example:
https://rxnav.nlm.nih.gov/REST/rxclass/class/byRxcui.json?rxcui=7052
```

**Query Parameters**:
- `rxcui` (required): RxNorm Concept Unique Identifier
- `relaSource` (optional): Filter by source (MEDRT, ATC, VA, etc.)
- `relas` (optional): Filter by relationship (e.g., "may_treat", "may_prevent")

**Response Structure**:
```json
{
  "rxclassDrugInfoList": {
    "rxclassDrugInfo": [
      {
        "minConcept": {
          "rxcui": "7052",
          "name": "Morphine",
          "tty": "IN"
        },
        "rxclassMinConceptItem": {
          "classId": "D004417",
          "className": "Dyspnea",
          "classType": "DISEASE"
        },
        "rela": "may_treat",
        "relaSource": "MEDRT"
      },
      {
        "minConcept": {
          "rxcui": "7052",
          "name": "Morphine",
          "tty": "IN"
        },
        "rxclassMinConceptItem": {
          "classId": "D010148",
          "className": "Pain, Intractable",
          "classType": "DISEASE"
        },
        "rela": "may_treat",
        "relaSource": "MEDRT"
      },
      {
        "minConcept": {
          "rxcui": "7052",
          "name": "Morphine",
          "tty": "IN"
        },
        "rxclassMinConceptItem": {
          "classId": "N02A",
          "className": "OPIOIDS",
          "classType": "ATC1-4"
        },
        "rela": "isa",
        "relaSource": "ATC"
      }
    ]
  }
}
```

**Key Fields Returned**:
- `minConcept`: Drug information (rxcui, name, tty)
- `rxclassMinConceptItem`: Class information
  - `classId`: Unique class identifier
  - `className`: Human-readable class name
  - `classType`: Type of classification (see below)
  - `classUrl`: Optional URL for more info
- `rela`: Relationship type (may_treat, may_prevent, isa, etc.)
- `relaSource`: Source of classification (MEDRT, ATC, VA, etc.)

#### 3.2.2 Get Drug Classes by Drug Name

**getClassByRxNormDrugName**: Get classes by drug name
```
GET /class/byDrugName.json?drugName={name}

Example:
https://rxnav.nlm.nih.gov/REST/rxclass/class/byDrugName.json?drugName=morphine
```

Returns the same structure as `getClassByRxNormDrugId`.

#### 3.2.3 Get Class Members

**getClassMembers**: List drugs within a specified class
```
GET /classMembers.json?classId={classId}&relaSource={source}

Example:
https://rxnav.nlm.nih.gov/REST/rxclass/classMembers.json?classId=N02A&relaSource=ATC
```

**Response Structure**:
```json
{
  "drugMemberGroup": {
    "drugMember": [
      {
        "minConcept": {
          "rxcui": "7052",
          "name": "Morphine",
          "tty": "IN"
        },
        "nodeAttr": "Y"
      },
      {
        "minConcept": {
          "rxcui": "3423",
          "name": "Codeine",
          "tty": "IN"
        },
        "nodeAttr": "Y"
      }
    ]
  }
}
```

#### 3.2.4 Additional Classification Endpoints

**findClassByName**: Locate classes by name
```
GET /class/byName.json?className={name}
```

**getClassTree**: View class hierarchy (subclasses/descendants)
```
GET /classTree.json?classId={classId}&relaSource={source}
```

**getAllClasses**: Retrieve all available classes for a source
```
GET /allClasses.json?relaSource={source}
```

### 3.3 Drug Class Sources and Types

RxClass includes multiple classification systems:

| Class Type | Source | Description | Example Classes |
|------------|--------|-------------|-----------------|
| **ATC1-4** | WHO ATC | Anatomical Therapeutic Chemical (levels 1-4) | N02A (OPIOIDS) |
| **DISEASE** | MED-RT | Diseases the drug may treat/prevent | Dyspnea, Pain |
| **MOA** | MED-RT | Mechanism of Action | Opioid Agonists |
| **PE** | MED-RT | Physiologic Effect | Decreased Central Nervous System Excitability |
| **PK** | MED-RT | Pharmacokinetics | Cytochrome P450 2D6 Inhibitors |
| **CHEM** | MED-RT | Chemical structure classes | Phenanthrenes |
| **VA** | VA National | Veterans Affairs drug classes | CN101 (Opioid Analgesics) |
| **EPC** | FDA | Established Pharmacologic Class | Opioid Agonist |

**Common Relationship Types (rela)**:
- `may_treat`: Drug may treat a disease
- `may_prevent`: Drug may prevent a disease
- `isa`: Drug is a member of a class
- `has_moa`: Drug has a mechanism of action
- `has_pe`: Drug has a physiologic effect
- `has_pk`: Drug has pharmacokinetic properties

---

## 4. Database Schema Recommendations

### 4.1 What to Store vs. What to Cache

Based on the API response structures, here's a recommended approach:

#### **Store in Azure SQL Database:**

1. **Core Concept Data**:
   - CUI (UMLS Concept Unique Identifier)
   - Preferred name
   - Semantic types
   - Status and suppressibility
   - Date added and last updated
   - Source vocabulary information

2. **RxNorm Core Data**:
   - RxCUI (RxNorm Concept Unique Identifier)
   - Drug name
   - Term type (TTY)
   - Ingredient information
   - NDC codes (if relevant)
   - UMLS CUI mapping

3. **User-Specific Data**:
   - User search history
   - Favorite/bookmarked concepts
   - Custom annotations or notes
   - Usage analytics

4. **Frequently Used Relationships**:
   - Common drug-to-ingredient mappings
   - Brand-to-generic mappings
   - High-traffic concept relationships

#### **Fetch On-Demand with Caching:**

1. **Detailed Hierarchies**:
   - Full concept relationship trees (PAR/CHD/RB/RN)
   - Complete drug class hierarchies
   - Reason: Large, complex, infrequently changing

2. **Extensive Related Information**:
   - All related RxNorm concepts via `getAllRelatedInfo`
   - Complete atom lists for a concept
   - Full definition lists
   - Reason: Verbose responses, storage-intensive

3. **Drug Class Information**:
   - MED-RT classifications (MOA, PE, PK, etc.)
   - ATC classifications
   - VA class memberships
   - Reason: Multiple classification systems, updated periodically

4. **Cross-References**:
   - NDC to RxCUI mappings (unless critical)
   - Source-specific codes and terms
   - Reason: Large volume, system-specific

### 4.2 Proposed Database Schema

```sql
-- Core UMLS Concepts Table
CREATE TABLE UMLSConcepts (
    CUI NVARCHAR(10) PRIMARY KEY,
    PreferredName NVARCHAR(500) NOT NULL,
    Status CHAR(1) NOT NULL, -- R=Regular, O=Obsolete
    Suppressible BIT NOT NULL DEFAULT 0,
    DateAdded DATE,
    MajorRevisionDate DATE,
    AtomCount INT,
    AttributeCount INT,
    LastSynced DATETIME2 DEFAULT GETDATE(),
    INDEX IX_PreferredName (PreferredName)
);

-- Semantic Types
CREATE TABLE SemanticTypes (
    SemanticTypeId INT IDENTITY PRIMARY KEY,
    TUI NVARCHAR(10) NOT NULL UNIQUE, -- Type Unique Identifier
    SemanticTypeName NVARCHAR(200) NOT NULL,
    INDEX IX_TUI (TUI)
);

-- Concept to Semantic Type Mapping
CREATE TABLE ConceptSemanticTypes (
    CUI NVARCHAR(10) NOT NULL,
    TUI NVARCHAR(10) NOT NULL,
    CONSTRAINT PK_ConceptSemanticTypes PRIMARY KEY (CUI, TUI),
    CONSTRAINT FK_ConceptSemanticTypes_CUI FOREIGN KEY (CUI)
        REFERENCES UMLSConcepts(CUI),
    CONSTRAINT FK_ConceptSemanticTypes_TUI FOREIGN KEY (TUI)
        REFERENCES SemanticTypes(TUI)
);

-- RxNorm Concepts
CREATE TABLE RxNormConcepts (
    RxCUI NVARCHAR(10) PRIMARY KEY,
    ConceptName NVARCHAR(1000) NOT NULL,
    TTY NVARCHAR(20) NOT NULL, -- Term Type
    Synonym NVARCHAR(1000),
    Language CHAR(3) DEFAULT 'ENG',
    Suppress CHAR(1) DEFAULT 'N',
    UMLSCUI NVARCHAR(10), -- Link to UMLS
    LastSynced DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_RxNorm_UMLS FOREIGN KEY (UMLSCUI)
        REFERENCES UMLSConcepts(CUI),
    INDEX IX_ConceptName (ConceptName),
    INDEX IX_TTY (TTY),
    INDEX IX_UMLSCUI (UMLSCUI)
);

-- RxNorm Term Types Reference
CREATE TABLE RxNormTermTypes (
    TTY NVARCHAR(20) PRIMARY KEY,
    FullName NVARCHAR(100),
    Description NVARCHAR(500),
    IsDispensable BIT DEFAULT 0
);

-- Drug Ingredients (IN term types from RxNorm)
CREATE TABLE DrugIngredients (
    IngredientRxCUI NVARCHAR(10) PRIMARY KEY,
    IngredientName NVARCHAR(500) NOT NULL,
    CONSTRAINT FK_Ingredient_RxNorm FOREIGN KEY (IngredientRxCUI)
        REFERENCES RxNormConcepts(RxCUI),
    INDEX IX_IngredientName (IngredientName)
);

-- Drug to Ingredient Mapping
CREATE TABLE DrugIngredientMapping (
    DrugRxCUI NVARCHAR(10) NOT NULL,
    IngredientRxCUI NVARCHAR(10) NOT NULL,
    CONSTRAINT PK_DrugIngredient PRIMARY KEY (DrugRxCUI, IngredientRxCUI),
    CONSTRAINT FK_Drug FOREIGN KEY (DrugRxCUI)
        REFERENCES RxNormConcepts(RxCUI),
    CONSTRAINT FK_Ingredient FOREIGN KEY (IngredientRxCUI)
        REFERENCES DrugIngredients(IngredientRxCUI)
);

-- Dose Forms (DF term types)
CREATE TABLE DoseForms (
    DoseFormRxCUI NVARCHAR(10) PRIMARY KEY,
    DoseFormName NVARCHAR(200) NOT NULL,
    CONSTRAINT FK_DoseForm_RxNorm FOREIGN KEY (DoseFormRxCUI)
        REFERENCES RxNormConcepts(RxCUI),
    INDEX IX_DoseFormName (DoseFormName)
);

-- Drug Classes
CREATE TABLE DrugClasses (
    ClassId NVARCHAR(50) NOT NULL,
    ClassName NVARCHAR(500) NOT NULL,
    ClassType NVARCHAR(20) NOT NULL, -- ATC1-4, DISEASE, MOA, PE, PK, CHEM, VA, EPC
    RelaSource NVARCHAR(20) NOT NULL, -- MEDRT, ATC, VA, FDA
    ClassUrl NVARCHAR(500),
    LastSynced DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT PK_DrugClasses PRIMARY KEY (ClassId, RelaSource),
    INDEX IX_ClassName (ClassName),
    INDEX IX_ClassType (ClassType)
);

-- Drug to Class Mapping
CREATE TABLE DrugClassMapping (
    RxCUI NVARCHAR(10) NOT NULL,
    ClassId NVARCHAR(50) NOT NULL,
    RelaSource NVARCHAR(20) NOT NULL,
    Rela NVARCHAR(50) NOT NULL, -- may_treat, may_prevent, isa, has_moa, etc.
    CONSTRAINT PK_DrugClassMapping PRIMARY KEY (RxCUI, ClassId, RelaSource),
    CONSTRAINT FK_DrugClass_Drug FOREIGN KEY (RxCUI)
        REFERENCES RxNormConcepts(RxCUI),
    CONSTRAINT FK_DrugClass_Class FOREIGN KEY (ClassId, RelaSource)
        REFERENCES DrugClasses(ClassId, RelaSource),
    INDEX IX_ClassId (ClassId),
    INDEX IX_Rela (Rela)
);

-- Cached API Responses (for expensive operations)
CREATE TABLE APIResponseCache (
    CacheKey NVARCHAR(500) PRIMARY KEY,
    ResponseData NVARCHAR(MAX) NOT NULL, -- JSON response
    CacheExpiry DATETIME2 NOT NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    INDEX IX_CacheExpiry (CacheExpiry)
);

-- User Search History
CREATE TABLE UserSearchHistory (
    SearchId INT IDENTITY PRIMARY KEY,
    UserId NVARCHAR(100) NOT NULL,
    SearchTerm NVARCHAR(500) NOT NULL,
    SearchType NVARCHAR(20) NOT NULL, -- UMLS, RxNorm, etc.
    ResultCount INT,
    SearchTimestamp DATETIME2 DEFAULT GETDATE(),
    INDEX IX_UserId (UserId),
    INDEX IX_SearchTimestamp (SearchTimestamp)
);

-- User Favorites
CREATE TABLE UserFavorites (
    FavoriteId INT IDENTITY PRIMARY KEY,
    UserId NVARCHAR(100) NOT NULL,
    CUI NVARCHAR(10),
    RxCUI NVARCHAR(10),
    Notes NVARCHAR(MAX),
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Favorite_CUI FOREIGN KEY (CUI)
        REFERENCES UMLSConcepts(CUI),
    CONSTRAINT FK_Favorite_RxCUI FOREIGN KEY (RxCUI)
        REFERENCES RxNormConcepts(RxCUI),
    INDEX IX_UserId (UserId),
    INDEX IX_CreatedAt (CreatedAt)
);
```

### 4.3 Caching Strategy

**Implement a two-tier caching approach:**

1. **Database Cache Table** (`APIResponseCache`):
   - Store expensive API responses (getAllRelatedInfo, full hierarchies)
   - TTL: 7-30 days depending on data volatility
   - Automatically clean up expired entries

2. **Application-Level Cache** (Redis/Memory):
   - Recent search results (TTL: 1-4 hours)
   - Frequently accessed concepts (TTL: 24 hours)
   - Session-specific data (TTL: session duration)

3. **Cache Key Strategy**:
   ```
   Format: {API}:{Endpoint}:{Parameters}:{Version}
   Examples:
   - UMLS:SEARCH:diabetes:2024AA
   - RXNORM:ALLRELATED:321988:v1
   - RXCLASS:BYDRUGID:7052:MEDRT:v1
   ```

### 4.4 Data Synchronization Strategy

1. **Initial Load**:
   - Populate commonly used ingredients (IN)
   - Load major drug classes (ATC, VA top levels)
   - Import frequently searched concepts

2. **Incremental Updates**:
   - Track `majorRevisionDate` for UMLS concepts
   - Monitor RxNorm version API for updates
   - Schedule weekly sync for drug classes

3. **On-Demand Population**:
   - Add new concepts when users search for them
   - Store user-accessed relationships
   - Build up database based on actual usage patterns

---

## 5. Implementation Recommendations

### 5.1 API Rate Limiting Considerations

**UMLS API**:
- No official rate limits published
- Implement exponential backoff for errors
- Cache aggressively to minimize API calls

**RxNorm/RxClass APIs**:
- No authentication or rate limits
- Still recommend request throttling (e.g., 10 req/sec)
- Batch operations where possible

### 5.2 Error Handling

**Common API Errors**:
- Invalid API key (UMLS)
- Concept not found (404)
- Invalid parameters (400)
- Service unavailable (503)

**Recommended Approach**:
```typescript
// Retry logic with exponential backoff
async function fetchWithRetry(url: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
      if (response.status === 404) return null; // Not found
      if (response.status >= 500) {
        // Server error, retry
        await sleep(Math.pow(2, i) * 1000);
        continue;
      }
      throw new Error(`API error: ${response.status}`);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000);
    }
  }
}
```

### 5.3 Performance Optimization

1. **Parallel Requests**:
   - When fetching multiple concepts, use `Promise.all()`
   - Limit concurrent requests (e.g., 5 at a time)

2. **Pagination**:
   - UMLS search limited to 200 results (no pagination)
   - For large result sets, use multiple specific queries

3. **Selective Field Fetching**:
   - Only request needed fields (use specific endpoints)
   - Avoid `getAllRelatedInfo` when specific relations suffice

4. **Database Indexing**:
   - Index all search fields (names, CUIs, RxCUIs)
   - Use full-text search for concept name searches
   - Consider partitioning for large tables

### 5.4 Security Considerations

1. **API Key Management**:
   - Store UMLS API key in Azure Key Vault
   - Never expose in client-side code
   - Rotate keys periodically

2. **User Data Protection**:
   - Encrypt sensitive user data (search history, notes)
   - Implement proper access controls
   - Comply with HIPAA if handling PHI

3. **Input Validation**:
   - Sanitize all user search inputs
   - Validate CUI/RxCUI formats before queries
   - Prevent SQL injection with parameterized queries

---

## 6. Example API Workflows

### 6.1 Drug Information Lookup Workflow

```typescript
// 1. User searches for "aspirin"
const searchTerm = "aspirin";

// 2. Search RxNorm for concepts
const searchResponse = await fetch(
  `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${searchTerm}`
);
const searchData = await searchResponse.json();

// 3. Get the ingredient RxCUI
const ingredient = searchData.drugGroup.conceptGroup
  .find(g => g.tty === "IN")
  ?.conceptProperties[0];

// 4. Get all related information
const relatedResponse = await fetch(
  `https://rxnav.nlm.nih.gov/REST/rxcui/${ingredient.rxcui}/allrelated.json`
);
const relatedData = await relatedResponse.json();

// 5. Get drug classes
const classResponse = await fetch(
  `https://rxnav.nlm.nih.gov/REST/rxclass/class/byRxcui.json?rxcui=${ingredient.rxcui}`
);
const classData = await classResponse.json();

// 6. Store frequently accessed data in database
await storeInDatabase({
  rxcui: ingredient.rxcui,
  name: ingredient.name,
  tty: ingredient.tty,
  classes: classData.rxclassDrugInfoList?.rxclassDrugInfo || []
});

// 7. Cache detailed response
await cacheResponse(`RXNORM:ALLRELATED:${ingredient.rxcui}`, relatedData, 30 * 24 * 60 * 60);
```

### 6.2 UMLS Concept Hierarchy Workflow

```typescript
// 1. User searches for "diabetes"
const searchTerm = "diabetes";

// 2. Search UMLS concepts
const searchResponse = await fetch(
  `https://uts-ws.nlm.nih.gov/rest/search/current?string=${searchTerm}&apiKey=${apiKey}`
);
const searchData = await searchResponse.json();

// 3. Get the top concept
const concept = searchData.result.results[0];

// 4. Get detailed concept information
const conceptResponse = await fetch(
  `https://uts-ws.nlm.nih.gov/rest/content/current/CUI/${concept.ui}?apiKey=${apiKey}`
);
const conceptData = await conceptResponse.json();

// 5. Get relationships/hierarchy
const relationsResponse = await fetch(
  `https://uts-ws.nlm.nih.gov/rest/content/current/CUI/${concept.ui}/relations?apiKey=${apiKey}`
);
const relationsData = await relationsResponse.json();

// 6. Store core concept data
await storeInDatabase({
  cui: conceptData.result.ui,
  preferredName: conceptData.result.name,
  semanticTypes: conceptData.result.semanticTypes,
  status: conceptData.result.status
});

// 7. Cache relationships (large, complex data)
await cacheResponse(
  `UMLS:RELATIONS:${concept.ui}`,
  relationsData,
  7 * 24 * 60 * 60 // 7 days
);
```

---

## 7. References and Resources

### Official Documentation
- [UMLS Terminology Services REST API](https://documentation.uts.nlm.nih.gov/)
- [UMLS Authentication](https://documentation.uts.nlm.nih.gov/rest/authentication.html)
- [Searching the UMLS](https://documentation.uts.nlm.nih.gov/rest/search/)
- [Retrieving UMLS Concept Information](https://documentation.uts.nlm.nih.gov/rest/concept/)
- [Retrieving UMLS Concept Relations](https://documentation.uts.nlm.nih.gov/rest/relations/)
- [RxNorm API Documentation](https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html)
- [RxClass API Documentation](https://lhncbc.nlm.nih.gov/RxNav/APIs/RxClassAPIs.html)
- [RxNorm Term Types (TTY)](https://www.nlm.nih.gov/research/umls/rxnorm/docs/appendix5.html)
- [RxNav Applications](https://lhncbc.nlm.nih.gov/RxNav/)

### Additional Resources
- [UMLS API Home](https://documentation.uts.nlm.nih.gov/rest/home.html)
- [UMLS Python Client](https://palasht75.github.io/umls-python-client-homepage/)
- [RxNorm Overview](https://www.nlm.nih.gov/research/umls/rxnorm/overview.html)
- [RxClass Overview](https://lhncbc.nlm.nih.gov/RxNav/applications/RxClassIntro.html)

### Code Examples
- [HHS/uts-rest-api GitHub Repository](https://github.com/HHS/uts-rest-api)

---

## Summary

### Key Takeaways

1. **UMLS API**:
   - Requires API key authentication (simple query parameter)
   - Search returns max 200 results (no pagination)
   - Concept data includes CUI, name, semantic types, counts
   - Relations endpoint provides hierarchical relationships (PAR/CHD/RB/RN)

2. **RxNorm API**:
   - No authentication required
   - Rich drug information with term types (IN, SCD, SBD, etc.)
   - `getAllRelatedInfo` provides comprehensive related concepts
   - NDC mappings available

3. **RxClass API**:
   - No authentication required
   - Multiple classification systems (ATC, MED-RT, VA, FDA)
   - Drug-to-class and class-to-drug lookups
   - Relationship types include may_treat, may_prevent, isa

4. **Database Strategy**:
   - Store: Core concepts, user data, frequently used mappings
   - Cache: Detailed hierarchies, extensive relationships, class info
   - Sync: Initial load + incremental updates + on-demand population

5. **Performance**:
   - Aggressive caching (two-tier: DB + app-level)
   - Parallel requests with throttling
   - Proper indexing and full-text search
   - Error handling with retry logic
