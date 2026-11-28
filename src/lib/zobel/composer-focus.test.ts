// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$app/navigation', () => import('#lib/test-support/app-navigation.js'));
vi.mock('$app/state', () => import('#lib/test-support/app-state.js'));
vi.mock('$app/paths', () => ({ resolve: (path: string) => path }));
vi.mock('#lib/ui/app-layout.svelte.js', () => ({ matchesAppLayout: vi.fn(() => true) }));
vi.mock('#lib/rooms/room-list.svelte.js', () => ({
  roomPathParamFromId: (roomId: string) => roomId,
  findRoomByPathId: () => undefined,
}));

import { trackRouteFocus } from '#lib/features/room/room-navigation.js';
import { preferences } from '#lib/settings/preferences.svelte.js';
import { afterNavigate, beforeNavigate } from '#lib/test-support/app-navigation.js';

import { focusComposerOnOpen } from './composer-focus';

function pointer(coarse: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(pointer: coarse)' ? coarse : false,
    media: query,
  }));
}

/** Opens a room from the room list and returns the id of the element left focused. */
function openFromList(): string | undefined {
  trackRouteFocus();
  const before = beforeNavigate.mock.calls.at(-1)?.[0] as () => void;
  const after = afterNavigate.mock.calls.at(-1)?.[0] as (navigation: unknown) => void;
  document.getElementById('item')?.focus();
  before();
  after({ from: null, to: { url: new URL('https://app.test/rooms/room') } });
  return document.activeElement?.id;
}

describe('jumping to the message field when opening a chat', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => setTimeout(callback, 0));
    document.body.innerHTML = `
      <div data-focus-region="rooms"><a href="#r" role="treeitem" id="item">Room</a></div>
      <h1 tabindex="-1" data-room-heading id="heading">Room</h1>
      <div data-focus-region="composer"><div contenteditable="true" id="composer"></div></div>`;
  });

  afterEach(() => {
    preferences.focusComposerOnOpen = 'auto';
    vi.unstubAllGlobals();
  });

  test('"auto" jumps there with a mouse', () => {
    pointer(false);
    expect(focusComposerOnOpen()).toBe(true);
    expect(openFromList()).toBe('composer');
  });

  test('"auto" leaves the keyboard closed on a touch screen', () => {
    pointer(true);
    expect(focusComposerOnOpen()).toBe(false);
    expect(openFromList()).toBe('item');
  });

  test('"always" jumps there on a touch screen too', () => {
    pointer(true);
    preferences.focusComposerOnOpen = 'always';
    expect(openFromList()).toBe('composer');
  });

  test('"never" stays in the room list, even with a mouse', () => {
    pointer(false);
    preferences.focusComposerOnOpen = 'never';
    expect(openFromList()).toBe('item');
  });
});
