import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Timezone utility functions for consistent Eastern Time display
 * These functions ensure all dates are displayed in EST/EDT regardless of user's browser timezone
 */

// Eastern Time Zone constant
const EASTERN_TIMEZONE = 'America/New_York';

/**
 * Format a date string or Date object to Eastern Time locale date string
 */
export function formatDateEastern(date: string | Date | null | undefined): string {
  if (!date) return 'N/A';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleDateString('en-US', {
    timeZone: EASTERN_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format a date string or Date object to Eastern Time locale date and time string
 */
export function formatDateTimeEastern(date: string | Date | null | undefined): string {
  if (!date) return 'Never';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleString('en-US', {
    timeZone: EASTERN_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

/**
 * Format a date string or Date object to Eastern Time time string only
 * Database stores times in UTC, this function converts them to Eastern Time for display
 */
export function formatTimeEastern(date: string | Date | null | undefined): string {
  if (!date) return 'N/A';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Convert to Eastern Time and format
  return dateObj.toLocaleTimeString('en-US', {
    timeZone: EASTERN_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

/**
 * Calculate age based on date of birth, using Eastern Time for consistency
 */
export function calculateAgeEastern(dateOfBirth: string | Date | null): number | null {
  if (!dateOfBirth) return null;
  
  const birth = new Date(dateOfBirth);
  const today = new Date();
  
  // Convert both dates to Eastern time for consistent calculation
  const birthEastern = new Date(birth.toLocaleString('en-US', { timeZone: EASTERN_TIMEZONE }));
  const todayEastern = new Date(today.toLocaleString('en-US', { timeZone: EASTERN_TIMEZONE }));
  
  let age = todayEastern.getFullYear() - birthEastern.getFullYear();
  const monthDiff = todayEastern.getMonth() - birthEastern.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && todayEastern.getDate() < birthEastern.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Get current date/time in Eastern Time
 */
export function getCurrentEasternTime(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: EASTERN_TIMEZONE }));
}
