# AI Workspace: ứng dụng Windows 11, Android, iOS

Cùng một mã nguồn React/Vite (`src/`) được đóng gói thành:

| Nền tảng | Công nghệ | Thư mục | Build trong WSL |
|---|---|---|---|
| Windows 11 | Tauri 2 (WebView2) | `src-tauri/` | Có, biên dịch chéo bằng `cargo-xwin` |
| Android | Capacitor 8 | `android/` | Có (JDK 21 + Android SDK 36) |
| iOS | Capacitor 8 | `ios/` | Không: chỉ đồng bộ mã nguồn, build phải dùng macOS + Xcode |

Mã định danh ứng dụng (Windows, Android, iOS; thử nghiệm): `vn.aitech.aiworkspace`.
Phiên bản lấy theo `package.json` (hiện `6.11.16`): Tauri đọc trực tiếp; Android versionCode / iOS build ghi `61116`
(cập nhật tay trong `android/app/build.gradle` và `ios/App/App.xcodeproj/project.pbxproj` khi đổi phiên bản).

## Kết nối AI Gateway

Các ứng dụng native là "ứng dụng máy trạm" (`isClientApp()` trong `src/services/api.js`): người dùng chọn AI Gateway
trên trang Đăng nhập. Origin của từng ứng dụng đã nằm trong `CLIENT_APP_ORIGINS` của AI Platform (`config.py`):

- Windows (Tauri): `http://tauri.localhost`
- Android: `http://localhost` (`server.androidScheme = "http"` trong `capacitor.config.json`, để gọi được AI Gateway
  On-Premise `http://IP-nội-bộ` mà không vướng Mixed Content; `usesCleartextTraffic` đã bật)
- iOS: `capacitor://localhost` (ATS: `NSAllowsLocalNetworking`)

Quyền camera và micro (cho gọi thoại/video và Face ID) đã khai báo trong `AndroidManifest.xml` và `Info.plist`.

**Không hiển thị địa chỉ AI Gateway** trong ứng dụng máy trạm: trang Đăng nhập chỉ hiện "Đã kết nối AI Gateway của Tổ chức
(địa chỉ được ẩn)", loại kết nối và Tổ chức; gợi ý (đã dùng, `KNOWN_GATEWAYS`) hiện theo mã / tên Tổ chức đọc từ
`/api/org/info`; ô nhập địa chỉ mới che ký tự (nút mắt để xem khi đang gõ), chặn sao chép; thông báo lỗi, chú thích thanh
bên, trang Tích hợp MCP không có địa chỉ; menu chuột phải mặc định của WebView bị tắt ngoài ô nhập. Bản phát hành không có
công cụ gỡ lỗi (Tauri release, `webContentsDebuggingEnabled: false`). Giới hạn: địa chỉ vẫn nằm trong bộ nhớ ứng dụng
(localStorage) trên máy, trong `index.html` đóng gói (`DEFAULT_GATEWAY_URL`, `KNOWN_GATEWAYS`: không ghi IP nội bộ vào đây)
và lộ qua lưu lượng mạng (DNS, kết nối TCP); bảo vệ thật sự là xác thực của AI Gateway, TLS, tường lửa / VPN.

**Phóng to trên Windows**: nút **Cỡ hiển thị** (80% đến 200%) ở cuối thanh bên trái, phím Ctrl + / Ctrl - / Ctrl 0, Ctrl +
lăn chuột (`src/services/appZoom.js`, `Webview.setZoom`, quyền `core:webview:allow-set-webview-zoom` trong
`src-tauri/capabilities/default.json`). Mức phóng to được ghi nhớ trên máy. Bản Web dùng phóng to của trình duyệt.

## Lệnh

```bash
npm run native:doctor     # kiểm tra môi trường
npm run win:dev           # Vite dev (hot reload) + bản debug .exe mở trên Windows
npm run win:build         # bộ cài NSIS: src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/
npm run android:build     # APK debug: android/app/build/outputs/apk/debug/app-debug.apk
npm run android:emulator  # bật trình giả lập Android (KVM, hiện qua WSLg), cài và mở APK debug
npm run android:install   # cài APK lên thiết bị đang kết nối: trình giả lập, hoặc điện thoại qua Gỡ lỗi không dây
npm run android:release   # APK/AAB release (cần khóa ký, xem bên dưới)
npm run ios:sync          # đồng bộ dist/ vào ios/ (sau đó build trên macOS)
npm run release           # bộ phát hành dùng thử: release/<phiên bản>/ và .zip (thêm -- --copy-windows để chép vào Downloads)
```

## Bộ phát hành dùng thử (`npm run release`)

`scripts/native/release.sh` build bộ cài Windows và APK Android bản phát hành, kiểm tra chữ ký APK (không chấp nhận khóa
debug), rồi tạo `release/<phiên bản>/` (thư mục bị bỏ qua trong git):

