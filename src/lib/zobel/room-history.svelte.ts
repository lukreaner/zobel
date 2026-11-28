import { page } from '$app/state';
import { MediaQuery } from 'svelte/reactivity';

import { AppLayout } from '#lib/ui/app-layout.svelte.js';

const touch = new MediaQuery('(pointer: coarse)');
const layout = new AppLayout();

/**
 * Whether opening a chat from the room list takes the place of the open chat in the history
 * instead of adding to it.
 *
 * In the split view every chat opened from the list became a step of its own. A foldable
 * folded shut afterwards switches to the phone layout, where the back gesture then went
 * through every chat seen before instead of to the list of chats. On touch screens in the
 * split view, chat after chat now shares one step, so back leads to the list as on a phone.
 * With a mouse, back still steps through the chats as in a browser.
 */
export function replacesOpenChat(): boolean {
  return page.params.roomId !== undefined && layout.current && touch.current;
}
