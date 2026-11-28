import type { Page } from '@playwright/test';

import { NEGATIVE_SETTLE_MS, quietFor } from './fixtures/settle';
import { expect, test, SIGNED_OUT } from './fixtures/test';
import { COLD_BOOT_TIMEOUT } from './pages/AppShell';

/**
 * Zobel: on a phone, tapping message search in the chat list puts the cursor into the search
 * field, so the keyboard comes up and typing can start right away.
 */
test.use({ storageState: SIGNED_OUT, hasTouch: true, viewport: { width: 390, height: 844 } });

function searchFieldFocused(page: Page): Promise<boolean> {
  return page.evaluate(() => document.activeElement?.id === 'message-search-field');
}

test('tapping search in the chat list focuses the search field', async ({ page, freshLogin }) => {
  await freshLogin();
  await page.goto('/rooms');
  const search = page.getByRole('link', { name: 'Message search' }).first();
  await expect(search).toBeVisible({ timeout: COLD_BOOT_TIMEOUT });
  await search.tap();

  const field = page.getByRole('combobox', { name: 'Search messages' });
  await expect(field).toBeVisible({ timeout: COLD_BOOT_TIMEOUT });
  await expect(field).toBeFocused();
  await page.keyboard.type('hello');
  await expect(field).toHaveValue('hello');
});

test('coming back to search does not focus the field', async ({ page, freshLogin }) => {
  await freshLogin();
  await page.goto('/rooms');
  const search = page.getByRole('link', { name: 'Message search' }).first();
  await expect(search).toBeVisible({ timeout: COLD_BOOT_TIMEOUT });
  await search.tap();
  const field = page.getByRole('combobox', { name: 'Search messages' });
  await expect(field).toBeFocused({ timeout: COLD_BOOT_TIMEOUT });

  await field.blur();
  await page.goto('/settings');
  await page.goBack();
  await expect(field).toBeVisible({ timeout: COLD_BOOT_TIMEOUT });
  await quietFor(page, NEGATIVE_SETTLE_MS);
  expect(await searchFieldFocused(page)).toBe(false);
});

test('opening the search address directly leaves the field alone, as in Sable', async ({
  page,
  freshLogin,
}) => {
  await freshLogin();
  await page.goto('/search');
  await expect(page.getByRole('combobox', { name: 'Search messages' })).toBeVisible({
    timeout: COLD_BOOT_TIMEOUT,
  });
  await quietFor(page, NEGATIVE_SETTLE_MS);
  expect(await searchFieldFocused(page)).toBe(false);
});
