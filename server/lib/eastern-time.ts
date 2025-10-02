import { DateTime } from 'luxon';

const EASTERN_TIMEZONE = 'America/New_York';

/**
 * Converts any date to Eastern Time (America/New_York)
 * Handles both ISO strings and Date objects
 * @param date - The date to convert (ISO string or Date object)
 * @param sourceTimezone - Optional source timezone (defaults to UTC if not specified)
 * @returns Date object in Eastern Time
 */
export function toEasternDate(date: string | Date, sourceTimezone?: string): Date {
  let dt: DateTime;
  
  if (typeof date === 'string') {
    // Parse ISO string with optional timezone information
    dt = DateTime.fromISO(date, { 
      zone: sourceTimezone || 'utc'
    });
    
    // If parsing failed, try as a simple date string
    if (!dt.isValid) {
      dt = DateTime.fromJSDate(new Date(date));
    }
  } else {
    // Convert JavaScript Date to Luxon DateTime
    dt = DateTime.fromJSDate(date);
  }
  
  // Convert to Eastern Time and return as JavaScript Date
  return dt.setZone(EASTERN_TIMEZONE).toJSDate();
}

/**
 * Formats a date for display in Eastern Time
 * @param date - The date to format
 * @returns Formatted date string (e.g., "Jan 15, 2025 2:30 PM EST")
 */
export function formatEasternDateTime(date: Date): string {
  const dt = DateTime.fromJSDate(date).setZone(EASTERN_TIMEZONE);
  return dt.toFormat('LLL dd, yyyy h:mm a ZZZZ');
}

/**
 * Gets the current time in Eastern Time
 * @returns Date object representing current time in ET
 */
export function getCurrentEasternTime(): Date {
  return DateTime.now().setZone(EASTERN_TIMEZONE).toJSDate();
}

/**
 * Parses a date string in Eastern Time
 * Useful when the source data is known to be in Eastern Time
 * @param dateString - Date string to parse
 * @returns Date object in Eastern Time
 */
export function parseEasternDate(dateString: string): Date {
  const dt = DateTime.fromISO(dateString, { zone: EASTERN_TIMEZONE });
  return dt.toJSDate();
}

/**
 * Converts a Date object to ISO string in Eastern Time
 * @param date - Date to convert
 * @returns ISO string in Eastern Time
 */
export function toEasternISO(date: Date): string {
  const iso = DateTime.fromJSDate(date).setZone(EASTERN_TIMEZONE).toISO();
  if (!iso) {
    throw new Error('Failed to convert date to ISO string');
  }
  return iso;
}
