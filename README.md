# Zobel

Zobel is a [Matrix](https://matrix.org) client for the web, desktop and mobile, written in Rust and Svelte.

It is a fork of [Sable](https://git.sable.moe/SableClient/sable-next) and stays close to it: changes made in Sable are merged into Zobel every day. "Zobel" is the German word for sable.

## How Zobel differs from Sable

Zobel is at an early stage. This list is kept up to date with every change that makes Zobel differ from Sable.

**What Zobel does differently**

- **Marking chats as read by hand.** With "Mark chats as read by hand" on (Settings → Privacy), opening a chat no longer sends a read receipt. A "Seen" button below the messages sends it when you choose. Each chat can differ from the setting in its own settings, and these choices sync between your devices when settings sync is on.
- **Messenger look.** Settings → Appearance → Look → "Messenger" arranges Zobel like Signal or Beeper: a menu of lists (home, rooms, direct messages, each space) above the chats in place of Sable's bar of spaces, larger chat rows with round pictures, the last message and its time, and messages in bubbles with your own on the right in the accent colour. In a chat with one other person, their name and picture above each message are left out. The menu of lists can also float at the bottom of the screen together with message search, as in Beeper (Settings → Appearance → List menu). Choosing it also switches Sable's own settings to bubbles and message previews. Sable's look stays the default.
- **No keyboard when opening a chat on a touch screen.** In the split view Sable moves focus into the message field whenever a chat is opened from the list, which on an unfolded foldable opens the keyboard every time. Zobel only does that where the main pointer is a mouse or touchpad; "Jump to the message field when opening a chat" (Settings → Composer) can set it to always or never.
- **Search opens with the keyboard.** On a phone, tapping message search in the chat list puts the cursor straight into the search field, so you can type right away. In Sable you have to tap the field first. Coming back to search, for example from a result, leaves the keyboard closed.
- **GIFs and images from the keyboard (Android).** Keyboards such as Gboard can insert their GIFs, stickers and images into the message field, where they are attached like a pasted image. In Sable the keyboard greys them out ("This app doesn't support images here").
- **App icon (Android).** Zobel has its own icon: a sable drawn for Zobel, as a sticker. It is also on the splash screen and has a one-colour version for themed icons. Settings → Appearance → App icon offers the same sable in seven more styles (paper cut, linocut, watercolour, risograph, chalk, line art, pixel) and Sable's icon, listed before Sable's other icons.
- **Notifications for bridged chats (Android).** A chat named after the person who wrote, as bridges such as the WhatsApp bridge name theirs, is notified as a direct chat. Sable shows it as a group of that name, with the name and picture twice.
- **Split view on foldables.** On touch screens from about 600 pixels wide, such as an unfolded foldable in portrait or a small tablet, the chat opens next to the room list, and it stays there while the keyboard is open. Sable only does that from 768 pixels. Chats opened one after another from the list in that view take each other's place in the history, so after folding the phone shut the back gesture leads to the list of chats instead of through every chat seen before.
- **Name.** The app is called Zobel: in the window title, the installed web app, and the interface text that names the app. Text about the Sable project, its services, themes and supporters still says Sable.
- **Links.** The source code link, the update check and the bug report form lead to [this repository](https://github.com/lukreaner/zobel) and its [issue tracker](https://github.com/lukreaner/zobel/issues), not to Sable's.
- **No community rooms.** Sable's support and feature-request rooms are for Sable's own client, so Zobel does not link to them.
- **"Powered by Sable".** Settings → About always says that Zobel is based on Sable.
- **Android app.** Built as Zobel with its own app identifier (`io.github.lukreaner.zobel`), so it installs next to Sable instead of replacing it. Each [release](https://github.com/lukreaner/zobel/releases) carries the APK, and testers get it through Firebase App Distribution. Like Sable's FOSS build, it receives push notifications through UnifiedPush, not Firebase Cloud Messaging. The link schemes (`sable`, `matrix`, `moe.sable.next`) are still Sable's.
- **Versions and changelog.** Zobel has its own version numbers (`zobel-v0.1.0`, …) and [its own changelog](zobel/CHANGELOG.md), which also lists what came in from Sable.
- **GitHub workflows.** Sable's workflows, which build and publish Sable's releases, are removed. Zobel has two of its own: the daily merge of Sable's changes and the release.

**What is still Sable's**

- **Everything else in the app.** Features, design and fixes come from Sable unchanged and arrive in Zobel within a day.
- **Services.** Push notifications, link previews, the GIF proxy, the theme catalogue and supporter badges are Sable's, as configured in [`static/config.json`](static/config.json). Sable's [privacy policy](https://sable.moe/privacy) describes them.
- **Desktop and iOS apps.** They still build under Sable's name and app identifiers. Zobel does not publish them.
- **Web app hosting.** There is no hosted Zobel yet, so you build and serve the web app yourself.

## Running it

You need Node.js 24, [pnpm](https://pnpm.io), Rust with the `wasm32-unknown-unknown` target, `wasm-bindgen`, `wasm-opt` and `clang`. [mise](https://mise.jdx.dev) installs all of them except `clang`, in the versions this repository pins:

```sh
mise run setup   # tools and dependencies
pnpm dev         # builds the WebAssembly core, then serves the app on http://localhost:3000
```

To host the web app, run `pnpm build` and serve the `dist` directory. [`docs/web.md`](docs/web.md) covers configuration, containers and branding.

Run `pnpm test` for the unit tests. [`docs/TESTING.md`](docs/TESTING.md) describes the other suites.

## Staying in step with Sable

The [`Sync with Sable`](.github/workflows/zobel-sync-upstream.yml) workflow merges Sable's `main` branch into Zobel's once a day. When a merge needs a decision it stops and opens an issue instead.

To merge by hand, run [`scripts/zobel/sync-upstream.sh`](scripts/zobel/sync-upstream.sh). [`docs/zobel.md`](docs/zobel.md) explains how Zobel keeps its changes small so that these merges stay easy.

## Releases

Releases are made by hand with the [`Release`](.github/workflows/zobel-release.yml) workflow. It writes [Zobel's changelog](zobel/CHANGELOG.md) from the change files in [`zobel/changes`](zobel/changes), adds what came in from Sable, builds and signs the Android app, publishes a GitHub release and uploads the app to Firebase App Distribution. [`docs/zobel.md`](docs/zobel.md#releases) has the details.

## Reporting problems

Please use [Zobel's issue tracker](https://github.com/lukreaner/zobel/issues), not Sable's: Zobel is a modified client, and its bugs are not the Sable maintainers' to sort out.

## License and credits

Zobel is licensed under [AGPL-3.0-or-later](LICENSE), like Sable. The notification sounds have [their own license](LICENSE.sound).

Nearly all of the code is the work of the [Sable contributors](https://git.sable.moe/SableClient/sable-next). If you like Zobel, consider [supporting Sable](https://opencollective.com/sable).
