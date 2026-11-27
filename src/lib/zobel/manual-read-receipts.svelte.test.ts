import { afterEach, describe, expect, test, vi } from 'vitest';

import { setPreference } from '#lib/settings/preferences.svelte.js';

import {
  HeldReadReceipt,
  manualReadReceiptsDocument,
  parseRoomChoices,
  roomManualReadReceipts,
  setRoomManualReadReceipts,
  usesManualReadReceipts,
} from './manual-read-receipts.svelte.js';

const ROOM = '!room:example.org';
const OTHER = '!other:example.org';

afterEach(() => {
  setPreference('manualReadReceipts', false);
  setRoomManualReadReceipts(ROOM, null);
  setRoomManualReadReceipts(OTHER, null);
});

describe('which chats are marked as read by hand', () => {
  test('a chat follows the setting for all chats until it gets its own', () => {
    expect(usesManualReadReceipts(ROOM)).toBe(false);

    setPreference('manualReadReceipts', true);

    expect(usesManualReadReceipts(ROOM)).toBe(true);
    expect(roomManualReadReceipts(ROOM)).toBeNull();
  });

  test('a chat can be switched on while the others stay automatic', () => {
    setRoomManualReadReceipts(ROOM, true);

    expect(usesManualReadReceipts(ROOM)).toBe(true);
    expect(usesManualReadReceipts(OTHER)).toBe(false);
  });

  test('a chat can be switched off while the others wait for the reader', () => {
    setPreference('manualReadReceipts', true);
    setRoomManualReadReceipts(ROOM, false);

    expect(usesManualReadReceipts(ROOM)).toBe(false);
    expect(usesManualReadReceipts(OTHER)).toBe(true);
  });

  test('a chat goes back to following the setting for all chats', () => {
    setRoomManualReadReceipts(ROOM, true);
    setRoomManualReadReceipts(ROOM, null);

    expect(usesManualReadReceipts(ROOM)).toBe(false);
  });

  test('a timeline without a room follows the setting for all chats', () => {
    setPreference('manualReadReceipts', true);

    expect(usesManualReadReceipts(undefined)).toBe(true);
  });

  test('stored choices that are not on or off are dropped', () => {
    expect(parseRoomChoices({ [ROOM]: true, [OTHER]: 'yes', '!third:example.org': false })).toEqual(
      [
        [ROOM, true],
        ['!third:example.org', false],
      ]
    );
    expect(parseRoomChoices(['nonsense'])).toEqual([]);
    expect(parseRoomChoices(null)).toEqual([]);
  });
});

describe('syncing the choices', () => {
  test('the choices of this device are what gets uploaded', () => {
    setRoomManualReadReceipts(ROOM, true);
    setRoomManualReadReceipts(OTHER, false);

    expect(manualReadReceiptsDocument.snapshot().content).toEqual({
      v: 1,
      rooms: { [ROOM]: true, [OTHER]: false },
    });
  });

  test('choices from another device replace the ones here', () => {
    setRoomManualReadReceipts(ROOM, true);

    const adopted = manualReadReceiptsDocument.adopt({ v: 1, rooms: { [OTHER]: true } });

    expect(adopted).toBe(true);
    expect(roomManualReadReceipts(ROOM)).toBeNull();
    expect(roomManualReadReceipts(OTHER)).toBe(true);
  });

  test('an account without stored choices takes the ones made here', () => {
    setRoomManualReadReceipts(ROOM, true);

    expect(manualReadReceiptsDocument.adopt(null)).toBe(false);
    expect(roomManualReadReceipts(ROOM)).toBe(true);
  });

  test('nothing is uploaded while neither side has a choice', () => {
    expect(manualReadReceiptsDocument.adopt(null)).toBe(true);
  });
});

describe('a held read receipt', () => {
  test('keeps the newest event it was handed', async () => {
    const receipt = new HeldReadReceipt();

    await receipt.hold('$first');
    await receipt.hold('$second');

    expect(receipt.eventId).toBe('$second');
  });

  test('is sent for the held event and then gone', async () => {
    const receipt = new HeldReadReceipt();
    const markRead = vi.fn().mockResolvedValue(undefined);
    await receipt.hold('$latest');

    await receipt.send(markRead);

    expect(markRead).toHaveBeenCalledExactlyOnceWith('$latest');
    expect(receipt.eventId).toBeNull();
    expect(receipt.sending).toBe(false);
  });

  test('stays held when sending fails', async () => {
    const receipt = new HeldReadReceipt();
    await receipt.hold('$latest');

    await expect(receipt.send(() => Promise.reject(new Error('offline')))).rejects.toThrow(
      'offline'
    );

    expect(receipt.eventId).toBe('$latest');
    expect(receipt.sending).toBe(false);
  });

  test('keeps a newer event that came in while the older one was being sent', async () => {
    const receipt = new HeldReadReceipt();
    await receipt.hold('$older');

    await receipt.send(async () => {
      await receipt.hold('$newer');
    });

    expect(receipt.eventId).toBe('$newer');
  });

  test('sends nothing when nothing is held', async () => {
    const markRead = vi.fn();

    await new HeldReadReceipt().send(markRead);

    expect(markRead).not.toHaveBeenCalled();
  });
});
