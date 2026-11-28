import { expect, test, SIGNED_OUT } from './fixtures/test';
import { COLD_BOOT_TIMEOUT } from './pages/AppShell';

/**
 * Zobel uploads GIFs picked from the GIF picker to your own homeserver by default
 * (`settingsDefaults.reuploadGifs` in `static/config.json`). Sable's default sends a link to
 * its GIF proxy instead, which homeservers and bridges that cannot reach it show as
 * "Media unavailable".
 */
test.use({ storageState: SIGNED_OUT, viewport: { width: 1280, height: 720 } });

// A 1×1 GIF, served as the GIF the picker found.
const GIF = Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');
const MEDIA_URL = 'https://media.tenor.com/zobelTestAAAAC/zobel-test.gif';

type Messages = { chunk: { type: string; content: { msgtype?: string; url?: string } }[] };

test('a GIF from the picker is uploaded to your homeserver', async ({ page, app, freshLogin }) => {
  const me = await freshLogin();
  const roomId = await me.createRoom({ name: `GIF ${String(Date.now())}` });
  await page.route('**/_soliditas/gifs/search**', (route) =>
    route.fulfill({
      json: {
        results: [
          {
            id: 'zobel-test',
            title: 'Zobel test',
            media_formats: {
              gif: { url: MEDIA_URL, dims: [1, 1], size: GIF.length },
              tinygif: { url: MEDIA_URL, dims: [1, 1], size: GIF.length },
            },
          },
        ],
      },
    })
  );
  await page.route('**/_soliditas/gifs/media**', (route) =>
    route.fulfill({ body: GIF, contentType: 'image/gif' })
  );
  await page.route(/tenor\.com/, (route) => route.fulfill({ body: GIF, contentType: 'image/gif' }));

  await app.openRoom(roomId);
  await page.getByRole('button', { name: 'Open the GIF picker', exact: true }).click({
    timeout: COLD_BOOT_TIMEOUT,
  });
  await page.locator('.composer-board').getByRole('searchbox').fill('zobel');
  await page.getByRole('button', { name: 'Zobel test' }).first().click();

  await expect
    .poll(
      async () => {
        const messages = await me.request<Messages>(
          'GET',
          `client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=10`
        );
        return messages.chunk.find((event) => event.type === 'm.room.message')?.content.url ?? null;
      },
      { timeout: 30_000 }
    )
    .toMatch(/^mxc:\/\/test\.local\//);
});

test('a GIF inserted from the keyboard is sent as an image', async ({ page, app, freshLogin }) => {
  const me = await freshLogin();
  const roomId = await me.createRoom({ name: `Keyboard GIF ${String(Date.now())}` });
  await app.openRoom(roomId);
  await app.composer.click({ timeout: COLD_BOOT_TIMEOUT });

  // What ZobelKeyboardImages.kt hands to the page when Gboard inserts a GIF.
  await page.evaluate((data) => {
    window.dispatchEvent(
      new CustomEvent('zobel-keyboard-image', {
        detail: { mime: 'image/gif', name: 'gboard.gif', data },
      })
    );
  }, GIF.toString('base64'));
  await expect(page.getByRole('button', { name: 'Remove gboard.gif' })).toBeVisible();
  await app.composer.press('Enter');

  await expect
    .poll(
      async () => {
        const messages = await me.request<Messages>(
          'GET',
          `client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=10`
        );
        const sent = messages.chunk.find((event) => event.type === 'm.room.message');
        return sent ? `${sent.content.msgtype ?? ''} ${sent.content.url ?? ''}` : null;
      },
      { timeout: 30_000 }
    )
    .toMatch(/^m\.image mxc:\/\/test\.local\//);
});
