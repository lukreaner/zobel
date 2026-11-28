import { currentLocale, t } from '#lib/i18n.js';
import { preferences } from '#lib/settings/preferences.svelte.js';
import { SYSTEM_TIME_ZONE } from '#lib/ui/time-zones.js';
import { dayKey, formatTime } from '#lib/ui/date-time.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function format(timestamp: number, options: Intl.DateTimeFormatOptions): string {
  const timeZone = preferences.timeZone === SYSTEM_TIME_ZONE ? undefined : preferences.timeZone;
  return new Intl.DateTimeFormat(currentLocale(), { ...options, timeZone }).format(timestamp);
}

/**
 * When the last message of a chat arrived, short enough for the chat list, as messengers
 * write it: the time today, "Yesterday", the weekday within the last week, else the date.
 */
export function formatListTime(timestamp: number, now = Date.now()): string {
  const day = dayKey(timestamp);
  if (day === dayKey(now)) return formatTime(timestamp);
  if (day === dayKey(now - DAY_MS)) return t('common.yesterday');
  if (timestamp > now) return format(timestamp, { day: 'numeric', month: 'short' });
  for (let back = 2; back < 7; back++) {
    if (day === dayKey(now - back * DAY_MS)) return format(timestamp, { weekday: 'short' });
  }
  const sameYear = format(timestamp, { year: 'numeric' }) === format(now, { year: 'numeric' });
  return format(
    timestamp,
    sameYear
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'numeric', year: '2-digit' }
  );
}
