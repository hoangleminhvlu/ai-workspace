# iThunder AI OS – AI Workspace (Frontend)

AI Workspace là giao diện người dùng của **iThunder AI OS**, nền tảng AI dùng chung chạy trên hạ tầng của Tổ chức
(On-Premise) do AI-TECH Center, Trường Đại học Văn Lang phát triển. Cùng một mã nguồn React chạy được dưới dạng Web App
(sau nginx của AI Gateway), ứng dụng Windows 11 (Tauri 2) và ứng dụng Android, iOS (Capacitor 8).

```
AI Workspace (kho này) ──► AI Gateway (nginx) ──► AI Platform (FastAPI, kho iThunder-AI-OS)
   Web / Windows / Android      /api, /ws           Định danh, Kho Dữ liệu, Kho Tri thức, RAG, MCP, Trao đổi trực tuyến
```

Phiên bản hiện tại: **6.11.23** (`package.json`). Tài liệu hướng dẫn sử dụng (TL1) và cài đặt, vận hành (TL2):
[hoangleminhvlu/ai-os-reference](https://github.com/hoangleminhvlu/ai-os-reference).

## Chức năng

| Trang | Đường dẫn | Nội dung |
|---|---|---|
| Đăng nhập | `/` | Chọn AI Gateway (ứng dụng máy trạm), Tổ chức, PassCode gửi qua email, FaceID hoặc PassTime |
| AI Chat / AI Work | `/` | Hỏi đáp trên Kho Tri thức có trích dẫn nguồn, chọn mô hình On-Premise hoặc On-Clouds, thông tin phiên trả lời (mô hình, thời gian, token), Sao chép / Lưu DOCX, Kho Dữ liệu, xem tệp |
| Kho Tri thức | `/knowledge` | Nạp, quản lý tài liệu của Kho Tri thức |
| Trao đổi trực tuyến | `/comm` | Nhắn tin cá nhân và nhóm, gọi thoại / video, hỏi Trợ lý AI bằng `@ai` trong hội thoại |
| Lịch sử Làm việc | `/history` | Phiên hội thoại của người dùng trên mọi Kho Tri thức |
| Quản trị Định danh | `/identity` | Người dùng, vai trò, Đơn vị, Phân vùng, nhập CSV, nhật ký; hồ sơ cá nhân cho mọi thành viên |
| Tích hợp MCP | `/mcp` | Kết nối Claude Desktop / Claude Code tới MCP Server của AI Platform; MCP Server bên ngoài (quản trị viên) |
| Giám sát Hệ thống | `/analytics` | Chỉ vai trò `admin`: tải GPU, Máy chủ AI, Trạng thái AI Platform (`?tab=platform`), khóa API AI On-Clouds của Tổ chức (`?tab=clouds`) |

Các thao tác quản trị nhạy cảm (Quản trị Định danh, khóa API On-Clouds) yêu cầu xác thực bổ sung bằng PassCode. Quyền thật
sự luôn được AI Platform kiểm tra ở từng API; việc ẩn trang ở giao diện chỉ để thuận tiện.

## Công nghệ

React 18, React Router 7, Vite 8, Tailwind CSS 4, `react-markdown` + `remark-gfm`, `lucide-react`; Tauri 2 (Windows),
Capacitor 8 (Android, iOS). Không dùng TypeScript.

## Cấu trúc mã nguồn

| Thư mục | Nội dung |
|---|---|
| `src/App.jsx`, `src/routes.jsx` | Luồng Đăng nhập → FaceID → Workspace, khai báo trang và rào chắn quyền |
| `src/auth/` | Trang Đăng nhập, Đăng ký, nhận PassCode, FaceID; chọn AI Gateway và Tổ chức |
| `src/workspace/` | Khung AI Chat/Work: thanh bên, danh sách tin nhắn, ô soạn, xem tệp, Kho Dữ liệu |
| `src/components/` | Thành phần dùng chung: Markdown, thông tin câu trả lời, nút Sao chép / Lưu DOCX |
| `src/comm/` | Kết nối `/ws/comm` dùng chung, cuộc gọi (WebRTC), chuông |
| `src/pages/` | Các trang phụ; `identity/`, `comm/`, `system/` là các bảng con |
| `src/services/api.js` | Toàn bộ lời gọi API, chọn AI Gateway, phiên đăng nhập |
| `src-tauri/`, `android/`, `ios/` | Vỏ ứng dụng native (xem `docs/NATIVE_APPS.md`) |
| `scripts/native/` | Script build, chạy thử, phát hành ứng dụng native |

## Phát triển

Cần Node.js 20.19+ hoặc 22.12+ (yêu cầu của Vite 8).

```bash
npm install
npm run dev      # http://localhost:5173, /api và /ws chuyển tới AI Platform tại http://localhost:8088
npm run lint
npm run build    # bản Web tĩnh trong dist/
```

`npm run dev` gọi AI Platform chạy cục bộ ở cổng 8088. Muốn dùng AI Gateway khác, đặt biến `VITE_DEV_GATEWAY`, ví dụ
`VITE_DEV_GATEWAY=https://aigate.to-chuc.vn npm run dev`. Máy phát triển thêm `http://localhost:5173` vào `CORS_ORIGINS` trong `.env` của AI Platform.

## Cấu hình AI Gateway

AI Workspace chọn AI Gateway theo thứ tự sau (`src/services/api.js`):

1. **Web App**: AI Gateway chính là tên miền đang mở AI Workspace. nginx của mỗi Tổ chức chuyển `/api` và `/ws` về AI
   Platform của Tổ chức đó, nên một bản build dùng chung cho mọi Tổ chức.
2. **Ứng dụng máy trạm** (Windows, Android, iOS, hoặc mở tại `http://localhost`): người dùng chọn AI Gateway trên trang Đăng
   nhập, On-Premise (`http://` trong mạng nội bộ) hoặc On-Clouds (`https://` qua Internet). Địa chỉ chỉ được ghi nhớ sau khi
   đăng nhập thành công.
3. **Cố định**: đặt `API_GATEWAY_URL` trong `window.TARA_CONFIG` của `index.html` thì không cho chọn.

`window.TARA_CONFIG` trong `index.html` còn có `DEFAULT_GATEWAY_URL` và `KNOWN_GATEWAYS` (danh sách gợi ý trên trang Đăng nhập).

## Triển khai Web App

Chép nội dung `dist/` vào thư mục web của nginx trên AI Gateway, chuyển `/api` và `/ws` (WebSocket) tới AI Platform. Nên đặt
`Cache-Control: no-store` cho `index.html` để người dùng nhận bản mới ngay sau mỗi lần triển khai (các tệp trong
`dist/assets/` có mã băm trong tên nên lưu đệm lâu được). Cấu hình chi tiết nằm trong TL2, mục 4.3 và 4.4.

## Ứng dụng Windows, Android, iOS

Build ngay trong WSL bằng các lệnh `npm run win:*`, `android:*`, `ios:sync`, `release`. Hướng dẫn đầy đủ (toolchain, trình
giả lập, khóa ký, bộ phát hành dùng thử): [`docs/NATIVE_APPS.md`](docs/NATIVE_APPS.md). Đây là bản thử nghiệm: bộ cài Windows
chưa ký số, iOS phải build trên macOS.

## Tải về, góp ý, đặt hàng phát triển

- Bộ cài Windows 11 (bản dùng thử): [Releases](https://github.com/hoangleminhvlu/ai-workspace/releases/latest).
- [Wiki](https://github.com/hoangleminhvlu/ai-workspace/wiki): câu hỏi thường gặp, mẫu báo lỗi, mẫu đặt hàng phát triển và
  tích hợp.
- Email **ai-tech.center@vlu.edu.vn** (Trung tâm AI-TECH, Trường Đại học Văn Lang): góp ý, báo lỗi, đặt hàng phát triển
  chức năng, tích hợp với phần mềm nghiệp vụ (LMS, ERP, CRM, EMR...), triển khai AI On-Premise.
- [Issues](https://github.com/hoangleminhvlu/ai-workspace/issues): báo lỗi công khai. Không đăng PassCode, mã truy cập hay
  địa chỉ AI Gateway nội bộ của Tổ chức.

## Giấy phép

GNU General Public License v3.0, xem [`LICENSE`](LICENSE).
