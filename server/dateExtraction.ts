/**
 * Date Extraction Utilities
 *
 * Extracts dates from document filenames and content for creating
 * standalone chart notes when documents don't match existing appointments
 */

import { toEasternDate } from './lib/eastern-time';

export interface ExtractedDate {
  date: Date;
  confidence: number;
  source: 'filename' | 'content' | 'metadata';
  matchedPattern: string;
}

/**
 * Common date patterns found in filenames and content
 */
const DATE_PATTERNS = [
  // ISO format: 2024-07-05, 2024/07/05
  {
    regex: /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/g,
    parse: (match: RegExpMatchArray) => ({
      year: parseInt(match[1]),
      month: parseInt(match[2]) - 1, // JS months are 0-indexed
      day: parseInt(match[3])
    }),
    confidence: 0.95
  },

  // US format: 07-05-2024, 07/05/2024, 7-5-2024
  {
    regex: /\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/g,
    parse: (match: RegExpMatchArray) => ({
      year: parseInt(match[3]),
      month: parseInt(match[1]) - 1,
      day: parseInt(match[2])
    }),
    confidence: 0.9
  },

  // Short year format: 07-05-24, 7/5/24
  {
    regex: /\b(\d{1,2})[-/](\d{1,2})[-/](\d{2})\b/g,
    parse: (match: RegExpMatchArray) => {
      let year = parseInt(match[3]);
      // Assume 20xx for years 00-50, 19xx for years 51-99
      year = year <= 50 ? 2000 + year : 1900 + year;
      return {
        year,
        month: parseInt(match[1]) - 1,
        day: parseInt(match[2])
      };
    },
    confidence: 0.85
  },

  // Month name formats: July 5, 2024; July 5th, 2024
  {
    regex: /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/gi,
    parse: (match: RegExpMatchArray) => {
      const monthNames = {
        'january': 0, 'jan': 0,
        'february': 1, 'feb': 1,
        'march': 2, 'mar': 2,
        'april': 3, 'apr': 3,
        'may': 4,
        'june': 5, 'jun': 5,
        'july': 6, 'jul': 6,
        'august': 7, 'aug': 7,
        'september': 8, 'sep': 8, 'sept': 8,
        'october': 9, 'oct': 9,
        'november': 10, 'nov': 10,
        'december': 11, 'dec': 11
      };
      return {
        year: parseInt(match[3]),
        month: monthNames[match[1].toLowerCase() as keyof typeof monthNames],
        day: parseInt(match[2])
      };
    },
    confidence: 0.95
  },

  // Month/day only: July 5, July 5th (assumes current or previous year)
  {
    regex: /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/gi,
    parse: (match: RegExpMatchArray) => {
      const monthNames = {
        'january': 0, 'jan': 0,
        'february': 1, 'feb': 1,
        'march': 2, 'mar': 2,
        'april': 3, 'apr': 3,
        'may': 4,
        'june': 5, 'jun': 5,
        'july': 6, 'jul': 6,
        'august': 7, 'aug': 7,
        'september': 8, 'sep': 8, 'sept': 8,
        'october': 9, 'oct': 9,
        'november': 10, 'nov': 10,
        'december': 11, 'dec': 11
      };
      const month = monthNames[match[1].toLowerCase() as keyof typeof monthNames];
      const day = parseInt(match[2]);

      // Infer year: use current year if date hasn't passed, otherwise previous year
      const now = new Date();
      let year = now.getFullYear();
      const testDate = new Date(year, month, day);
      if (testDate > now) {
        year--;
      }

      return { year, month, day };
    },
    confidence: 0.75
  }
];

/**
 * Extract date from filename
 */
export function extractDateFromFilename(filename: string): ExtractedDate | null {
  console.log(`[Date Extraction] Extracting date from filename: ${filename}`);

  for (const pattern of DATE_PATTERNS) {
    const matches = [...filename.matchAll(pattern.regex)];

    for (const match of matches) {
      try {
        const { year, month, day } = pattern.parse(match);

        // Validate date
        if (month < 0 || month > 11 || day < 1 || day > 31 || year < 1900 || year > 2100) {
          console.log(`[Date Extraction] Invalid date values: ${year}-${month + 1}-${day}`);
          continue;
        }

        const date = new Date(year, month, day);

        // Validate that the date is actually valid (e.g., not Feb 30)
        if (date.getMonth() !== month || date.getDate() !== day) {
          console.log(`[Date Extraction] Date validation failed: ${year}-${month + 1}-${day}`);
          continue;
        }

        console.log(`[Date Extraction] Found date in filename: ${date.toISOString()} (confidence: ${pattern.confidence})`);

        return {
          date,
          confidence: pattern.confidence,
          source: 'filename',
          matchedPattern: match[0]
        };
      } catch (error) {
        console.log(`[Date Extraction] Error parsing date from match: ${match[0]}`, error);
        continue;
      }
    }
  }

  console.log(`[Date Extraction] No date found in filename: ${filename}`);
  return null;
}

