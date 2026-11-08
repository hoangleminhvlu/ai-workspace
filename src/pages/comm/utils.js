/**
 * TARA AI Workspace - Main iThunder AI OS Entry Point (V6.09.27)
 * Hằng số và hàm tiện ích dùng chung của trang Trao đổi trực tuyến.
 * Tách khỏi shared.jsx (chỉ chứa component) để React Fast Refresh hoạt động đúng khi phát triển.
 */

import { Bot, User, Users } from 'lucide-react';

export const KIND_INFO = {
  direct:    { label: 'Trực tiếp', icon: User },
  group:     { label: 'Nhóm', icon: Users },
  assistant: { label: 'Trợ lý AI', icon: Bot },
};

// Hội thoại trực tiếp mang tên người còn lại (peer trong danh sách, hoặc tìm trong members của chi tiết hội thoại)
export const conversationTitle = (conv, me) => {
  if (!conv) return '';
  if (conv.kind === 'direct') return conv.peer?.user_name || conv.members?.find(m => m.user_id !== me)?.user_name || 'Hội thoại trực tiếp';
  return conv.title || KIND_INFO[conv.kind]?.label || 'Hội thoại';
};

// Mã tin phía máy trạm: máy chủ dùng để không ghi trùng khi gửi lại (mạng chập chờn, kết nối lại)
export const newClientId = () => (window.crypto?.randomUUID ? window.crypto.randomUUID() : `c-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);

export const formatShortTime = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d)) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

export const formatDay = (value) => {
  const d = new Date(value);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Hôm nay';
  if (d.toDateString() === yesterday.toDateString()) return 'Hôm qua';
  return d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};
