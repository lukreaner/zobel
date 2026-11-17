/**
 * Interface text that only Zobel has. It lives here instead of in `src/locales`, so those
 * files stay identical to Sable's and its translation updates merge without conflicts.
 * A language without its own file falls back to English.
 */
import de from './locales/de.json';
import en from './locales/en.json';

import { useAppNameInLocale } from './app-name-in-locale.js';

type Tree = Record<string, unknown>;

const OWN_STRINGS: Record<string, Tree> = { de, en };

/** Returns a language bundle of Sable's as Zobel shows it. */
export function zobelLocale<T extends Tree>(code: string, bundle: T): T {
  return { ...useAppNameInLocale(bundle), ...OWN_STRINGS[code] };
}