/**
 * Extract date from document content
 * Looks for dates near keywords like "session", "appointment", "date", etc.
 */
export function extractDateFromContent(content: string): ExtractedDate | null {
  console.log(`[Date Extraction] Extracting date from content (${content.length} characters)`);

  // Keywords that often appear near relevant dates
  const contextKeywords = [
    'session',
    'appointment',
    'visit',
    'date:',
    'on',
    'therapy',
    'meeting',
    'consultation'
  ];

  const allMatches: Array<{ date: Date; confidence: number; matchedPattern: string; contextScore: number }> = [];

  // Try each pattern on the content
  for (const pattern of DATE_PATTERNS) {
    const matches = [...content.matchAll(pattern.regex)];

    for (const match of matches) {
      try {
        const { year, month, day } = pattern.parse(match);

        // Validate date
        if (month < 0 || month > 11 || day < 1 || day > 31 || year < 1900 || year > 2100) {
          continue;
        }

        const date = new Date(year, month, day);

        // Validate that the date is actually valid
        if (date.getMonth() !== month || date.getDate() !== day) {
          continue;
        }

        // Calculate context score based on proximity to keywords
        const matchIndex = match.index || 0;
        const contextWindow = content.substring(
          Math.max(0, matchIndex - 50),
          Math.min(content.length, matchIndex + 50)
        ).toLowerCase();

        let contextScore = 0;
        for (const keyword of contextKeywords) {
          if (contextWindow.includes(keyword)) {
            contextScore += 0.1;
          }
        }

        // Boost score if date is at the beginning of content (common for session notes)
        if (matchIndex < 200) {
          contextScore += 0.2;
        }

        allMatches.push({
          date,
          confidence: pattern.confidence * (1 + Math.min(contextScore, 0.5)),
          matchedPattern: match[0],
          contextScore
        });
      } catch (error) {
        continue;
      }
    }
  }

  // Return the match with the highest confidence
  if (allMatches.length > 0) {
    allMatches.sort((a, b) => b.confidence - a.confidence);
    const best = allMatches[0];

    console.log(`[Date Extraction] Found date in content: ${best.date.toISOString()} (confidence: ${best.confidence})`);

    return {
      date: best.date,
      confidence: best.confidence,
      source: 'content',
      matchedPattern: best.matchedPattern
    };
  }

  console.log(`[Date Extraction] No date found in content`);
  return null;
}

/**
 * Extract the best date from a document (tries filename first, then content)
 */
export function extractBestDate(filename: string, content: string): ExtractedDate | null {
  // Try filename first (usually more reliable)
  const filenameDate = extractDateFromFilename(filename);
  if (filenameDate && filenameDate.confidence >= 0.85) {
    return filenameDate;
  }

  // Try content
  const contentDate = extractDateFromContent(content);

  // Compare and return the best match
  if (!filenameDate && !contentDate) {
    return null;
  }

  if (!filenameDate) {
    return contentDate;
  }

  if (!contentDate) {
    return filenameDate;
  }

  // Both found - return the one with higher confidence
  return filenameDate.confidence >= contentDate.confidence ? filenameDate : contentDate;
}

/**
 * Test function for date extraction
 */
export function testDateExtraction() {
  console.log('\n=== Date Extraction Tests ===\n');

  const testCases = [
    {
      filename: 'Session_7-5-2024.pdf',
      expected: '2024-07-05'
    },
    {
      filename: 'Progress Note 07-05-2024.docx',
      expected: '2024-07-05'
    },
    {
      filename: 'Therapy_Session_2024-07-05.pdf',
      expected: '2024-07-05'
    },
    {
      filename: 'Client Notes July 5th 2024.txt',
      expected: '2024-07-05'
    },
    {
      filename: 'Notes_7_5_24.pdf',
      expected: '2024-07-05'
    }
  ];

  for (const testCase of testCases) {
    const result = extractDateFromFilename(testCase.filename);
    const passed = result && result.date.toISOString().startsWith(testCase.expected);

    console.log(`Filename: "${testCase.filename}"`);
    console.log(`Expected: ${testCase.expected}`);
    console.log(`Result: ${result ? result.date.toISOString() : 'null'}`);
    console.log(`Status: ${passed ? '✓ PASS' : '✗ FAIL'}\n`);
  }
}
