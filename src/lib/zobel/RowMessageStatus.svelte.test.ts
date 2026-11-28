// @vitest-environment happy-dom
import { render, screen } from '@testing-library/svelte';
import { afterEach, expect, test } from 'vitest';

import type { LatestEventView } from '#src/generated/protocol';
import RoomRowText from '#lib/features/sidebar/RoomRowText.svelte';
import { preferences } from '#lib/settings/preferences.svelte.js';
import { roomView } from '#lib/test-support/room-views.js';

function latest(overrides: Partial<LatestEventView>): LatestEventView {
  return {
    sender: '@me:test.local',
    own: true,
    sender_label: null,
    kind: 'text',
    body: 'Hi',
    emotes: [],
    timestamp: 1,
    sending: false,
    event_id: '$sent',
    ...overrides,
  };
}

function row(event: LatestEventView): void {
  render(RoomRowText, {
    name: 'Chat',
    room: roomView({ latest_event: event }),
    preview: { sender: 'You', text: event.body, emotes: [] },
  });
}

afterEach(() => {
  preferences.chatListStatus = false;
});

test('with the setting on, your sent last message gets a tick', () => {
  preferences.chatListStatus = true;
  row(latest({}));
  expect(screen.getByRole('img', { name: 'Sent' })).toBeInTheDocument();
});

test('a message still being sent gets a clock', () => {
  preferences.chatListStatus = true;
  row(latest({ sending: true, event_id: null }));
  expect(screen.getByRole('img', { name: 'Sending' })).toBeInTheDocument();
});

test("someone else's last message gets no status", () => {
  preferences.chatListStatus = true;
  row(latest({ own: false, sender: '@them:test.local' }));
  expect(screen.queryByRole('img')).toBeNull();
});

test('with the setting off, as in Sable, there is no status', () => {
  row(latest({}));
  expect(screen.queryByRole('img')).toBeNull();
});
