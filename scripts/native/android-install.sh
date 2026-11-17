#!/usr/bin/env bash
# Cài APK debug lên trình giả lập (npm run android:emulator) hoặc điện thoại qua Gỡ lỗi không dây:
#   lần đầu ghép đôi: adb pair <IP>:<cổng ghép đôi>   rồi: adb connect <IP>:<cổng>
# Có nhiều thiết bị: ANDROID_SERIAL=<mã thiết bị> npm run android:install
set -euo pipefail
. "$(dirname "$0")/env.sh"
APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
[ -f "$APK" ] || "$(dirname "$0")/android-build.sh"
adb devices
adb install -r "$APK"
adb shell monkey -p vn.aitech.aiworkspace -c android.intent.category.LAUNCHER 1 >/dev/null
