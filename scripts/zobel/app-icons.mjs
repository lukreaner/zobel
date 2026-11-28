#!/usr/bin/env node
// Adds Zobel's launcher icons (src/lib/zobel/app-icons/icons.json) to the Android app, next to
// Sable's (src-tauri/app-icons.json), and writes Zobel's main icon to zobel/android/res:
//
//   node scripts/zobel/app-icons.mjs
//
// Needs Playwright's Chromium (`pnpm exec playwright install chromium`) to render the SVGs.
// It uses the generator of tauri-plugin-app-icon, the plugin Sable switches icons with, at the
// revision src-tauri/Cargo.toml pins. The generator writes the resources of Zobel's icons only,
// so Sable's stay byte for byte as Sable committed them, and the manifest gets one launcher alias
// per icon, Zobel's before Sable's. The main icon's resources are named like Sable's
// (ic_launcher…); scripts/zobel/android/zobel.init.gradle lays them over Sable's when building
// Zobel. Commit what it changes. Run it again after changing Zobel's
// icons, or when a merge from Sable has rewritten the aliases in AndroidManifest.xml.
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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
const fromConfig = (path) => resolve(dirname(zobelConfigPath), path);
const zobelIcons = zobel.icons.map((icon) => ({ ...icon, source: fromConfig(icon.source) }));
const mainIcon = { id: 'default', ...zobel.default, source: fromConfig(zobel.default.source) };
const mainMonochrome = { id: 'default_monochrome', source: fromConfig(zobel.default.monochrome) };

/**
 * Renders each SVG to a PNG with Chromium. `tauri icon` would render the SVGs itself with resvg,
 * whose noise and displacement filters come out unlike the browser's, and the picker shows the
 * SVGs in the WebView, that is in Chromium.
 */
async function renderWithChromium(icons, directory) {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
    const rendered = [];
    for (const icon of icons) {
      if (!icon.source.endsWith('.svg')) {
        rendered.push(icon);
        continue;
      }
      const png = join(directory, `${icon.id}.png`);
      const svg = readFileSync(icon.source, 'utf8').replace(
        '<svg ',
        '<svg width="1024" height="1024" '
      );
      await page.setContent(`<body style="margin:0">${svg}</body>`);
      await page.screenshot({ path: png, omitBackground: true });
      rendered.push({ ...icon, source: png });
    }
    return rendered;
  } finally {
    await browser.close();
  }
}

const DENSITIES = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];

/** Writes Zobel's main icon as resources named like Sable's, for the release build to use. */
function writeMainIcon(icon, monochrome, temporary) {
  const out = join(root, 'zobel/android/res');
  rmSync(out, { recursive: true, force: true });
  const generate = (source, name) => {
    const directory = join(temporary, name);
    run('pnpm', ['tauri', 'icon', source, '--output', directory], { cwd: root });
    return join(directory, 'android');
  };
  const main = generate(icon.source, 'main');
  const mono = generate(monochrome.source, 'mono');
  for (const density of DENSITIES) {
    const target = join(out, `mipmap-${density}`);
    mkdirSync(target, { recursive: true });
    for (const name of ['ic_launcher', 'ic_launcher_round', 'ic_launcher_foreground']) {
      cpSync(join(main, `mipmap-${density}`, `${name}.png`), join(target, `${name}.png`));
    }
    cpSync(
      join(mono, `mipmap-${density}`, 'ic_launcher_foreground.png'),
      join(target, 'ic_launcher_adaptive_foreground.png')
    );
  }
  mkdirSync(join(out, 'mipmap-anydpi-v26'), { recursive: true });
  writeFileSync(
    join(out, 'mipmap-anydpi-v26', 'ic_launcher.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <foreground>
    <inset android:drawable="@mipmap/ic_launcher_foreground" android:inset="16.5%" />
  </foreground>
  <background android:drawable="@color/ic_launcher_background"/>
  <monochrome>
    <inset android:drawable="@mipmap/ic_launcher_adaptive_foreground" android:inset="16.5%" />
  </monochrome>
</adaptive-icon>
`
  );
  mkdirSync(join(out, 'values'), { recursive: true });
  writeFileSync(
    join(out, 'values', 'ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <color name="ic_launcher_background">${icon.backgroundColor}</color>
</resources>
`
  );
}

const temporary = mkdtempSync(join(tmpdir(), 'zobel-app-icons-'));
try {
  const plugin = pluginDirectory(temporary);
  const [main, mono, ...rendered] = await renderWithChromium(
    [mainIcon, mainMonochrome, ...zobelIcons],
    temporary
  );
  writeMainIcon(main, mono, temporary);

  // The generator also rewrites the manifest; let it write a copy, and write the real one below
  // with every icon, so Sable's aliases stay.
  const scratchManifest = join(temporary, 'AndroidManifest.xml');
  writeFileSync(scratchManifest, readFileSync(android.manifest));
  const config = join(temporary, 'app-icons.json');
  writeFileSync(
    config,
    JSON.stringify({ android: { ...android, manifest: scratchManifest }, icons: rendered })
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
