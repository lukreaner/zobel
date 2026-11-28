import { expect, test, SIGNED_OUT } from './fixtures/test';
import { COLD_BOOT_TIMEOUT } from './pages/AppShell';

/**
 * The page side of Zobel's keyboard images on Android (`ZobelKeyboardImages.kt`): a GIF that a
 * keyboard such as Gboard inserts arrives as the `zobel-keyboard-image` event and is attached
 * like a pasted image.
 */
test.use({ storageState: SIGNED_OUT, viewport: { width: 1280, height: 720 } });

// A 1×1 GIF, as a keyboard would insert it.
const GIF = Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');
type Messages = { chunk: { type: string; content: { msgtype?: string; url?: string } }[] };

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
