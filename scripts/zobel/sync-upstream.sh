#!/usr/bin/env bash
# Merges Sable's main branch into the branch that is checked out.
#
# Exit status: 0 when the branch is up to date or the merge was committed,
# 1 when the merge has conflicts (it is aborted, nothing changes), 2 on misuse.
set -euo pipefail

UPSTREAM_URL="${ZOBEL_UPSTREAM_URL:-https://github.com/SableClient/sable-next.git}"
UPSTREAM_BRANCH="${ZOBEL_UPSTREAM_BRANCH:-main}"

# Paths Zobel owns outright. Sable's changes to them are dropped: these files describe
# the project and its rules, and Sable's GitHub workflows publish Sable's releases.
OURS=(
  README.md
  CONTRIBUTING.md
  .github/ISSUE_TEMPLATE
  .github/PULL_REQUEST_TEMPLATE.md
  .github/SECURITY.md
  .github/workflows
)

cd "$(git rev-parse --show-toplevel)"

if [ -n "$(git status --porcelain)" ]; then
  echo "The working tree has uncommitted changes. Commit or stash them first." >&2
  exit 2
fi

git fetch --no-tags "$UPSTREAM_URL" "$UPSTREAM_BRANCH"
upstream="$(git rev-parse FETCH_HEAD)"

if git merge-base --is-ancestor "$upstream" HEAD; then
  echo "Already up to date with Sable ($(git rev-parse --short "$upstream"))."
  exit 0
fi

# From here on, any failure leaves the branch and the working tree as they were.
trap 'git merge --abort 2>/dev/null || true' ERR

git merge --no-ff --no-commit "$upstream" >/dev/null 2>&1 || true

# Put Zobel's own paths back the way they were, which also settles their conflicts:
# first in the index, then in the working tree, then drop the files Sable added there.
git reset --quiet HEAD -- "${OURS[@]}"
git ls-files -z -- "${OURS[@]}" | git checkout-index --force -z --stdin
git clean --quiet -fd -- "${OURS[@]}"

conflicts="$(git diff --name-only --diff-filter=U)"
if [ -n "$conflicts" ]; then
  echo "Sable $(git rev-parse --short "$upstream") does not merge cleanly. Conflicting files:"
  echo "$conflicts" | sed 's/^/  /'
  git merge --abort
  exit 1
fi

git commit --quiet --no-edit -m "Merge Sable's main branch ($(git rev-parse --short "$upstream"))"
echo "Merged Sable $(git rev-parse --short "$upstream")."
