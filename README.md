# Zobel

Zobel is a [Matrix](https://matrix.org) client for the web, desktop and mobile, written in Rust and Svelte.

It is a fork of [Sable](https://git.sable.moe/SableClient/sable-next) and stays close to it: changes made in Sable are merged into Zobel every day. "Zobel" is the German word for sable.

## Status

Zobel is at an early stage.

- **Web app:** carries the Zobel name and builds from this repository. There is no hosted instance yet, so you build and serve it yourself.
- **Android app:** builds as Zobel, with its own app identifier, so it installs next to Sable. Each [release](https://github.com/lukreaner/zobel/releases) carries the APK, and testers get it through Firebase App Distribution.
- **Desktop and iOS apps:** still build under Sable's name and app identifiers. Zobel does not publish them.
- **Services:** push notifications, link previews, the GIF proxy, the theme catalogue and supporter badges are still Sable's, as configured in [`static/config.json`](static/config.json). Sable's [privacy policy](https://sable.moe/privacy) describes them.

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
