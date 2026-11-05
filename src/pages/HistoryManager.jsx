/**
 * TARA AI Workspace - Main iThunder AI OS Entry Point (V6.11.03)
 * Lịch sử Làm việc: các phiên hội thoại RAG của chính người dùng trên mọi Kho Tri thức (xem lại, tiếp tục, xóa).
 * Chính sách lưu lịch sử theo vai trò do Backend quyết định (config.py: CHAT_HISTORY_ROLES).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, Bot, Database, FolderKanban, History, MessageSquare, Play, RefreshCw, Trash2, User } from 'lucide-react';
import iThunderAPI, { requestOpenThread } from '../services/api';
import { Button, Notice, controlCls, formatDateTime } from './identity/shared';

const ALL = '';

export default function HistoryManager() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [domain, setDomain] = useState(ALL);
  const [result, setResult] = useState(null);           // { items, chat_history_enabled }
  const [stores, setStores] = useState([]);
  const [notice, setNotice] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState(null);       // null: đang tải | [] | [...]
  const detailRequestRef = useRef(0);

  useEffect(() => {
    iThunderAPI.getCollections().then(data => Array.isArray(data) && setStores(data)).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {   // chờ người dùng gõ xong ô tìm kiếm
      try {
        const res = await iThunderAPI.getAllThreads(q.trim(), domain);
        if (cancelled) return;
        if (Array.isArray(res?.items)) { setResult(res); setNotice(null); }
        else setNotice({ type: 'error', text: res?.detail || 'Không tải được lịch sử làm việc.' });
      } catch {
        if (!cancelled) setNotice({ type: 'error', text: 'Không kết nối được AI Gateway.' });
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, domain, reloadKey]);

  const storeName = useMemo(() => {
    const names = Object.fromEntries(stores.map(s => [s.storage_key, s.scope === 'cloud' ? s.cloud?.name || s.display_name : s.display_name]));
    return (key) => names[key] || key || '—';
  }, [stores]);

  const openThread = async (thread) => {
    const request = ++detailRequestRef.current;
    setSelected(thread);
    setMessages(null);
    try {
      const data = await iThunderAPI.getChatHistory(thread.thread_id);
      if (request !== detailRequestRef.current) return;
      setMessages(Array.isArray(data) ? data : []);
      if (!Array.isArray(data)) setNotice({ type: 'error', text: data?.detail || 'Phiên hội thoại không tồn tại hoặc không thuộc về bạn.' });
    } catch {
      if (request === detailRequestRef.current) setMessages([]);
    }
  };

  const continueThread = (thread) => {
    requestOpenThread(thread);
    navigate('/');
  };

  const removeThread = async (thread) => {
    if (!window.confirm(`Xóa vĩnh viễn phiên "${thread.title || thread.thread_id}" và ${thread.message_count} tin nhắn?`)) return;
    try {
      const res = await iThunderAPI.deleteThread(thread.thread_id);
      if (res?.status !== 'SUCCESS') { setNotice({ type: 'error', text: res?.detail || 'Không xóa được phiên hội thoại.' }); return; }
      setNotice({ type: 'success', text: res.detail });
      if (selected?.thread_id === thread.thread_id) { setSelected(null); setMessages(null); }
      setReloadKey(k => k + 1);
    } catch {
      setNotice({ type: 'error', text: 'Không kết nối được AI Gateway.' });
    }
  };

  const items = result?.items || [];
  const domainOptions = [...new Set([...stores.map(s => s.storage_key), ...items.map(i => i.domain).filter(Boolean)])];

  return (
    <div className="w-screen h-app flex flex-col bg-app text-fg font-sans antialiased overflow-hidden">
      <header className="h-14 border-b border-line bg-panel px-6 max-md:px-4 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate('/')} aria-label="Về AI Workspace" className="p-1.5 rounded-lg hover:bg-hover text-fg-muted hover:text-fg-strong transition-all">
          <ArrowLeft size={16} />
        </button>
        <span className="text-sm font-bold uppercase tracking-wider text-fg truncate">Lịch sử Làm việc</span>
        <span className="hidden md:inline text-xs text-fg-muted truncate">Phiên hội thoại với Trợ lý AI trên các Kho Tri thức</span>
      </header>

      <main className="flex-1 min-h-0 p-6 max-md:p-4 flex flex-col gap-3 overflow-y-auto lg:overflow-hidden">
        <Notice notice={notice} onClose={() => setNotice(null)} />
        {result && result.chat_history_enabled === false && (
          <Notice notice={{ type: 'info', text: 'Hệ thống không lưu lịch sử hội thoại cho vai trò của bạn: các phiên mới sẽ không xuất hiện ở đây.' }} />
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input aria-label="Tìm theo tên phiên" value={q} onChange={e => setQ(e.target.value)}
            placeholder="Tìm theo tên phiên hội thoại" className={`${controlCls} flex-1 min-w-[12rem]`} />
          <select aria-label="Lọc theo Kho Tri thức" value={domain} onChange={e => setDomain(e.target.value)} className={`${controlCls} max-w-full`}>
            <option value={ALL}>Mọi Kho Tri thức</option>
            {domainOptions.map(key => <option key={key} value={key}>{storeName(key)}</option>)}
          </select>
          <Button icon={RefreshCw} onClick={() => setReloadKey(k => k + 1)}>Làm mới</Button>
        </div>

        <div className="flex-1 min-h-0 grid gap-3 lg:grid-cols-[minmax(18rem,26rem)_1fr]">
          <section className="min-h-0 flex flex-col gap-1.5 lg:overflow-y-auto" aria-label="Danh sách phiên">
            {result === null && !notice && <p className="text-xs text-fg-subtle italic py-4 text-center">Đang tải...</p>}
            {result && items.length === 0 && (
              <p className="text-xs text-fg-subtle italic py-4 text-center">{q || domain ? 'Không có phiên nào phù hợp.' : 'Chưa có phiên hội thoại nào được lưu.'}</p>
            )}
            {items.map(t => {
              const active = selected?.thread_id === t.thread_id;
              const cloud = t.domain.includes('/');
              return (
                <button key={t.thread_id} onClick={() => openThread(t)}
                  className={`text-left border rounded-xl px-3 py-2.5 transition-all ${active ? 'bg-blue-600/10 border-blue-500/40' : 'border-line hover:bg-hover'}`}>
                  <div className="flex items-start gap-2 min-w-0">
                    <MessageSquare size={13} className={`shrink-0 mt-0.5 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-fg-subtle'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-fg-strong truncate">{t.title || t.thread_id}</div>
                      <div className="flex items-center gap-1 text-[10px] text-fg-subtle mt-0.5 min-w-0">
                        {cloud ? <FolderKanban size={10} className="shrink-0" /> : <Database size={10} className="shrink-0" />}
                        <span className="truncate">{storeName(t.domain)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0 text-[10px] text-fg-subtle font-mono">
                      <span>{formatDateTime(t.updated_at || t.created_at)}</span>
                      <span>{t.message_count} tin</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </section>

          <section className="min-h-[16rem] border border-line rounded-2xl bg-panel flex flex-col overflow-hidden" aria-label="Nội dung phiên">
            {!selected ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-fg-subtle p-6 text-center">
                <History size={28} />
                <p className="text-xs">Chọn một phiên để xem lại nội dung, tiếp tục hội thoại hoặc xóa.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-fg-strong truncate">{selected.title || selected.thread_id}</div>
                    <div className="text-[11px] text-fg-muted truncate">{storeName(selected.domain)} · tạo {formatDateTime(selected.created_at)}</div>
                  </div>
                  <Button variant="primary" icon={Play} onClick={() => continueThread(selected)}>Tiếp tục hội thoại</Button>
                  <Button icon={Trash2} onClick={() => removeThread(selected)}>Xóa</Button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                  {messages === null && <p className="text-xs text-fg-subtle italic text-center py-4">Đang tải...</p>}
                  {messages?.length === 0 && <p className="text-xs text-fg-subtle italic text-center py-4">Phiên không có tin nhắn.</p>}
                  {messages?.map((m, i) => {
                    const assistant = m.role === 'assistant';
                    return (
                      <div key={i} className={`flex gap-2 ${assistant ? '' : 'flex-row-reverse'}`}>
                        <span className={`shrink-0 h-6 w-6 rounded-full flex items-center justify-center ${assistant ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400' : 'bg-elevated text-fg-muted'}`}>
                          {assistant ? <Bot size={12} /> : <User size={12} />}
                        </span>
                        <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed break-words ${assistant ? 'bg-elevated text-fg' : 'bg-blue-600 text-white'}`}>
                          {assistant
                            ? <div className="prose prose-sm dark:prose-invert max-w-none break-words"><ReactMarkdown>{String(m.content ?? '')}</ReactMarkdown></div>
                            : <span className="whitespace-pre-wrap">{String(m.content ?? '')}</span>}
                          {m.timestamp && <div className={`text-[9px] mt-1 font-mono ${assistant ? 'text-fg-subtle' : 'text-white/70'}`}>{formatDateTime(m.timestamp)}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
