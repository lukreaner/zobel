# Zobel's change files

Each Markdown file here becomes one line of the next release's changelog. The
[`Release`](../../.github/workflows/zobel-release.yml) workflow collects them, writes
[`zobel/CHANGELOG.md`](../CHANGELOG.md) and deletes them. They work like Sable's change sets
in `.changeset`:

```md
---
default: minor
---

What changed, in one or two sentences for people who use the app.
```

`default` is the kind of change: `major` (breaking), `minor` (feature), `patch` (fix),
`security`, `docs` or `note`. `docs/zobel.md` describes the whole release process.
