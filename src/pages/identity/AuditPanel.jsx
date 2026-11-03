/**
 * TARA AI Workspace - Main iThunder AI OS Entry Point (V6.11.01)
 * Tập tin tạo lập môi trường quản trị định danh người dùng.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { identityAPI } from '../../services/api';
import { ACTION_LABELS, Button, Notice, formatDateTime, controlCls, inputCls } from './shared';

const PAGE = 50;

const describeChange = (c) => {
  const show = (v) => Array.isArray(v) ? (v.join(', ') || '∅') : (v === '' || v === null || v === undefined ? '∅' : String(v));
  return `${c.field}: ${show(c.old)} → ${show(c.new)}`;
};

// Nhật ký thao tác Quản trị Định danh (mới nhất trước)
export default function AuditPanel() {
  const [items, setItems] = useState([]);
  const [target, setTarget] = useState('');
  const [action, setAction] = useState('');   // vd. knowledge.open: admin mở Kho phân vùng Private
  const [source, setSource] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async (beforeId = null) => {
    setLoading(true);
    try {
      const res = await identityAPI.listAudit({ target_id: target.trim(), action, limit: PAGE, before_id: beforeId });
      if (!Array.isArray(res?.items)) { setNotice({ type: 'error', text: res?.detail || 'Không tải được nhật ký.' }); return; }
      setItems(prev => beforeId ? [...prev, ...res.items] : res.items);
      setSource(res.source);
      setHasMore(res.items.length === PAGE);
      setNotice(null);
    } catch {
      setNotice({ type: 'error', text: 'Không tải được nhật ký.' });
    } finally { setLoading(false); }
  }, [target, action]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); load(); }}>
        <input value={target} onChange={e => setTarget(e.target.value.replace(/[^A-Za-z0-9/]/g, ''))} placeholder="uid hoặc phân vùng (Projects/1161000)" aria-label="Lọc theo đối tượng" className={`${controlCls} w-64`} />
        <select value={action} onChange={e => setAction(e.target.value)} aria-label="Lọc theo thao tác" className={`${controlCls} w-auto`}>
          <option value="">Mọi thao tác</option>
          {Object.entries(ACTION_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <Button type="submit" icon={RefreshCw} busy={loading}>Xem nhật ký</Button>
        {source === 'file' && <span className="text-[11px] text-amber-600 dark:text-amber-400">PostgreSQL không truy cập được — đang đọc tệp nhật ký dự phòng.</span>}
      </form>
      <Notice notice={notice} onClose={() => setNotice(null)} />
      <div className="bg-panel border border-line rounded-2xl overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="border-b border-line text-fg-muted bg-elevated">
              <th className="py-2.5 px-4 font-medium">Thời điểm</th>
              <th className="py-2.5 px-4 font-medium">Người thực hiện</th>
              <th className="py-2.5 px-4 font-medium">Thao tác</th>
              <th className="py-2.5 px-4 font-medium">Đối tượng</th>
              <th className="py-2.5 px-4 font-medium">Kết quả</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={5} className="py-12 text-center text-fg-subtle italic">{loading ? 'Đang tải...' : 'Chưa có thao tác nào.'}</td></tr>
            ) : items.map(i => (
              <tr key={`${source}-${i.id}`} className="border-b border-line last:border-0 align-top">
                <td className="py-2 px-4 whitespace-nowrap font-mono text-fg-muted">{formatDateTime(i.created_at)}</td>
                <td className="py-2 px-4"><div className="text-fg">{i.actor_name}</div><div className="text-[10px] font-mono text-fg-subtle">uid {i.actor_id} · {i.actor_ip}</div></td>
                <td className="py-2 px-4 whitespace-nowrap">{ACTION_LABELS[i.action] || i.action}</td>
                <td className="py-2 px-4 font-mono">{i.target_id || '—'}</td>
                <td className="py-2 px-4">
                  <div className={i.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>{i.message}</div>
                  {(i.changes || []).map((c, n) => <div key={n} className="text-[10px] text-fg-subtle font-mono break-all">{describeChange(c)}</div>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && <Button onClick={() => load(items[items.length - 1].id)} busy={loading} className="self-center">Xem thêm</Button>}
    </div>
  );
}
