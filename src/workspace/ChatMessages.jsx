// Lời chào khi chưa có hội thoại, hoặc danh sách tin nhắn của phiên AI Chat/Work.
// Cùng phong cách với khung Chat của Trao đổi trực tuyến: avatar, tên, bong bóng cỡ chữ nhỏ (prose-sm), câu hỏi nền xanh;
// dưới câu trả lời của Trợ lý AI: mô hình, On-Premises / On-Clouds, giờ bắt đầu - kết thúc, thời lượng, số token.
// Tin nhắn assistant có meta là câu trả lời của mô hình; không có meta là thông báo hệ thống (lệnh nhanh, tải tệp...).
import { Sparkles, Bot, Loader2, Info } from 'lucide-react';
import Markdown from '../components/Markdown';
import MessageActions from '../components/MessageActions';
import { LocationChip, AnswerFooter } from '../components/AnswerMeta';
import { PROSE, formatClock } from '../components/answerFormat';

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
