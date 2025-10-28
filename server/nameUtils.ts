/**
 * Name Matching Utilities
 *
 * Provides sophisticated client name matching to handle:
 * - Nickname variations (Chris/Christopher, Steve/Steven)
 * - Middle initial presence/absence (Hector E. Mendez / Hector Mendez)
 * - Spacing variations (De Luca / Deluca / DeLuca)
 * - Case insensitivity
 */

// Common nickname mappings - bidirectional
const NICKNAME_MAP: Record<string, string[]> = {
  // A
  'alexander': ['alex', 'xander', 'alexander'],
  'alex': ['alexander', 'alex', 'xander'],
  'andrew': ['andy', 'drew', 'andrew'],
  'andy': ['andrew', 'andy', 'drew'],
  'anthony': ['tony', 'anthony'],
  'tony': ['anthony', 'tony'],

  // B
  'benjamin': ['ben', 'benny', 'benjamin'],
  'ben': ['benjamin', 'ben', 'benny'],
  'robert': ['bob', 'bobby', 'rob', 'robbie', 'robert'],
  'bob': ['robert', 'bob', 'bobby', 'rob'],
  'bobby': ['robert', 'bob', 'bobby', 'rob'],

  // C
  'charles': ['charlie', 'chuck', 'charles'],
  'charlie': ['charles', 'charlie', 'chuck'],
  'christopher': ['chris', 'christopher'],
  'chris': ['christopher', 'chris'],
  'christine': ['chris', 'christine', 'christina', 'christy'],
  'christina': ['chris', 'christine', 'christina', 'christy'],

  // D
  'daniel': ['dan', 'danny', 'daniel'],
  'dan': ['daniel', 'dan', 'danny'],
  'david': ['dave', 'david'],
  'dave': ['david', 'dave'],
  'deborah': ['debbie', 'deb', 'deborah'],
  'debbie': ['deborah', 'debbie', 'deb'],

  // E
  'edward': ['ed', 'eddie', 'edward'],
  'ed': ['edward', 'ed', 'eddie'],
  'elizabeth': ['liz', 'beth', 'betty', 'lizzie', 'elizabeth'],
  'liz': ['elizabeth', 'liz', 'beth', 'betty', 'lizzie'],

  // F
  'francis': ['frank', 'francis'],
  'frank': ['francis', 'frank'],
  'frederick': ['fred', 'freddie', 'frederick'],
  'fred': ['frederick', 'fred', 'freddie'],

  // G
  'gregory': ['greg', 'gregory'],
  'greg': ['gregory', 'greg'],

  // J
  'james': ['jim', 'jimmy', 'jamie', 'james'],
  'jim': ['james', 'jim', 'jimmy', 'jamie'],
  'jennifer': ['jen', 'jenny', 'jennifer'],
  'jen': ['jennifer', 'jen', 'jenny'],
  'jessica': ['jess', 'jessie', 'jessica'],
  'jess': ['jessica', 'jess', 'jessie'],
  'john': ['johnny', 'jack', 'john'],
  'johnny': ['john', 'johnny', 'jack'],
  'jonathan': ['jon', 'jonathan'],
  'jon': ['jonathan', 'jon'],
  'joseph': ['joe', 'joey', 'joseph'],
  'joe': ['joseph', 'joe', 'joey'],

  // K
  'katherine': ['kate', 'kathy', 'katie', 'kat', 'katherine', 'catherine'],
  'catherine': ['kate', 'kathy', 'katie', 'kat', 'katherine', 'catherine'],
  'kate': ['katherine', 'kate', 'kathy', 'katie', 'catherine'],
  'kenneth': ['ken', 'kenny', 'kenneth'],
  'ken': ['kenneth', 'ken', 'kenny'],

  // L
  'lawrence': ['larry', 'lawrence'],
  'larry': ['lawrence', 'larry'],

  // M
  'margaret': ['maggie', 'meg', 'peggy', 'margaret'],
  'maggie': ['margaret', 'maggie', 'meg', 'peggy'],
  'matthew': ['matt', 'matthew'],
  'matt': ['matthew', 'matt'],
  'michael': ['mike', 'mickey', 'mick', 'michael'],
  'mike': ['michael', 'mike', 'mickey', 'mick'],
  'michelle': ['mickey', 'shelly', 'michelle'],

  // N
  'nicholas': ['nick', 'nicky', 'nicholas'],
  'nick': ['nicholas', 'nick', 'nicky'],

  // P
  'patricia': ['pat', 'patty', 'tricia', 'patricia'],
  'pat': ['patricia', 'pat', 'patty', 'patrick'],
  'patrick': ['pat', 'patrick'],

  // R
  'rebecca': ['becky', 'rebecca'],
  'becky': ['rebecca', 'becky'],
  'richard': ['rick', 'ricky', 'dick', 'richard'],
  'rick': ['richard', 'rick', 'ricky'],

  // S
  'samuel': ['sam', 'sammy', 'samuel'],
  'sam': ['samuel', 'sam', 'sammy'],
  'stephanie': ['steph', 'stephanie'],
  'steph': ['stephanie', 'steph'],
  'steven': ['steve', 'steven', 'stephen'],
  'stephen': ['steve', 'steven', 'stephen'],
  'steve': ['steven', 'stephen', 'steve'],
  'susan': ['sue', 'susie', 'susan'],
  'sue': ['susan', 'sue', 'susie'],

  // T
  'thomas': ['tom', 'tommy', 'thomas'],
  'tom': ['thomas', 'tom', 'tommy'],
  'timothy': ['tim', 'timmy', 'timothy'],
  'tim': ['timothy', 'tim', 'timmy'],

  // W
  'william': ['bill', 'billy', 'will', 'willie', 'william'],
  'bill': ['william', 'bill', 'billy', 'will'],
  'will': ['william', 'bill', 'billy', 'will', 'willie'],
};

