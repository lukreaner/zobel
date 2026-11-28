import type { Locator, Page } from '@playwright/test';

import { registerUser } from './fixtures/continuwuity';
import { LOGIN_PASSWORD } from './fixtures/loginAccount';
import { MatrixAdmin } from './fixtures/matrix';
import { quietFor } from './fixtures/settle';
import { expect, test, SIGNED_OUT } from './fixtures/test';
import { COLD_BOOT_TIMEOUT } from './pages/AppShell';

/**
 * Zobel's "mark chats as read by hand", against a real homeserver: what the other
 * member of a chat is told about the reader, before and after "Seen".
 */
test.use({ storageState: SIGNED_OUT });

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
});

type Receipts = Record<string, Record<string, Record<string, unknown>>>;
type Sync = {
  rooms?: {
    join?: Record<string, { ephemeral?: { events?: { type: string; content: Receipts }[] } }>;
  };
};

/** The event the homeserver tells `observer` that `userId` has read up to. */
async function readUpTo(
  observer: MatrixAdmin,
  roomId: string,
  userId: string
): Promise<string | null> {
  const sync = await observer.request<Sync>('GET', 'client/v3/sync?timeout=0');
  for (const event of sync.rooms?.join?.[roomId]?.ephemeral?.events ?? []) {
    if (event.type !== 'm.receipt') continue;
    for (const [eventId, kinds] of Object.entries(event.content)) {
      if (kinds['m.read']?.[userId]) return eventId;
    }
  }
  return null;
}

/** Every event the homeserver tells `observer` that `userId` has a read receipt on. */
async function readEvents(
  observer: MatrixAdmin,
  roomId: string,
  userId: string
): Promise<string[]> {
  const sync = await observer.request<Sync>('GET', 'client/v3/sync?timeout=0');
  return (sync.rooms?.join?.[roomId]?.ephemeral?.events ?? [])
    .filter((event) => event.type === 'm.receipt')
    .flatMap((event) => Object.entries(event.content))
    .filter(([, kinds]) => kinds['m.read']?.[userId])
    .map(([eventId]) => eventId);
}

/** A second person, a chat they share with the reader, and a first message in it. */
async function chatWith(
  homeserverUrl: string,
  reader: MatrixAdmin,
  label: string
): Promise<{ writer: MatrixAdmin; roomId: string; firstEventId: string }> {
  const account = await registerUser(homeserverUrl, `writer-${label}`, LOGIN_PASSWORD);
  const writer = new MatrixAdmin(homeserverUrl, account.accessToken, account.userId);
  // The reader's own room: the app would have to follow an invitation turning into a
  // membership, which it sometimes misses when the join happens outside it.
  const roomId = await reader.createRoom({ name: `Seen ${label}`, invite: [writer.userId] });
  await writer.join(roomId);
  const firstEventId = await writer.sendMessage(roomId, 'First message');
  return { writer, roomId, firstEventId };
}

const seenButton = (within: Page | Locator) =>
  within.getByRole('button', { name: 'Seen', exact: true });

/** Long enough for a chat that is read by itself to have told the homeserver. */
const AUTOMATIC_RECEIPT_MS = 3_000;

test('a chat is marked as read by opening it while the setting is off', async ({
  page,
  app,
  homeserver,
  freshLogin,
}) => {
  const reader = await freshLogin();
  const { writer, roomId, firstEventId } = await chatWith(
    homeserver.baseUrl,
    reader,
    `auto-${String(Date.now())}`
  );

  await app.openRoomShowing(roomId, page.getByText('First message'));

  await expect.poll(() => readUpTo(writer, roomId, reader.userId)).toBe(firstEventId);
  await expect(seenButton(page)).toBeHidden();
});

test('with the setting on, the other member only learns of it after "Seen"', async ({
  page,
  app,
  homeserver,
  freshLogin,
}) => {
  const reader = await freshLogin();
  const { writer, roomId, firstEventId } = await chatWith(
    homeserver.baseUrl,
    reader,
    `manual-${String(Date.now())}`
  );
  await page.goto('/settings/privacy');
  const setting = page.getByRole('switch', { name: 'Mark chats as read by hand', exact: true });
  await expect(setting).toBeVisible({ timeout: COLD_BOOT_TIMEOUT });
  await setting.click();
  await expect(setting).toBeChecked();

  await app.openRoomShowing(roomId, page.getByText('First message'));

  await expect(seenButton(page)).toBeVisible();
  await quietFor(page, AUTOMATIC_RECEIPT_MS);
  expect(await readUpTo(writer, roomId, reader.userId)).toBeNull();

  await seenButton(page).click();

  await expect.poll(() => readUpTo(writer, roomId, reader.userId)).toBe(firstEventId);
  await expect(seenButton(page)).toBeHidden();

  // A message that arrives while the chat is open waits for "Seen" as well.
  const secondEventId = await writer.sendMessage(roomId, 'Second message');
  await expect(page.getByText('Second message', { exact: true })).toBeVisible();
  await expect(seenButton(page)).toBeVisible();
  await quietFor(page, AUTOMATIC_RECEIPT_MS);
  expect(await readUpTo(writer, roomId, reader.userId)).toBe(firstEventId);

  await seenButton(page).click();

  await expect.poll(() => readUpTo(writer, roomId, reader.userId)).toBe(secondEventId);
});

