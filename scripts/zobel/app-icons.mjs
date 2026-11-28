#!/usr/bin/env node
// Adds Zobel's launcher icons (src/lib/zobel/app-icons/icons.json) to the Android app, next to
// Sable's (src-tauri/app-icons.json):
//
//   node scripts/zobel/app-icons.mjs
//
// It uses the generator of tauri-plugin-app-icon, the plugin Sable switches icons with, at the
// revision src-tauri/Cargo.toml pins. The generator writes the resources of Zobel's icons only,
// so Sable's stay byte for byte as Sable committed them, and the manifest gets one launcher alias
// per icon, Zobel's before Sable's. Commit what it changes. Run it again after changing Zobel's
// icons, or when a merge from Sable has rewritten the aliases in AndroidManifest.xml.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../..');
const tauri = join(root, 'src-tauri');
const zobelConfigPath = join(root, 'src/lib/zobel/app-icons/icons.json');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed`);
}

/** The plugin's checkout at the pinned revision: Cargo's own, or a fresh clone. */
function pluginDirectory(temporary) {
  const cargoToml = readFileSync(join(tauri, 'Cargo.toml'), 'utf8');
  const pin = cargoToml.match(
    /^tauri-plugin-app-icon\s*=.*git\s*=\s*"([^"]+)".*rev\s*=\s*"([^"]+)"/m
  );
  if (!pin)
    throw new Error('src-tauri/Cargo.toml does not pin tauri-plugin-app-icon by git revision');
  const [, url, rev] = pin;

  const checkouts = join(process.env.CARGO_HOME ?? join(homedir(), '.cargo'), 'git/checkouts');
  if (existsSync(checkouts)) {
    for (const entry of readdirSync(checkouts)) {
      if (!entry.startsWith('tauri-plugin-app-icon-')) continue;
      const candidate = join(checkouts, entry, rev.slice(0, 7));
      if (existsSync(join(candidate, 'scripts/generate-android.mjs'))) return candidate;
    }
  }

  const clone = join(temporary, 'plugin');
  run('git', ['init', '--quiet', clone]);
  run('git', ['-C', clone, 'fetch', '--quiet', '--depth=1', url, rev]);
  run('git', ['-C', clone, 'checkout', '--quiet', 'FETCH_HEAD']);
  return clone;
}

const sable = JSON.parse(readFileSync(join(tauri, 'app-icons.json'), 'utf8'));
const zobel = JSON.parse(readFileSync(zobelConfigPath, 'utf8'));

const sableIds = new Set(sable.icons.map((icon) => icon.id));
const clashes = zobel.icons.filter((icon) => sableIds.has(icon.id));
if (clashes.length) throw new Error(`Sable has icons named ${clashes.map((i) => i.id).join(', ')}`);

const android = {
  ...sable.android,
  resourcesDirectory: resolve(tauri, sable.android.resourcesDirectory),
  manifest: resolve(tauri, sable.android.manifest),
};
const zobelIcons = zobel.icons.map((icon) => ({
  ...icon,
  source: resolve(dirname(zobelConfigPath), icon.source),
}));

const temporary = mkdtempSync(join(tmpdir(), 'zobel-app-icons-'));
try {
  const plugin = pluginDirectory(temporary);

  // The generator also rewrites the manifest; let it write a copy, and write the real one below
  // with every icon, so Sable's aliases stay.
  const scratchManifest = join(temporary, 'AndroidManifest.xml');
  writeFileSync(scratchManifest, readFileSync(android.manifest));
  const config = join(temporary, 'app-icons.json');
  writeFileSync(
    config,
    JSON.stringify({ android: { ...android, manifest: scratchManifest }, icons: zobelIcons })
  );
  // `tauri icon` resolves from this repository's dependencies.
  run(process.execPath, [join(plugin, 'scripts/generate-android.mjs'), '--config', config], {
    cwd: root,
  });

  const { applyAliases } = await import(
    pathToFileURL(join(plugin, 'scripts/android-manifest.mjs'))
  );
  const manifest = readFileSync(android.manifest, 'utf8');
  writeFileSync(
    android.manifest,
    applyAliases(manifest, { android, icons: [...zobelIcons, ...sable.icons] })
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
