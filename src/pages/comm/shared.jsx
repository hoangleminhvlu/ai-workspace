/**
 * TARA AI Workspace - Main iThunder AI OS Entry Point (V6.09.27)
 * Tập tin tạo lập môi trường trao đổi thông tin Text/Voice/Video Chat cho người dùng.
 */

import React, { useEffect, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { commAPI } from '../../services/api';
import { inputCls } from '../identity/shared';
import { KIND_INFO } from './utils';

// Thành phần (component) dùng chung của trang Trao đổi trực tuyến; hằng số và hàm tiện ích nằm trong ./utils.js

const AVATAR_COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500'];

export const Avatar = ({ name, kind, online, size = 'md' }) => {
  const dim = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs';
  const Icon = kind && kind !== 'direct' ? KIND_INFO[kind]?.icon : null;
  const initials = String(name || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
  const color = AVATAR_COLORS[[...String(name || '')].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return (
    <span className={`relative shrink-0 inline-flex items-center justify-center rounded-full font-bold text-white ${dim} ${kind === 'assistant' ? 'bg-gradient-to-br from-blue-500 to-violet-600' : Icon ? 'bg-slate-500' : color}`}>
      {Icon ? <Icon size={size === 'sm' ? 13 : 16} /> : initials}
      {online !== undefined && (
        <span aria-label={online ? 'Đang trực tuyến' : 'Ngoại tuyến'}
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-panel ${online ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      )}
    </span>
  );
};

// Tìm người dùng trên OpenLDAP (≥ 2 ký tự) để mời; selected: [{ user_id, user_name }]
export const UserPicker = ({ selected, onChange, single = false, exclude = [] }) => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); setError(''); return undefined; }
    let cancelled = false;
    setBusy(true);
    const timer = setTimeout(async () => {
      const res = await commAPI.searchUsers(term);
      if (cancelled) return;
      setBusy(false);
      if (res?.status === 'SUCCESS') { setResults(res.users); setError(''); }
      else { setResults([]); setError(res?.detail || 'Không tìm được người dùng.'); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [q]);

  const chosen = new Set(selected.map(u => u.user_id));
  const pick = (u) => {
    if (single) onChange([u]);
    else if (!chosen.has(u.user_id)) onChange([...selected, u]);
    setQ('');
  };

  return (
    <div className="flex flex-col gap-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(u => (
            <span key={u.user_id} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-[11px] text-blue-700 dark:text-blue-300">
              {u.user_name}
              <button type="button" onClick={() => onChange(selected.filter(s => s.user_id !== u.user_id))} aria-label={`Bỏ ${u.user_name}`} className="p-0.5 hover:opacity-60"><X size={10} /></button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm theo họ tên, mã nhân sự, email..." className={`${inputCls} pl-8`} aria-label="Tìm người dùng" />
        {busy && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-fg-subtle" />}
      </div>
      {error && <span className="text-[11px] text-red-600 dark:text-red-400">{error}</span>}
      {results.length > 0 && (
        <ul className="border border-line rounded-lg divide-y divide-line max-h-56 overflow-y-auto bg-elevated">
          {results.filter(u => !exclude.includes(u.user_id)).map(u => (
            <li key={u.user_id}>
              <button type="button" onClick={() => pick(u)} disabled={chosen.has(u.user_id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-hover disabled:opacity-50">
                <Avatar name={u.user_name} online={u.online} size="sm" />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-semibold text-fg-strong truncate">{u.user_name}</span>
                  <span className="block text-[10px] text-fg-subtle truncate">{[u.title, u.role, `#${u.user_id}`].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && !busy && !error && results.length === 0 && <span className="text-[11px] text-fg-subtle">Không tìm thấy người dùng phù hợp.</span>}
    </div>
  );
};
