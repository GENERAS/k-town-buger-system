/**
 * Defensive payload sanitization synchronized with firebase-blueprint.json
 * constraints so outgoing Firestore writes strictly respect maxLength,
 * ID pattern, and array bounds.
 */

export const BLUEPRINT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function clampString(value: unknown, maxLen: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLen);
}

export function sanitizeId(value: string, fallbackPrefix = 'doc'): string {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 128);
  if (cleaned && BLUEPRINT_ID_PATTERN.test(cleaned)) {
    return cleaned;
  }
  return `${fallbackPrefix}-${Date.now()}`;
}

export function clampArray<T>(items: T[] | undefined, maxLen: number): T[] {
  if (!Array.isArray(items)) return [];
  return items.slice(0, maxLen);
}

export function nonNegativeNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num;
}

export function removeUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      result[k] = v;
    }
  }
  return result as T;
}