| Tệp | Nội dung |
|---|---|
| `iThunder-AI-Workspace-<pb>-Windows-x64-setup.exe` | Bộ cài NSIS, cài cho người dùng hiện tại, chưa ký số |
| `iThunder-AI-Workspace-<pb>-Android.apk` | APK ký bằng khóa phát hành, không debuggable, tắt sao lưu dữ liệu |
| `HUONG_DAN_CAI_DAT.txt` | Hướng dẫn cho người dùng thử (mẫu: `scripts/native/release/HUONG_DAN_CAI_DAT.txt`) |
| `SHA256SUMS.txt` | Mã SHA-256 của hai tệp cài đặt |

và `release/iThunder-AI-Workspace-<pb>.zip` để gửi đi. Trước khi đóng gói, đổi phiên bản trong `package.json` và
versionCode/versionName trong `android/app/build.gradle` (script dừng nếu hai nơi khác nhau).

**Khóa ký Android** nằm NGOÀI repo: `~/.config/ithunder-signing/aiworkspace-release.jks` và
`android-release.properties` (mật khẩu), quyền 600. `android/app/build.gradle` đọc tệp này (đổi đường dẫn bằng biến
`ITHUNDER_ANDROID_SIGNING`). Mọi bản cập nhật phải ký bằng đúng khóa này, nếu không Android từ chối cài đè: hãy sao lưu
cả hai tệp ở nơi an toàn (két mật khẩu, ổ mã hóa). Dấu vân tay SHA-256 của chứng thư được in trong `HUONG_DAN_CAI_DAT.txt`.

**Windows** chưa có chứng thư ký mã: SmartScreen cảnh báo khi cài. Khi có chứng thư, khai báo
`bundle.windows.signCommand` trong `src-tauri/tauri.conf.json`.

Sau mỗi lần sửa giao diện, Android và iOS cần `npm run build` rồi `npx cap sync` (các lệnh trên đã gộp sẵn).

## Toolchain trong WSL (thư mục nhà, không cần sudo)

- Rust stable + target `x86_64-pc-windows-msvc`, `cargo-xwin` (`~/.cargo`). Lần build đầu, cargo-xwin tải
  MSVC CRT và Windows SDK về `~/.cache/cargo-xwin`; việc tải này nghĩa là chấp nhận giấy phép của Microsoft.
- JDK 21 Temurin: `~/.local/opt/jdk-21`
- Android SDK: `~/Android/Sdk` (cmdline-tools, platform-tools, platforms;android-36, build-tools;36.0.0)
- Biến môi trường nằm trong khối "iThunder AI Workspace native toolchain" ở `~/.bashrc`

Cần cài bằng sudo cho bản Windows: `clang lld llvm nsis`.

## Ghi chú

- WSL đang ở chế độ mạng NAT: Windows gọi được `localhost:5173` của WSL, nhưng điện thoại không gọi được. Vì vậy
  Android dùng APK đã build (không dùng live reload). `adb connect` từ WSL tới điện thoại vẫn hoạt động.
- Trình giả lập Android: máy ảo `AIWorkspace_API36` (khung Pixel 7, màn hình hạ còn 720×1600 @320dpi; Android 16 /
  API 36 AOSP `default` x86_64, không có Google Play Services; RAM 2 GB), tăng tốc bằng KVM (người dùng `local` thuộc
  nhóm `kvm`; nếu nhóm chưa có hiệu lực, script tự chạy qua `sg kvm`). WSLg không có GPU thật (chỉ llvmpipe) nên đồ họa
  giả lập bằng CPU (`swiftshader_indirect`, đổi bằng `EMU_GPU=`), hiệu ứng chuyển cảnh được tắt. Khởi động mất 2 đến 3
  phút; vài phút đầu máy ảo rất chậm, có thể hiện "System UI isn't responding" (chọn Wait) và lần dò AI Gateway đầu
  tiên quá 8 giây (bấm "Thử lại"). Gỡ lỗi WebView:
  `adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>` rồi mở `chrome://inspect` trên Windows.
- Biểu tượng tạm (đám mây và tia sét theo màu logo iThunder Clouds) vẽ bằng `scripts/native/icon/make_icon.py`
  (cần Pillow) vào `assets/`. Khi có biểu tượng chính thức 1024×1024, thay các tệp trong `assets/` rồi chạy
  `npx tauri icon assets/icon.png` (xóa `src-tauri/icons/android`, `src-tauri/icons/ios` sinh thừa) và
  `npx @capacitor/assets generate --android --ios --iconBackgroundColor '#061430' --splashBackgroundColor '#060b13'`.
- iOS: cần máy Mac có Xcode 26+, hoặc GitHub Actions `macos` runner, cùng tài khoản Apple Developer để ký.
