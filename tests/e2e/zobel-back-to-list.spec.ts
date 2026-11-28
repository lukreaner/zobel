import type { Page } from '@playwright/test';

import type { MatrixAdmin } from './fixtures/matrix';
import { expect, test, SIGNED_OUT } from './fixtures/test';
import { COLD_BOOT_TIMEOUT } from './pages/AppShell';

/**
 * Going through several chats on an unfolded foldable, folding it shut and going back must
 * lead to the list of chats, not through the chats seen before.
 */
test.use({ storageState: SIGNED_OUT });

const UNFOLDED = { width: 700, height: 800 };
const FOLDED = { width: 390, height: 800 };

async function threeRooms(me: MatrixAdmin): Promise<string[]> {
  const stamp = String(Date.now());
  const rooms: string[] = [];
  for (const name of ['One', 'Two', 'Three']) {
    const roomId = await me.createRoom({ name: `${name} ${stamp}` });
    await me.sendMessage(roomId, `In ${name}`);
    rooms.push(roomId);
  }
  return rooms;
}

async function openEach(page: Page, rooms: string[], tap: boolean): Promise<void> {
  await page.goto('/rooms');
  for (const [index, roomId] of rooms.entries()) {
    const row = page.locator(`.room-row-wrap a[href="/rooms/${encodeURIComponent(roomId)}"]`);
    await expect(row).toBeVisible({ timeout: COLD_BOOT_TIMEOUT });
    if (tap) await row.tap();
    else await row.click();
    await expect(page).toHaveURL(new RegExp(`/rooms/${encodeURIComponent(roomId)}$`));
    await expect(
      page.getByText(`In ${['One', 'Two', 'Three'][index] ?? ''}`, { exact: true })
    ).toBeVisible({ timeout: COLD_BOOT_TIMEOUT });
  }
}

test.describe('on a foldable', () => {
  test.use({ hasTouch: true, viewport: UNFOLDED });

  test('back after folding shut leads to the list of chats', async ({ page, freshLogin }) => {
    const me = await freshLogin();
    const rooms = await threeRooms(me);
    await openEach(page, rooms, true);

    await page.setViewportSize(FOLDED);
    await page.goBack();

    await expect(page).toHaveURL(/\/rooms$/);
  });
});

test.describe('with a mouse', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('back still steps through the chats', async ({ page, freshLogin }) => {
    const me = await freshLogin();
    const rooms = await threeRooms(me);
    await openEach(page, rooms, false);

    await page.goBack();

    await expect(page).toHaveURL(new RegExp(`/rooms/${encodeURIComponent(rooms[1] ?? '')}$`));
  });
});
