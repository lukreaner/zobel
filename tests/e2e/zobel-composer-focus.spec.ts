import type { Page } from '@playwright/test';

import { registerUser } from './fixtures/continuwuity';
import { LOGIN_PASSWORD } from './fixtures/loginAccount';
import { MatrixAdmin } from './fixtures/matrix';
import { NEGATIVE_SETTLE_MS, quietFor } from './fixtures/settle';
import { expect, test, SIGNED_OUT } from './fixtures/test';
import { COLD_BOOT_TIMEOUT } from './pages/AppShell';

/**
 * Zobel's "Jump to the message field when opening a chat": on a touch screen in the split view,
 * such as an unfolded foldable, opening a chat from the list must not open the keyboard unless
 * asked to.
 */
test.use({ storageState: SIGNED_OUT });

/** Whether focus sits in the message field, which on a phone opens the keyboard. */
function composerFocused(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.activeElement?.closest('[data-focus-region="composer"]') !== null
  );
}

async function chatInList(
  page: Page,
  homeserverUrl: string,
  reader: MatrixAdmin,
  label: string
): Promise<string> {
  const account = await registerUser(homeserverUrl, `focus-${label}`, LOGIN_PASSWORD);
  const writer = new MatrixAdmin(homeserverUrl, account.accessToken, account.userId);
  const roomId = await reader.createRoom({ name: `Focus ${label}`, invite: [writer.userId] });
  await writer.join(roomId);
  await writer.sendMessage(roomId, 'Hello');
  return roomId;
}

async function chooseFocus(page: Page, choice: string): Promise<void> {
  await page.goto('/settings/composer');
  const option = page
    .getByRole('radiogroup', { name: 'Jump to the message field when opening a chat' })
    .getByRole('radio', { name: choice, exact: true });
  await option.click({ timeout: COLD_BOOT_TIMEOUT });
  await expect(option).toBeChecked();
}

async function openFromList(page: Page, roomId: string, tap: boolean): Promise<void> {
  await page.goto('/rooms');
  const row = page.locator(`.room-row-wrap a[href="/rooms/${encodeURIComponent(roomId)}"]`);
  await expect(row).toBeVisible({ timeout: COLD_BOOT_TIMEOUT });
  if (tap) await row.tap();
  else await row.click();
  await expect(page.getByText('Hello', { exact: true })).toBeVisible({ timeout: COLD_BOOT_TIMEOUT });
  await expect(page.locator('[data-focus-region="composer"]')).toBeVisible();
}

test.describe('on a touch screen in the split view', () => {
  test.use({ hasTouch: true, viewport: { width: 700, height: 800 } });

  test('opening a chat leaves the keyboard closed', async ({ page, homeserver, freshLogin }) => {
    const reader = await freshLogin();
    const roomId = await chatInList(
      page,
      homeserver.baseUrl,
      reader,
      `touch-${String(Date.now())}`
    );

    await openFromList(page, roomId, true);

    await quietFor(page, NEGATIVE_SETTLE_MS);
    expect(await composerFocused(page)).toBe(false);
  });

  test('"Always" jumps into the message field', async ({ page, homeserver, freshLogin }) => {
    const reader = await freshLogin();
    const roomId = await chatInList(
      page,
      homeserver.baseUrl,
      reader,
      `always-${String(Date.now())}`
    );
    await chooseFocus(page, 'Always');

    await openFromList(page, roomId, true);

    await expect.poll(() => composerFocused(page)).toBe(true);
  });
});

test.describe('with a mouse', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('opening a chat jumps into the message field', async ({ page, homeserver, freshLogin }) => {
    const reader = await freshLogin();
    const roomId = await chatInList(
      page,
      homeserver.baseUrl,
      reader,
      `mouse-${String(Date.now())}`
    );

    await openFromList(page, roomId, false);

    await expect.poll(() => composerFocused(page)).toBe(true);
  });

  test('"Never" stays in the list', async ({ page, homeserver, freshLogin }) => {
    const reader = await freshLogin();
    const roomId = await chatInList(
      page,
      homeserver.baseUrl,
      reader,
      `never-${String(Date.now())}`
    );
    await chooseFocus(page, 'Never');

    await openFromList(page, roomId, false);

    await quietFor(page, NEGATIVE_SETTLE_MS);
    expect(await composerFocused(page)).toBe(false);
  });
});
