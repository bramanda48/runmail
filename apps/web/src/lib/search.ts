export type SearchFilter = {
  general: string[];
  from: string[];
  to: string[];
  subject: string[];
};

const PREFIXES = ["from", "to", "subject"] as const;

/**
 * Splits a local search query on whitespace. Tokens with a `from:` / `to:` /
 * `subject:` prefix (case-insensitive prefix, value kept as-is) go to that
 * bucket; everything else is a general token. Quoted phrases are NOT
 * supported in this MVP — each whitespace-separated token stands alone.
 */
export function parseSearchQuery(query: string): SearchFilter {
  const filter: SearchFilter = { general: [], from: [], to: [], subject: [] };
  const trimmed = query.trim();
  if (!trimmed) return filter;
  for (const token of trimmed.split(/\s+/)) {
    if (!token) continue;
    const colon = token.indexOf(":");
    if (colon > 0) {
      const prefix = token.slice(0, colon).toLowerCase();
      const value = token.slice(colon + 1);
      if (value && (PREFIXES as readonly string[]).includes(prefix)) {
        filter[prefix as (typeof PREFIXES)[number]].push(value);
        continue;
      }
    }
    filter.general.push(token);
  }
  return filter;
}
