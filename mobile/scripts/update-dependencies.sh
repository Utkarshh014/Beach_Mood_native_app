#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

npx expo install --check
npx expo install --fix
npx expo-doctor
npm audit --omit=dev
