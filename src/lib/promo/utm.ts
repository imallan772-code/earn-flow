/**
 * UTM URL builder + merge.
 * Pure / deterministic — used by /api/public/r/$slug redirect and Studio preview.
 */
export interface UtmParams {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
  term?: string;
}

export function buildUtmUrl(targetUrl: string, utm: UtmParams): string {
  const url = new URL(targetUrl);
  url.searchParams.set("utm_source", utm.source);
  url.searchParams.set("utm_medium", utm.medium);
  url.searchParams.set("utm_campaign", utm.campaign);
  if (utm.content) url.searchParams.set("utm_content", utm.content);
  if (utm.term) url.searchParams.set("utm_term", utm.term);
  return url.toString();
}

export function mergeUtm(targetUrl: string, params: Record<string, string>): string {
  const url = new URL(targetUrl);
  for (const [k, v] of Object.entries(params)) {
    if (!v) continue;
    url.searchParams.set(k, v);
  }
  return url.toString();
}
