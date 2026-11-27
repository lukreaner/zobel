// @vitest-environment happy-dom

import type { Window } from 'happy-dom';
import { afterEach, expect, test, vi } from 'vitest';
import { AppLayout, matchesAppLayout } from '#lib/ui/app-layout.svelte.js';

const viewport = (window as unknown as Window).happyDOM;
const originalSize = { width: window.innerWidth, height: window.innerHeight };

afterEach(() => {
  vi.restoreAllMocks();
  viewport.setViewport(originalSize);
});

test.each([
  { what: 'an unfolded foldable in portrait', width: 700, height: 900, touch: true, split: true },
  { what: 'a small tablet in portrait', width: 600, height: 960, touch: true, split: true },
  { what: 'a large phone in portrait', width: 430, height: 932, touch: true, split: false },
  { what: 'a narrow touch window', width: 591, height: 900, touch: true, split: false },
  { what: 'a narrow desktop window', width: 700, height: 900, touch: false, split: false },
])('$what ($width x $height) gets the split view: $split', ({ width, height, touch, split }) => {
  viewport.setViewport({ width, height });
  vi.spyOn(window.navigator, 'maxTouchPoints', 'get').mockReturnValue(touch ? 1 : 0);

  expect(new AppLayout().current).toBe(split);
  expect(matchesAppLayout()).toBe(split);
});
