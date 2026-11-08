/**
 * TARA AI Workspace - Main iThunder AI OS Entry Point (V6.11.01)
 * Tập tin tạo lập môi trường AI Workspace cho người dùng.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, MessagesSquare, Plus, Search } from 'lucide-react';
import { commAPI } from '../services/api';
import { CommSocket } from '../services/commSocket';
import { Button, Notice, inputCls } from './identity/shared';
import { Avatar } from './comm/shared';
import { conversationTitle, formatShortTime, newClientId } from './comm/utils';
import ChatPane from './comm/ChatPane';
import MembersDialog from './comm/MembersDialog';
import NewConversationDialog from './comm/NewConversationDialog';

// Trang Trao đổi trực tuyến (Text Chat): người dùng ↔ người dùng, ↔ nhóm, ↔ Trợ lý AI.
// Mọi tin nhắn, thành viên, tệp đính kèm nằm trên Backend (PostgreSQL); trang chỉ giữ trong bộ nhớ và tải lại
// qua /api/comm khi mở trang hoặc khi kết nối lại /ws/comm. Hội thoại đang mở nằm trên URL (?c=<mã>).

const TYPING_SHOW_MS = 4000;

const STATUS_CHIP = {
  online: { label: 'Trực tuyến', cls: 'bg-emerald-500' },
  connecting: { label: 'Đang kết nối', cls: 'bg-amber-500 animate-pulse' },
  offline: { label: 'Mất kết nối', cls: 'bg-slate-400' },
};

const preview = (msg, me) => {
  if (!msg) return 'Chưa có tin nhắn';
  if (msg.deleted) return 'Tin nhắn đã bị xóa';
  const who = msg.sender_type === 'system' ? '' : msg.sender_id === me && msg.sender_type === 'user' ? 'Bạn: ' : msg.sender_type === 'assistant' ? 'AI: ' : '';
  const text = msg.content.replace(/[*_`#>~]+/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim();   // bỏ ký hiệu Markdown
  return who + (text || `📎 ${msg.attachments?.[0]?.name || 'Tệp đính kèm'}`);
};

export default function CommManager() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeId = Number(searchParams.get('c')) || null;

  const [info, setInfo] = useState(null);
  const [notice, setNotice] = useState(null);
  const [status, setStatus] = useState('connecting');
  const [conversations, setConversations] = useState(null);
  const [detail, setDetail] = useState(null);
  const [threads, setThreads] = useState({});        // conv_id -> { items, hasMore, loaded, loading }
  const [aiStreams, setAiStreams] = useState({});    // conv_id -> { stream_id, text, model }
  const [typing, setTyping] = useState({});          // conv_id -> { user_id: { name, until } }
  const [replyTo, setReplyTo] = useState(null);
  const [filter, setFilter] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showMembers, setShowMembers] = useState(false);

  const socketRef = useRef(null);
  const activeRef = useRef(activeId);
  const lastReadRef = useRef({});
  const handlerRef = useRef(() => {});
  const convsRef = useRef(null);
  const connectedOnce = useRef(false);
  activeRef.current = activeId;
  convsRef.current = conversations;
  const me = info?.user_id;

  const openConversation = useCallback((id) => {
    setReplyTo(null);
    setSearchParams(id ? { c: String(id) } : {}, { replace: !id });
  }, [setSearchParams]);

  // ------------------------------------------------------------------ tải dữ liệu
  const loadConversations = useCallback(async () => {
    const res = await commAPI.listConversations();
    if (res?.status === 'SUCCESS') setConversations(res.conversations);
    else setNotice({ type: 'error', text: res?.detail || 'Không tải được danh sách hội thoại.' });
  }, []);

  const loadDetail = useCallback(async (id) => {
    const res = await commAPI.getConversation(id);
    if (activeRef.current !== id) return;
    if (res?.status === 'SUCCESS') { setDetail(res.conversation); return; }
    setDetail(null);
    if (res?.httpStatus === 404) {
      setConversations(cs => cs?.filter(c => c.id !== id) ?? cs);
      openConversation(null);
    }
    setNotice({ type: 'error', text: res?.detail || 'Không mở được hội thoại.' });
  }, [openConversation]);

  const loadMessages = useCallback(async (id, before) => {
    setThreads(t => ({ ...t, [id]: { items: [], hasMore: false, loaded: false, ...t[id], loading: true } }));
    const res = await commAPI.listMessages(id, before);
    setThreads(t => {
      const prev = t[id] || { items: [] };
      if (res?.status !== 'SUCCESS') return { ...t, [id]: { ...prev, loading: false, loaded: true } };
      const pending = before ? [] : prev.items.filter(m => m.pending || m.failed);
      const items = before ? [...res.messages, ...prev.items] : [...res.messages, ...pending];
      return { ...t, [id]: { items, hasMore: res.has_more, loaded: true, loading: false } };
    });
    if (res?.status !== 'SUCCESS') setNotice({ type: 'error', text: res?.detail || 'Không tải được tin nhắn.' });
  }, []);

  // ------------------------------------------------------------------ cập nhật trạng thái theo tin nhắn / sự kiện
  const upsertMessage = useCallback((msg) => {
    setThreads(t => {
      const th = t[msg.conversation_id];
      if (!th?.loaded) return t;
      const same = (m) => m.id === msg.id || (msg.client_msg_id && m.client_msg_id === msg.client_msg_id && m.sender_id === msg.sender_id);
      const idx = th.items.findIndex(same);
      const items = idx >= 0 ? th.items.map((m, i) => (i === idx ? msg : m))
        : [...th.items.filter(m => !m.pending && !m.failed), msg, ...th.items.filter(m => m.pending || m.failed)];
      return { ...t, [msg.conversation_id]: { ...th, items } };
    });
  }, []);

  const noteInList = useCallback((msg) => {
    if (convsRef.current && !convsRef.current.some(c => c.id === msg.conversation_id)) { loadConversations(); return; }   // hội thoại mới
    setConversations(cs => {
      const conv = cs?.find(c => c.id === msg.conversation_id);
      if (!conv || conv.last_message?.id === msg.id) return cs;
      const viewing = activeRef.current === conv.id && document.visibilityState === 'visible';
      const updated = { ...conv, last_message: msg, last_msg_at: msg.created_at, unread: conv.unread + (msg.sender_id !== info?.user_id && !viewing ? 1 : 0) };
      return [updated, ...cs.filter(c => c.id !== conv.id)];
    });
  }, [info, loadConversations]);

  handlerRef.current = (frame) => {
    const convId = frame.conversation_id ?? frame.message?.conversation_id;
    switch (frame.type) {
      case 'ready':
        // Kết nối lại: đọc lại từ máy chủ những gì có thể đã lỡ trong lúc rớt mạng
        if (!connectedOnce.current) { connectedOnce.current = true; break; }
        loadConversations();
        if (activeRef.current) { loadDetail(activeRef.current); loadMessages(activeRef.current); }
        break;
      case 'message':
        upsertMessage(frame.message);
        noteInList(frame.message);
        setTyping(t => (t[convId]?.[frame.message.sender_id] ? { ...t, [convId]: { ...t[convId], [frame.message.sender_id]: undefined } } : t));
        break;
      case 'message_updated':
        upsertMessage(frame.message);
        setConversations(cs => cs?.map(c => (c.last_message?.id === frame.message.id ? { ...c, last_message: frame.message } : c)) ?? cs);
        break;
      case 'read':
        if (frame.user_id === info?.user_id) setConversations(cs => cs?.map(c => (c.id === convId ? { ...c, unread: 0 } : c)) ?? cs);
        else setDetail(d => (d?.id === convId ? { ...d, members: d.members.map(m => (m.user_id === frame.user_id ? { ...m, last_read_id: Math.max(m.last_read_id, frame.message_id) } : m)) } : d));
        break;
      case 'typing':
        setTyping(t => ({ ...t, [convId]: { ...t[convId], [frame.user_id]: { name: frame.user_name, until: Date.now() + TYPING_SHOW_MS } } }));
        setTimeout(() => setTyping(t => ({ ...t })), TYPING_SHOW_MS + 50);
        break;
      case 'presence':
        setConversations(cs => cs?.map(c => (c.peer?.user_id === frame.user_id ? { ...c, peer: { ...c.peer, online: frame.online } } : c)) ?? cs);
        setDetail(d => (d ? { ...d, members: d.members.map(m => (m.user_id === frame.user_id ? { ...m, online: frame.online } : m)) } : d));
        break;
      case 'conversation':
        loadConversations();
        if (activeRef.current === convId) loadDetail(convId);
        break;
      case 'ai_start':
        setAiStreams(s => ({ ...s, [convId]: { stream_id: frame.stream_id, text: '', model: frame.model } }));
        break;
      case 'ai_status':
        setAiStreams(s => (s[convId]?.stream_id === frame.stream_id ? { ...s, [convId]: { ...s[convId], status: frame.text } } : s));
        break;
      case 'ai_delta':
        setAiStreams(s => (s[convId]?.stream_id === frame.stream_id ? { ...s, [convId]: { ...s[convId], text: s[convId].text + frame.text } } : s));
        break;
      case 'ai_done':
        setAiStreams(s => { const n = { ...s }; delete n[convId]; return n; });
        if (frame.message) { upsertMessage(frame.message); noteInList(frame.message); }
        else if (activeRef.current === convId) setNotice({ type: 'error', text: frame.error });
        break;
      case 'error':
        if (frame.ref === undefined && frame.detail && frame.code !== 4401) setNotice({ type: 'error', text: frame.detail });
        break;
      default:
    }
  };

  // ------------------------------------------------------------------ khởi động: quyền, danh sách, kết nối /ws/comm
  useEffect(() => {
    let socket = null;
    commAPI.getInfo().then(res => {
      if (res?.status !== 'SUCCESS') { setNotice({ type: 'error', text: res?.detail || 'Không tải được thông tin Trao đổi trực tuyến.' }); return; }
      setInfo(res);
      if (!res.allowed) return;
      loadConversations();
      socket = new CommSocket({ onEvent: (f) => handlerRef.current(f), onStatus: setStatus });
      socketRef.current = socket;
      socket.connect();
    });
    return () => { socket?.close(); socketRef.current = null; };
  }, [loadConversations]);

  useEffect(() => {
    setDetail(d => (d?.id === activeId ? d : null));
    if (!activeId || !info?.allowed) return;
    loadDetail(activeId);
    loadMessages(activeId);
  }, [activeId, info, loadDetail, loadMessages]);

  // Đánh dấu đã đọc tin cuối của hội thoại đang mở (khi trang đang hiển thị)
  const activeItems = activeId ? threads[activeId]?.items : null;
  useEffect(() => {
    const markRead = () => {
      if (!activeId || !activeItems?.length || document.visibilityState !== 'visible') return;
      const last = [...activeItems].reverse().find(m => typeof m.id === 'number');
      if (!last || last.id <= (lastReadRef.current[activeId] || 0)) return;
      lastReadRef.current[activeId] = last.id;
      if (!socketRef.current?.send({ type: 'read', conversation_id: activeId, message_id: last.id })) commAPI.markRead(activeId, last.id);
      setConversations(cs => cs?.map(c => (c.id === activeId ? { ...c, unread: 0 } : c)) ?? cs);
    };
    markRead();
    document.addEventListener('visibilitychange', markRead);
    return () => document.removeEventListener('visibilitychange', markRead);
  }, [activeId, activeItems]);

  // ------------------------------------------------------------------ thao tác
  const sendMessage = async ({ content, attachments }, retry) => {
    const convId = activeId;
    const clientId = retry?.client_msg_id || newClientId();
    const reply = retry ? retry.reply_to : replyTo?.id ?? null;
    const pending = {
      id: `tmp-${clientId}`, conversation_id: convId, client_msg_id: clientId, sender_id: me, sender_name: info.user_name,
      sender_type: 'user', kind: attachments.length ? 'file' : 'text', content, attachments, reply_to: reply,
      created_at: new Date().toISOString(), pending: true,
    };
    upsertMessage(pending);
    setReplyTo(null);
    const frame = {
      conversation_id: convId, content, client_msg_id: clientId, reply_to: reply, attachments: attachments.map(a => a.id),
      aimodel: localStorage.getItem('tara_model') || undefined, runtime: localStorage.getItem('tara_runtime') || undefined,
    };
    let message = null, error = null;
    const viaSocket = socketRef.current?.request({ type: 'send', ...frame });
    if (viaSocket) {
      const res = await viaSocket;
      if (res.type === 'ack') message = res.message; else error = res.detail;
    } else {
      const res = await commAPI.sendMessage(convId, frame);
      if (res?.status === 'SUCCESS') message = res.message; else error = res?.detail;
    }
    if (message) { upsertMessage(message); noteInList(message); }
    else upsertMessage({ ...pending, pending: false, failed: true, error: error || 'Không gửi được tin nhắn.' });
  };

  const editMessage = async (msg, content) => {
    const res = await commAPI.editMessage(msg.id, content);
    if (res?.status === 'SUCCESS') upsertMessage(res.message);
    else setNotice({ type: 'error', text: res?.detail || 'Không sửa được tin nhắn.' });
  };

  const deleteMessage = async (msg) => {
    if (!window.confirm('Xóa tin nhắn này? Mọi thành viên sẽ thấy "Tin nhắn đã bị xóa".')) return;
    const res = await commAPI.deleteMessage(msg.id);
    if (res?.status === 'SUCCESS') upsertMessage(res.message);
    else setNotice({ type: 'error', text: res?.detail || 'Không xóa được tin nhắn.' });
  };

  const downloadAttachment = async (att) => {
    const blob = await commAPI.downloadAttachment(activeId, att.id);
    if (!(blob instanceof Blob)) { setNotice({ type: 'error', text: blob?.detail || 'Không tải được tệp.' }); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = att.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // ------------------------------------------------------------------ giao diện
  const term = filter.trim().toLowerCase();
  const visible = (conversations || []).filter(c => !term || conversationTitle(c, me).toLowerCase().includes(term));
  const typingNames = Object.values(typing[activeId] || {}).filter(t => t && t.until > Date.now()).map(t => t.name);
  const chip = STATUS_CHIP[status];

  return (
    <div className="w-screen h-app flex flex-col bg-app text-fg font-sans antialiased overflow-hidden">
      <header className="h-14 border-b border-line bg-panel px-4 sm:px-6 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate('/')} aria-label="Về AI Workspace" className="p-1.5 rounded-lg hover:bg-hover text-fg-muted hover:text-fg-strong transition-all">
          <ArrowLeft size={16} />
        </button>
        <MessagesSquare size={16} className="text-fg-muted" />
        <span className="text-sm font-bold uppercase tracking-wider text-fg truncate">Trao đổi trực tuyến</span>
        <span className="hidden md:inline text-xs text-fg-muted truncate">Người dùng · Nhóm · Trợ lý AI</span>
        {info?.allowed && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-fg-muted" role="status">
            <span className={`w-2 h-2 rounded-full ${chip.cls}`} />{chip.label}
          </span>
        )}
      </header>
      {notice && <div className="px-4 pt-3"><Notice notice={notice} onClose={() => setNotice(null)} /></div>}

      {info && !info.allowed && (
        <div className="p-6"><Notice notice={{ type: 'info', text: `Vai trò của bạn không được dùng Trao đổi trực tuyến (tài khoản Khách dùng chung không lưu được hội thoại riêng).` }} /></div>
      )}

      {info?.allowed && (
        <div className="flex-1 flex min-h-0">
          <aside className={`${activeId ? 'hidden md:flex' : 'flex'} w-full md:w-80 shrink-0 flex-col border-r border-line bg-panel`}>
            <div className="p-3 flex gap-2 border-b border-line">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
                <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Tìm hội thoại..." aria-label="Tìm hội thoại" className={`${inputCls} pl-8`} />
              </div>
              <Button variant="primary" icon={Plus} onClick={() => setShowNew(true)} aria-label="Hội thoại mới" />
            </div>
            <ul className="flex-1 overflow-y-auto">
              {conversations === null ? (
                <li className="p-4 text-xs text-fg-subtle flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Đang tải...</li>
              ) : visible.length === 0 ? (
                <li className="p-6 text-center text-xs text-fg-subtle">
                  {term ? 'Không có hội thoại phù hợp.' : 'Chưa có hội thoại nào. Bấm + để nhắn tin cho đồng nghiệp, tạo nhóm hoặc hỏi Trợ lý AI.'}
                </li>
              ) : visible.map(c => (
                <li key={c.id}>
                  <button onClick={() => openConversation(c.id)} aria-current={c.id === activeId ? 'true' : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${c.id === activeId ? 'bg-active' : 'hover:bg-hover'}`}>
                    <Avatar name={conversationTitle(c, me)} kind={c.kind} online={c.peer ? c.peer.online : undefined} />
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className={`flex-1 truncate text-xs ${c.unread ? 'font-bold text-fg-strong' : 'font-semibold text-fg'}`}>{conversationTitle(c, me)}</span>
                        <span className="text-[10px] text-fg-subtle shrink-0">{formatShortTime(c.last_message?.created_at || c.last_msg_at)}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className={`flex-1 truncate text-[11px] ${c.unread ? 'text-fg' : 'text-fg-subtle'}`}>
                          {aiStreams[c.id] ? 'Trợ lý AI đang trả lời...' : preview(c.last_message, me)}
                        </span>
                        {c.unread > 0 && <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">{c.unread > 99 ? '99+' : c.unread}</span>}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {detail && detail.id === activeId ? (
            <ChatPane conversation={detail} me={me} thread={threads[activeId]} aiStream={aiStreams[activeId]} typingNames={typingNames}
              status={status} limits={info.limits} assistantAvailable={info.assistant_available} replyTo={replyTo} setReplyTo={setReplyTo}
              onBack={() => openConversation(null)} onOpenMembers={() => setShowMembers(true)}
              onLoadOlder={() => loadMessages(activeId, threads[activeId]?.items.find(m => typeof m.id === 'number')?.id)}
              onSend={(data) => sendMessage(data)} onRetry={(msg) => sendMessage(msg, msg)} onEdit={editMessage} onDelete={deleteMessage}
              onUpload={(file) => commAPI.uploadAttachment(activeId, file)} onDownload={downloadAttachment}
              onTyping={() => socketRef.current?.send({ type: 'typing', conversation_id: activeId })} />
          ) : (
            <div className={`${activeId ? 'flex' : 'hidden md:flex'} flex-1 items-center justify-center text-xs text-fg-subtle`}>
              {activeId ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Đang mở hội thoại...</span>
                : <span className="flex flex-col items-center gap-2"><MessagesSquare size={28} className="opacity-40" />Chọn một hội thoại hoặc bấm + để bắt đầu.</span>}
            </div>
          )}
        </div>
      )}

      {showNew && info && (
        <NewConversationDialog info={info} onClose={() => setShowNew(false)}
          onCreated={(conv) => { setShowNew(false); loadConversations(); openConversation(conv.id); }} />
      )}
      {showMembers && detail && (
        <MembersDialog conversation={detail} me={me} storages={info.storages} onClose={() => setShowMembers(false)}
          onChanged={() => { loadDetail(detail.id); loadConversations(); }}
          onLeft={() => { setShowMembers(false); setConversations(cs => cs?.filter(c => c.id !== detail.id) ?? cs); openConversation(null); }} />
      )}
    </div>
  );
}
