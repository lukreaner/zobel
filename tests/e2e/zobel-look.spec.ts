import type { Page } from '@playwright/test';

import { registerUser } from './fixtures/continuwuity';
import { LOGIN_PASSWORD } from './fixtures/loginAccount';
import { MatrixAdmin } from './fixtures/matrix';
import { NEGATIVE_SETTLE_MS, quietFor } from './fixtures/settle';
import { expect, test, SIGNED_OUT } from './fixtures/test';
import { COLD_BOOT_TIMEOUT } from './pages/AppShell';

/**
 * Zobel's messenger look (Appearance → Look), on an unfolded foldable: a touch screen wide
 * enough for the split view. With `ZOBEL_SHOTS=<directory>` it also saves screenshots, to look
 * at after a merge from Sable has moved the class names `messenger-look.css` relies on.
 */
test.use({ storageState: SIGNED_OUT, hasTouch: true, viewport: { width: 700, height: 800 } });
test.setTimeout(240_000);

const SHOTS = process.env.ZOBEL_SHOTS;

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function chooseLook(page: Page, look: string): Promise<void> {
  await page.goto('/settings/appearance');
  const option = page.getByRole('radiogroup', { name: 'Look' }).getByRole('radio', { name: look });
  await option.click({ timeout: COLD_BOOT_TIMEOUT });
  await expect(option).toBeChecked();
  await page
    .getByRole('radiogroup', { name: 'Light or dark' })
    .getByRole('radio', { name: 'Dark' })
    .click();
}

/** A direct chat with `name`, where each of them wrote something; returns its room id. */
async function directChat(homeserverUrl: string, me: MatrixAdmin, name: string): Promise<string> {
  const account = await registerUser(
    homeserverUrl,
    `${name.toLowerCase()}-${String(Date.now())}`,
    LOGIN_PASSWORD
  );
  const other = new MatrixAdmin(homeserverUrl, account.accessToken, account.userId);
  await other.setDisplayName(name);
  const roomId = await other.createRoom({ preset: 'trusted_private_chat', invite: [me.userId] });
  await me.join(roomId);
  await me.request('PUT', `client/v3/user/${encodeURIComponent(me.userId)}/account_data/m.direct`, {
    [other.userId]: [roomId],
  });
  await other.sendMessage(roomId, 'Unser Tisch wird nur noch 5min vorgehalten, gehen wir hin?');
  await me.sendMessage(roomId, 'Lass es trotzdem noch versuchen');
  await other.sendMessage(roomId, 'Es tickt immer weiter hoch');
  await me.sendMessage(roomId, 'Bin an der Treppe');
  return roomId;
}

