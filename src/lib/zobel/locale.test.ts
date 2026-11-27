import { expect, test } from 'vitest';

import sable from '../../locales/en.json';

import de from './locales/de.json';
import en from './locales/en.json';
import { zobelLocale } from './locale.js';

test("a language gets Zobel's own text next to Sable's", () => {
  const bundle = zobelLocale('de', { common: { readReceipts: 'Lesebestätigungen' } });

  expect(bundle).toMatchObject({
    common: { readReceipts: 'Lesebestätigungen' },
    zobel: { seen: 'Gesehen' },
  });
});

test('a language Zobel has no text for is left to fall back to English', () => {
  expect(zobelLocale('fr', { common: { yes: 'Oui' } })).toEqual({ common: { yes: 'Oui' } });
});

test('strings that name the app still use the app name', () => {
  const bundle = zobelLocale('en', { settings: { matrixLinkHandlerAction: 'Use Sable' } });

  expect(bundle.settings.matrixLinkHandlerAction).toBe('Use {{appName}}');
});

test('German has every string English has', () => {
  expect(Object.keys(de.zobel).toSorted()).toEqual(Object.keys(en.zobel).toSorted());
});

test("Zobel's text does not take a name Sable uses", () => {
  expect(Object.keys(en).filter((key) => key in sable)).toEqual([]);
});