/**
 * Normalize a name component by:
 * - Converting to lowercase
 * - Removing middle initials (single letter with optional period)
 * - Removing spaces, hyphens, apostrophes
 * - Trimming whitespace
 */
function normalizeNameComponent(name: string): string {
  if (!name) return '';

  return name
    .toLowerCase()
    .trim()
    // Remove single letter middle initials with optional period
    .replace(/\b[a-z]\.\s*/gi, '')
    // Remove spaces, hyphens, apostrophes
    .replace(/[\s'-]/g, '');
}

/**
 * Get all possible name variations including nicknames
 */
function getNameVariations(name: string): string[] {
  const normalized = normalizeNameComponent(name);

  // Start with the normalized name
  const variations = [normalized];

  // Add nickname variations if they exist
  if (NICKNAME_MAP[normalized]) {
    variations.push(...NICKNAME_MAP[normalized].map(n => normalizeNameComponent(n)));
  }

  // Remove duplicates
  return [...new Set(variations)];
}

/**
 * Parse a full name string into components
 * Handles formats like:
 * - "First Last"
 * - "First Middle Last"
 * - "First M. Last"
 * - "First Last Suffix"
 */
interface ParsedName {
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
}

function parseFullName(fullName: string): ParsedName {
  if (!fullName) {
    return { firstName: '', lastName: '' };
  }

  const parts = fullName.trim().split(/\s+/);

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  if (parts.length === 2) {
    return { firstName: parts[0], lastName: parts[1] };
  }

  // Check if last part is a suffix (Jr., Sr., III, etc.)
  const suffixes = ['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v'];
  const lastPart = parts[parts.length - 1].toLowerCase();
  const hasSuffix = suffixes.includes(lastPart);

  if (hasSuffix) {
    return {
      firstName: parts[0],
      middleName: parts.slice(1, -2).join(' '),
      lastName: parts[parts.length - 2],
      suffix: parts[parts.length - 1]
    };
  }

  // Multiple parts, assume: First [Middle...] Last
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts[parts.length - 1]
  };
}

/**
 * Create a normalized search key for a client
 * This key can be used for exact matching after normalization
 */
export function createClientSearchKey(firstName: string, lastName: string): string {
  const normalizedFirst = normalizeNameComponent(firstName);
  const normalizedLast = normalizeNameComponent(lastName);
  return `${normalizedFirst}|${normalizedLast}`;
}

/**
 * Create multiple search keys for a client including nickname variations
 */
export function createClientSearchKeys(firstName: string, lastName: string): string[] {
  const firstVariations = getNameVariations(firstName);
  const lastVariations = getNameVariations(lastName);

  const keys: string[] = [];
  for (const first of firstVariations) {
    for (const last of lastVariations) {
      keys.push(`${first}|${last}`);
    }
  }

  return [...new Set(keys)]; // Remove duplicates
}

/**
 * Match a search name against a client record
 * Returns confidence score (0-1)
 */
export interface NameMatchResult {
  matched: boolean;
  confidence: number;
  matchType: 'exact' | 'nickname' | 'partial' | 'none';
  details?: string;
}

export function matchClientName(
  searchFirstName: string,
  searchLastName: string,
  clientFirstName: string,
  clientLastName: string
): NameMatchResult {
  // Handle full name string if provided
  let searchFirst = searchFirstName;
  let searchLast = searchLastName;

  if (searchFirstName && !searchLastName) {
    const parsed = parseFullName(searchFirstName);
    searchFirst = parsed.firstName;
    searchLast = parsed.lastName;
  }

  // Generate all search keys for both the search term and client
  const searchKeys = createClientSearchKeys(searchFirst, searchLast);
  const clientKeys = createClientSearchKeys(clientFirstName, clientLastName);

  // Check for exact match (after normalization)
  const exactSearchKey = createClientSearchKey(searchFirst, searchLast);
  const exactClientKey = createClientSearchKey(clientFirstName, clientLastName);

  if (exactSearchKey === exactClientKey) {
    return {
      matched: true,
      confidence: 1.0,
      matchType: 'exact',
      details: 'Exact name match after normalization'
    };
  }

  // Check for nickname match
  for (const searchKey of searchKeys) {
    if (clientKeys.includes(searchKey)) {
      return {
        matched: true,
        confidence: 0.95,
        matchType: 'nickname',
        details: 'Match found using nickname variation'
      };
    }
  }

  // Check for partial match (last name match + first name partial)
  const normalizedSearchLast = normalizeNameComponent(searchLast);
  const normalizedClientLast = normalizeNameComponent(clientLastName);

  if (normalizedSearchLast === normalizedClientLast) {
    const normalizedSearchFirst = normalizeNameComponent(searchFirst);
    const normalizedClientFirst = normalizeNameComponent(clientFirstName);

    // Check if one first name starts with the other
    if (normalizedSearchFirst.startsWith(normalizedClientFirst) ||
        normalizedClientFirst.startsWith(normalizedSearchFirst)) {
      return {
        matched: true,
        confidence: 0.85,
        matchType: 'partial',
        details: 'Last name match with partial first name match'
      };
    }
  }

  return {
    matched: false,
    confidence: 0,
    matchType: 'none'
  };
}

/**
 * Find best matching client from a list
 */
export function findBestClientMatch<T extends { firstName: string; lastName: string; id: string }>(
  searchFirstName: string,
  searchLastName: string,
  clients: T[],
  minConfidence: number = 0.8
): { client: T; match: NameMatchResult } | null {
  let bestMatch: { client: T; match: NameMatchResult } | null = null;

  for (const client of clients) {
    const match = matchClientName(
      searchFirstName,
      searchLastName,
      client.firstName,
      client.lastName
    );

    if (match.matched && match.confidence >= minConfidence) {
      if (!bestMatch || match.confidence > bestMatch.match.confidence) {
        bestMatch = { client, match };
      }
    }
  }

  return bestMatch;
}

/**
 * Test function to verify name matching logic
 */
export function testNameMatching() {
  const testCases = [
    {
      search: ['Chris', 'Balabanick'],
      client: ['Christopher', 'Balabanick'],
      expected: 'nickname'
    },
    {
      search: ['Steven', 'De Luca'],
      client: ['Steve', 'Deluca'],
      expected: 'nickname'
    },
    {
      search: ['Hector', 'Mendez'],
      client: ['Hector E.', 'Mendez'],
      expected: 'exact'
    },
    {
      search: ['Hector E.', 'Mendez'],
      client: ['Hector', 'Mendez'],
      expected: 'exact'
    },
    {
      search: ['Bob', 'Smith'],
      client: ['Robert', 'Smith'],
      expected: 'nickname'
    },
    {
      search: ['Bill', 'Johnson'],
      client: ['William', 'Johnson'],
      expected: 'nickname'
    }
  ];

  console.log('\n=== Name Matching Tests ===\n');

  for (const testCase of testCases) {
    const result = matchClientName(
      testCase.search[0],
      testCase.search[1],
      testCase.client[0],
      testCase.client[1]
    );

    const passed = result.matched && result.matchType === testCase.expected;

    console.log(`Test: "${testCase.search.join(' ')}" → "${testCase.client.join(' ')}"`);
    console.log(`  Expected: ${testCase.expected}`);
    console.log(`  Result: ${result.matchType} (confidence: ${result.confidence})`);
    console.log(`  Status: ${passed ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  Details: ${result.details}\n`);
  }
}
