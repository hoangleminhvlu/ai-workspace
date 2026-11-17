#!/usr/bin/env bash
# Đóng gói bộ cài Windows (NSIS .exe) từ WSL bằng cargo-xwin.
set -euo pipefail
. "$(dirname "$0")/env.sh"
cd "$ROOT"
npx tauri build --runner cargo-xwin --target "$WIN_TARGET" "$@"
ls -la "src-tauri/target/$WIN_TARGET/release/bundle/nsis/"
