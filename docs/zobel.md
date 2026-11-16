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

## Files Zobel owns

The sync script keeps Zobel's version of these and drops Sable's changes to them:

- `README.md` and `CONTRIBUTING.md`
- `.github/ISSUE_TEMPLATE`, `.github/PULL_REQUEST_TEMPLATE.md` and `.github/SECURITY.md`
- `.github/workflows`. Sable's GitHub workflows build and publish Sable's releases, so Zobel
  removed them.

Everything under a `zobel` directory (`src/lib/zobel`, `scripts/zobel`) and this page exist
only in Zobel, so they never conflict.

## Edits to Sable's files

These are the places where Zobel changes a file that Sable also maintains. Each is a few
lines, and a conflict there is resolved by keeping Zobel's line.

| File                                             | Change                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| `src/lib/deployment/default-app-name.ts`         | The app is called Zobel                                            |
| `src/lib/deployment/links.ts`                    | Source link and update feed point to Zobel; no community rooms     |
| `src/lib/features/bug-report/forge.ts`           | Bug reports go to Zobel's GitHub issues                            |
| `src/lib/features/settings/AboutSettings.svelte` | "Powered by Sable." is always shown                                |
| `src/lib/i18n.ts`                                | Passes each language through `src/lib/zobel/app-name-in-locale.ts` |
| `src/app.html`, `static/manifest.webmanifest`    | Name of the installed web app                                      |
| Tests next to these files                        | Expect "Zobel" where they expected "Sable"                         |

## Interface text

Sable writes most interface text with `{{appName}}`, which becomes "Zobel" automatically. A
few strings spell "Sable" out. Zobel does not edit the files in `src/locales`, because Sable
updates them constantly. Instead `src/lib/zobel/app-name-in-locale.ts` holds two lists:

- `APP_NAME_KEYS`: strings that mean the app you are running. "Sable" is replaced by the app
  name when a language loads.
- `UPSTREAM_NAME_KEYS`: strings about the Sable project, its services, its donors or its
  themes. These keep saying Sable, because that is still true.

## What is still Sable

- **Services.** `static/config.json` is unchanged: push notifications, link previews, the
  GIF proxy, the theme catalogue and supporter badges are Sable's.
- **Desktop and mobile apps.** Their names, app identifiers, URL schemes, update feeds and
  packaging are untouched, so a native build made from this repository is still "Sable".
- **Internal names.** Crates (`sable-*`), the package name, CSS and storage keys keep their
  names. Renaming them would conflict with nearly every Sable update.
