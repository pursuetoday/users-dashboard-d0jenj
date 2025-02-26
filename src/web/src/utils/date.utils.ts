/**
 * Date utility functions for consistent date handling and display
 * throughout the frontend application
 */

import { format, parseISO, isValid } from 'date-fns'; // date-fns: ^2.30.0

/**
 * Formats a date string into a human-readable format with custom pattern support
 * @param dateString - ISO date string to format
 * @param formatPattern - date-fns compatible format pattern
 * @returns Formatted date string or empty string if date is invalid
 */
export const formatDate = (dateString: string, formatPattern: string): string => {
  try {
    if (!dateString) return '';
    
    const date = parseISO(dateString);
    if (!isValid(date)) return '';
    
    return format(date, formatPattern);
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

/**
 * Formats a date string to include both date and time components
 * @param dateString - ISO date string to format
 * @returns Formatted date and time string (e.g., 'Jan 1, 2023 13:45')
 */
export const formatDateTime = (dateString: string): string => {
  return formatDate(dateString, 'MMM d, yyyy HH:mm');
};

/**
 * Formats a date string in short format for compact display
 * @param dateString - ISO date string to format
 * @returns Short formatted date string (e.g., '01/01/2023')
 */
export const formatDateShort = (dateString: string): string => {
  return formatDate(dateString, 'MM/dd/yyyy');
};

/**
 * Calculates and returns a human-readable relative time string
 * @param dateString - ISO date string to calculate relative time from
 * @returns Relative time string (e.g., '2 hours ago', 'in 3 days')
 */
export const getRelativeTime = (dateString: string): string => {
  try {
    if (!dateString) return '';
    
    const date = parseISO(dateString);
    if (!isValid(date)) return '';
    
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffSeconds = Math.floor(Math.abs(diffMs) / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    // Future or past determination
    const isFuture = diffMs > 0;
    const prefix = isFuture ? 'in ' : '';
    const suffix = isFuture ? '' : ' ago';
    
    // Format based on appropriate time unit
    if (diffDays > 0) {
      return `${prefix}${diffDays} day${diffDays !== 1 ? 's' : ''}${suffix}`;
    } else if (diffHours > 0) {
      return `${prefix}${diffHours} hour${diffHours !== 1 ? 's' : ''}${suffix}`;
    } else if (diffMinutes > 0) {
      return `${prefix}${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}${suffix}`;
    } else {
      return 'just now';
    }
  } catch (error) {
    console.error('Error calculating relative time:', error);
    return '';
  }
};

/**
 * Validates if a provided date string is in valid ISO format
 * @param dateString - ISO date string to validate
 * @returns True if date is valid, false otherwise
 */
export const isValidDate = (dateString: string): boolean => {
  try {
    if (!dateString) return false;
    
    const date = parseISO(dateString);
    return isValid(date);
  } catch (error) {
    console.error('Error validating date:', error);
    return false;
  }
};