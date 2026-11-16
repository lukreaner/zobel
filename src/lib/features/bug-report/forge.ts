import { appName } from '#lib/deployment/brand.js';
import { bugReportUrl, communityFeatures } from '#lib/deployment/links.js';
import { openExternalUrl, opensExternalUrls } from '#lib/platform/external-links.js';

export type ReportType = 'bug' | 'feature';

export interface ForgeIssue {
  number: number;
  title: string;
  html_url: string;
}

// Zobel's tracker is GitHub Issues, not Sable's Forgejo.
const FORGE_ORIGIN = 'https://github.com';
const FORGE_REPO = 'lukreaner/zobel';

const TEMPLATES: Record<ReportType, string> = {
  bug: 'bug_report.yml',
  feature: 'feature_request.yml',
};

const forgeIssuesUrl = `${FORGE_ORIGIN}/${FORGE_REPO}/issues`;

export function issueEnvironment(platform: string, video = ''): string {
  const userAgent = typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent;
  const version = `v${import.meta.env.VITE_APP_VERSION ?? 'dev'}`;
  const environment = `- OS: ${platform}\n- Browser: ${userAgent}\n- ${appName()}: ${version}`;
  return video ? `${environment}\n- Video: ${video}` : environment;
}

export function forgeIssueUrl(
  type: ReportType,
  title: string,
  fields: Record<string, string>
): string {
  const params = new globalThis.URLSearchParams({ template: TEMPLATES[type], title: title.trim() });
  for (const [id, value] of Object.entries(fields)) {
    if (value.trim() !== '') params.set(id, value);
  }
  return `${forgeIssuesUrl}/new?${params}`;
}

export function usesForge(): boolean {
  return bugReportUrl() === null && communityFeatures();
}

export function issueTrackerAvailable(): boolean {
  return bugReportUrl() !== null || communityFeatures();
}

export function reportIssueUrl(
  type: ReportType,
  title: string,
  fields: Record<string, string>
): string {
  return bugReportUrl() ?? forgeIssueUrl(type, title, fields);
}

export async function searchForgeIssues(query: string, signal: AbortSignal): Promise<ForgeIssue[]> {
  const params = new globalThis.URLSearchParams({
    q: `${query} repo:${FORGE_REPO} is:issue is:open`,
    per_page: '5',
  });
  const response = await fetch(`https://api.github.com/search/issues?${params}`, {
    headers: { Accept: 'application/vnd.github+json' },
    signal,
  });
  if (!response.ok) return [];
  return ((await response.json()) as { items?: ForgeIssue[] }).items ?? [];
}

export async function openForgeIssueUrl(url: string): Promise<void> {
  if (opensExternalUrls()) {
    const opened = await openExternalUrl(url).then(
      () => true,
      (error: unknown) => {
        console.debug('[sable report] opening the issue externally failed', error);
        return false;
      }
    );
    if (opened) return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
