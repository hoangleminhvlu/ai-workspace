// Lời chào khi chưa có hội thoại, hoặc danh sách tin nhắn của phiên AI Chat/Work.
// Cùng phong cách với khung Chat của Trao đổi trực tuyến: avatar, tên, bong bóng cỡ chữ nhỏ (prose-sm), câu hỏi nền xanh;
// dưới câu trả lời của Trợ lý AI: mô hình, On-Premises / On-Clouds, giờ bắt đầu - kết thúc, thời lượng, số token.
// Tin nhắn assistant có meta là câu trả lời của mô hình; không có meta là thông báo hệ thống (lệnh nhanh, tải tệp...).
import { useEffect, useState } from 'react';
import { Sparkles, Bot, Server, Cloud, Loader2, Info, Clock, Coins, CircleAlert } from 'lucide-react';
import Markdown from '../components/Markdown';
import MessageActions from '../components/MessageActions';

const LOCATION = {
  onpremise: { label: 'On-Premises', Icon: Server, cls: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
               title: 'Mô hình chạy trên Máy chủ AI của Tổ chức: dữ liệu không ra khỏi hạ tầng nội bộ' },
  onclouds:  { label: 'On-Clouds', Icon: Cloud, cls: 'text-sky-700 dark:text-sky-400 bg-sky-500/10 border-sky-500/30',
               title: 'Mô hình chạy trên dịch vụ AI qua Internet' },
};

// Nội dung Markdown cỡ 13px, khoảng cách gọn (prose-sm mặc định để lề lớn giữa đoạn, danh sách, đường kẻ)
const PROSE = 'prose prose-sm max-w-none break-words text-[13px] leading-relaxed prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 '
  + 'prose-li:my-0.5 prose-hr:my-3 prose-headings:mt-3 prose-headings:mb-1.5 prose-pre:my-2 prose-blockquote:my-2 prose-table:my-2 '
  + 'prose-code:before:content-none prose-code:after:content-none '
  + '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0';

const toDate = (iso) => { const d = iso ? new Date(iso) : null; return d && !Number.isNaN(d.getTime()) ? d : null; };
const sameDay = (a, b) => a.toDateString() === b.toDateString();
// Giờ:phút:giây; khác ngày hôm nay thì thêm ngày
const formatClock = (iso) => {
  const d = toDate(iso);
  if (!d) return '';
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return sameDay(d, new Date()) ? time : `${time} ${d.toLocaleDateString('vi-VN')}`;
};
const formatDuration = (ms) => {
  if (ms == null || ms < 0) return '';
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1).replace('.', ',')} giây` : `${Math.floor(s / 60)} phút ${Math.round(s % 60)} giây`;
};
const formatCount = (n) => Number(n || 0).toLocaleString('vi-VN');
const initials = (name) => String(name || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();

function Avatar({ kind, name }) {
  if (kind === 'user') {
    return <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0" aria-hidden="true">{initials(name)}</span>;
  }
  const Icon = kind === 'system' ? Info : Bot;
  return (
    <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border ${kind === 'system'
      ? 'bg-elevated border-line text-fg-subtle' : 'bg-violet-600/10 border-violet-500/30 text-violet-600 dark:text-violet-400'}`} aria-hidden="true">
      <Icon size={14} />
    </span>
  );
}

