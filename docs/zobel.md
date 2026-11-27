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

Everything under a `zobel` directory (`zobel`, `src/lib/zobel`, `scripts/zobel`), the
end-to-end tests named `tests/e2e/zobel-*` and this page exist only in Zobel, so they never
conflict.

## Keeping the README's list current

The README's section "How Zobel differs from Sable" lists every difference people would
notice. Whenever a change adds, removes or alters such a difference, update that list in the
same commit, along with the change file in `zobel/changes`.

## Edits to Sable's files

These are the places where Zobel changes a file that Sable also maintains. Each is a few
lines, and a conflict there is resolved by keeping Zobel's line.

| File                                                                                   | Change                                                                   |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/lib/deployment/default-app-name.ts`                                               | The app is called Zobel                                                  |
| `src/lib/deployment/links.ts`                                                          | Source link and update feed point to Zobel; no community rooms           |
| `src/lib/features/bug-report/forge.ts`                                                 | Bug reports go to Zobel's GitHub issues                                  |
| `src/lib/features/settings/AboutSettings.svelte`                                       | "Powered by Sable." is always shown                                      |
| `src/lib/i18n.ts`                                                                      | Passes each language through `src/lib/zobel/locale.ts`                   |
| `src/app.html`, `static/manifest.webmanifest`                                          | Name of the installed web app                                            |
| `src/lib/settings/definitions.ts`                                                      | Adds the setting `manualReadReceipts`                                    |
| `src/lib/settings/registry/privacy.ts`                                                 | Lists that setting under Privacy                                         |
| `src/lib/features/room/timeline/TimelineList.svelte`                                   | Hands read receipts to the "Seen" button when it is on                   |
| `src/lib/features/forum/ForumPage.svelte`                                              | The same for forum rooms                                                 |
| `src/lib/features/room/settings/RoomGeneralSettings.svelte`                            | Shows the per-chat choice for "Seen"                                     |
| `src/routes/(app)/+layout.svelte`                                                      | Syncs the per-chat choices                                               |
| `src/lib/ui/breakpoints.ts`, `src/lib/ui/media.css`, `src/lib/ui/app-layout.svelte.ts` | Touch screens from 37rem wide get the split view (foldables in portrait) |
| `src/lib/ui/breakpoints.test.ts`                                                       | Expects that breakpoint in the CSS                                       |
| `docs/settings.md`, `static/*.schema.json`                                             | Generated: they list the setting `manualReadReceipts`                    |
| `src/lib/config/config-reference.test.ts`                                              | Reads the names of Zobel's settings for those generated files            |
| Tests next to these files                                                              | Expect "Zobel" where they expected "Sable"                               |

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

## Releases

Zobel has its own version numbers (`0.1.0`, `0.2.0`, …), independent of Sable's, and tags
them `zobel-v<version>`. Sable's own tags (`v26.11.2` …) come along with the merges and mean
nothing for Zobel.

### Writing down a change

Every change people will notice gets a change file in `zobel/changes`, committed with the
change itself. The format is that of Sable's change sets:

```md
---
default: minor
---

Chats can be marked as read by hand with a "Seen" button.
```

`default` is `major` (breaking), `minor` (feature), `patch` (fix), `security`, `docs` or
`note`. Write for people who use the app, not for developers. Sable's changes need nothing
from Zobel: the release takes them from Sable's `CHANGELOG.md` and `.changeset`.

### Making a release

In GitHub, open **Actions → Release → Run workflow** on `main`. With **bump** at `auto` the
version follows the change files: a `major` file makes the next major version, a `minor` file
the next minor version, anything else a patch. **version** sets it exactly instead. With
**dry run** ticked the workflow only builds the APK and shows the notes in the run's summary.

The workflow ([`zobel-release.yml`](../.github/workflows/zobel-release.yml)):

1. works out the version and the notes with
   [`scripts/zobel/release.mjs`](../scripts/zobel/release.mjs). The notes list Zobel's change
   files, the Sable releases merged since the last Zobel release, and Sable's change sets that
   are merged but not yet in a Sable release;
2. builds the Android app for 64-bit ARM, signs it, and checks it is called Zobel and has
   Zobel's application ID;
3. moves the change files into [`zobel/CHANGELOG.md`](../zobel/CHANGELOG.md), commits that
   onto the built commit, tags it and merges it into `main`;
4. publishes the GitHub release with the notes, the APK and `latest.json`. The app's update
   check in Settings → About reads that file from the latest release;
5. uploads the APK to Firebase App Distribution with the notes as plain text.

If the Firebase upload fails, the GitHub release is already out: fix the cause and use
**Re-run failed jobs**, which only repeats the upload.

To try the notes locally: `node scripts/zobel/release.mjs prepare --out /tmp/release`.
Its tests run with `node --test scripts/zobel/*.test.mjs`.

### The Android app as Zobel

Sable's Android project is built unchanged, except that
[`scripts/zobel/android/zobel.init.gradle`](../scripts/zobel/android/zobel.init.gradle) sets
the application ID `io.github.lukreaner.zobel` and the name "Zobel" while Gradle runs.
[`scripts/zobel/android-build.sh`](../scripts/zobel/android-build.sh) installs that script
for one build and otherwise runs `pnpm android:build` with the same arguments. Kotlin
package, JNI names and Tauri's identifier stay `moe.sable.client`: Android installs by the
application ID alone, and renaming the rest would touch files Sable edits constantly.

It is Sable's FOSS build: no Firebase Cloud Messaging inside the app, push through
UnifiedPush as in Sable's FOSS APK. Firebase is only used to hand the APK to testers.

Still Sable's: the icon, and the link schemes `moe.sable.next`, `sable` and `matrix`. With
both apps installed, Android asks which one opens such a link.

### What the workflow needs

Set these under **Settings → Secrets and variables → Actions** in the GitHub repository.

| Name                       | Kind     | What                                                                       |
| -------------------------- | -------- | -------------------------------------------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`  | secret   | The signing keystore, base64-encoded                                       |
| `ANDROID_KEY_ALIAS`        | secret   | The key's alias in it                                                      |
| `ANDROID_KEY_PASSWORD`     | secret   | Password of keystore and key (the same)                                    |
| `FIREBASE_SERVICE_ACCOUNT` | secret   | JSON key of a Google service account allowed to upload to App Distribution |
| `FIREBASE_ANDROID_APP_ID`  | variable | The Firebase app ID, `1:<number>:android:<hex>`                            |
| `FIREBASE_TESTER_GROUPS`   | variable | Optional: aliases of tester groups that get each release, comma-separated  |

**Signing key.** Android only installs an update signed with the same key as the installed
app. Losing the keystore or its password means everyone has to uninstall Zobel (and lose its
local data) to get the next version, so keep a copy outside GitHub. To make one:

```sh
keytool -genkeypair -v -keystore zobel-release.jks -alias zobel -keyalg RSA -keysize 4096 \
  -validity 36500 -dname "CN=Zobel"
base64 -w0 zobel-release.jks | gh secret set ANDROID_KEYSTORE_BASE64
gh secret set ANDROID_KEY_ALIAS --body zobel
gh secret set ANDROID_KEY_PASSWORD   # asks for the password given to keytool
```

**Firebase.**

1. In the [Firebase console](https://console.firebase.google.com), create a project (or use
   one) and add an Android app with the package name `io.github.lukreaner.zobel`. Skip the
   download of `google-services.json`: Zobel does not use it.
2. Under **Release & Monitor → App Distribution**, click **Get started**. Under
   **Testers & Groups**, add a group (e.g. `testers`) with the testers' email addresses.
3. Under **Project settings → General**, copy the app's **App ID** into the variable
   `FIREBASE_ANDROID_APP_ID`, and the group's alias into `FIREBASE_TESTER_GROUPS`.
4. In the [Google Cloud console](https://console.cloud.google.com/iam-admin/serviceaccounts)
   for the same project, create a service account with the role **Firebase App Distribution
   Admin**, create a JSON key for it and paste the whole file into the secret
   `FIREBASE_SERVICE_ACCOUNT`.

Testers get an email for each release and install it through the App Tester app or the link
in the email.

## What is still Sable

- **Services.** `static/config.json` is unchanged: push notifications, link previews, the
  GIF proxy, the theme catalogue and supporter badges are Sable's.
- **Desktop and iOS apps.** Their names, app identifiers, URL schemes, update feeds and
  packaging are untouched, so a native build made from this repository is still "Sable". The
  Android app is built as Zobel only through `scripts/zobel/android-build.sh` (see
  [Releases](#the-android-app-as-zobel)); `pnpm android:build` alone still builds Sable.
- **Internal names.** Crates (`sable-*`), the package name, CSS and storage keys keep their
  names. Renaming them would conflict with nearly every Sable update.
