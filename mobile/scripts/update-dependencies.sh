#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# --check exits non-zero on mismatches and would prevent --fix under set -e.
# --fix performs the compatibility check and applies the required updates.
npx expo install --fix
npx expo-doctor
npm audit --omit=dev
