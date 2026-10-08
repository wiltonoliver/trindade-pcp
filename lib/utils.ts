import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sanitizeUnit(unit?: string): string {
  if (!unit || typeof unit !== 'string') return 'un';
  const trimmed = unit.trim();
  // If unit is longer than 6 chars or contains corrupted explanation text/repeats/symbols
  if (
    trimmed.length > 6 ||
    /[()\/\\-]/.test(trimmed) ||
    /versidade|peça|unidade|quantidade|lotes/i.test(trimmed)
  ) {
    if (/pç|peça/i.test(trimmed)) return 'pç';
    if (/m2|m²/i.test(trimmed)) return 'm²';
    if (/kg/i.test(trimmed)) return 'kg';
    if (/cx|caixa/i.test(trimmed)) return 'cx';
    return 'un';
  }
  return trimmed;
}

/**
 * Normalizes text for search comparisons by converting to lowercase,
 * trimming, and stripping diacritics/accents (e.g. "BALCAÕ" or "BALCÃO" -> "balcao").
 */
export function normalizeSearchText(str: string | undefined | null | number): string {
  if (str === undefined || str === null) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Checks if any of the target fields matches a multi-term search query.
 * Terms can be separated by ';' (semicolon), e.g. "VITRO; LAMBRIL; BALCAÕ".
 * - Returns true if query is empty.
 * - An item matches if it matches ANY of the semicolon-separated terms (OR condition).
 * - Within a term, if there are multiple space-separated words, each word must be present (AND condition within the term).
 */
export function matchesMultiTermSearch(
  fields: (string | undefined | null | number)[],
  query: string | undefined | null
): boolean {
  if (!query || !query.trim()) return true;

  // Split by semicolon into distinct search terms
  const terms = query
    .split(';')
    .map((t) => t.trim())
    .filter(Boolean);

  if (terms.length === 0) return true;

  // Build a single normalized text representing all fields of the item
  const combinedFieldsText = fields
    .map((f) => normalizeSearchText(f))
    .filter(Boolean)
    .join(' ');

  // Return true if ANY term matches (OR condition)
  return terms.some((term) => {
    const normalizedTerm = normalizeSearchText(term);
    if (!normalizedTerm) return true;

    // Tokens within a single term (space-separated words)
    const tokens = normalizedTerm.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return true;

    // All tokens of this term must appear in the item's fields (AND condition within the term)
    return tokens.every((token) => combinedFieldsText.includes(token));
  });
}


