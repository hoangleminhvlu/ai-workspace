// Thông tin Tổ chức / AI Gateway dùng trên các màn hình xác thực và Workspace (tách từ App.jsx)
import { gatewayAPI } from '../services/api';

// Tổ chức sở hữu AI Gateway (Backend /api/org/info): status 'loading' | 'ok' | 'error'
// network: 'internet' | 'onpremise'; switchEnabled + organizations: chọn Tổ chức khác (chỉ AI Gateway chạy trên Internet)
export const ORG_LOADING = { status: 'loading', orgId: '', orgName: '', orgUrl: '', location: '', network: '', switchEnabled: false, organizations: [] };
export const OTHER_ORG_HINT = 'Không phải Tổ chức của bạn? Hãy đăng nhập tại AI Gateway của Tổ chức mình (địa chỉ do Quản trị viên Tổ chức cung cấp).';
export const ONPREM_ORG_HINT = 'AI Gateway nội bộ (On-Premise): chỉ phục vụ mạng của Tổ chức này. Không phải Tổ chức của bạn? Hãy dùng AI Gateway do Quản trị viên Tổ chức mình cung cấp.';

// AI Workspace chạy như ứng dụng máy trạm (http://localhost, Desktop, Mobile): người dùng chọn AI Gateway trên trang Đăng nhập
export const CLIENT_APP = gatewayAPI.isClientApp();

// Chỉ chuyển trang tới https (hoặc http://localhost khi phát triển): kiểm tra lại phía máy trạm dù Backend đã lọc danh mục
export const isSafeWorkspaceUrl = (url) => /^https:\/\/[^\s/@]+/i.test(url) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url);
