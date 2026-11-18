#!/usr/bin/env node
// Works out Zobel's next release: its version, its changelog entry and its release notes.
//
//   node scripts/zobel/release.mjs prepare --out <dir> [--bump auto|patch|minor|major]
//                                          [--version <x.y.z>] [--date <yyyy-mm-dd>] [--write]
//
// Writes into <dir>:
//   release.json       version, tag, previous tag, Sable version
//   release-notes.md   notes for the GitHub release
//   release-notes.txt  the same as plain text, short enough for Firebase App Distribution
//   latest.json        the update manifest the app reads from the latest GitHub release
// With --write it also adds the entry to zobel/CHANGELOG.md and deletes the change files
// in zobel/changes it used. docs/zobel.md describes the change files.
//
// Uses only Node's standard library, so it runs before `pnpm install`.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

export const TAG_PREFIX = 'zobel-v';
export const FIRST_VERSION = '0.1.0';
export const CHANGES_DIR = 'zobel/changes';
export const ZOBEL_CHANGELOG = 'zobel/CHANGELOG.md';
const SABLE_CHANGELOG = 'CHANGELOG.md';
const REPOSITORY = 'https://github.com/lukreaner/zobel';
const SABLE_REPOSITORY = 'https://github.com/SableClient/sable-next';
// Firebase App Distribution takes at most 16,000 characters of release notes.
export const PLAIN_NOTES_LIMIT = 15_000;

// The same change types Sable's knope.toml knows, in the order its changelog lists them.
export const SECTIONS = [
  { name: 'Security', types: ['security'] },
  { name: 'Breaking Changes', types: ['major'] },
  { name: 'Features', types: ['minor', 'feature'] },
  { name: 'Fixes', types: ['patch'] },
  { name: 'Documentation', types: ['docs'] },
  { name: 'Notes', types: ['note'] },
];
const TYPES = new Set(SECTIONS.flatMap((section) => section.types));

// ---------------------------------------------------------------------------
// Versions

export function parseVersion(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version ?? '');
  return match ? match.slice(1, 4).map(Number) : undefined;
}

