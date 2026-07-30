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

