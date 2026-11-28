import { page } from '$app/state';

import { findRoomByPathId, useRoomList } from '#lib/rooms/room-list.svelte.js';
import { preferences, setPreference } from '#lib/settings/preferences.svelte.js';
import type { Preferences } from '#lib/settings/definitions.js';

import './messenger-look.css';

export type ChatLook = 'sable' | 'messenger';

/** Whether the app looks like a messenger such as Signal or Beeper rather than like Sable. */
export function messengerLook(): boolean {
  return preferences.chatLook === 'messenger';
}

type PresetKey = 'layout' | 'alignOwnMessages' | 'messagePreviews';

/**
 * Sable's own settings the messenger look turns on with it: messages in bubbles with your own on
 * the right, and the last message under every chat. Each stays a setting of its own, so it can be
 * changed again afterwards.
 */
const MESSENGER: { [K in PresetKey]: Preferences[K] } = {
  layout: 'bubble',
  alignOwnMessages: true,
  messagePreviews: 'all',
};

const SABLE: { [K in PresetKey]: Preferences[K] } = {
  layout: 'modern',
  alignOwnMessages: true,
  messagePreviews: 'off',
};

function apply(values: { [K in PresetKey]: Preferences[K] }, from?: typeof values): void {
  for (const key of Object.keys(values) as PresetKey[]) {
    // Going back to Sable's look only undoes what the messenger look set and nobody changed since.
    if (from && preferences[key] !== from[key]) continue;
    setPreference(key, values[key] as never);
  }
}

/** Called when someone picks a look in the settings. */
export function chooseChatLook(look: string): void {
  if (look === 'messenger') apply(MESSENGER);
  else apply(SABLE, MESSENGER);
}

/**
 * Marks the page with the current look, which `messenger-look.css` styles, and whether the open
 * chat is one with a single other person, where messengers leave out names and pictures.
 * Call it while a component inside the signed-in app starts.
 */
export function trackChatLook(): void {
  const roomList = useRoomList();
  $effect(() => {
    document.documentElement.dataset.zobelLook = preferences.chatLook;
  });
  $effect(() => {
    const room = findRoomByPathId(roomList.rooms, page.params.roomId);
    const oneToOne =
      room !== undefined &&
      room.is_direct &&
      room.direct_targets.length <= 1 &&
      room.group_members.length === 0;
    document.documentElement.dataset.zobelChat = oneToOne ? 'one-to-one' : 'group';
  });
}
