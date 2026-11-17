#!/usr/bin/env bash
# Build web + đồng bộ Capacitor + đóng gói APK Android. Tham số: debug (mặc định) | release
set -euo pipefail
. "$(dirname "$0")/env.sh"
VARIANT="${1:-debug}"
cd "$ROOT"
npm run build
npx cap sync android
cd android
if [ "$VARIANT" = release ]; then ./gradlew --console=plain assembleRelease bundleRelease; else ./gradlew --console=plain assembleDebug; fi
find app/build/outputs \( -name '*.apk' -o -name '*.aab' \) -newer "$ROOT/dist/index.html" -exec ls -la {} \;