function LocationChip({ location }) {
  const loc = LOCATION[location];
  if (!loc) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-px rounded-full border text-[10px] font-semibold ${loc.cls}`} title={loc.title}>
      <loc.Icon size={10} /> {loc.label}
    </span>
  );
}

// Đồng hồ chạy trong lúc Trợ lý AI đang trả lời
function Elapsed({ since }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const start = toDate(since);
  return start ? <span>{formatDuration(Math.max(0, now - start.getTime()))}</span> : null;
}

// Dòng thông tin dưới câu trả lời: giờ bắt đầu → kết thúc · thời lượng · token
function AnswerFooter({ meta, at }) {
  const usage = meta.usage;
  const detail = [
    meta.runtime_name && `Máy chủ AI: ${meta.runtime_name}`,
    meta.first_token_ms != null && `Token đầu tiên sau ${formatDuration(meta.first_token_ms)}`,
    meta.sources != null && `${meta.sources} nguồn trích dẫn từ Kho Tri thức`,
    usage && `Token: ${formatCount(usage.input_tokens)} vào (Prompt + ngữ cảnh) · ${formatCount(usage.output_tokens)} ra (câu trả lời)`,
  ].filter(Boolean).join('\n');
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 mt-0.5 text-[10px] text-fg-subtle" title={detail || undefined}>
      <span className="inline-flex items-center gap-1">
        <Clock size={10} />
        {formatClock(meta.started_at || at)}
        {meta.finished_at && !meta.pending && <> → {formatClock(meta.finished_at)}</>}
      </span>
      {meta.pending ? (
        <span className="inline-flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> đang trả lời · <Elapsed since={meta.started_at || at} /></span>
      ) : (
        <>
          {meta.duration_ms != null && <span>· {formatDuration(meta.duration_ms)}</span>}
          {usage && (
            <span className="inline-flex items-center gap-1">· <Coins size={10} /> {formatCount(usage.total_tokens)} token
              <span className="hidden sm:inline">({formatCount(usage.input_tokens)} vào · {formatCount(usage.output_tokens)} ra)</span>
            </span>
          )}
          {meta.status === 'refused' && <span>· không gọi mô hình (Kho Tri thức chưa có thông tin)</span>}
          {meta.status === 'error' && <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">· <CircleAlert size={10} /> lỗi</span>}
        </>
      )}
    </div>
  );
}

export default function ChatMessages({ isLoading, messages, messagesEndRef, userData }) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
        <div className="w-11 h-11 rounded-xl bg-card border-line border flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-lg mb-3">
          <Sparkles size={20} />
        </div>
        <h3 className="text-sm font-bold text-fg mb-1">Chào {userData.userName}!</h3>
        <p className="text-xs text-fg-subtle max-w-md leading-relaxed">Hãy nhập nội dung câu hỏi hoặc gõ dấu `/` để dùng các phím điều hướng nhanh.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 mt-1">
      {messages.map((msg, i) => {
        const isAsst = msg.role === 'assistant';
        const isAnswer = isAsst && !!msg.meta;                 // câu trả lời của mô hình (có meta)
        const kind = !isAsst ? 'user' : isAnswer ? 'assistant' : 'system';
        const streaming = isLoading && i === messages.length - 1;
        // Câu trả lời đang được stream (hoặc chưa có nội dung) thì chưa hiện nút Sao chép / Lưu DOCX
        const isComplete = !!msg.content?.trim() && !streaming;
        const bodyId = `chat-message-body-${i}`;
        const prompt = isAsst && messages[i - 1]?.role === 'user' ? messages[i - 1].content : '';

        if (kind === 'user') {
          return (
            <div key={i} className="flex gap-2 flex-row-reverse">
              <Avatar kind="user" name={userData.userName} />
              <div className="flex flex-col items-end max-w-[85%] sm:max-w-[75%] min-w-0">
                <div className="rounded-2xl rounded-tr-md px-3 py-2 bg-blue-600 text-white shadow-sm max-w-full">
                  <div id={bodyId} className={`${PROSE} prose-invert`}>
                    <Markdown>{msg.content}</Markdown>
                  </div>
                  {isComplete && (
                    <MessageActions content={msg.content} isAsst={false} prompt="" getHtml={() => document.getElementById(bodyId)?.innerHTML} />
                  )}
                </div>
                {msg.at && <span className="px-1 mt-0.5 text-[10px] text-fg-subtle">{formatClock(msg.at)}</span>}
              </div>
            </div>
          );
        }

        const meta = msg.meta || {};
        return (
          <div key={i} className="flex gap-2">
            <Avatar kind={kind} />
            <div className="flex flex-col items-start flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 px-1 mb-0.5 text-[11px]">
                <span className="font-semibold text-fg-muted">{isAnswer ? 'Trợ lý AI' : 'iThunder AI'}</span>
                {isAnswer && meta.model && <span className="font-mono text-fg-subtle truncate max-w-[16rem]" title={meta.runtime_name ? `${meta.model} · ${meta.runtime_name}` : meta.model}>· {meta.model}</span>}
                {isAnswer && <LocationChip location={meta.location} />}
              </div>
              <div className={`rounded-2xl rounded-tl-md px-3 py-2 border shadow-sm max-w-full ${isAnswer ? 'bg-card border-line' : 'bg-elevated border-line'}`}>
                {msg.content ? (
                  <div id={bodyId} className={`${PROSE} dark:prose-invert`}>
                    <Markdown>{msg.content}</Markdown>
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-2 text-xs text-fg-subtle">
                    <Loader2 size={12} className="animate-spin" /> {isAnswer ? 'Đang tra Kho Tri thức và soạn câu trả lời...' : 'Đang xử lý...'}
                  </span>
                )}
                {isComplete && <MessageActions content={msg.content} isAsst prompt={prompt} getHtml={() => document.getElementById(bodyId)?.innerHTML} />}
              </div>
              {isAnswer ? <AnswerFooter meta={meta} at={msg.at} />
                : msg.at && <span className="px-1 mt-0.5 text-[10px] text-fg-subtle">{formatClock(msg.at)}</span>}
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}
