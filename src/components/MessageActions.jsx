/**
 * Hàng nút dưới mỗi tin nhắn của khung AI Chat/Work: Sao chép (Prompt và câu trả lời) và Lưu DOCX (câu trả lời).
 */
import React, { useState } from 'react';
import { Copy, Check, FileDown, Loader2, CircleAlert } from 'lucide-react';
import iThunderAPI from '../services/api';

// navigator.clipboard chỉ có ở ngữ cảnh an toàn (HTTPS, localhost); AI Gateway On-Premise mở bằng http://<IP nội bộ>
// phải dùng cách cũ là chọn một <textarea> ẩn rồi gọi execCommand('copy').
const legacyCopy = (text) => {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.appendChild(area);
  area.select();
  try { return document.execCommand('copy'); } catch { return false; } finally { area.remove(); }
};

// Chép cả hai dạng: văn bản thô (Markdown) cho ô nhập Prompt, trình soạn mã...; HTML đã dựng cho Word, Email để
// giữ tiêu đề, bảng, chữ đậm. Trình duyệt không hỗ trợ ClipboardItem thì chỉ chép văn bản thô.
const copyMessage = async (text, html) => {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      if (html && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/plain': new Blob([text], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' }),
        })]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      return true;
    } catch { /* Bị từ chối quyền hoặc cửa sổ mất tiêu điểm: thử cách cũ */ }
  }
  return legacyCopy(text);
};

// Tên văn bản lấy từ dòng đầu của Prompt đã sinh ra câu trả lời
const titleFrom = (prompt) => (prompt || '').split('\n')[0].replace(/[#*_`>]/g, '').trim().slice(0, 80);

const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

/**
 * @param content    Nội dung Markdown của tin nhắn
 * @param isAsst     true: câu trả lời của iThunder AI (có thêm nút Lưu DOCX)
 * @param prompt     Prompt của người dùng ngay trước câu trả lời (đặt tên tập tin)
 * @param getHtml    Hàm trả HTML đã dựng của tin nhắn (để dán vào Word giữ định dạng)
 */
export default function MessageActions({ content, isAsst, prompt, getHtml }) {
  const [copied, setCopied] = useState(null);     // null | 'ok' | 'fail'
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const copy = async () => {
    const ok = await copyMessage(content, getHtml?.());
    setCopied(ok ? 'ok' : 'fail');
    setTimeout(() => setCopied(null), 1800);
  };

  const saveDocx = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await iThunderAPI.exportChatDocx(content, titleFrom(prompt));
      if (res?.status === 'SUCCESS') saveBlob(res.blob, res.filename);
      else setSaveError(res?.detail || 'Không tạo được tập tin DOCX.');
    } catch {
      setSaveError('Mất kết nối tới AI Gateway khi tạo tập tin DOCX.');
    } finally {
      setSaving(false);
    }
  };

  const button = `inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-60 ${
    isAsst ? 'text-fg-muted hover:text-fg-strong hover:bg-hover' : 'text-blue-100 hover:text-white hover:bg-white/15'}`;

  return (
    <div className={`mt-2 flex flex-wrap items-center gap-1 ${isAsst ? '' : 'justify-end'}`}>
      <button type="button" onClick={copy} className={button}
        title={isAsst ? 'Sao chép câu trả lời (dán vào Word vẫn giữ định dạng)' : 'Sao chép Prompt'}>
        {copied === 'ok' ? <Check size={13} /> : copied === 'fail' ? <CircleAlert size={13} /> : <Copy size={13} />}
        <span aria-live="polite">{copied === 'ok' ? 'Đã sao chép' : copied === 'fail' ? 'Không sao chép được' : 'Sao chép'}</span>
      </button>
      {isAsst && (
        <button type="button" onClick={saveDocx} disabled={saving} className={button} title="Lưu câu trả lời thành tập tin Word (.docx)">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
          <span>{saving ? 'Đang tạo...' : 'Lưu DOCX'}</span>
        </button>
      )}
      {saveError && <span role="alert" className="text-[11px] text-red-600 dark:text-red-400">{saveError}</span>}
    </div>
  );
}
