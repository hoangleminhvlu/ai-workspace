// Định dạng dùng chung cho câu trả lời của Trợ lý AI ở khung AI Chat/Work và Trao đổi trực tuyến
import { Cloud, Server } from 'lucide-react';

// Nơi mô hình chạy (meta.location do AI Platform gửi)
export const LOCATION = {
  onpremise: { label: 'On-Premises', Icon: Server, cls: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
               title: 'Mô hình chạy trên Máy chủ AI của Tổ chức: dữ liệu không ra khỏi hạ tầng nội bộ' },
  onclouds:  { label: 'On-Clouds', Icon: Cloud, cls: 'text-sky-700 dark:text-sky-400 bg-sky-500/10 border-sky-500/30',
               title: 'Mô hình chạy trên dịch vụ AI qua Internet' },
};

// Nội dung Markdown cỡ 13px, khoảng cách gọn (prose-sm mặc định để lề lớn giữa đoạn, danh sách, đường kẻ)
export const PROSE = 'prose prose-sm max-w-none break-words text-[13px] leading-relaxed prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 '
  + 'prose-li:my-0.5 prose-hr:my-3 prose-headings:mt-3 prose-headings:mb-1.5 prose-pre:my-2 prose-blockquote:my-2 prose-table:my-2 '
  + 'prose-code:before:content-none prose-code:after:content-none '
  + '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0';

export const toDate = (iso) => { const d = iso ? new Date(iso) : null; return d && !Number.isNaN(d.getTime()) ? d : null; };

// Giờ:phút:giây; khác ngày hôm nay thì thêm ngày
export const formatClock = (iso) => {
  const d = toDate(iso);
  if (!d) return '';
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? time : `${time} ${d.toLocaleDateString('vi-VN')}`;
};

export const formatDuration = (ms) => {
  if (ms == null || ms < 0) return '';
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1).replace('.', ',')} giây` : `${Math.floor(s / 60)} phút ${Math.round(s % 60)} giây`;
};

export const formatCount = (n) => Number(n || 0).toLocaleString('vi-VN');
