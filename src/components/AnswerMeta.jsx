// Thông tin phiên trả lời của Trợ lý AI, dùng chung cho khung AI Chat/Work và Trao đổi trực tuyến:
// nhãn On-Premises / On-Clouds, dòng giờ bắt đầu → kết thúc · thời lượng · số token (đang trả lời: đồng hồ chạy).
import { useEffect, useState } from 'react';
import { Clock, Coins, Loader2, CircleAlert } from 'lucide-react';
import { LOCATION, formatClock, formatCount, formatDuration, toDate } from './answerFormat';

export function LocationChip({ location }) {
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

/**
 * meta: { pending, started_at, finished_at, duration_ms, first_token_ms, usage, sources, status, runtime_name }
 * at: thời điểm dự phòng khi meta chưa có started_at; className: căn trái / phải theo bong bóng
 */
export function AnswerFooter({ meta, at, className = '' }) {
  const usage = meta.usage;
  const detail = [
    meta.runtime_name && `Máy chủ AI: ${meta.runtime_name}`,
    meta.first_token_ms != null && `Token đầu tiên sau ${formatDuration(meta.first_token_ms)}`,
    meta.sources != null && `${meta.sources} nguồn trích dẫn từ Kho Tri thức`,
    usage && `Token: ${formatCount(usage.input_tokens)} vào (Prompt + ngữ cảnh) · ${formatCount(usage.output_tokens)} ra (câu trả lời)`,
  ].filter(Boolean).join('\n');
  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 mt-0.5 text-[10px] text-fg-subtle ${className}`} title={detail || undefined}>
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
