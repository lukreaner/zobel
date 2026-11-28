import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const tauri = join(root, 'src-tauri');
const sable = JSON.parse(readFileSync(join(tauri, 'app-icons.json'), 'utf8'));
const zobelConfig = join(root, 'src/lib/zobel/app-icons/icons.json');
const zobel = JSON.parse(readFileSync(zobelConfig, 'utf8'));
const resources = resolve(tauri, sable.android.resourcesDirectory);
const manifest = readFileSync(resolve(tauri, sable.android.manifest), 'utf8');
const aliases = manifest.slice(
  manifest.indexOf('<!-- APP-ICON ALIASES START -->'),
  manifest.indexOf('<!-- APP-ICON ALIASES END -->')
);
const strings = Object.fromEntries(
  ['en', 'de'].map((code) => [
    code,
    JSON.parse(readFileSync(join(root, `src/lib/zobel/locales/${code}.json`), 'utf8')).zobel
      .appIcons,
  ])
);

test("Zobel's icons do not take an ID Sable uses", () => {
  const taken = new Set(sable.icons.map((icon) => icon.id));
  assert.deepEqual(
    zobel.icons.filter((icon) => taken.has(icon.id)).map((icon) => icon.id),
    []
  );
});

test("Sable's icons keep their launcher aliases", () => {
  for (const { id } of sable.icons) {
    assert.match(aliases, new RegExp(`android:value="${id}"`), id);
  }
});

test("Zobel's main icon is there at every density, named like Sable's", () => {
  const main = join(root, 'zobel/android/res');
  assert.ok(existsSync(join(main, 'mipmap-anydpi-v26/ic_launcher.xml')));
  assert.ok(existsSync(join(main, 'values/ic_launcher_background.xml')));
  for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
    for (const name of ['', '_round', '_foreground', '_adaptive_foreground']) {
      const image = join(main, `mipmap-${density}`, `ic_launcher${name}.png`);
      assert.ok(existsSync(image), image);
    }
  }
  // Sable's own resources keep these names, so the build type's copies replace them.
  assert.ok(existsSync(join(resources, 'mipmap-xxxhdpi/ic_launcher.png')));
  assert.ok(existsSync(join(resources, 'mipmap-anydpi-v26/ic_launcher.xml')));
});

test("the Gradle init script lays the main icon over Sable's", () => {
  const init = readFileSync(join(root, 'scripts/zobel/android/zobel.init.gradle'), 'utf8');
  assert.match(init, /zobel\/android\/res/);
  assert.match(init, /\['debug', 'release'\]/);
});

for (const { id, source } of zobel.icons) {
  test(`the ${id} icon is in the Android app, off until chosen`, () => {
    assert.ok(existsSync(resolve(dirname(zobelConfig), source)), source);
    const name = `ic_launcher_${id}`;
    assert.ok(existsSync(join(resources, 'mipmap-anydpi-v26', `${name}.xml`)), name);
    for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
      for (const suffix of ['', '_round', '_foreground']) {
        const image = join(resources, `mipmap-${density}`, `${name}${suffix}.png`);
        assert.ok(existsSync(image), image);
      }
    }
    const alias = aliases
      .split('</activity-alias>')
      .find((entry) => entry.includes(`android:value="${id}"`));
    assert.ok(alias, `no launcher alias for ${id}; run node scripts/zobel/app-icons.mjs`);
    assert.match(alias, new RegExp(`android:icon="@mipmap/${name}"`));
    assert.match(alias, /android:enabled="false"/);
  });

  test(`the ${id} icon has a name in English and German`, () => {
    assert.ok(strings.en[id], 'en');
    assert.ok(strings.de[id], 'de');
  });
}
