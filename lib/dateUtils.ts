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

  // DD/MM (e.g., 12/08)
  if (/^\d{2}\/\d{2}$/.test(trimmed)) {
    const currentYear = new Date().getFullYear();
    return `${trimmed}/${currentYear}`;
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
 * Strictly extracts and returns a DD/MM/YYYY date from any string format (ISO, DD/MM/YYYY HH:mm, YYYY-MM-DD, etc.)
 * Returns fallback or empty string if not found.
 */
export const extractDMYDate = (raw?: string | null, fallback: string = ''): string => {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase().includes('aguardando') || trimmed.toLowerCase().includes('sem data')) {
    return fallback;
  }

  // 1. Check for DD/MM/YYYY (e.g. 15/09/2026, 15/09/2026, 13:40, 15/09/2026 às 13:40)
  const dmyMatch = trimmed.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${day}/${month}/${year}`;
  }

  // 2. Check for DD/MM/YY (e.g. 15/09/26)
  const dmyShortMatch = trimmed.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2})\b/);
  if (dmyShortMatch) {
    const day = dmyShortMatch[1].padStart(2, '0');
    const month = dmyShortMatch[2].padStart(2, '0');
    const year = `20${dmyShortMatch[3]}`;
    return `${day}/${month}/${year}`;
  }

  // 3. Check for YYYY-MM-DD (e.g. 2026-09-15 or ISO 2026-09-15T13:40:00.000Z)
  const ymdMatch = trimmed.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${day}/${month}/${year}`;
  }

  // 4. Try parsing with JS Date
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return fallback;
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

/**
 * Checks if an order was programmed for a past date and has not been completed ("baixa").
 */
export const isOrderOverdueForCheckoff = (
  productionDate?: string | null,
  executionStatus?: string,
  progress: number = 0,
  todayDateStr: string = getLocalDateFormatted(),
  isClosedUncompleted?: boolean
): boolean => {
  if (executionStatus === 'concluido' || progress >= 100 || isClosedUncompleted) return false;
  if (!productionDate || productionDate.toLowerCase().includes('aguardando')) return false;
  const norm = normalizeDateToDDMMYYYY(productionDate);
  return isDateBefore(norm, todayDateStr);
};
