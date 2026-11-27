// @vitest-environment happy-dom

/**
 * The timeline with "mark chats as read by hand" on. Kept apart from Sable's own
 * timeline tests, so those merge without conflicts.
 */
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { CoreClient } from '#lib/core/client.svelte.js';
import { timelineItem as item } from '#lib/features/room/timeline/test-items.js';
import { RoomTimeline } from '#lib/rooms/timeline.svelte.js';
import { setPreference } from '#lib/settings/preferences.svelte.js';
import { rememberTimelineView } from '#lib/timeline/timeline-window.js';
import { flushed } from '#lib/ui/flushed.js';

vi.mock('$app/state', () => import('#lib/test-support/app-state.js'));
vi.mock('#lib/core/context.js');
vi.mock('#lib/platform/overlay-back.svelte.js', () => ({
  holdOverlayBack: () => {},
  afterOverlayPops: () => Promise.resolve(),
}));
vi.mock('#lib/rooms/room-list.svelte.js', () => ({ useRoomList: () => ({ rooms: [] }) }));
vi.mock('#lib/personas/personas.svelte.js', () => ({
  usePersonaStore: () => ({ personas: [], load: () => Promise.resolve() }),
}));
vi.mock('#lib/features/room/messages/event-items.svelte.js', () => ({
  useEventItems: () => ({ get: () => undefined }),
}));

import TimelineListHarness from '#lib/features/room/timeline/TimelineListHarness.test.svelte';
import { resetPage } from '#lib/test-support/app-state.js';

import { setRoomManualReadReceipts } from './manual-read-receipts.svelte.js';

const ROOM = '!room:example.org';

let animationFrames: FrameRequestCallback[];

beforeEach(() => {
  rememberTimelineView(`${ROOM}:`, null);
  resetPage();
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  // happy-dom has no Web Animations API.
  Element.prototype.animate = () =>
    ({
      cancel: () => {},
      effect: null,
      onfinish: null,
      playState: 'finished',
    }) as unknown as Animation;
  animationFrames = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    animationFrames.push(callback);
    return animationFrames.length;
  });
});

afterEach(() => {
  setPreference('manualReadReceipts', false);
  setRoomManualReadReceipts(ROOM, null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function runAnimationFrames(): Promise<void> {
  for (let index = 0; index < 10; index += 1) {
    await Promise.resolve();
    for (const callback of animationFrames.splice(0)) callback(0);
    await flushed();
  }
}

/** Opens an unread room at its latest message and waits until a receipt would have gone out. */
async function openUnreadRoom(read: (eventId: string, fullyRead: boolean) => Promise<void>) {
  const timeline = new RoomTimeline({} as CoreClient);
  timeline.hasSnapshot = true;
  timeline.items = [item('earlier'), item('latest')];
  const view = render(TimelineListHarness, {
    props: {
      list: {
        timeline,
        roomId: ROOM,
        hasUnread: true,
        onRequestHistory: () => Promise.resolve(true),
        onRequestFuture: () => Promise.resolve(),
        onRead: read,
      },
    },
  });
  await flushed();
  await runAnimationFrames();
  // Longer than the timeline waits before it marks what is on screen as read.
  await new Promise((resolve) => setTimeout(resolve, 700));
  await runAnimationFrames();
  return view;
}

test('opening a chat sends the read receipt by itself while the setting is off', async () => {
  const read = vi.fn().mockResolvedValue(undefined);

  await openUnreadRoom(read);

  expect(read).toHaveBeenCalledWith('$latest', true);
  expect(screen.queryByRole('button', { name: 'Seen' })).not.toBeInTheDocument();
});

test('with the setting on, opening a chat sends nothing and offers "Seen"', async () => {
  setPreference('manualReadReceipts', true);
  const read = vi.fn().mockResolvedValue(undefined);

  await openUnreadRoom(read);

  expect(read).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Seen' })).toBeInTheDocument();
});

test('tapping "Seen" sends the read receipt for the latest message', async () => {
  setPreference('manualReadReceipts', true);
  const read = vi.fn().mockResolvedValue(undefined);
  await openUnreadRoom(read);

  await userEvent.click(screen.getByRole('button', { name: 'Seen' }));

  expect(read).toHaveBeenCalledExactlyOnceWith('$latest', true);
  expect(screen.queryByRole('button', { name: 'Seen' })).not.toBeInTheDocument();
});

test('a chat set to "on" waits for "Seen" although the setting for all chats is off', async () => {
  setRoomManualReadReceipts(ROOM, true);
  const read = vi.fn().mockResolvedValue(undefined);

  await openUnreadRoom(read);

  expect(read).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Seen' })).toBeInTheDocument();
});

test('a chat set to "off" is read by itself although the setting for all chats is on', async () => {
  setPreference('manualReadReceipts', true);
  setRoomManualReadReceipts(ROOM, false);
  const read = vi.fn().mockResolvedValue(undefined);

  await openUnreadRoom(read);

  expect(read).toHaveBeenCalledWith('$latest', true);
  expect(screen.queryByRole('button', { name: 'Seen' })).not.toBeInTheDocument();
});
