#!/usr/bin/env bash
# Cài APK debug lên điện thoại Android qua Gỡ lỗi không dây (Wireless debugging).
# Lần đầu ghép đôi: adb pair <IP>:<cổng ghép đôi>   rồi: adb connect <IP>:<cổng>
set -euo pipefail
. "$(dirname "$0")/env.sh"
APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
adb devices
adb install -r "$APK"
adb shell monkey -p vn.aitech.aiworkspace.debug -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 \
  || adb shell monkey -p vn.aitech.aiworkspace -c android.intent.category.LAUNCHER 1 >/dev/null
