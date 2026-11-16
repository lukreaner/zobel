import { expect, test } from 'vitest';

import en from '../../locales/en.json';

import { APP_NAME_KEYS, UPSTREAM_NAME_KEYS, useAppNameInLocale } from './app-name-in-locale.js';

function strings(tree: Record<string, unknown>, prefix = ''): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]): [string, string][] => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') return [[path, value]];
    return typeof value === 'object' && value !== null
      ? strings(value as Record<string, unknown>, path)
      : [];
  });
}

test('strings that name the app use the app name', () => {
  const bundle = useAppNameInLocale({
    settings: {
      matrixLinkHandler: 'Open matrix: links in Sable',
      aboutPoweredBy: 'Powered by Sable.',
    },
    auth: { serverSignInIntro: 'Bei diesem Sable-Server anmelden, Sables Konto' },
  });

  expect(bundle.settings.matrixLinkHandler).toBe('Open matrix: links in {{appName}}');
  expect(bundle.settings.aboutPoweredBy).toBe('Powered by Sable.');
  expect(bundle.auth.serverSignInIntro).toBe(
    'Bei diesem {{appName}}-Server anmelden, {{appName}}s Konto'
  );
});

test('the bundle it was given is left as it was', () => {
  const original = { settings: { matrixLinkHandlerAction: 'Use Sable' } };

  useAppNameInLocale(original);

  expect(original.settings.matrixLinkHandlerAction).toBe('Use Sable');
});

test('a language without the string is returned unchanged', () => {
  expect(useAppNameInLocale({ settings: { other: 'Sable' } })).toEqual({
    settings: { other: 'Sable' },
  });
});

// Fails when an upstream update adds a string that says "Sable": decide whether it
// names the app (APP_NAME_KEYS) or the Sable project and its services (UPSTREAM_NAME_KEYS).
test('every English string that says Sable has been sorted into one of the two lists', () => {
  const unsorted = strings(en)
    .filter(([, text]) => text.includes('Sable'))
    .map(([key]) => key)
    .filter((key) => !APP_NAME_KEYS.includes(key) && !UPSTREAM_NAME_KEYS.includes(key));

  expect(unsorted).toEqual([]);
});

test('no string is in both lists', () => {
  expect(APP_NAME_KEYS.filter((key) => UPSTREAM_NAME_KEYS.includes(key))).toEqual([]);
});
