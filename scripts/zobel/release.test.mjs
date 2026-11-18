// Run with: node --test scripts/zobel/*.test.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import {
  bumpFor,
  nextVersion,
  parseChange,
  plainText,
  prependChangelog,
  renderSections,
  sableReleasesBetween,
  withoutBullets,
} from './release.mjs';

const SCRIPT = resolve(import.meta.dirname, 'release.mjs');

const SABLE_CHANGELOG = `# Sable Changelog

## 26.11.2 (2026-11-16)

### Features

* Profile JSON.

### Fixes

* Emoji rows.
* Battery.

## 26.11.1 (2026-11-16)

### Fixes

* Speaking indicator.

## 26.11.0 (2026-11-15)

### Features

* Back button badge.
`;

test('versions start at 0.1.0 and follow the change files', () => {
  assert.equal(nextVersion(undefined, 'auto', []), '0.1.0');
  assert.equal(nextVersion('0.1.0', 'auto', []), '0.1.1');
  assert.equal(nextVersion('0.1.3', 'auto', [{ type: 'patch' }, { type: 'minor' }]), '0.2.0');
  assert.equal(nextVersion('0.2.0', 'auto', [{ type: 'major' }]), '1.0.0');
  assert.equal(nextVersion('1.2.3', 'patch', [{ type: 'major' }]), '1.2.4');
  assert.equal(nextVersion('1.2.3', 'minor', []), '1.3.0');
  assert.equal(bumpFor([{ type: 'feature' }]), 'minor');
  assert.throws(() => nextVersion('1.0.0', 'huge', []), /Unknown bump/);
});

test('change files are read like Sable change sets', () => {
  assert.deepEqual(parseChange('---\ndefault: minor\n---\n\nA new thing.\n'), {
    type: 'minor',
    summary: 'A new thing.',
  });
  assert.throws(() => parseChange('A new thing.'), /front matter/);
  assert.throws(() => parseChange('---\ndefault: big\n---\n\nX'), /unknown type/);
  assert.throws(() => parseChange('---\ndefault: patch\n---\n\n'), /does not say/);
});

test('changes are grouped in the order of Sable changelog', () => {
  assert.equal(
    renderSections([
      { type: 'patch', summary: 'Fixed.' },
      { type: 'minor', summary: 'New.\nSecond line.' },
      { type: 'security', summary: 'Safer.' },
    ]),
    '### Security\n\n* Safer.\n\n### Features\n\n* New.\n  Second line.\n\n### Fixes\n\n* Fixed.'
  );
});

test("Sable's releases since the last Zobel release are picked", () => {
  const picked = sableReleasesBetween(SABLE_CHANGELOG, '26.11.0', '26.11.2');
  assert.deepEqual(
    picked.map((release) => release.version),
    ['26.11.2', '26.11.1']
  );
  assert.equal(picked[1].body, '### Fixes\n\n* Speaking indicator.');
  assert.deepEqual(sableReleasesBetween(SABLE_CHANGELOG, '26.11.2', '26.11.2'), []);
});

test('bullets already listed as unreleased Sable changes are dropped', () => {
  const body = '### Features\n\n* Profile JSON.\n\n### Fixes\n\n* Emoji rows.\n* Battery.';
  assert.equal(
    withoutBullets(body, new Set(['Profile JSON.', 'Battery.'])),
    '### Fixes\n\n* Emoji rows.'
  );
});

test('plain text notes fit Firebase and point to the full notes', () => {
  const text = plainText('## Zobel\n\n### Fixes\n\n* A [link](https://x) and `code`.');
  assert.equal(text, 'ZOBEL\n\nFixes:\n\n• A link and code.');
  const long = plainText(`* ${'word '.repeat(50)}\n`.repeat(100), {
    limit: 1000,
    fullNotesUrl: 'https://example.org/notes',
  });
  assert.ok(long.length <= 1000);
  assert.ok(long.endsWith('Full notes: https://example.org/notes'));
});

