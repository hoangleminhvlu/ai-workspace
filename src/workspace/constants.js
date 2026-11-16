// Hằng số và hàm tiện ích dùng chung của AI Workspace (tách từ App.jsx)
import { Database, FolderKanban } from 'lucide-react';

// Mã phiên hội thoại (thread) mới: mỗi lần đăng nhập/đăng xuất hoặc đổi kho tri thức là một thread riêng,
// tránh ghi vào thread của người dùng trước (Backend trả 403) và để danh sách thread theo kho khớp nội dung
export const newThreadId = () => {
  const unique = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `thread_${unique}`;
};

// Nhóm Kho Tri thức trong danh sách chọn ở thanh bên (Kho Cá nhân hiện riêng)
export const PERSONAL_STORE = 'Personal';
export const STORE_GROUPS = [
  { id: 'org', label: 'Kho của Tổ chức' },
  { id: 'cloud', label: 'Dự án / phân vùng của bạn' },
  { id: 'opened', label: 'Phân vùng đã mở' },
];
export const storeGroup = (c) => (c?.opened ? 'opened' : c?.scope === 'cloud' ? 'cloud' : 'org');
export const storeLabel = (c) => (c?.scope === 'cloud' ? c.cloud?.name || c.display_name : c?.display_name || c?.storage_key);
// Loại kho và mô tả (do Quản trị viên của Tổ chức đặt; phân vùng: tên đề tài) của Kho Tri thức đang làm việc
export const storeScopeLabel = (c) => (c?.scope === 'cloud' ? (c.opened ? 'Phân vùng đã mở' : 'Kho của phân vùng') : c?.scope === 'personal' ? 'Kho riêng của bạn' : 'Kho của Tổ chức');
export const storeDescription = (c) => c?.description || c?.cloud?.description || '';

// Nhãn vai trò ở đáy Left Sidebar: tên gọi và màu nền riêng cho từng vai trò (vai trò lạ dùng màu của Khách)
export const ROLE_BADGE = {
  admin:   { label: 'Quản trị viên', cls: 'bg-red-600 text-white' },
  manager: { label: 'Quản lý',       cls: 'bg-violet-600 text-white' },
  member:  { label: 'Thành viên',    cls: 'bg-blue-600 text-white' },
  partner: { label: 'Đối tác',       cls: 'bg-teal-600 text-white' },
  intern:  { label: 'Thực tập',      cls: 'bg-cyan-600 text-white' },
  active:  { label: 'Giảng viên',    cls: 'bg-emerald-600 text-white' },
  idle:    { label: 'Thỉnh giảng',   cls: 'bg-lime-600 text-white' },
  shared:  { label: 'Sinh viên',     cls: 'bg-amber-500 text-white' },
  graded:  { label: 'Đã tốt nghiệp', cls: 'bg-slate-500 text-white' },
  stoped:  { label: 'Dừng học',      cls: 'bg-zinc-500 text-white' },
  visitor: { label: 'Khách',         cls: 'bg-zinc-400 text-white dark:bg-zinc-600' },
};

// Số khung hình FaceID không khớp/không thấy khuôn mặt liên tiếp trước khi tạm dừng quét
export const MAX_FACE_ATTEMPTS = 8;

// Chính sách lưu lịch sử hội thoại khi chưa biết (chưa nạp /api/auth/me hoặc Backend chưa có API này)
export const UNKNOWN_HISTORY_POLICY = { enabled: null, roles: [] };

// Danh mục lệnh nhanh (Slash Commands) hiển thị khi gõ "/" trong ô Chat/Work
export const SLASH_COMMANDS = [
  { cmd: '/menu', desc: 'Hiển thị thanh điều hướng tác vụ chính' },
  { cmd: '/history', desc: 'Xem lịch sử hội thoại của kho đang chọn (mọi kho: mục Lịch sử Làm việc)' },
  { cmd: '/thread', desc: 'Khôi phục hội thoại gần nhất (/thread <số> theo /history)' },
  { cmd: '/knowledge', desc: 'Quản trị và kiểm tra danh mục kho tri thức' },
  { cmd: '/analytics', desc: 'Giám sát hạ tầng và hiệu năng AI Server' },
  { cmd: '/mcp', desc: 'Tích hợp MCP: kết nối Claude Desktop/Claude Code, công cụ AI bên ngoài' },
  { cmd: '/comm', desc: 'Trao đổi trực tuyến: nhắn tin người dùng, nhóm, Trợ lý AI' },
  { cmd: '/rag-sync', desc: 'RAG tệp mới / đã sửa của Kho Dữ liệu; /rag-sync <thư mục con> để chỉ RAG một thư mục' }
];

// Trạng thái đồng bộ của tập tin Kho Dữ liệu vào Kho Tri thức (trường sync_state do Backend trả về)
export const SYNC_STATE = {
  synced:     { label: 'Đã RAG',      dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  outdated:   { label: 'Cần RAG lại', dot: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400' },
  not_synced: { label: 'Chưa RAG',    dot: 'bg-slate-400',   text: 'text-fg-subtle' }
};

// Hiển thị thời gian ISO theo định dạng Việt Nam
export const formatDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString('vi-VN');
};

// Biểu tượng của Kho Tri thức: phân vùng (Dự án...) hoặc kho của Tổ chức / Kho Cá nhân
export const storeIconOf = (c) => (c?.scope === 'cloud' ? FolderKanban : Database);

// Người dùng mặc định khi chưa đăng nhập / sau khi đăng xuất (tài khoản Khách dùng chung của Tổ chức)
export const GUEST_USER = { userId: "1162000", ownerId: "", userName: "Khách", userRole: "visitor", userOrg: "AI-TECH Center" };
