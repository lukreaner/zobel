// @vitest-environment happy-dom

import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

import { flushed } from '#lib/ui/flushed.js';
import { toasts } from '#lib/ui/toasts.svelte.js';

vi.mock('#lib/core/context.js');

import { core } from '#lib/core/__mocks__/context.js';

import { HeldReadReceipt } from './manual-read-receipts.svelte.js';
import SeenBar from './SeenBar.svelte';

afterEach(() => {
  vi.restoreAllMocks();
  core.rpc.timeline.unreadDiagnostics.mockReset();
});

function held(eventId: string | null = '$latest'): HeldReadReceipt {
  const receipt = new HeldReadReceipt();
  receipt.eventId = eventId;
  return receipt;
}

const seenButton = () => screen.queryByRole('button', { name: 'Seen' });

test('the button shows once unread messages have been on screen', () => {
  render(SeenBar, { manual: true, receipt: held(), unread: true, onSeen: vi.fn() });

  expect(seenButton()).toBeInTheDocument();
});

test('there is no button before anything has been on screen', () => {
  render(SeenBar, { manual: true, receipt: held(null), unread: true, onSeen: vi.fn() });

  expect(seenButton()).not.toBeInTheDocument();
});

test('there is no button in a chat that is already read', () => {
  render(SeenBar, { manual: true, receipt: held(), unread: false, onSeen: vi.fn() });

  expect(seenButton()).not.toBeInTheDocument();
});

test('tapping the button sends the read receipt and puts the button away', async () => {
  const onSeen = vi.fn().mockResolvedValue(undefined);
  render(SeenBar, { manual: true, receipt: held(), unread: true, onSeen });

  await userEvent.click(screen.getByRole('button', { name: 'Seen' }));

  expect(onSeen).toHaveBeenCalledExactlyOnceWith('$latest');
  expect(seenButton()).not.toBeInTheDocument();
});

test('the button stays when the read receipt could not be sent', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const failed = vi.spyOn(toasts, 'error');
  const onSeen = vi.fn().mockRejectedValue(new Error('offline'));
  render(SeenBar, { manual: true, receipt: held(), unread: true, onSeen });

  await userEvent.click(screen.getByRole('button', { name: 'Seen' }));
  await flushed();

  expect(failed).toHaveBeenCalledWith('The read receipt could not be sent.');
  expect(seenButton()).toBeEnabled();
});

test('a chat that is read automatically has no button and sends nothing by itself', async () => {
  const onSeen = vi.fn().mockResolvedValue(undefined);
  render(SeenBar, { manual: false, receipt: held(null), unread: true, onSeen });
  await flushed();

  expect(seenButton()).not.toBeInTheDocument();
  expect(onSeen).not.toHaveBeenCalled();
});

test('switching back to automatic sends the receipt that was waiting', async () => {
  const onSeen = vi.fn().mockResolvedValue(undefined);
  const receipt = held();
  const view = render(SeenBar, { manual: true, receipt, unread: true, onSeen });

  await view.rerender({ manual: false });
  await flushed();

  expect(onSeen).toHaveBeenCalledExactlyOnceWith('$latest');
  expect(receipt.eventId).toBeNull();
  expect(seenButton()).not.toBeInTheDocument();
});

test('a thread shows the button when the thread itself has unread replies', async () => {
  core.rpc.timeline.unreadDiagnostics.mockResolvedValue({
    main: { unread: 0, notifying: 0, highlight: 0, receipt_event_id: null },
    server_notifications: 0,
    server_highlights: 0,
    threads: [
      { root_event_id: '$root', unread: 2, notifying: 0, highlight: 0, receipt_event_id: null },
    ],
  });
  render(SeenBar, {
    manual: true,
    receipt: held('$reply'),
    roomId: '!room:example.org',
    threadRootId: '$root',
    unread: false,
    onSeen: vi.fn(),
  });

  await vi.waitFor(() => {
    expect(seenButton()).toBeInTheDocument();
  });
  expect(core.rpc.timeline.unreadDiagnostics).toHaveBeenCalledWith({
    room_id: '!room:example.org',
    thread_roots: ['$root'],
  });
});

test('a thread that is read has no button, even in an unread room', async () => {
  core.rpc.timeline.unreadDiagnostics.mockResolvedValue({
    main: { unread: 3, notifying: 0, highlight: 0, receipt_event_id: null },
    server_notifications: 0,
    server_highlights: 0,
    threads: [
      { root_event_id: '$root', unread: 0, notifying: 0, highlight: 0, receipt_event_id: '$reply' },
    ],
  });
  render(SeenBar, {
    manual: true,
    receipt: held('$reply'),
    roomId: '!room:example.org',
    threadRootId: '$root',
    unread: true,
    onSeen: vi.fn(),
  });
  await flushed();
  await flushed();

  expect(core.rpc.timeline.unreadDiagnostics).toHaveBeenCalled();
  expect(seenButton()).not.toBeInTheDocument();
});

test('a thread whose read state cannot be looked up still gets the button', async () => {
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  core.rpc.timeline.unreadDiagnostics.mockRejectedValue(new Error('unavailable'));
  render(SeenBar, {
    manual: true,
    receipt: held('$reply'),
    roomId: '!room:example.org',
    threadRootId: '$root',
    unread: false,
    onSeen: vi.fn(),
  });

  await vi.waitFor(() => {
    expect(seenButton()).toBeInTheDocument();
  });
});
