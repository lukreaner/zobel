/**
 * Marking chats as read by hand. Sable sends a read receipt as soon as a message has been
 * on screen. With this on, the timeline keeps that receipt back and shows a "Seen" button
 * instead; the receipt goes out when the reader taps it.
 *
 * The preference `manualReadReceipts` is the default for every chat. A chat can be set
 * apart from it, and those choices are kept here and synced as their own account data.
 */
import { SvelteMap } from 'svelte/reactivity';

import { readJson, writeJson } from '#lib/platform/local-json.js';
import type { SyncedDocument } from '#lib/settings/account-sync.svelte.js';
import { preferences } from '#lib/settings/preferences.svelte.js';

const STORAGE_KEY = 'zobel-manual-read-receipts';
const DOCUMENT_VERSION = 1;

export const MANUAL_READ_RECEIPTS_ACCOUNT_DATA_TYPE =
  'io.github.lukreaner.zobel.manual_read_receipts';

const rooms = new SvelteMap<string, boolean>(readJson(STORAGE_KEY, parseRoomChoices, []));

/** Reads `{ roomId: true | false }` and drops everything else. */
export function parseRoomChoices(value: unknown): [string, boolean][] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [];

  return Object.entries(value).filter(
    (entry): entry is [string, boolean] => typeof entry[1] === 'boolean'
  );
}

function persist(): void {
  writeJson(STORAGE_KEY, Object.fromEntries(rooms), '[zobel] read receipt choices not stored');
}

/** What was chosen for this chat, or null while it follows the setting for all chats. */
export function roomManualReadReceipts(roomId: string | null | undefined): boolean | null {
  return roomId ? (rooms.get(roomId) ?? null) : null;
}

export function setRoomManualReadReceipts(roomId: string, manual: boolean | null): void {
  if (manual === null) rooms.delete(roomId);
  else rooms.set(roomId, manual);
  persist();
}

/** Whether read receipts for this chat wait for the reader to tap "Seen". */
export function usesManualReadReceipts(roomId: string | null | undefined): boolean {
  return roomManualReadReceipts(roomId) ?? preferences.manualReadReceipts;
}

function adoptRoomChoices(entries: [string, boolean][]): void {
  rooms.clear();
  for (const [roomId, manual] of entries) rooms.set(roomId, manual);
  persist();
}

/** Carries the per-chat choices to the reader's other devices. */
export const manualReadReceiptsDocument: SyncedDocument = {
  eventType: MANUAL_READ_RECEIPTS_ACCOUNT_DATA_TYPE,
  sealed: true,

  snapshot: () => ({ content: { v: DOCUMENT_VERSION, rooms: Object.fromEntries(rooms) } }),

  adopt(content) {
    const body =
      typeof content === 'object' && content !== null && !Array.isArray(content)
        ? (content as Record<string, unknown>)
        : null;
    // Nothing usable on the account yet: local choices, if there are any, get uploaded.
    if (body?.v !== DOCUMENT_VERSION) return rooms.size === 0;

    adoptRoomChoices(parseRoomChoices(body.rooms));
    return true;
  },
};

/** The read receipt a timeline would have sent by now, kept until the reader confirms it. */
export class HeldReadReceipt {
  /** The newest event the reader has had on screen, or null when nothing is waiting. */
  eventId = $state<string | null>(null);
  sending = $state(false);

  /** Stands in for sending: the timeline hands over the event it would mark as read. */
  hold = (eventId: string): Promise<void> => {
    this.eventId = eventId;
    return Promise.resolve();
  };

  /** Forgets the receipt, because the chat was marked as read some other way. */
  drop(): void {
    this.eventId = null;
  }

  /** Sends the receipt. It stays held if sending fails, so the reader can try again. */
  async send(markRead: (eventId: string) => Promise<void>): Promise<void> {
    const eventId = this.eventId;
    if (eventId === null || this.sending) return;

    this.sending = true;
    try {
      await markRead(eventId);
      if (this.eventId === eventId) this.eventId = null;
    } finally {
      this.sending = false;
    }
  }
}
