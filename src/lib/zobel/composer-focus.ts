import { preferences } from '#lib/settings/preferences.svelte.js';

/**
 * Whether opening a chat from the room list moves focus into the message field.
 *
 * Sable always does so in the wide layout. On a touch screen, such as an unfolded foldable,
 * that opens the keyboard over the chat every time, so "auto" leaves the focus alone where
 * the main pointer is a finger.
 */
export function focusComposerOnOpen(): boolean {
  const mode = preferences.focusComposerOnOpen;
  if (mode !== 'auto') return mode === 'always';
  return typeof matchMedia !== 'function' || !matchMedia('(pointer: coarse)').matches;
}
