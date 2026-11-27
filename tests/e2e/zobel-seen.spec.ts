import type { Page } from '@playwright/test';

import { quietFor, RECEIPT_COALESCE_MS } from './fixtures/settle';
import { timelineItem } from './fixtures/timeline-items';
import { expect, test, SIGNED_OUT } from './fixtures/test';
import { COLD_BOOT_TIMEOUT } from './pages/AppShell';
import type { FakeCoreDriver } from './pages/FakeCoreDriver';

/**
 * Zobel's "mark chats as read by hand" in the app, with a scripted core: when the app
 * asks the core to send a read receipt. `zobel-seen-homeserver.spec.ts` checks what a
 * real homeserver then tells the other members.
 */
test.use({ storageState: SIGNED_OUT });

const ROOM = '!room:example.test';
const LATEST = 'General message 19';

const seenButton = (page: Page) => page.getByRole('button', { name: 'Seen', exact: true });

async function receiptsSent(core: FakeCoreDriver): Promise<number> {
  return (await core.commands()).filter((command) => command === 'timeline.mark_read').length;
}

async function markByHand(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('sable-preferences', JSON.stringify({ manualReadReceipts: true }));
  });
}

test('the setting under Privacy holds the read receipt back until "Seen"', async ({
  page,
  app,
  timeline,
  core,
  installRoomCore,
}, testInfo) => {
  await installRoomCore('ready');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/settings/privacy');
  const setting = page.getByRole('switch', { name: 'Mark chats as read by hand', exact: true });
  await expect(setting).toBeVisible({ timeout: COLD_BOOT_TIMEOUT });
  await expect(setting).not.toBeChecked();
  await setting.click();
  await expect(setting).toBeChecked();
  await page.screenshot({ path: testInfo.outputPath('setting.png') });

  await app.openRoom(ROOM);
  await timeline.expectAtLatest(LATEST);

  await expect(seenButton(page)).toBeVisible();
  // Wait past the receipt coalescing window so an accidental read cannot pass.
  await quietFor(page, RECEIPT_COALESCE_MS);
  expect(await receiptsSent(core)).toBe(0);
  await page.screenshot({ path: testInfo.outputPath('seen-desktop.png') });

  await seenButton(page).click();

  await expect.poll(() => receiptsSent(core)).toBe(1);
  await expect(seenButton(page)).toBeHidden();
});

test('a chat is read by opening it while the setting is off', async ({
  page,
  app,
  timeline,
  core,
  installRoomCore,
}) => {
  await installRoomCore('ready');
  await app.openRoom(ROOM);
  await timeline.expectAtLatest(LATEST);

  await expect.poll(() => receiptsSent(core)).toBe(1);
  await expect(seenButton(page)).toBeHidden();
});

test('a message that arrives in the open chat waits for "Seen" again', async ({
  page,
  app,
  timeline,
  core,
  installRoomCore,
}) => {
  await markByHand(page);
  await installRoomCore('ready');
  await app.openRoom(ROOM);
  await timeline.expectAtLatest(LATEST);
  await seenButton(page).click();
  await expect.poll(() => receiptsSent(core)).toBe(1);

  const subscription = await core.subscription(0);
  await core.emitTimelineDiff(subscription, [
    { op: 'push_back', value: timelineItem('arrived', 'Arrived while the chat was open') },
  ]);

  await expect(timeline.message('Arrived while the chat was open')).toBeInViewport();
  await expect(seenButton(page)).toBeVisible();
  await quietFor(page, RECEIPT_COALESCE_MS);
  expect(await receiptsSent(core)).toBe(1);

  await seenButton(page).click();

  await expect.poll(() => receiptsSent(core)).toBe(2);
});

test('marking the chat as read from its menu still works and puts "Seen" away', async ({
  page,
  app,
  timeline,
  core,
  installRoomCore,
}) => {
  await markByHand(page);
  await installRoomCore('ready');
  await page.setViewportSize({ width: 1280, height: 720 });
  await app.openRoom(ROOM);
  await timeline.expectAtLatest(LATEST);
  await expect(seenButton(page)).toBeVisible();

  await page.getByRole('button', { name: 'More options' }).click();
  await page.getByRole('menuitem', { name: 'Mark as read', exact: true }).click();

  await expect.poll(() => receiptsSent(core)).toBe(1);
  await expect(seenButton(page)).toBeHidden();
});

test('a chat can be set to wait for "Seen" in its own settings', async ({
  page,
  app,
  timeline,
  core,
  installRoomCore,
}, testInfo) => {
  await installRoomCore('ready');
  await page.setViewportSize({ width: 1280, height: 720 });
  await app.openRooms();
  await page
    .locator(`.room-row-wrap a[href="/rooms/${encodeURIComponent(ROOM)}"]`)
    .click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  const choice = page.getByRole('dialog').getByRole('radiogroup', { name: 'Mark as read by hand' });
  await expect(choice.getByRole('radio', { name: 'Default (Off)' })).toBeChecked();
  await choice.getByRole('radio', { name: 'On', exact: true }).check();
  await expect(choice.getByRole('radio', { name: 'On', exact: true })).toBeChecked();
  await page.screenshot({ path: testInfo.outputPath('room-setting.png') });

  await app.openRoom(ROOM);
  await timeline.expectAtLatest(LATEST);

  await expect(seenButton(page)).toBeVisible();
  await quietFor(page, RECEIPT_COALESCE_MS);
  expect(await receiptsSent(core)).toBe(0);
});

test('mobile: "Seen" sits between the messages and the composer', async ({
  page,
  app,
  timeline,
  core,
  installRoomCore,
}, testInfo) => {
  await markByHand(page);
  await installRoomCore('ready');
  await page.setViewportSize({ width: 390, height: 800 });
  await app.openRoom(ROOM);
  await timeline.expectAtLatest(LATEST);

  await expect(seenButton(page)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('seen-mobile.png') });
  const button = await seenButton(page).boundingBox();
  const latest = await timeline.message(LATEST).boundingBox();
  const composer = await app.composer.boundingBox();
  if (!button || !latest || !composer) throw new Error('the chat is not laid out');
  expect(button.y).toBeGreaterThanOrEqual(latest.y + latest.height);
  expect(button.y + button.height).toBeLessThanOrEqual(composer.y);

  await seenButton(page).click();

  await expect.poll(() => receiptsSent(core)).toBe(1);
});