export function compareVersions(a, b) {
  const [x, y] = [parseVersion(a), parseVersion(b)];
  if (!x || !y) throw new Error(`Cannot compare versions ${a} and ${b}`);
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

/** The bump the change files ask for: the largest of their types. */
export function bumpFor(changes) {
  if (changes.some((change) => change.type === 'major')) return 'major';
  if (changes.some((change) => change.type === 'minor' || change.type === 'feature')) {
    return 'minor';
  }
  return 'patch';
}

export function nextVersion(previous, bump, changes) {
  if (!previous) return FIRST_VERSION;
  const [major, minor, patch] = parseVersion(previous);
  switch (bump === 'auto' ? bumpFor(changes) : bump) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Unknown bump ${bump}: use auto, patch, minor or major`);
  }
}

// ---------------------------------------------------------------------------
// Change files

/**
 * A change file is a knope change set as Sable writes them:
 *
 *   ---
 *   default: minor
 *   ---
 *
 *   What changed, written for people who use the app.
 */
export function parseChange(text, file = 'change file') {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text.trimStart());
  if (!match) throw new Error(`${file} must start with a --- front matter block`);
  const entries = match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => /^([\w-]+):\s*(\S+)$/.exec(line));
  if (entries.length !== 1 || !entries[0]) {
    throw new Error(`${file} must name exactly one change type, e.g. "default: patch"`);
  }
  const type = entries[0][2];
  if (!TYPES.has(type)) {
    throw new Error(`${file} has the unknown type "${type}" (use ${[...TYPES].join(', ')})`);
  }
  const summary = match[2].trim();
  if (!summary) throw new Error(`${file} does not say what changed`);
  return { type, summary };
}

export function readChanges(dir = CHANGES_DIR) {
  let names;
  try {
    names = readdirSync(dir);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return names
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .sort()
    .map((name) => {
      const file = join(dir, name);
      return { file, ...parseChange(readFileSync(file, 'utf8'), file) };
    });
}

/** Markdown bullets grouped under ### headings, Sable's changelog layout. */
export function renderSections(changes, level = 3) {
  const hashes = '#'.repeat(level);
  const blocks = [];
  for (const section of SECTIONS) {
    const items = changes.filter((change) => section.types.includes(change.type));
    if (items.length === 0) continue;
    const bullets = items.map((change) => bullet(change.summary));
    blocks.push(`${hashes} ${section.name}\n\n${bullets.join('\n')}`);
  }
  return blocks.join('\n\n');
}

function bullet(text) {
  const [first, ...rest] = text.split('\n');
  return [`* ${first}`, ...rest.map((line) => (line ? `  ${line}` : ''))].join('\n');
}

// ---------------------------------------------------------------------------
// Sable's changelog

/** Sable's released versions, newest first, each with its changelog body. */
export function sableReleases(changelog) {
  const releases = [];
  let current;
  for (const line of changelog.split('\n')) {
    const heading = /^## (\d+\.\d+\.\d+)(?: \((\d{4}-\d{2}-\d{2})\))?/.exec(line);
    if (heading) {
      current = { version: heading[1], date: heading[2], lines: [] };
      releases.push(current);
    } else if (line.startsWith('# ')) {
      current = undefined;
    } else if (current) {
      current.lines.push(line);
    }
  }
  return releases.map(({ lines, ...release }) => ({ ...release, body: lines.join('\n').trim() }));
}

/** Sable's releases after `since` up to and including `until`, newest first. */
export function sableReleasesBetween(changelog, since, until) {
  return sableReleases(changelog).filter(
    (release) =>
      compareVersions(release.version, until) <= 0 &&
      (!since || compareVersions(release.version, since) > 0)
  );
}

/** Drops bullets Zobel already listed as coming from Sable's main branch. */
export function withoutBullets(body, known) {
  if (known.size === 0) return body;
  const kept = [];
  let skipping = false;
  for (const line of body.split('\n')) {
    if (/^[*-] /.test(line)) {
      skipping = known.has(normalise(line.slice(2)));
      if (!skipping) kept.push(line);
    } else if (skipping && /^\s+\S/.test(line)) {
      // continuation of a dropped bullet
    } else {
      skipping = false;
      kept.push(line);
    }
  }
  // Remove headings left without bullets.
  const blocks = kept.join('\n').split(/\n(?=#+ )/);
  return blocks
    .filter((block) => !/^#+ /.test(block) || /\n[*-] /.test(block))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalise(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function demote(body, by) {
  return body.replace(/^(#+) /gm, (_, hashes) => `${'#'.repeat(hashes.length + by)} `);
}

// ---------------------------------------------------------------------------
// Notes

export function renderNotes({
  version,
  date,
  previous,
  sableVersion,
  sableCommit,
  changes,
  sableReleases: released,
  sablePending,
}) {
  const parts = [];
  parts.push(
    `Based on Sable ${sableVersion}` +
      (sableCommit
        ? ` and Sable's main branch up to [${sableCommit.slice(0, 9)}](${SABLE_REPOSITORY}/commit/${sableCommit})`
        : '') +
      '.'
  );
  if (changes.length > 0) {
    parts.push(`## Zobel\n\n${renderSections(changes, 3)}`);
  }
  const sable = [];
  for (const release of released) {
    if (!release.body) continue;
    sable.push(
      `### Sable ${release.version}${release.date ? ` (${release.date})` : ''}\n\n${demote(release.body, 1)}`
    );
  }
  if (sablePending.length > 0) {
    sable.push(`### Not yet in a Sable release\n\n${renderSections(sablePending, 4)}`);
  }
  if (sable.length > 0) {
    const since = previous ? ` since Zobel ${previous}` : '';
    parts.push(`## From Sable${since}\n\n${sable.join('\n\n')}`);
  }
  if (changes.length === 0 && sable.length === 0) {
    parts.push('No changes worth listing.');
  }
  return {
    markdown: `${parts.join('\n\n')}\n`,
    changelogEntry: renderChangelogEntry({ version, date, sableVersion, changes, released }),
  };
}

