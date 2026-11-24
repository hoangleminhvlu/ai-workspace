// Khuyến nghị dùng ứng dụng Windows Desktop / Android Mobile trước khi đăng nhập bằng trình duyệt (Web App).
// Web luôn phải kiểm tra người thật (FaceID Liveness); ứng dụng có khóa thiết bị nên chỉ cần nhìn thẳng (xem deviceKey.js).
import { clientKind } from '../services/api';

// releases/latest: GitHub tự chuyển tới bản phát hành mới nhất (tên tệp ZIP có số phiên bản nên không gắn cứng vào mã nguồn)
export const RELEASE_URL = 'https://github.com/hoangleminhvlu/ai-workspace/releases/latest';
export const GUIDE_URL = 'https://github.com/hoangleminhvlu/ai-workspace/wiki';

const NOTICE_KEY = 'tara_web_notice';

// Chỉ nhắc trên trình duyệt; người dùng đã chọn "Tiếp tục bằng Web App" thì không nhắc lại trong cùng thẻ (tab)
export const isWebClient = () => clientKind() === 'web';
export const shouldShowWebNotice = () => {
  if (!isWebClient()) return false;
  try { return sessionStorage.getItem(NOTICE_KEY) !== '1'; } catch { return true; }
};
export const dismissWebNotice = () => {
  try { sessionStorage.setItem(NOTICE_KEY, '1'); } catch { /* trình duyệt chặn lưu trữ: nhắc lại khi tải lại trang */ }
};

// 'windows' | 'android' | 'ios' | 'other': chọn ứng dụng phù hợp với thiết bị đang mở (gợi ý hiển thị, không dùng để phân quyền)
export const devicePlatform = () => {
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return 'android';
  // iPadOS tự nhận là Macintosh nhưng có màn hình cảm ứng
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Windows NT/i.test(ua)) return 'windows';
  return 'other';
};
