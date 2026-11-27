// @vitest-environment happy-dom

import { expect, test, vi } from 'vitest';

import { forgeIssueUrl, issueEnvironment, openForgeIssueUrl, searchForgeIssues } from './forge.js';

const { openExternalUrl, opensExternalUrls } = vi.hoisted(() => ({
  openExternalUrl: vi.fn<(url: string) => Promise<void>>(),
  opensExternalUrls: vi.fn(() => false),
}));

vi.mock('#lib/platform/external-links.js', () => ({ openExternalUrl, opensExternalUrls }));

test('a bug report prefills the template fields GitHub reads', () => {
  const url = new URL(
    forgeIssueUrl('bug', '  Timeline jumps  ', {
      description: 'It jumps',
      reproduction: '',
      'expected-behavior': 'It stays',
    })
  );

  expect(url.origin + url.pathname).toBe('https://github.com/lukreaner/zobel/issues/new');
  expect(url.searchParams.get('template')).toBe('bug_report.yml');
  expect(url.searchParams.get('title')).toBe('Timeline jumps');
  expect(url.searchParams.get('description')).toBe('It jumps');
  expect(url.searchParams.get('expected-behavior')).toBe('It stays');
  expect(url.searchParams.has('reproduction')).toBe(false);
});

test('a feature request uses the other template', () => {
  const url = new URL(forgeIssueUrl('feature', 'Pinned rooms', { problem: 'Too much scrolling' }));

  expect(url.searchParams.get('template')).toBe('feature_request.yml');
  expect(url.searchParams.get('problem')).toBe('Too much scrolling');
});

test('a search asks GitHub for open issues in the Zobel repository', async () => {
  const issue = { number: 7, title: 'Timeline jumps', html_url: 'https://github.com/issue/7' };
  const fetch = vi.fn().mockResolvedValue(Response.json({ total_count: 1, items: [issue] }));
  vi.stubGlobal('fetch', fetch);

  await expect(searchForgeIssues('timeline', new AbortController().signal)).resolves.toEqual([
    issue,
  ]);
  const url = new URL(fetch.mock.calls[0]?.[0] as string);
  expect(url.origin + url.pathname).toBe('https://api.github.com/search/issues');
  expect(url.searchParams.get('q')).toBe('timeline repo:lukreaner/zobel is:issue is:open');

  vi.unstubAllGlobals();
});

test('a failed search yields no suggestions rather than throwing', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));

  await expect(searchForgeIssues('timeline', new AbortController().signal)).resolves.toEqual([]);

  vi.unstubAllGlobals();
});

test('the shell opens the issue, and the browser takes over when it refuses', async () => {
  const open = vi.fn();
  vi.stubGlobal('open', open);
  opensExternalUrls.mockReturnValue(true);
  openExternalUrl.mockRejectedValueOnce(new Error('no opener'));

  await openForgeIssueUrl('https://git.sable.moe/issue');
  expect(open).toHaveBeenCalledWith('https://git.sable.moe/issue', '_blank', 'noopener,noreferrer');

  openExternalUrl.mockResolvedValueOnce(undefined);
  await openForgeIssueUrl('https://git.sable.moe/issue');
  expect(open).toHaveBeenCalledOnce();

  vi.unstubAllGlobals();
});

test('names the OS, browser and app version for the environment field', () => {
  const info = issueEnvironment('linux 6.9 (x86_64)').split('\n');
  expect(info[0]).toBe('- OS: linux 6.9 (x86_64)');
  expect(info[1]).toBe(`- Browser: ${navigator.userAgent}`);
  expect(info[2]).toMatch(/^- Zobel: v/);
});

test('adds the homeserver before the video line', () => {
  const info = issueEnvironment('linux', 'vaapi', 'example.org').split('\n');
  expect(info.slice(3)).toEqual(['- Homeserver: example.org', '- Video: vaapi']);
});