test('a chat set to "On" waits for "Seen" while the setting for all chats is off', async ({
  page,
  app,
  homeserver,
  freshLogin,
}) => {
  const reader = await freshLogin();
  const { writer, roomId, firstEventId } = await chatWith(
    homeserver.baseUrl,
    reader,
    `room-${String(Date.now())}`
  );

  // From the room list, so the chat is set apart before it has ever been open.
  await app.openRooms();
  await page
    .locator(`.room-row-wrap a[href="/rooms/${encodeURIComponent(roomId)}"]`)
    .click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  const choice = page.getByRole('dialog').getByRole('radiogroup', { name: 'Mark as read by hand' });
  await expect(choice.getByRole('radio', { name: 'Default (Off)' })).toBeChecked();
  await choice.getByRole('radio', { name: 'On', exact: true }).check();
  await expect(choice.getByRole('radio', { name: 'On', exact: true })).toBeChecked();
  await page.getByRole('dialog').getByRole('button', { name: 'Close room settings' }).click();

  await app.openRoomShowing(roomId, page.getByText('First message'));

  await expect(seenButton(page)).toBeVisible();
  await quietFor(page, AUTOMATIC_RECEIPT_MS);
  expect(await readUpTo(writer, roomId, reader.userId)).toBeNull();

  await seenButton(page).click();

  await expect.poll(() => readUpTo(writer, roomId, reader.userId)).toBe(firstEventId);
});

test('a thread waits for its own "Seen"', async ({ page, app, homeserver, freshLogin }) => {
  const reader = await freshLogin();
  const { writer, roomId, firstEventId } = await chatWith(
    homeserver.baseUrl,
    reader,
    `thread-${String(Date.now())}`
  );
  const replyEventId = await writer.sendMessage(roomId, 'Reply in the thread', {
    'm.relates_to': { rel_type: 'm.thread', event_id: firstEventId },
  });
  await page.goto('/settings/privacy');
  const setting = page.getByRole('switch', { name: 'Mark chats as read by hand', exact: true });
  await expect(setting).toBeVisible({ timeout: COLD_BOOT_TIMEOUT });
  await setting.click();
  await expect(setting).toBeChecked();
  await app.openRoomShowing(roomId, page.getByText('First message', { exact: true }));

  await page.locator('.thread-summary').click();
  const thread = page.getByRole('region', { name: 'Thread', exact: true });
  await expect(thread.getByText('Reply in the thread', { exact: true })).toBeVisible();

  await expect(seenButton(thread)).toBeVisible();
  await quietFor(page, AUTOMATIC_RECEIPT_MS);
  expect(await readEvents(writer, roomId, reader.userId)).not.toContain(replyEventId);

  await seenButton(thread).click();

  await expect.poll(() => readEvents(writer, roomId, reader.userId)).toContain(replyEventId);
  await expect(seenButton(thread)).toBeHidden();
});

test('a chat opened without window focus, as from a notification on Android, shows "Seen"', async ({
  page,
  app,
  homeserver,
  freshLogin,
}) => {
  const reader = await freshLogin();
  const { writer, roomId } = await chatWith(
    homeserver.baseUrl,
    reader,
    `unfocused-${String(Date.now())}`
  );
  await page.goto('/settings/privacy');
  const setting = page.getByRole('switch', { name: 'Mark chats as read by hand', exact: true });
  await expect(setting).toBeVisible({ timeout: COLD_BOOT_TIMEOUT });
  await setting.click();
  await expect(setting).toBeChecked();
  const notifiedEventId = await writer.sendMessage(roomId, 'Notified message');

  // A chat opened from an Android notification has no focus until the first touch.
  await page.addInitScript(() => {
    document.hasFocus = () => false;
  });
  await app.openPermalink(roomId, notifiedEventId);
  await expect(page.getByText('Notified message', { exact: true })).toBeVisible({
    timeout: COLD_BOOT_TIMEOUT,
  });

  await expect(seenButton(page)).toBeVisible();
  await seenButton(page).click();
  await expect.poll(() => readUpTo(writer, roomId, reader.userId)).toBe(notifiedEventId);
});
