// Trình xem tập tin Kho Dữ liệu (thay khung hội thoại cho đến khi đóng hoặc gửi câu hỏi mới).
// Tách từ App.jsx: trạng thái và xử lý vẫn nằm ở App, thành phần này chỉ hiển thị và gọi lại qua props.
import {
  Loader2, FileText, RefreshCw, Trash2, Download, X
} from 'lucide-react';
import Markdown from '../components/Markdown';
import { SYNC_STATE, formatDateTime } from './constants';

export default function FileViewer({ canManageActive, closeViewer, dataBusyPath, deleteOneDataFile, downloadDataFile, selectedColDetails, syncOneDataFile, viewer }) {
  return (
    <div className="w-full bg-card border border-line rounded-xl shadow-sm flex flex-col">
      <div className="flex items-start justify-between gap-3 p-4 border-b border-line">
        <div className="min-w-0">
          <div className="text-sm font-bold text-fg-strong flex items-center gap-2">
            <FileText size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="truncate min-w-0">{viewer.name}</span>
          </div>
          <div className="text-[11px] text-fg-subtle mt-0.5 truncate">
            Kho {selectedColDetails.display_name}: {viewer.path} · {viewer.size_display} · cập nhật {formatDateTime(viewer.modified)}
          </div>
          <div className={`text-[11px] mt-0.5 flex items-center gap-1 ${(SYNC_STATE[viewer.sync_state] || SYNC_STATE.not_synced).text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${(SYNC_STATE[viewer.sync_state] || SYNC_STATE.not_synced).dot}`} />
            {(SYNC_STATE[viewer.sync_state] || SYNC_STATE.not_synced).label}
            {viewer.chunk_count ? ` · ${viewer.chunk_count} đoạn tri thức` : ''}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {canManageActive && (
            <button onClick={() => syncOneDataFile(viewer)} disabled={dataBusyPath === viewer.path} title="Đồng bộ tập tin vào Kho Tri thức"
              className="px-2 py-1.5 rounded-lg text-[11px] font-bold bg-elevated border border-line text-fg hover:bg-hover flex items-center gap-1 disabled:opacity-50">
              <RefreshCw size={12} className={`text-blue-600 dark:text-blue-400 ${dataBusyPath === viewer.path ? 'animate-spin' : ''}`} /> RAG
            </button>
          )}
          <button onClick={() => downloadDataFile(viewer)} title="Tải tập tin về máy" className="p-1.5 rounded-lg text-fg-muted hover:text-fg-strong hover:bg-hover"><Download size={14} /></button>
          {canManageActive && (
            <button onClick={() => deleteOneDataFile(viewer)} disabled={dataBusyPath === viewer.path} title="Xóa (chuyển vào thùng rác)" className="p-1.5 rounded-lg text-fg-muted hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 disabled:opacity-50"><Trash2 size={14} /></button>
          )}
          <button onClick={closeViewer} title="Đóng, quay lại hội thoại" className="p-1.5 rounded-lg text-fg-muted hover:text-fg-strong hover:bg-hover"><X size={14} /></button>
        </div>
      </div>
      <div className="p-4">
        {viewer.loading ? (
          <div className="py-16 flex items-center justify-center gap-2 text-xs text-fg-muted"><Loader2 size={14} className="animate-spin" /> Đang mở tập tin...</div>
        ) : viewer.error ? (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-xs rounded-xl">{viewer.error}</div>
        ) : viewer.blobUrl ? (
          <iframe src={viewer.blobUrl} title={viewer.name} className="w-full h-[68vh] rounded-lg border border-line bg-white" />
        ) : viewer.ext === '.md' ? (
          <div className="prose prose-sm dark:prose-invert max-w-none break-words"><Markdown>{viewer.content || ''}</Markdown></div>
        ) : (
          <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words font-mono text-fg">{viewer.content || '(Tập tin không có nội dung văn bản)'}</pre>
        )}
        {viewer.truncated && (
          <div className="mt-3 text-[11px] text-amber-700 dark:text-amber-400">Nội dung quá dài nên chỉ hiển thị phần đầu. Hãy tải tập tin về để xem đầy đủ.</div>
        )}
      </div>
    </div>
  );
}
