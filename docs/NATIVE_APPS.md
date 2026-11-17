# AI Workspace: ứng dụng Windows 11, Android, iOS

Cùng một mã nguồn React/Vite (`src/`) được đóng gói thành:

| Nền tảng | Công nghệ | Thư mục | Build trong WSL |
|---|---|---|---|
| Windows 11 | Tauri 2 (WebView2) | `src-tauri/` | Có, biên dịch chéo bằng `cargo-xwin` |
| Android | Capacitor 8 | `android/` | Có (JDK 21 + Android SDK 36) |
| iOS | Capacitor 8 | `ios/` | Không: chỉ đồng bộ mã nguồn, build phải dùng macOS + Xcode |

Mã định danh ứng dụng: Windows `vn.istech.aiworkspace`; Mobile (Android/iOS, thử nghiệm) `vn.aitech.aiworkspace`.
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

## Lệnh

```bash
npm run native:doctor     # kiểm tra môi trường
npm run win:dev           # Vite dev (hot reload) + bản debug .exe mở trên Windows
npm run win:build         # bộ cài NSIS: src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/
npm run android:build     # APK debug: android/app/build/outputs/apk/debug/app-debug.apk
npm run android:install   # cài APK lên điện thoại qua Gỡ lỗi không dây (adb pair / adb connect)
npm run android:release   # APK/AAB release (cần cấu hình khóa ký trước)
npm run ios:sync          # đồng bộ dist/ vào ios/ (sau đó build trên macOS)
```

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
- Trình giả lập Android trong WSL cần quyền `/dev/kvm`: `sudo usermod -aG kvm $USER`, sau đó khởi động lại WSL.
  Dùng điện thoại thật thì đơn giản hơn.
- Biểu tượng hiện là biểu tượng mặc định. Khi có ảnh vuông 1024×1024: `npx tauri icon <ảnh>` (Windows) và
  `npx @capacitor/assets generate` (Android/iOS).
- iOS: cần máy Mac có Xcode 26+, hoặc GitHub Actions `macos` runner, cùng tài khoản Apple Developer để ký.
