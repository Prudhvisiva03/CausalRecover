/** API timestamps are stored in UTC. Older records are ISO strings without a timezone suffix. */
export function formatApiDate(value?: string | null, locale = "en-IN") {
  if (!value) return "—";
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString(locale);
}
