#!/usr/bin/env bash
# Chạy AI Workspace dạng ứng dụng Windows ở chế độ phát triển (hot reload):
#   Vite dev server trong WSL (localhost:5173) + bản debug .exe biên dịch chéo, mở trên Windows 11 (WebView2).
set -euo pipefail
. "$(dirname "$0")/env.sh"
cd "$ROOT/src-tauri"
cargo xwin build --target "$WIN_TARGET"
DEST="$(win_dev_dir)"; mkdir -p "$DEST"
cp "target/$WIN_TARGET/debug/ai-workspace.exe" "$DEST/"
cd "$ROOT"
if ! curl -s -o /dev/null http://localhost:5173; then
  npm run dev -- --host 127.0.0.1 &
  VITE_PID=$!; trap 'kill $VITE_PID 2>/dev/null' EXIT
  until curl -s -o /dev/null http://localhost:5173; do sleep 1; done
fi
echo "Mở $DEST/ai-workspace.exe (đóng cửa sổ ứng dụng để kết thúc)"
"$DEST/ai-workspace.exe"
