import { afterEach, expect, test, vi } from 'vitest';

vi.mock('$app/state', () => import('#lib/test-support/app-state.js'));

import { preferences, setPreference } from '#lib/settings/preferences.svelte.js';

import { chooseChatLook, messengerLook } from './chat-look.svelte.js';

afterEach(() => {
  setPreference('chatLook', 'sable');
  setPreference('layout', 'modern');
  setPreference('alignOwnMessages', true);
  setPreference('messagePreviews', 'off');
});

test('the messenger look turns on bubbles and message previews', () => {
  setPreference('chatLook', 'messenger');
  chooseChatLook('messenger');

  expect(messengerLook()).toBe(true);
  expect(preferences.layout).toBe('bubble');
  expect(preferences.alignOwnMessages).toBe(true);
  expect(preferences.messagePreviews).toBe('all');
});

test("going back to Sable's look undoes them", () => {
  chooseChatLook('messenger');
  setPreference('chatLook', 'sable');
  chooseChatLook('sable');

  expect(messengerLook()).toBe(false);
  expect(preferences.layout).toBe('modern');
  expect(preferences.messagePreviews).toBe('off');
});

test('a setting changed since stays as it is', () => {
  chooseChatLook('messenger');
  setPreference('layout', 'compact');
  chooseChatLook('sable');

  expect(preferences.layout).toBe('compact');
  expect(preferences.messagePreviews).toBe('off');
});
