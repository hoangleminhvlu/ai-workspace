#!/usr/bin/env bash
# Đóng gói bộ phát hành dùng thử: bộ cài Windows (NSIS) + APK Android đã ký + hướng dẫn + SHA256SUMS + .zip
#   release/<phiên bản>/  và  release/iThunder-AI-Workspace-<phiên bản>.zip
# Tham số:
#   --windows       chỉ bộ cài Windows, kèm tài liệu Hướng dẫn sử dụng AI Workspace (TL1, PDF):
#                   release/<phiên bản>-Windows/  và  release/iThunder-AI-Workspace-<phiên bản>-Windows.zip
#                   TL1 lấy từ TL1_PDF (mặc định ~/ai-reference/aios-docs/iThunder_AI_OS_TL1_...pdf)
#   --android       chỉ APK Android đã ký, kèm TL1 (PDF):
#                   release/<phiên bản>-Android/  và  release/iThunder-AI-Workspace-<phiên bản>-Android.zip
#   --copy-windows  chép thêm bộ phát hành vào thư mục Downloads của người dùng Windows
set -euo pipefail
. "$(dirname "$0")/env.sh"
cd "$ROOT"

WINDOWS_ONLY=0
ANDROID_ONLY=0
COPY_WINDOWS=0
for arg in "$@"; do
  case "$arg" in
    --windows) WINDOWS_ONLY=1 ;;
    --android) ANDROID_ONLY=1 ;;
    --copy-windows) COPY_WINDOWS=1 ;;
    *) echo "Tham số không hợp lệ: $arg"; exit 2 ;;
  esac
done
[ "$WINDOWS_ONLY$ANDROID_ONLY" = 11 ] && { echo "Chọn --windows hoặc --android, không cả hai"; exit 2; }

VERSION=$(node -p "require('./package.json').version")
NAME="iThunder-AI-Workspace-$VERSION"
OUT="$ROOT/release/$VERSION"
WIN_FILE="$NAME-Windows-x64-setup.exe"

if [ "$WINDOWS_ONLY$ANDROID_ONLY" != 00 ]; then
  TL1_PDF="${TL1_PDF:-$HOME/ai-reference/aios-docs/iThunder_AI_OS_TL1_Huong_dan_su_dung_AI_Workspace.pdf}"
  [ -f "$TL1_PDF" ] || { echo "Thiếu tài liệu TL1 (PDF): $TL1_PDF"; exit 1; }
  # Số phiên bản TL1 đọc từ trang bìa ("Phiên bản tài liệu 0.17, ...")
  TL1_VERSION=$(pdftotext -l 1 "$TL1_PDF" - 2>/dev/null | tr '\n' ' ' | grep -oP 'Phiên bản tài liệu\s+\K[0-9]+\.[0-9]+' | head -1)
  TL1_VERSION="${TL1_VERSION:-?}"
  TL1_FILE="iThunder_AI_OS_TL1_Huong_dan_su_dung_AI_Workspace_v$TL1_VERSION.pdf"
fi

if [ "$WINDOWS_ONLY" = 1 ]; then
  OUT="$ROOT/release/$VERSION-Windows"
  ZIP="$NAME-Windows.zip"
  echo "== Windows $VERSION + TL1 bản $TL1_VERSION"
  npx tauri build --runner cargo-xwin --target "$WIN_TARGET"
  WIN_SRC="$(ls -t src-tauri/target/$WIN_TARGET/release/bundle/nsis/*_"$VERSION"_x64-setup.exe | head -1)"
  rm -rf "${OUT:?}"
  mkdir -p "$OUT"
  cp "$WIN_SRC" "$OUT/$WIN_FILE"
  cp "$TL1_PDF" "$OUT/$TL1_FILE"
  sed -e "s|{{VERSION}}|$VERSION|g" -e "s|{{DATE}}|$(date +%d/%m/%Y)|g" -e "s|{{WIN_FILE}}|$WIN_FILE|g" \
      -e "s|{{TL1_FILE}}|$TL1_FILE|g" -e "s|{{TL1_VERSION}}|$TL1_VERSION|g" \
      scripts/native/release/HUONG_DAN_CAI_DAT_WINDOWS.txt | sed 's/$/\r/' > "$OUT/HUONG_DAN_CAI_DAT.txt"
  (cd "$OUT" && sha256sum "$WIN_FILE" "$TL1_FILE" | sed 's/$/\r/' > SHA256SUMS.txt)
  rm -f "$ROOT/release/$ZIP"
  (cd "$OUT" && zip -q -j "$ROOT/release/$ZIP" "$WIN_FILE" "$TL1_FILE" HUONG_DAN_CAI_DAT.txt SHA256SUMS.txt)
  ls -la "$OUT" "$ROOT/release/$ZIP"
  if [ "$COPY_WINDOWS" = 1 ]; then
    DL="$(wslpath "$(cmd.exe /c "echo %USERPROFILE%" 2>/dev/null | tr -d '\r')")/Downloads"
    cp "$ROOT/release/$ZIP" "$DL/"
    echo "Đã chép vào $(wslpath -w "$DL/$ZIP")"
  fi
  exit 0
