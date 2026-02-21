/**
 * CSV Utilities
 * Helper functions for CSV export and import
 */

/**
 * Convert an array of objects to CSV string
 */
export const objectsToCsv = (
  data: Record<string, unknown>[],
  columns?: string[]
): string => {
  if (data.length === 0) return '';
  
  // Use provided columns or derive from first object
  const headers = columns ?? Object.keys(data[0]);
  
  // Create header row
  const headerRow = headers.map(h => escapeCsvField(h)).join(',');
  
  // Create data rows
  const rows = data.map(item => 
    headers.map(h => escapeCsvField(item[h])).join(',')
  );
  
  return [headerRow, ...rows].join('\n');
};

/**
 * Escape a CSV field value
 */
export const escapeCsvField = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  
  const str = String(value);
  
  // If contains comma, newline, or quote, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  
  return str;
};

/**
 * Parse CSV string to array of objects
 */
export const csvToObjects = <T extends Record<string, unknown>>(
  csv: string,
  options?: {
    hasHeader?: boolean;
    columns?: string[];
    delimiter?: string;
  }
): T[] => {
  const { hasHeader = true, columns, delimiter = ',' } = options ?? {};
  
  const lines = parseCsvLines(csv, delimiter);
  
  if (lines.length === 0) return [];
  
  let headers: string[];
  let dataStartIndex: number;
  
  if (hasHeader) {
    headers = lines[0];
    dataStartIndex = 1;
  } else if (columns) {
    headers = columns;
    dataStartIndex = 0;
  } else {
    throw new Error('CSV must have headers or columns must be provided');
  }
  
  const results: T[] = [];
  
  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i];
    if (line.length === 0 || (line.length === 1 && line[0] === '')) continue;
    
    const obj: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      obj[header] = line[index] ?? '';
    });
    
    results.push(obj as T);
  }
  
  return results;
};

/**
 * Parse CSV lines handling quoted fields
 */
const parseCsvLines = (csv: string, delimiter: string): string[][] => {
  const lines: string[][] = [];
  let currentLine: string[] = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const nextChar = csv[i + 1];
    
    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++; // Skip next quote
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentLine.push(currentField);
        currentField = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentLine.push(currentField);
        lines.push(currentLine);
        currentLine = [];
        currentField = '';
        if (char === '\r') i++; // Skip \n after \r
      } else if (char !== '\r') {
        currentField += char;
      }
    }
  }
  
  // Don't forget the last field/line
  if (currentField || currentLine.length > 0) {
    currentLine.push(currentField);
    lines.push(currentLine);
  }
  
  return lines;
};

/**
 * Download CSV as file (for HTTP response)
 */
export const csvResponseHeaders = (
  filename: string
): Record<string, string> => ({
  'Content-Type': 'text/csv; charset=utf-8',
  'Content-Disposition': `attachment; filename="${filename}"`,
});

/**
 * Format a date for CSV export
 */
export const formatDateForCsv = (date: Date | null | undefined): string => {
  if (!date) return '';
  return date.toISOString().split('T')[0];
};

/**
 * Format a datetime for CSV export
 */
export const formatDateTimeForCsv = (date: Date | null | undefined): string => {
  if (!date) return '';
  return date.toISOString();
};

/**
 * Format boolean for CSV export
 */
export const formatBooleanForCsv = (value: boolean | null | undefined): string => {
  if (value === null || value === undefined) return '';
  return value ? '1' : '0';
};

/**
 * Parse boolean from CSV
 */
export const parseBooleanFromCsv = (value: string): boolean => {
  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
};

/**
 * Parse number from CSV
 */
export const parseNumberFromCsv = (value: string): number | null => {
  if (!value || value.trim() === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
};

/**
 * Parse integer from CSV
 */
export const parseIntFromCsv = (value: string): number | null => {
  if (!value || value.trim() === '') return null;
  const num = parseInt(value, 10);
  return isNaN(num) ? null : num;
};
