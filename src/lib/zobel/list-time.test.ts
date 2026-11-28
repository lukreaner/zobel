import { afterEach, beforeEach, expect, test } from 'vitest';

import { currentLocale } from '#lib/i18n.js';
import { preferences, setPreference } from '#lib/settings/preferences.svelte.js';

import { formatListTime } from './list-time.js';

// Tuesday, 1 September 2026, early afternoon.
const now = new Date(2026, 8, 1, 14, 30).getTime();
const previousClock = preferences.hour24Clock;

beforeEach(() => {
  setPreference('hour24Clock', true);
});

afterEach(() => {
  setPreference('hour24Clock', previousClock);
});

test('a message from today shows its time', () => {
  expect(formatListTime(new Date(2026, 8, 1, 8, 28).getTime(), now)).toBe('08:28');
});

test('a message from yesterday says so', () => {
  expect(formatListTime(new Date(2026, 7, 31, 23, 50).getTime(), now)).toBe('Yesterday');
});

test('a message from this week shows its weekday', () => {
  const thursday = new Date(2026, 7, 27, 12, 0);
  expect(formatListTime(thursday.getTime(), now)).toBe(
    thursday.toLocaleDateString(currentLocale(), { weekday: 'short' })
  );
});

test('an older message shows its date, with the year only when it is another one', () => {
  const january = new Date(2026, 0, 21, 12, 0);
  expect(formatListTime(january.getTime(), now)).toBe(
    january.toLocaleDateString(currentLocale(), { day: 'numeric', month: 'short' })
  );
  const lastYear = new Date(2025, 10, 21, 12, 0);
  expect(formatListTime(lastYear.getTime(), now)).toBe(
    lastYear.toLocaleDateString(currentLocale(), {
      day: 'numeric',
      month: 'numeric',
      year: '2-digit',
    })
  );
});