function renderChangelogEntry({ version, date, sableVersion, changes, released }) {
  const lines = [`## ${version} (${date})`, ''];
  if (changes.length > 0) lines.push(renderSections(changes, 3), '');
  const versions = released.map((release) => release.version).reverse();
  lines.push(
    versions.length > 0
      ? `Based on Sable ${sableVersion}, with the changes of Sable ${versions.join(', ')} ([Sable's changelog](../CHANGELOG.md)).`
      : `Based on Sable ${sableVersion}.`,
    ''
  );
  return lines.join('\n');
}

/** Markdown to plain text for Firebase App Distribution, which shows notes unformatted. */
export function plainText(markdown, { limit = PLAIN_NOTES_LIMIT, fullNotesUrl } = {}) {
  const text = markdown
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .split('\n')
    .map((line) => {
      const heading = /^(#+) (.*)$/.exec(line);
      if (heading) return heading[1].length <= 2 ? heading[2].toUpperCase() : `${heading[2]}:`;
      return line.replace(/^(\s*)[*-] /, '$1• ');
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (text.length <= limit) return text;
  const more = `\n\n… Full notes: ${fullNotesUrl ?? REPOSITORY + '/releases'}`;
  const cut = text.slice(0, limit - more.length);
  return cut.slice(0, cut.lastIndexOf('\n')).trimEnd() + more;
}

export function prependChangelog(existing, entry) {
  const title = '# Zobel Changelog';
  const body = existing.startsWith(title) ? existing.slice(title.length).trim() : existing.trim();
  return `${title}\n\n${entry.trim()}\n${body ? `\n${body}\n` : ''}`;
}

// ---------------------------------------------------------------------------
// Git

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function tryGit(...args) {
  try {
    return git(...args);
  } catch {
    return undefined;
  }
}

/** The newest zobel-v* tag that is an ancestor of HEAD. */
export function previousTag() {
  const tags = (tryGit('tag', '--merged', 'HEAD', '--list', `${TAG_PREFIX}*`) ?? '')
    .split('\n')
    .filter((tag) => parseVersion(tag.slice(TAG_PREFIX.length)));
  tags.sort((a, b) => compareVersions(b.slice(TAG_PREFIX.length), a.slice(TAG_PREFIX.length)));
  return tags[0];
}

function sableVersionAt(ref) {
  const json = ref ? tryGit('show', `${ref}:package.json`) : readFileSync('package.json', 'utf8');
  return json ? JSON.parse(json).version : undefined;
}

/** Sable's change sets present now and not at `ref`, i.e. unreleased Sable changes new to Zobel. */
function sablePendingSince(ref) {
  const now = readChanges('.changeset');
  if (!ref) return { pending: now, known: new Set() };
  const before = new Map();
  for (const file of (tryGit('ls-tree', '--name-only', `${ref}`, '.changeset/') ?? '').split(
    '\n'
  )) {
    if (!file.endsWith('.md') || file.endsWith('README.md')) continue;
    const text = tryGit('show', `${ref}:${file}`);
    if (!text) continue;
    try {
      before.set(file, parseChange(text, file));
    } catch {
      // Sable's own checks cover its change files.
    }
  }
  return {
    pending: now.filter((change) => !before.has(change.file)),
    known: new Set([...before.values()].map((change) => normalise(change.summary))),
  };
}

/** Sable's commit that the latest daily sync merged, for the "based on" line. */
function latestSableMergeParent() {
  const merge = tryGit(
    'log',
    '-1',
    '--format=%H',
    '--merges',
    '--grep',
    "^Merge Sable's main branch",
    'HEAD'
  );
  return merge ? tryGit('rev-parse', `${merge}^2`) : undefined;
}

// ---------------------------------------------------------------------------
// Command line

export function prepare({ bump = 'auto', version: forced, date = today() } = {}) {
  const changes = readChanges();
  const previousTagName = previousTag();
  const previous = previousTagName?.slice(TAG_PREFIX.length);
  const version = forced ?? nextVersion(previous, bump, changes);
  if (!parseVersion(version)) throw new Error(`Version must look like 1.2.3 (got ${version})`);
  if (previous && compareVersions(version, previous) <= 0) {
    throw new Error(`Version ${version} is not newer than the last release, ${previous}`);
  }

  const sableVersion = sableVersionAt();
  const previousSable = previousTagName ? sableVersionAt(previousTagName) : undefined;
  const { pending, known } = sablePendingSince(previousTagName);
  // On the first release, Sable's history so far is not news.
  const released = previousSable
    ? sableReleasesBetween(readFileSync(SABLE_CHANGELOG, 'utf8'), previousSable, sableVersion).map(
        (release) => ({ ...release, body: withoutBullets(release.body, known) })
      )
    : [];

  const notes = renderNotes({
    version,
    date,
    previous,
    sableVersion,
    sableCommit: latestSableMergeParent(),
    changes,
    sableReleases: released,
    sablePending: previousTagName ? pending : [],
  });
  return {
    release: {
      version,
      tag: `${TAG_PREFIX}${version}`,
      previousTag: previousTagName ?? null,
      sableVersion,
      date,
    },
    changes,
    notes,
  };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string' },
      bump: { type: 'string', default: 'auto' },
      version: { type: 'string' },
      date: { type: 'string' },
      write: { type: 'boolean', default: false },
    },
  });
  if (positionals[0] !== 'prepare' || !values.out) {
    console.error(
      'Usage: release.mjs prepare --out <dir> [--bump auto|patch|minor|major] [--version x.y.z] [--write]'
    );
    process.exit(2);
  }

  const { release, changes, notes } = prepare({
    bump: values.bump,
    version: values.version?.replace(/^v/, ''),
    date: values.date || undefined,
  });
  const url = `${REPOSITORY}/releases/tag/${release.tag}`;
  mkdirSync(values.out, { recursive: true });
  writeFileSync(join(values.out, 'release.json'), `${JSON.stringify(release, null, 2)}\n`);
  writeFileSync(join(values.out, 'release-notes.md'), notes.markdown);
  writeFileSync(
    join(values.out, 'release-notes.txt'),
    `Zobel ${release.version}\n\n${plainText(notes.markdown, { fullNotesUrl: url })}\n`
  );
  writeFileSync(
    join(values.out, 'latest.json'),
    `${JSON.stringify(
      {
        version: release.version,
        notes: plainText(notes.changelogEntry.split('\n').slice(2).join('\n'), { limit: 2000 }),
        pub_date: `${release.date}T00:00:00Z`,
        url,
      },
      null,
      2
    )}\n`
  );

  if (values.write) {
    let existing = '';
    try {
      existing = readFileSync(ZOBEL_CHANGELOG, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    writeFileSync(ZOBEL_CHANGELOG, prependChangelog(existing, notes.changelogEntry));
    for (const change of changes) rmSync(change.file);
  }

  console.log(
    `Zobel ${release.version} (${release.tag}), after ${release.previousTag ?? 'no earlier release'}, based on Sable ${release.sableVersion}; ${changes.length} change file(s).`
  );
  if (process.env.GITHUB_OUTPUT) {
    writeFileSync(
      process.env.GITHUB_OUTPUT,
      `version=${release.version}\ntag=${release.tag}\ndate=${release.date}\n`,
      { flag: 'a' }
    );
  }
}

if (import.meta.main) main();
