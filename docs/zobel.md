# How Zobel stays close to Sable

Zobel is a fork of [Sable](https://git.sable.moe/SableClient/sable-next). Sable changes many
times a day, and Zobel merges those changes daily. This only works while Zobel's own changes
are small and sit where Sable rarely edits. This page lists what Zobel changes and how to
keep it that way.

## Merging Sable's changes

[`scripts/zobel/sync-upstream.sh`](../scripts/zobel/sync-upstream.sh) fetches Sable's `main`
branch from its GitHub mirror and merges it into the branch you have checked out. The
[`Sync with Sable`](../.github/workflows/zobel-sync-upstream.yml) workflow runs it once a day
on `main` and pushes the result.

If the merge has conflicts, the script aborts it and lists the files. The workflow then opens
an issue titled "Sync with Sable needs attention". To finish the merge by hand:

```sh
git fetch https://github.com/SableClient/sable-next.git main
git merge FETCH_HEAD
# resolve the conflicts, keeping Zobel's change where the two disagree, then:
git commit
git push
```

Afterwards run `pnpm test src/lib/zobel`. It fails when Sable has added interface text that
says "Sable" and nobody has decided yet whether it names the app or the Sable project.

`docs/settings.md` and the two schemas in `static` are generated from the settings, Zobel's
included. If `src/lib/config/config-reference.test.ts` fails after a merge, write them again
with `pnpm exec vitest run -u src/lib/config/config-reference.test.ts`.

## Files Zobel owns

The sync script keeps Zobel's version of these and drops Sable's changes to them:

- `README.md` and `CONTRIBUTING.md`
- `.github/ISSUE_TEMPLATE`, `.github/PULL_REQUEST_TEMPLATE.md` and `.github/SECURITY.md`
- `.github/workflows`. Sable's GitHub workflows build and publish Sable's releases, so Zobel
  removed them.

Everything under a `zobel` directory (`src/lib/zobel`, `scripts/zobel`), the end-to-end
tests named `tests/e2e/zobel-*` and this page exist only in Zobel, so they never conflict.

## Edits to Sable's files

These are the places where Zobel changes a file that Sable also maintains. Each is a few
lines, and a conflict there is resolved by keeping Zobel's line.

| File                                                        | Change                                                         |
| ----------------------------------------------------------- | -------------------------------------------------------------- |
| `src/lib/deployment/default-app-name.ts`                    | The app is called Zobel                                        |
| `src/lib/deployment/links.ts`                               | Source link and update feed point to Zobel; no community rooms |
| `src/lib/features/bug-report/forge.ts`                      | Bug reports go to Zobel's GitHub issues                        |
| `src/lib/features/settings/AboutSettings.svelte`            | "Powered by Sable." is always shown                            |
| `src/lib/i18n.ts`                                           | Passes each language through `src/lib/zobel/locale.ts`         |
| `src/app.html`, `static/manifest.webmanifest`               | Name of the installed web app                                  |
| `src/lib/settings/definitions.ts`                           | Adds the setting `manualReadReceipts`                          |
| `src/lib/settings/registry/privacy.ts`                      | Lists that setting under Privacy                               |
| `src/lib/features/room/timeline/TimelineList.svelte`        | Hands read receipts to the "Seen" button when it is on         |
| `src/lib/features/forum/ForumPage.svelte`                   | The same for forum rooms                                       |
| `src/lib/features/room/settings/RoomGeneralSettings.svelte` | Shows the per-chat choice for "Seen"                           |
| `src/routes/(app)/+layout.svelte`                           | Syncs the per-chat choices                                     |
| `docs/settings.md`, `static/*.schema.json`                  | Generated: they list the setting `manualReadReceipts`          |
| `src/lib/config/config-reference.test.ts`                   | Reads the names of Zobel's settings for those generated files  |
| Tests next to these files                                   | Expect "Zobel" where they expected "Sable"                     |

## Interface text

Sable writes most interface text with `{{appName}}`, which becomes "Zobel" automatically. A
few strings spell "Sable" out. Zobel does not edit the files in `src/locales`, because Sable
updates them constantly. Instead `src/lib/zobel/app-name-in-locale.ts` holds two lists:

- `APP_NAME_KEYS`: strings that mean the app you are running. "Sable" is replaced by the app
  name when a language loads.
- `UPSTREAM_NAME_KEYS`: strings about the Sable project, its services, its donors or its
  themes. These keep saying Sable, because that is still true.

Text that only Zobel has is not added to `src/locales` either. It lives in
`src/lib/zobel/locales` (English and German; other languages fall back to English) under the
key `zobel`, and `src/lib/zobel/locale.ts` adds it when a language loads.

## Features only Zobel has

Their code lives in `src/lib/zobel`. Sable's files only get the few lines that call it, listed
in the table above.

- **Marking chats as read by hand.** With the setting "Mark chats as read by hand" (Privacy)
  on, opening a chat sends no read receipt. The timeline keeps the receipt it would have sent
  and shows a "Seen" button below the messages; tapping it sends that receipt. Each chat can be
  set apart from the setting under its own settings (General, Access). Those per-chat choices
  sync, while Sable's settings sync is on, as the account data
  `io.github.lukreaner.zobel.manual_read_receipts`. Marking a chat as
  read from a menu, a notification or with Escape still works as in Sable. The code is in
  `src/lib/zobel/manual-read-receipts.svelte.ts` and `src/lib/zobel/SeenBar.svelte`.

  Tests: `src/lib/zobel/*.test.ts`, and in the browser `tests/e2e/zobel-seen.spec.ts` (when the
  app asks for a receipt) and `tests/e2e/zobel-seen-homeserver.spec.ts` (what a real homeserver
  then tells the other member of the chat).

## End-to-end tests without Docker

Sable's end-to-end tests start their homeserver in a Docker container.
`tests/e2e/playwright.zobel-local.config.ts` runs them where there is no Docker, against a
homeserver that is already running:

```sh
pnpm wasm:dev   # once, and again after Sable's Rust code changed
pnpm exec playwright test -c tests/e2e/playwright.zobel-local.config.ts zobel-seen
```

The homeserver is a [Continuwuity](https://forgejo.ellis.link/continuwuation/continuwuity)
binary set up as `tests/e2e/fixtures/continuwuity.ts` sets up its container: server name
`test.local`, registration token `sable-e2e`, listening on http://127.0.0.1:18008 (or wherever
`ZOBEL_E2E_HOMESERVER` points). So far only the `zobel-seen` tests have
been run this way.

## What is still Sable

- **Services.** `static/config.json` is unchanged: push notifications, link previews, the
  GIF proxy, the theme catalogue and supporter badges are Sable's.
- **Desktop and mobile apps.** Their names, app identifiers, URL schemes, update feeds and
  packaging are untouched, so a native build made from this repository is still "Sable".
- **Internal names.** Crates (`sable-*`), the package name, CSS and storage keys keep their
  names. Renaming them would conflict with nearly every Sable update.
