/**
 * TARA AI Workspace - Main iThunder AI OS Entry Point (V6.09.27)
 * Tập tin tạo lập môi trường trao đổi thông tin Text/Voice/Video Chat cho người dùng.
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { AlertCircle, ArrowLeft, Bot, Check, CheckCheck, Clock, FileText, Loader2, Paperclip, Pencil, Reply, RotateCw, Send, Trash2, Users, X } from 'lucide-react';
import { Avatar } from './shared';
import { KIND_INFO, conversationTitle, formatDay, formatShortTime, formatSize } from './utils';

// Khung trò chuyện của một hội thoại: tin nhắn (Markdown, không nhận HTML thô), trả lời/sửa/xóa tin của mình,
// tệp đính kèm, luồng trả lời của Trợ lý AI, "đang gõ", "đã xem" (hội thoại trực tiếp).

const TYPING_THROTTLE_MS = 3000;
const markdownComponents = {
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
};

const Attachment = ({ att, onDownload, onRemove }) => (
  <span className="inline-flex items-center gap-1.5 max-w-full pl-2 pr-1 py-1 rounded-lg border border-line bg-elevated text-[11px] text-fg">
    <FileText size={12} className="shrink-0 text-fg-subtle" />
    {onDownload ? (
      <button type="button" onClick={() => onDownload(att)} className="truncate hover:underline text-left" title={`Tải xuống ${att.name}`}>{att.name}</button>
    ) : <span className="truncate">{att.name}</span>}
    <span className="shrink-0 text-fg-subtle">{formatSize(att.size)}</span>
    {onRemove && <button type="button" onClick={onRemove} aria-label={`Bỏ ${att.name}`} className="p-0.5 text-fg-subtle hover:text-fg"><X size={11} /></button>}
  </span>
);

function MessageBubble({ msg, mine, showSender, replied, seen, onReply, onEdit, onDelete, onRetry, onDownload }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.content);

  if (msg.sender_type === 'system') {
    return <div className="text-center text-[11px] text-fg-subtle py-1">{msg.content}</div>;
  }
  const assistant = msg.sender_type === 'assistant';
  const saveEdit = () => {
    if (draft.trim() && draft.trim() !== msg.content) onEdit(msg, draft.trim());
    setEditing(false);
  };

  return (
    <div className={`group flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
      {!mine && (showSender ? <Avatar name={msg.sender_name} kind={assistant ? 'assistant' : undefined} size="sm" /> : <span className="w-7 shrink-0" />)}
      <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${mine ? 'items-end' : 'items-start'}`}>
        {showSender && !mine && <span className="text-[10px] font-semibold text-fg-muted px-1 mb-0.5">{msg.sender_name}</span>}
        {replied && (
          <div className="text-[10px] text-fg-subtle border-l-2 border-line pl-2 mb-1 max-w-full truncate">
            ↪ {replied.sender_name}: {replied.deleted ? 'Tin nhắn đã bị xóa' : replied.content || '[Tệp đính kèm]'}
          </div>
        )}
        <div className={`rounded-2xl px-3 py-2 text-sm break-words max-w-full ${msg.deleted ? 'italic text-fg-subtle bg-elevated border border-line'
          : mine ? 'bg-blue-600 text-white' : assistant ? 'bg-card border border-line' : 'bg-elevated border border-line text-fg'} ${msg.failed ? 'opacity-70' : ''}`}>
          {msg.deleted ? 'Tin nhắn đã bị xóa' : editing ? (
            <div className="flex flex-col gap-1.5 min-w-[220px]">
              <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={3} autoFocus aria-label="Sửa tin nhắn"
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); } if (e.key === 'Escape') setEditing(false); }}
                className="w-full rounded-md p-1.5 text-sm text-fg bg-panel border border-line focus:outline-none" />
              <div className="flex justify-end gap-2 text-[11px]">
                <button type="button" onClick={() => setEditing(false)} className="opacity-80 hover:opacity-100">Hủy</button>
                <button type="button" onClick={saveEdit} className="font-semibold">Lưu</button>
              </div>
            </div>
          ) : (
            <>
              {msg.content && (
                <div className={`prose prose-sm max-w-none break-words ${mine ? 'prose-invert' : 'dark:prose-invert'} [&>*:first-child]:mt-0 [&>*:last-child]:mb-0`}>
                  <ReactMarkdown components={markdownComponents}>{msg.content}</ReactMarkdown>
                </div>
              )}
              {msg.attachments?.length > 0 && (
                <div className={`flex flex-col gap-1 ${msg.content ? 'mt-1.5' : ''}`}>
                  {msg.attachments.map(a => <Attachment key={a.id} att={a} onDownload={msg.pending ? null : onDownload} />)}
                </div>
              )}
            </>
          )}
        </div>
        <div className={`flex items-center gap-1.5 px-1 mt-0.5 text-[10px] text-fg-subtle ${mine ? 'flex-row-reverse' : ''}`}>
          <span>{formatShortTime(msg.created_at)}</span>
          {msg.edited_at && !msg.deleted && <span>· đã sửa</span>}
          {assistant && msg.metadata?.model && <span>· {msg.metadata.model}</span>}
          {mine && (msg.failed ? (
            <button type="button" onClick={() => onRetry(msg)} className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 hover:underline" title={msg.error}>
              <AlertCircle size={11} /> Chưa gửi được · Gửi lại <RotateCw size={10} />
            </button>
          ) : msg.pending ? <Clock size={11} aria-label="Đang gửi" /> : seen ? <CheckCheck size={12} className="text-blue-500" aria-label="Đã xem" /> : <Check size={12} aria-label="Đã gửi" />)}
          {!msg.pending && !msg.deleted && !editing && (
            <span className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex items-center gap-1 transition-opacity">
              <button type="button" onClick={() => onReply(msg)} aria-label="Trả lời" className="p-0.5 hover:text-fg"><Reply size={12} /></button>
              {mine && <button type="button" onClick={() => { setDraft(msg.content); setEditing(true); }} aria-label="Sửa" className="p-0.5 hover:text-fg"><Pencil size={11} /></button>}
              {mine && <button type="button" onClick={() => onDelete(msg)} aria-label="Xóa" className="p-0.5 hover:text-red-500"><Trash2 size={11} /></button>}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Composer({ conversation, limits, assistantAvailable, onSend, onUpload, onTyping }) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);       // tệp đã tải lên máy chủ, chờ gửi kèm
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const boxRef = useRef(null);
  const typingAt = useRef(0);

  useEffect(() => { setText(''); setFiles([]); setError(''); }, [conversation.id]);
  // Ô soạn tin cao theo nội dung, tối đa 160px rồi mới cuộn
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    el.style.overflowY = el.scrollHeight > 160 ? 'auto' : 'hidden';
  }, [text]);

  const submit = () => {
    if ((!text.trim() && files.length === 0) || uploading) return;
    onSend({ content: text.trim(), attachments: files });
    setText('');
    setFiles([]);
  };
  const change = (value) => {
    setText(value);
    if (value && Date.now() - typingAt.current > TYPING_THROTTLE_MS) { typingAt.current = Date.now(); onTyping(); }
  };
  const pickFiles = async (list) => {
    setError('');
    for (const file of Array.from(list || [])) {
      if (file.size > limits.attachment_max_mb * 1024 * 1024) { setError(`"${file.name}" vượt quá ${limits.attachment_max_mb} MB.`); continue; }
      setUploading(n => n + 1);
      const res = await onUpload(file);
      setUploading(n => n - 1);
      if (res?.status === 'SUCCESS') setFiles(f => [...f, res.attachment].slice(0, 10));
      else setError(res?.detail || `Không tải được "${file.name}".`);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const placeholder = conversation.kind === 'assistant' ? 'Hỏi Trợ lý AI... (Enter để gửi, Shift+Enter xuống dòng)'
    : assistantAvailable ? 'Nhập tin nhắn... gõ @ai để hỏi Trợ lý AI' : 'Nhập tin nhắn...';
  return (
    <div className="border-t border-line bg-panel px-3 sm:px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-col gap-2">
      {(files.length > 0 || uploading > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {files.map(f => <Attachment key={f.id} att={f} onRemove={() => setFiles(fs => fs.filter(x => x.id !== f.id))} />)}
          {uploading > 0 && <span className="inline-flex items-center gap-1 text-[11px] text-fg-subtle"><Loader2 size={12} className="animate-spin" /> Đang tải tệp...</span>}
        </div>
      )}
      {error && <span className="text-[11px] text-red-600 dark:text-red-400">{error}</span>}
      <div className="flex items-end gap-2">
        <input ref={fileRef} type="file" multiple hidden accept={limits.attachment_extensions.join(',')} onChange={e => pickFiles(e.target.files)} />
        <button type="button" onClick={() => fileRef.current?.click()} aria-label="Đính kèm tệp" title={`Đính kèm tệp (tối đa ${limits.attachment_max_mb} MB)`}
          className="p-2 rounded-lg text-fg-muted hover:bg-hover hover:text-fg-strong shrink-0"><Paperclip size={16} /></button>
        <textarea ref={boxRef} value={text} onChange={e => change(e.target.value)} rows={1} maxLength={limits.message_max_chars} placeholder={placeholder} aria-label="Nội dung tin nhắn"
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
          className="flex-1 min-w-0 resize-none overflow-hidden bg-elevated border border-line rounded-xl px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
        <button type="button" onClick={submit} disabled={(!text.trim() && files.length === 0) || uploading > 0} aria-label="Gửi"
          className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 shrink-0"><Send size={16} /></button>
      </div>
    </div>
  );
}

export default function ChatPane({ conversation, me, thread, aiStream, typingNames, status, limits, assistantAvailable, replyTo, setReplyTo,
  onBack, onOpenMembers, onLoadOlder, onSend, onRetry, onEdit, onDelete, onUpload, onDownload, onTyping }) {
  const scrollRef = useRef(null);
  const nearBottom = useRef(true);
  const prevHeight = useRef(null);
  // useMemo: khi chưa có thread, [] không được tạo mới mỗi lần render (tránh chạy lại useLayoutEffect cuộn trang)
  const items = useMemo(() => thread?.items || [], [thread?.items]);
  const byId = new Map(items.map(m => [m.id, m]));
  const peer = conversation.kind === 'direct' ? conversation.members.find(m => m.user_id !== me) : null;
  const online = conversation.members.filter(m => m.online).length;
  const KindIcon = KIND_INFO[conversation.kind].icon;

  // Giữ vị trí khi tải tin cũ; tự cuộn xuống khi có tin mới nếu đang ở cuối
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (prevHeight.current !== null) {
      el.scrollTop += el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
    } else if (nearBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [items, aiStream?.text]);
  useEffect(() => { nearBottom.current = true; }, [conversation.id]);

  const loadOlder = () => {
    prevHeight.current = scrollRef.current?.scrollHeight ?? null;
    onLoadOlder();
  };
  const onScroll = (e) => {
    const el = e.currentTarget;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 40 && thread?.hasMore && !thread.loading) loadOlder();
  };

  return (
    <section className="flex-1 min-w-0 flex flex-col bg-app">
      <header className="h-14 shrink-0 border-b border-line bg-panel px-3 sm:px-4 flex items-center gap-3">
        <button onClick={onBack} aria-label="Danh sách hội thoại" className="md:hidden p-1.5 rounded-lg hover:bg-hover text-fg-muted"><ArrowLeft size={16} /></button>
        <Avatar name={conversationTitle(conversation, me)} kind={conversation.kind} online={peer ? peer.online : undefined} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-fg-strong truncate">{conversationTitle(conversation, me)}</div>
          <div className="text-[11px] text-fg-muted truncate flex items-center gap-1">
            <KindIcon size={11} />
            {peer ? (peer.online ? 'Đang trực tuyến' : 'Ngoại tuyến')
              : `${conversation.members.length} thành viên · ${online} trực tuyến${conversation.ldap_unit ? ` · OpenLDAP ${conversation.ldap_unit}` : ''}`}
            {conversation.kind !== 'direct' && conversation.metadata?.domain && <span>· Kho {conversation.metadata.domain}</span>}
          </div>
        </div>
        <button onClick={onOpenMembers} aria-label="Thông tin hội thoại" className="p-2 rounded-lg hover:bg-hover text-fg-muted hover:text-fg-strong"><Users size={16} /></button>
      </header>

      {status !== 'online' && (
        <div className="px-4 py-1.5 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900/40">
          {status === 'connecting' ? 'Đang kết nối máy chủ Trao đổi trực tuyến...' : 'Mất kết nối thời gian thực: tin mới gửi qua API, đang thử kết nối lại...'}
        </div>
      )}

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 flex flex-col gap-2">
        {thread?.hasMore && (
          <button onClick={loadOlder} disabled={thread.loading} className="self-center text-[11px] text-fg-muted hover:text-fg px-3 py-1 rounded-full border border-line bg-panel">
            {thread.loading ? 'Đang tải...' : 'Tải tin cũ hơn'}
          </button>
        )}
        {!thread?.loaded ? (
          <div className="m-auto text-xs text-fg-subtle flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Đang tải tin nhắn...</div>
        ) : items.length === 0 && !aiStream ? (
          <div className="m-auto text-center text-xs text-fg-subtle max-w-xs">
            {conversation.kind === 'assistant' ? 'Đặt câu hỏi để bắt đầu trao đổi với Trợ lý AI.' : 'Chưa có tin nhắn. Hãy gửi lời chào!'}
          </div>
        ) : items.map((msg, i) => {
          const prev = items[i - 1];
          const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(msg.created_at).toDateString();
          const mine = msg.sender_id === me && msg.sender_type === 'user';
          const sameAuthor = prev && !newDay && prev.sender_id === msg.sender_id && prev.sender_type === msg.sender_type;
          const showSender = !sameAuthor && (conversation.kind !== 'direct' || msg.sender_type === 'assistant');
          return (
            <React.Fragment key={msg.client_msg_id && msg.pending ? msg.client_msg_id : msg.id}>
              {newDay && <div className="self-center text-[10px] font-semibold text-fg-subtle uppercase tracking-wider py-2">{formatDay(msg.created_at)}</div>}
              <MessageBubble msg={msg} mine={mine} showSender={showSender}
                replied={msg.reply_to ? byId.get(msg.reply_to) : null}
                seen={peer && typeof msg.id === 'number' && peer.last_read_id >= msg.id}
                onReply={setReplyTo} onEdit={onEdit} onDelete={onDelete} onRetry={onRetry} onDownload={onDownload} />
            </React.Fragment>
          );
        })}
        {aiStream && (
          <div className="flex gap-2">
            <Avatar name="Trợ lý AI" kind="assistant" size="sm" />
            <div className="flex flex-col items-start max-w-[85%] sm:max-w-[75%]">
              <span className="text-[10px] font-semibold text-fg-muted px-1 mb-0.5 flex items-center gap-1"><Bot size={11} /> Trợ lý AI · {aiStream.model}</span>
              <div className="rounded-2xl px-3 py-2 text-sm bg-card border border-line break-words max-w-full">
                {aiStream.text ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"><ReactMarkdown components={markdownComponents}>{aiStream.text}</ReactMarkdown></div>
                ) : <span className="inline-flex items-center gap-2 text-xs text-fg-subtle"><Loader2 size={12} className="animate-spin" /> {aiStream.status || 'Đang suy nghĩ...'}</span>}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="h-5 px-4 text-[11px] text-fg-subtle italic truncate">
        {typingNames.length > 0 && `${typingNames.slice(0, 3).join(', ')}${typingNames.length > 3 ? '...' : ''} đang gõ...`}
      </div>
      {replyTo && (
        <div className="mx-3 sm:mx-4 mb-1 px-3 py-1.5 rounded-lg bg-elevated border border-line text-[11px] text-fg-muted flex items-center gap-2">
          <Reply size={12} className="shrink-0" />
          <span className="flex-1 truncate">Trả lời <b>{replyTo.sender_name}</b>: {replyTo.content || '[Tệp đính kèm]'}</span>
          <button onClick={() => setReplyTo(null)} aria-label="Bỏ trả lời" className="p-0.5 hover:text-fg"><X size={12} /></button>
        </div>
      )}
      <Composer conversation={conversation} limits={limits} assistantAvailable={assistantAvailable}
        onSend={onSend} onUpload={onUpload} onTyping={onTyping} />
    </section>
  );
}
