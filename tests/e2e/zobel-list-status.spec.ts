import type { Page } from '@playwright/test';

import { registerUser } from './fixtures/continuwuity';
import { LOGIN_PASSWORD } from './fixtures/loginAccount';
import { MatrixAdmin } from './fixtures/matrix';
import { expect, test, SIGNED_OUT } from './fixtures/test';
import { COLD_BOOT_TIMEOUT } from './pages/AppShell';

/**
 * Zobel's "Show whether your last message was sent": in the chat list, a clock in front of your
 * last message while it is being sent, a tick once it has been, nothing in front of others'. With `ZOBEL_SHOTS=<directory>`
 * it also saves screenshots.
 */
test.use({ storageState: SIGNED_OUT, hasTouch: true, viewport: { width: 390, height: 844 } });
test.setTimeout(240_000);

const SHOTS = process.env.ZOBEL_SHOTS;

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function turnOn(page: Page): Promise<void> {
  await page.goto('/settings/appearance');
  const messenger = page
    .getByRole('radiogroup', { name: 'Look' })
    .getByRole('radio', { name: 'Messenger' });
  await messenger.click({ timeout: COLD_BOOT_TIMEOUT });
  await expect(messenger).toBeChecked();
  await page.goto('/settings/sidebar');
  const status = page.getByRole('switch', { name: 'Show whether your last message was sent' });
  await status.click({ timeout: COLD_BOOT_TIMEOUT });
  await expect(status).toBeChecked();
}

async function chatWith(
  homeserverUrl: string,
  me: MatrixAdmin,
  name: string
): Promise<{ roomId: string; userId: string }> {
  const account = await registerUser(
    homeserverUrl,
    `${name.toLowerCase()}-${String(Date.now())}`,
    LOGIN_PASSWORD
  );
  const other = new MatrixAdmin(homeserverUrl, account.accessToken, account.userId);
  await other.setDisplayName(name);
  const roomId = await other.createRoom({ preset: 'trusted_private_chat', invite: [me.userId] });
  await me.join(roomId);
  await other.sendMessage(roomId, 'Kommst du heute noch vorbei?');
  return { roomId, userId: other.userId };
}

test('your last message shows a tick once sent', async ({ page, homeserver, freshLogin }) => {
  const me = await freshLogin();
  const mara = await chatWith(homeserver.baseUrl, me, 'Mara');
  await me.sendMessage(mara.roomId, 'Ja, gegen acht');
  const jonas = await chatWith(homeserver.baseUrl, me, 'Jonas');
  await me.request('PUT', `client/v3/user/${encodeURIComponent(me.userId)}/account_data/m.direct`, {
    [mara.userId]: [mara.roomId],
    [jonas.userId]: [jonas.roomId],
  });
  await turnOn(page);

  await page.goto('/direct');
  const row = (roomName: string) => page.locator('.room-row', { hasText: roomName });
  await expect(row('Mara').getByRole('img', { name: 'Sent' })).toBeVisible({
    timeout: COLD_BOOT_TIMEOUT,
  });
  await expect(row('Jonas').getByRole('img', { name: /^(Sent|Sending)$/ })).toHaveCount(0);
  await shot(page, 'list-sent');
});

/**
 * The clock needs a message that stays on its way, and the core's requests get past Playwright's
 * routing and offline mode. Locally, with `ZOBEL_E2E_HOMESERVER_PGID` set to the process group of
 * the running homeserver (`~/.local/state/zobel-homeserver.pid` for zobel-test-env), the test
 * pauses the homeserver instead.
 */
const HOMESERVER_PGID = Number(process.env.ZOBEL_E2E_HOMESERVER_PGID ?? 0);

test('a message still on its way shows a clock', async ({ page, homeserver, freshLogin }) => {
  test.skip(!HOMESERVER_PGID, 'needs ZOBEL_E2E_HOMESERVER_PGID');
  const me = await freshLogin();
  const jonas = await chatWith(homeserver.baseUrl, me, 'Jonas');
  await me.request('PUT', `client/v3/user/${encodeURIComponent(me.userId)}/account_data/m.direct`, {
    [jonas.userId]: [jonas.roomId],
  });
  await turnOn(page);
  await page.goto('/direct');
  const row = page.locator('.room-row', { hasText: 'Jonas' });
  await row.click({ timeout: COLD_BOOT_TIMEOUT });
  const composer = page.locator('[data-focus-region="composer"] [contenteditable="true"]');
  await composer.click({ timeout: COLD_BOOT_TIMEOUT });

  process.kill(-HOMESERVER_PGID, 'SIGSTOP');
  try {
    await page.keyboard.type('Bin unterwegs');
    await page.keyboard.press('Enter');
    await page.goBack();
    await expect(row.getByRole('img', { name: 'Sending' })).toBeVisible({ timeout: 20_000 });
    await shot(page, 'list-sending');
  } finally {
    process.kill(-HOMESERVER_PGID, 'SIGCONT');
  }
  await expect(row.getByRole('img', { name: 'Sent' })).toBeVisible({ timeout: COLD_BOOT_TIMEOUT });
});