test('the changelog keeps its title and the newest entry first', () => {
  const first = prependChangelog('', '## 0.1.0 (2026-11-18)\n\nA.\n');
  assert.equal(first, '# Zobel Changelog\n\n## 0.1.0 (2026-11-18)\n\nA.\n');
  assert.equal(
    prependChangelog(first, '## 0.2.0 (2026-11-19)\n\nB.\n'),
    '# Zobel Changelog\n\n## 0.2.0 (2026-11-19)\n\nB.\n\n## 0.1.0 (2026-11-18)\n\nA.\n'
  );
});

test('a release in a repository lists Zobel changes and the Sable releases since the last one', () => {
  const repo = mkdtempSync(join(tmpdir(), 'zobel-release-'));
  const out = join(repo, '.out');
  const run = (...args) =>
    execFileSync(args[0], args.slice(1), {
      cwd: repo,
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@example.org',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@example.org',
        GITHUB_OUTPUT: '',
      },
    });
  const write = (file, text) => {
    mkdirSync(join(repo, file, '..'), { recursive: true });
    writeFileSync(join(repo, file), text);
  };
  try {
    run('git', 'init', '-q', '-b', 'main');
    write('package.json', '{ "version": "26.11.0" }\n');
    write('CHANGELOG.md', SABLE_CHANGELOG.replace(/## 26\.11\.2[\s\S]*?(?=## 26\.11\.0)/, ''));
    write('zobel/changes/name.md', '---\ndefault: minor\n---\n\nThe app is called Zobel.\n');
    write('.changeset/pending.md', '---\ndefault: patch\n---\n\nSpeaking indicator.\n');
    run('git', 'add', '-A');
    run('git', 'commit', '-qm', 'start');

    run('node', SCRIPT, 'prepare', '--out', out, '--write');
    assert.equal(JSON.parse(readFileSync(join(out, 'release.json'), 'utf8')).version, '0.1.0');
    assert.ok(!existsSync(join(repo, 'zobel/changes/name.md')));
    assert.match(
      readFileSync(join(repo, 'zobel/CHANGELOG.md'), 'utf8'),
      /## 0\.1\.0 .*\n\n### Features\n\n\* The app is called Zobel\./
    );
    run('git', 'add', '-A');
    run('git', 'commit', '-qm', 'Release Zobel 0.1.0');
    run('git', 'tag', 'zobel-v0.1.0');

    // Sable releases 26.11.1 (with the pending change) and 26.11.2, and Zobel fixes a bug.
    write('package.json', '{ "version": "26.11.2" }\n');
    write('CHANGELOG.md', SABLE_CHANGELOG);
    rmSync(join(repo, '.changeset/pending.md'));
    write('.changeset/next.md', '---\ndefault: minor\n---\n\nSomething unreleased.\n');
    write('zobel/changes/seen.md', '---\ndefault: patch\n---\n\nThe Seen button stays put.\n');
    run('git', 'add', '-A');
    run('git', 'commit', '-qm', 'more');

    run('node', SCRIPT, 'prepare', '--out', out);
    const release = JSON.parse(readFileSync(join(out, 'release.json'), 'utf8'));
    assert.deepEqual(release, {
      version: '0.1.1',
      tag: 'zobel-v0.1.1',
      previousTag: 'zobel-v0.1.0',
      sableVersion: '26.11.2',
      date: release.date,
    });
    const notes = readFileSync(join(out, 'release-notes.md'), 'utf8');
    assert.match(notes, /## Zobel\n\n### Fixes\n\n\* The Seen button stays put\./);
    assert.match(notes, /### Sable 26\.11\.2 \(2026-11-16\)\n\n#### Features\n\n\* Profile JSON\./);
    // 26.11.1 only had the change Zobel 0.1.0 already listed as unreleased.
    assert.doesNotMatch(notes, /Speaking indicator/);
    assert.match(
      notes,
      /### Not yet in a Sable release\n\n#### Features\n\n\* Something unreleased\./
    );
    assert.equal(JSON.parse(readFileSync(join(out, 'latest.json'), 'utf8')).version, '0.1.1');
    // Without --write nothing in the tree changes.
    assert.ok(existsSync(join(repo, 'zobel/changes/seen.md')));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
