#!/usr/bin/env bash
# Kiểm tra môi trường phát triển ứng dụng Windows / Android / iOS
. "$(dirname "$0")/env.sh"
ok() { printf '  [OK]   %-28s %s\n' "$1" "$2"; }
miss() { printf '  [THIẾU] %-27s %s\n' "$1" "$2"; }
chk() { local name=$1 cmd=$2 hint=$3; if command -v "$cmd" >/dev/null 2>&1; then ok "$name" "$($cmd --version 2>&1 | head -1)"; else miss "$name" "$hint"; fi; }
echo "Chung"; chk Node.js node "nvm/apt"; chk npm npm ""
echo "Windows (Tauri 2, biên dịch chéo)"
chk rustc rustc "rustup"; chk cargo-xwin cargo-xwin "cargo install --locked cargo-xwin"
rustup target list --installed 2>/dev/null | grep -q "$WIN_TARGET" && ok "Rust target" "$WIN_TARGET" || miss "Rust target" "rustup target add $WIN_TARGET"
chk clang clang "sudo apt install clang"; chk lld-link lld-link "sudo apt install lld"; chk llvm-rc llvm-rc "sudo apt install llvm"; chk makensis makensis "sudo apt install nsis"
echo "Android (Capacitor 8)"
[ -x "$JAVA_HOME/bin/java" ] && ok "JDK" "$("$JAVA_HOME/bin/java" -version 2>&1 | head -1)" || miss JDK "JDK 21 tại $JAVA_HOME"
[ -d "$ANDROID_HOME/platforms/android-36" ] && ok "Android SDK 36" "$ANDROID_HOME" || miss "Android SDK 36" "sdkmanager 'platforms;android-36'"
chk adb adb "sdkmanager platform-tools"
echo "iOS: cần máy macOS có Xcode (hoặc GitHub Actions macos) — WSL chỉ đồng bộ được mã nguồn ios/"
