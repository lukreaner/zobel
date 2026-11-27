import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { test as setup } from '@playwright/test';
import { registerUser, seedTimelineRoom } from './fixtures/continuwuity';
import { LOGIN_PASSWORD, LOGIN_USERNAME } from './fixtures/loginAccount';
import { homeserverStatePath } from './fixtures/runtime';

/**
 * Stands in for `global.setup.ts` where there is no Docker: the homeserver is already
 * running (see `playwright.zobel-local.config.ts`), so this only creates what the
 * fixtures expect to find on it.
 */
const BASE_URL = process.env.ZOBEL_E2E_HOMESERVER ?? 'http://127.0.0.1:18008';

type State = { baseUrl: string; accessToken: string };

async function provisioned(): Promise<boolean> {
  try {
    const state = JSON.parse(await readFile(homeserverStatePath(), 'utf8')) as State;
    if (state.baseUrl !== BASE_URL) return false;
    const whoami = await fetch(`${BASE_URL}/_matrix/client/v3/account/whoami`, {
      headers: { authorization: `Bearer ${state.accessToken}` },
    });
    return whoami.ok;
  } catch {
    return false;
  }
}

setup('provision the running homeserver', async () => {
  // A server kept from the last run still has its accounts and the seeded room.
  if (await provisioned()) return;

  const session = await registerUser(BASE_URL, LOGIN_USERNAME, LOGIN_PASSWORD);
  const timeline = await seedTimelineRoom(BASE_URL, session.accessToken);
  const statePath = homeserverStatePath();
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(
    statePath,
    JSON.stringify({
      baseUrl: BASE_URL,
      containerId: '',
      timelineRoomId: timeline.roomId,
      timelineEventIds: timeline.eventIds,
      accessToken: session.accessToken,
    })
  );
});
