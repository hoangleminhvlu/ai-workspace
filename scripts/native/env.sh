# Biến môi trường dùng chung cho các script native (Tauri Windows, Capacitor Android)
export JAVA_HOME="${JAVA_HOME:-$HOME/.local/opt/jdk-21}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
[ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"
# Ubuntu có thể chỉ cài llvm-rc / lld-link trong /usr/lib/llvm-<N>/bin: dùng bản mới nhất
if ! command -v llvm-rc >/dev/null 2>&1; then
  LLVM_BIN="$(ls -d /usr/lib/llvm-*/bin 2>/dev/null | sort -V | tail -1)"
  [ -n "$LLVM_BIN" ] && export PATH="$PATH:$LLVM_BIN"
fi
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WIN_TARGET=x86_64-pc-windows-msvc
# Thư mục trên ổ C: để chạy thử bản Windows (chạy .exe từ \\wsl.localhost chậm và WebView2 không ghi được dữ liệu)
win_dev_dir() {
  local local_app
  local_app="$(cmd.exe /c "echo %LOCALAPPDATA%" 2>/dev/null | tr -d '\r')"
  echo "$(wslpath "$local_app")/iThunder-AIWorkspace-dev"
}
