/**
 * TARA AI Workspace - Main iThunder AI OS Entry Point (V6.11.03)
 * Mở Kho Tri thức của phân vùng Public (dự án, thực tập, hội đồng) mà người dùng không tham gia: chỉ khai thác.
 * Quản trị viên (can_include_private) được mở cả phân vùng Private, với quyền quản trị.
 */

import React, { useEffect, useState } from 'react';
import { Check, FolderKanban, FolderOpen, Lock } from 'lucide-react';
import iThunderAPI from '../services/api';
import { Button, Modal, Notice, controlCls } from './identity/shared';

export default function PublicCloudsDialog({ openedKeys, onOpen, onClose }) {
  const [q, setQ] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [includePrivate, setIncludePrivate] = useState(false);
  const [canPrivate, setCanPrivate] = useState(false);   // giữ ô chọn khi đang tải lại danh mục

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {   // chờ người dùng gõ xong ô tìm kiếm
      try {
        const res = await iThunderAPI.listPublicClouds(q.trim(), includePrivate);
        if (cancelled) return;
        if (Array.isArray(res?.clouds)) { setResult(res); setCanPrivate(!!res.can_include_private); setError(''); }
        else setError(res?.detail || 'Không tải được danh mục phân vùng Public.');
      } catch {
        if (!cancelled) setError('Không tải được danh mục phân vùng Public.');
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, includePrivate]);

  return (
    <Modal title={includePrivate ? "Mở Kho của phân vùng (quản trị viên)" : "Mở Kho của phân vùng Public"} onClose={onClose} width="max-w-2xl">
      <div className="flex flex-col gap-3">
        <p className="text-[11px] text-fg-muted leading-relaxed">
          Phân vùng để <b className="text-fg">Public</b> cho phép mọi thành viên của Tổ chức khai thác Kho Tri thức (hỏi đáp RAG, xem tệp),
          không tải lên hay sửa được. Phân vùng đã mở hiện ở thanh bên, mục “Phân vùng đã mở”
          {result?.max_opened ? ` (tối đa ${result.max_opened})` : ''}.
        </p>
        <input autoFocus aria-label="Tìm phân vùng Public" value={q} onChange={e => setQ(e.target.value)}
          placeholder="Mã phân vùng, tên đề tài hoặc gidNumber" className={`${controlCls} w-full`} />
        {canPrivate && (
          <label className="inline-flex items-start gap-2 text-[11px] text-fg-muted">
            <input type="checkbox" className="mt-0.5" checked={includePrivate} onChange={e => { setResult(null); setIncludePrivate(e.target.checked); }} />
            <span>
              Gồm cả phân vùng <b className="text-fg">Private</b> (quản trị viên): bạn có quyền quản trị Kho của mọi phân vùng trong Tổ chức,
              kể cả khi không tham gia. Chỉ mở khi cần hỗ trợ hoặc kiểm tra.
            </span>
          </label>
        )}
        <Notice notice={error ? { type: 'error', text: error } : null} />
        <div className="flex flex-col gap-1.5 max-h-[50vh] overflow-y-auto">
          {result === null && !error && <p className="text-xs text-fg-subtle italic py-4 text-center">Đang tải...</p>}
          {result?.clouds.length === 0 && <p className="text-xs text-fg-subtle italic py-4 text-center">{includePrivate ? 'Không có phân vùng nào phù hợp.' : 'Không có phân vùng Public nào phù hợp.'}</p>}
          {result?.clouds.map(c => {
            const opened = openedKeys.includes(c.storage_key);
            return (
              <div key={c.storage_key} className="flex items-start justify-between gap-3 border border-line rounded-xl px-3 py-2.5">
                <div className="flex items-start gap-2 min-w-0">
                  <FolderKanban size={14} className="text-fg-subtle shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-fg-strong font-mono truncate flex items-center gap-1.5">
                      {c.cloud?.name}
                      {c.cloud?.visibility === 'Private' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-px rounded border text-[10px] font-sans font-medium bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50">
                          <Lock size={9} />Private
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-fg">{c.cloud?.description}</div>
                    <div className="text-[10px] font-mono text-fg-subtle">{c.display_name.split(':')[0]} · {c.storage_key}</div>
                  </div>
                </div>
                <Button variant={opened ? undefined : 'primary'} icon={opened ? Check : FolderOpen} onClick={() => onOpen(c, result.max_opened)}>
                  {opened ? 'Chuyển tới' : 'Mở'}
                </Button>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end"><Button onClick={onClose}>Đóng</Button></div>
      </div>
    </Modal>
  );
}
