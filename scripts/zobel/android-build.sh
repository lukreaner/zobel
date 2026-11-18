#!/usr/bin/env bash
# Builds the Android app as Zobel: `pnpm android:build` with Zobel's application ID and name.
# Takes the same arguments, e.g.:
#
#   scripts/zobel/android-build.sh --version 0.1.0 --target aarch64
#
# The APK lands in src-tauri/gen/android/app/build/outputs/apk/<abi>/release/. It is signed
# when src-tauri/gen/android/keystore.properties exists (see docs/zobel.md).
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

init_dir="${GRADLE_USER_HOME:-$HOME/.gradle}/init.d"
init_script="$init_dir/zobel-android.init.gradle"
mkdir -p "$init_dir"
cp scripts/zobel/android/zobel.init.gradle "$init_script"
trap 'rm -f "$init_script"' EXIT

ZOBEL_ANDROID=1 pnpm android:build "$@"