fi
APK_FILE="$NAME-Android.apk"
SIGNING="${ITHUNDER_ANDROID_SIGNING:-$HOME/.config/ithunder-signing/android-release.properties}"
BUILD_TOOLS="$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)"

[ -f "$SIGNING" ] || { echo "Thiếu tệp khóa ký Android: $SIGNING"; exit 1; }
grep -q "\"version\": \"../package.json\"" src-tauri/tauri.conf.json || echo "Cảnh báo: tauri.conf.json không lấy phiên bản từ package.json"
grep -q "versionName \"$VERSION\"" android/app/build.gradle || { echo "android/app/build.gradle: versionName khác $VERSION"; exit 1; }

build_android() {
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
}

if [ "$ANDROID_ONLY" = 1 ]; then
  OUT="$ROOT/release/$VERSION-Android"
  ZIP="$NAME-Android.zip"
  echo "== Android $VERSION + TL1 bản $TL1_VERSION"
  npm run build
  build_android
  rm -rf "${OUT:?}"
  mkdir -p "$OUT"
  cp "$APK_SRC" "$OUT/$APK_FILE"
  cp "$TL1_PDF" "$OUT/$TL1_FILE"
  sed -e "s|{{VERSION}}|$VERSION|g" -e "s|{{DATE}}|$(date +%d/%m/%Y)|g" -e "s|{{APK_FILE}}|$APK_FILE|g" \
      -e "s|{{APK_CERT}}|$APK_CERT|g" -e "s|{{TL1_FILE}}|$TL1_FILE|g" -e "s|{{TL1_VERSION}}|$TL1_VERSION|g" \
      scripts/native/release/HUONG_DAN_CAI_DAT_ANDROID.txt | sed 's/$/\r/' > "$OUT/HUONG_DAN_CAI_DAT.txt"
  (cd "$OUT" && sha256sum "$APK_FILE" "$TL1_FILE" | sed 's/$/\r/' > SHA256SUMS.txt)
  rm -f "$ROOT/release/$ZIP"
  (cd "$OUT" && zip -q -j "$ROOT/release/$ZIP" "$APK_FILE" "$TL1_FILE" HUONG_DAN_CAI_DAT.txt SHA256SUMS.txt)
  ls -la "$OUT" "$ROOT/release/$ZIP"
  if [ "$COPY_WINDOWS" = 1 ]; then
    DL="$(wslpath "$(cmd.exe /c "echo %USERPROFILE%" 2>/dev/null | tr -d '\r')")/Downloads"
    cp "$ROOT/release/$ZIP" "$DL/"
    echo "Đã chép vào $(wslpath -w "$DL/$ZIP")"
  fi
  exit 0
fi

echo "== Windows"
npx tauri build --runner cargo-xwin --target "$WIN_TARGET"
WIN_SRC="$(ls -t src-tauri/target/$WIN_TARGET/release/bundle/nsis/*_"$VERSION"_x64-setup.exe | head -1)"

build_android

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

if [ "$COPY_WINDOWS" = 1 ]; then
  DL="$(wslpath "$(cmd.exe /c "echo %USERPROFILE%" 2>/dev/null | tr -d '\r')")/Downloads"
  mkdir -p "$DL/$NAME"
  cp "$OUT"/* "$DL/$NAME/"
  cp "$ROOT/release/$NAME.zip" "$DL/"
  echo "Đã chép vào $(wslpath -w "$DL/$NAME") và $(wslpath -w "$DL/$NAME.zip")"
fi