test('the messenger look puts a list menu, times and bubbles in place', async ({
  page,
  app,
  homeserver,
  freshLogin,
}) => {
  const me = await freshLogin();
  const roomId = await directChat(homeserver.baseUrl, me, 'Andrea');
  await chooseLook(page, 'Messenger');

  await page.goto(`/direct/${encodeURIComponent(roomId)}`);
  const own = page.locator('.message.own').filter({ hasText: 'Bin an der Treppe' });
  await expect(own).toBeVisible({ timeout: COLD_BOOT_TIMEOUT });

  // The bar of spaces gives way to a menu of lists above the chats.
  await expect(app.primaryNavigation.locator('.rail')).toHaveCount(0);
  const switcher = page.getByRole('button', { name: 'Direct messages' });
  await expect(switcher).toBeVisible();

  // A theme that caps rows at Sable's height, as Win95 and others in Sable's catalogue do,
  // does not squeeze the taller rows into each other.
  await page.addStyleTag({
    content:
      'body :is(.room-row-wrap, [data-a] [data-b]) { max-height: 37px !important; height: 37px !important; }',
  });

  // Each chat shows when its last message came.
  const row = page.locator(`.room-row-wrap a[href="/direct/${encodeURIComponent(roomId)}"]`);
  await expect(row.locator('.zobel-row-time')).toBeVisible();
  await expect(row).toContainText('Bin an der Treppe');
  const rowBox = await page
    .locator('.room-row-wrap')
    .filter({ has: page.locator(`a[href="/direct/${encodeURIComponent(roomId)}"]`) })
    .boundingBox();
  expect(rowBox && rowBox.height >= 60).toBe(true);

  // Your own messages sit on the right, the other person's on the left without their name.
  const theirs = page.locator('.message').filter({ hasText: 'Es tickt immer weiter hoch' });
  const ownBox = await own.locator('.formatted-body').boundingBox();
  const theirBox = await theirs.locator('.formatted-body').boundingBox();
  expect(ownBox && theirBox && ownBox.x > theirBox.x).toBe(true);
  await expect(theirs.locator('.sender-identity')).toBeHidden();
  await shot(page, 'messenger-chat');

  await switcher.click();
  await expect(page.getByRole('menuitemradio', { name: /Rooms outside spaces/ })).toBeVisible();
  await shot(page, 'messenger-menu');
  await page.getByRole('menuitemradio', { name: /Rooms outside spaces/ }).click();
  await expect(page).toHaveURL(/\/rooms$/);

  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/direct');
  await expect(row).toBeVisible({ timeout: COLD_BOOT_TIMEOUT });
  // The list menu shows the whole name of the list, not a few letters of it.
  const title = page.locator('.zobel-section-title');
  await expect(title).toHaveText('Direct messages');
  expect(await title.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  await shot(page, 'messenger-phone-list');

  // The list menu can float at the bottom instead, within reach of a thumb.
  await page.goto('/settings/appearance');
  const placement = page
    .getByRole('radiogroup', { name: 'List menu' })
    .getByRole('radio', { name: 'Floating at the bottom' });
  await placement.click({ timeout: COLD_BOOT_TIMEOUT });
  await expect(placement).toBeChecked();
  await page.goto('/direct');
  await expect(row).toBeVisible({ timeout: COLD_BOOT_TIMEOUT });
  const floating = page.locator('.zobel-section-switcher.floating');
  await expect(floating).toHaveText(/Direct messages/);
  await expect(page.locator('.room-nav-header .zobel-section-switcher')).toHaveCount(0);
  const box = await floating.boundingBox();
  expect(box && box.y > 800 / 2).toBe(true);
  // Message search moves from the list into the floating bar.
  await expect(
    page.locator('.room-nav-actions').getByRole('link', { name: 'Message search' })
  ).toBeHidden();
  const search = page.locator('.zobel-floating-bar').getByRole('link', { name: 'Message search' });
  await expect(search).toBeVisible();
  await shot(page, 'messenger-phone-floating');
  await floating.click();
  await expect(page.getByRole('menuitemradio', { name: /Rooms outside spaces/ })).toBeVisible();
  await shot(page, 'messenger-phone-floating-menu');
  await page.keyboard.press('Escape');
  await search.click();
  await expect(page).toHaveURL(/\/search/);
});

test("Sable's look keeps the bar of spaces", async ({ page, app, homeserver, freshLogin }) => {
  const me = await freshLogin();
  const roomId = await directChat(homeserver.baseUrl, me, 'Pierre');
  await chooseLook(page, 'Sable');

  await page.goto(`/direct/${encodeURIComponent(roomId)}`);
  await expect(page.getByText('Bin an der Treppe')).toBeVisible({ timeout: COLD_BOOT_TIMEOUT });
  await expect(app.primaryNavigation.locator('.rail')).toBeVisible();
  await quietFor(page, NEGATIVE_SETTLE_MS);
  await expect(page.locator('.zobel-row-time')).toHaveCount(0);
  await expect(page.locator('.zobel-section-switcher')).toHaveCount(0);
  await shot(page, 'sable-chat');
});
