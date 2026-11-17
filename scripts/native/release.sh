#!/usr/bin/env bash
# Đóng gói bộ phát hành dùng thử: bộ cài Windows (NSIS) + APK Android đã ký + hướng dẫn + SHA256SUMS + .zip
#   release/<phiên bản>/  và  release/iThunder-AI-Workspace-<phiên bản>.zip
# Tham số: --copy-windows  chép thêm bộ phát hành vào thư mục Downloads của người dùng Windows
set -euo pipefail
. "$(dirname "$0")/env.sh"
cd "$ROOT"

VERSION=$(node -p "require('./package.json').version")
NAME="iThunder-AI-Workspace-$VERSION"
OUT="$ROOT/release/$VERSION"
WIN_FILE="$NAME-Windows-x64-setup.exe"
APK_FILE="$NAME-Android.apk"
SIGNING="${ITHUNDER_ANDROID_SIGNING:-$HOME/.config/ithunder-signing/android-release.properties}"
BUILD_TOOLS="$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)"

[ -f "$SIGNING" ] || { echo "Thiếu tệp khóa ký Android: $SIGNING"; exit 1; }
grep -q "\"version\": \"../package.json\"" src-tauri/tauri.conf.json || echo "Cảnh báo: tauri.conf.json không lấy phiên bản từ package.json"
grep -q "versionName \"$VERSION\"" android/app/build.gradle || { echo "android/app/build.gradle: versionName khác $VERSION"; exit 1; }

echo "== Windows"
npx tauri build --runner cargo-xwin --target "$WIN_TARGET"
WIN_SRC="$(ls -t src-tauri/target/$WIN_TARGET/release/bundle/nsis/*_"$VERSION"_x64-setup.exe | head -1)"

echo "== Android"
npx cap sync android
(cd android && ./gradlew --console=plain clean assembleRelease)
APK_SRC=android/app/build/outputs/apk/release/app-release.apk
"$BUILD_TOOLS/apksigner" verify "$APK_SRC"
APK_CERT=$("$BUILD_TOOLS/apksigner" verify --print-certs "$APK_SRC" | sed -n 's/.*certificate SHA-256 digest: //p' | head -1)
"$BUILD_TOOLS/apksigner" verify --print-certs "$APK_SRC" | grep -q "CN=Android Debug" && { echo "APK đang ký bằng khóa debug"; exit 1; }
# Bản phát hành không được mở cổng gỡ lỗi WebView (chrome://inspect đọc được phiên đăng nhập qua USB)
unzip -p "$APK_SRC" assets/capacitor.config.json | grep -q '"webContentsDebuggingEnabled": false' \
  || { echo "APK chưa tắt webContentsDebuggingEnabled (capacitor.config.json)"; exit 1; }

echo "== Gói phát hành $OUT"
rm -rf "${OUT:?}"
mkdir -p "$OUT"
cp "$WIN_SRC" "$OUT/$WIN_FILE"
cp "$APK_SRC" "$OUT/$APK_FILE"
sed -e "s|{{VERSION}}|$VERSION|g" -e "s|{{DATE}}|$(date +%d/%m/%Y)|g" -e "s|{{WIN_FILE}}|$WIN_FILE|g" \
    -e "s|{{APK_FILE}}|$APK_FILE|g" -e "s|{{APK_CERT}}|$APK_CERT|g" \
    scripts/native/release/HUONG_DAN_CAI_DAT.txt | sed 's/$/\r/' > "$OUT/HUONG_DAN_CAI_DAT.txt"
(cd "$OUT" && sha256sum "$WIN_FILE" "$APK_FILE" | sed 's/$/\r/' > SHA256SUMS.txt)
rm -f "$ROOT/release/$NAME.zip"
(cd "$ROOT/release" && zip -q -r "$NAME.zip" "$VERSION")
ls -la "$OUT" "$ROOT/release/$NAME.zip"

if [ "${1:-}" = --copy-windows ]; then
  DL="$(wslpath "$(cmd.exe /c "echo %USERPROFILE%" 2>/dev/null | tr -d '\r')")/Downloads"
  mkdir -p "$DL/$NAME"
  cp "$OUT"/* "$DL/$NAME/"
  cp "$ROOT/release/$NAME.zip" "$DL/"
  echo "Đã chép vào $(wslpath -w "$DL/$NAME") và $(wslpath -w "$DL/$NAME.zip")"
fi
