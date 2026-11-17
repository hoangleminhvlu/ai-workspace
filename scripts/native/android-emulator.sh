#!/usr/bin/env bash
# Khởi động trình giả lập Android (KVM, hiển thị qua WSLg), chờ khởi động xong, cài và mở APK debug.
# Tham số: --no-install để chỉ bật trình giả lập. Biến AVD đổi tên máy ảo (mặc định AIWorkspace_API36).
set -euo pipefail
. "$(dirname "$0")/env.sh"
AVD="${AVD:-AIWorkspace_API36}"
if ! adb devices | grep -q '^emulator-'; then
  CMD="$ANDROID_HOME/emulator/emulator -avd $AVD -gpu ${EMU_GPU:-swiftshader_indirect} -no-snapshot-save -no-boot-anim -netdelay none -netspeed full"
  # Nhóm kvm chỉ có hiệu lực sau khi khởi động lại WSL (wsl --shutdown); trước đó chạy qua sg kvm
  if [ -w /dev/kvm ]; then nohup $CMD >/tmp/ai-workspace-emulator.log 2>&1 &
  else nohup sg kvm -c "$CMD" >/tmp/ai-workspace-emulator.log 2>&1 & fi
  echo "Đang khởi động $AVD (nhật ký: /tmp/ai-workspace-emulator.log)..."
  adb wait-for-device
  until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ]; do sleep 2; done
  # Đồ họa giả lập bằng CPU: tắt hiệu ứng chuyển cảnh cho đỡ giật
  for k in window_animation_scale transition_animation_scale animator_duration_scale; do adb shell settings put global $k 0; done
fi
echo "Trình giả lập sẵn sàng: $(adb devices | grep '^emulator-' | cut -f1)"
[ "${1:-}" = --no-install ] || "$(dirname "$0")/android-install.sh"
