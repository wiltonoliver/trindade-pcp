/**
 * Utility functions for date formatting, normalization, and comparison.
 * Prevents timezone offset shifts and date string format mismatches.
 */

/**
 * Returns local date ISO string (YYYY-MM-DD) without UTC timezone offset shift.
 */
export const getLocalDateISO = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Returns local date formatted as DD/MM/YYYY.
 */
export const getLocalDateFormatted = (date: Date = new Date()): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Normalizes any date string (e.g., "2026-08-12", "12/08/2026", "12/08/26", "2026-08-12T00:00:00.000Z") to "DD/MM/YYYY".
 * Returns "Aguardando Data" if invalid or empty.
 */
export const normalizeDateToDDMMYYYY = (dateStr?: string | null): string => {
  if (!dateStr) return 'Aguardando Data';
  const trimmed = dateStr.trim();
  if (!trimmed || trimmed.toLowerCase().includes('aguardando')) {
    return 'Aguardando Data';
  }

  // Already DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    return trimmed;
  }

  // DD/MM/YY (e.g., 12/08/26)
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('/');
    return `${d}/${m}/20${y}`;
  }

  // YYYY-MM-DD or ISO string
  if (trimmed.includes('-')) {
    const datePart = trimmed.split('T')[0];
    const parts = datePart.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      if (y.length === 4) {
        return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
      }
    }
  }

  return trimmed;
};

/**
 * Compare two DD/MM/YYYY dates. Returns true if dateA is strictly before dateB chronologically.
 */
export const isDateBefore = (dateStrA: string, dateStrB: string): boolean => {
  const normA = normalizeDateToDDMMYYYY(dateStrA);
  const normB = normalizeDateToDDMMYYYY(dateStrB);

  if (!normA || !normB || normA === 'Aguardando Data' || normB === 'Aguardando Data') {
    return false;
  }

  const partsA = normA.split('/');
  const partsB = normB.split('/');

  if (partsA.length !== 3 || partsB.length !== 3) return false;

  const valA = Number(`${partsA[2]}${partsA[1].padStart(2, '0')}${partsA[0].padStart(2, '0')}`);
  const valB = Number(`${partsB[2]}${partsB[1].padStart(2, '0')}${partsB[0].padStart(2, '0')}`);

  return valA < valB;
};

/**
 * Compare two DD/MM/YYYY dates. Returns true if they represent the exact same calendar day.
 */
export const isSameCalendarDay = (dateStrA: string, dateStrB: string): boolean => {
  const normA = normalizeDateToDDMMYYYY(dateStrA);
  const normB = normalizeDateToDDMMYYYY(dateStrB);
  if (!normA || !normB || normA === 'Aguardando Data' || normB === 'Aguardando Data') {
    return false;
  }
  return normA === normB;
};
