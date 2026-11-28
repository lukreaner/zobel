/**
 * Zobel's own launcher icons, offered next to Sable's in Settings → Appearance → App icon.
 *
 * `app-icons/icons.json` lists them; `scripts/zobel/app-icons.mjs` turns the same list into
 * Android resources and launcher aliases. Sable's picker only gets the previews, the labels
 * and the order from here.
 */
import { t } from '#lib/i18n.js';

import config from './app-icons/icons.json';

const sources = import.meta.glob<string>('./app-icons/*.svg', {
  eager: true,
  import: 'default',
  query: '?url',
});

export const ZOBEL_APP_ICONS: readonly string[] = config.icons.map((icon) => icon.id);

/** Preview images by icon ID, for the picker's `previews`. */
export const ZOBEL_APP_ICON_PREVIEWS: Record<string, string> = Object.fromEntries(
  config.icons.flatMap((icon) => {
    const url = sources[`./app-icons/${icon.source}`];
    return url ? [[icon.id, url]] : [];
  })
);

/** Zobel's icons first, in their own order, then the rest as given. */
export function zobelAppIconsFirst(icons: readonly string[]): string[] {
  return [
    ...ZOBEL_APP_ICONS.filter((icon) => icons.includes(icon)),
    ...icons.filter((icon) => !ZOBEL_APP_ICONS.includes(icon)),
  ];
}

/** The name of one of Zobel's icons, or undefined for any other. */
export function zobelAppIconLabel(icon: string): string | undefined {
  return ZOBEL_APP_ICONS.includes(icon) ? t(`zobel.appIcons.${icon}`) : undefined;
}
