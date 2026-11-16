# Contributing to Zobel

Zobel is a fork of [Sable](https://git.sable.moe/SableClient/sable-next) that merges Sable's
changes every day. That shapes how changes are made here.

## Where a change belongs

- **A fix or feature that would help Sable too** is best made in Sable. Zobel receives it with
  the next merge.
- **Something that only makes sense for Zobel** belongs here.

Sable does not accept contributions that include AI-generated content
([its policy](https://git.sable.moe/SableClient/sable-next/src/branch/main/CONTRIBUTING.md#ai-generated-content)).
Parts of Zobel were written with AI assistance, so do not submit code from this repository to
Sable.

## Making a change

[`docs/zobel.md`](docs/zobel.md) explains how Zobel keeps its differences from Sable small.
In short: prefer new files under a `zobel` directory, keep edits to Sable's files to a few
lines, and do not reformat or move Sable's code.

Run the tests for the code you changed, and add tests for new behavior.
[`docs/TESTING.md`](docs/TESTING.md) describes the suites.

## License

Zobel is licensed under AGPL-3.0-or-later. By contributing you agree that your contribution
is licensed under the same terms.
