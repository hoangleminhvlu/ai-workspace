/**
 * TARA AI Workspace - Main iThunder AI OS Entry Point (V6.11.03)
 * Tập tin tạo lập môi trường quản trị định danh người dùng.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Building2, RefreshCw, Users } from 'lucide-react';
import { identityAPI } from '../../services/api';
import { Button, Notice, ROLE_COLORS, Section } from './shared';

// Đơn vị = phần thứ ba của ou "<ORGID>:<vai trò>:<đơn vị>" (bộ môn, khóa học, đơn vị nội bộ), chỉ đọc.
// Đơn vị được gán cùng vai trò của người dùng; thành viên các phân vùng làm việc quản trị ở tab Phân vùng.
export default function UnitsPanel({ onOpenUnit }) {
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await identityAPI.listUnits();
      if (Array.isArray(res?.units)) setData(res);
      else setNotice({ type: 'error', text: res?.detail || 'Không tải được danh mục đơn vị.' });
    } catch {
      setNotice({ type: 'error', text: 'Không tải được danh mục đơn vị.' });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!data) return <div className="flex flex-col gap-4"><Notice notice={notice} />{!notice && <p className="text-xs text-fg-subtle">Đang tải danh mục đơn vị...</p>}</div>;

  return (
    <div className="flex flex-col gap-4">
      <Notice notice={notice} onClose={() => setNotice(null)} />

      <Section title="Đơn vị (theo vai trò)" icon={Building2} actions={<Button icon={RefreshCw} onClick={load}>Tải lại</Button>}>
        <p className="text-[11px] text-fg-muted leading-relaxed">
          Đơn vị là phần thứ ba của vai trò trên OpenLDAP, vd. <code className="font-mono">shared:K29</code> (khóa học) hoặc
          <code className="font-mono"> active:CNPM</code> (bộ môn). Đơn vị được gán khi đổi vai trò của người dùng và là phạm vi của Quản trị Đơn vị.
          Thành viên của các dự án, nhóm thực tập, hội đồng được quản trị riêng ở tab <b>Phân vùng</b>.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-line text-fg-muted">
                <th className="py-2 pr-4 font-medium">Đơn vị</th>
                <th className="py-2 pr-4 font-medium">Người dùng</th>
                <th className="py-2 pr-4 font-medium">Theo vai trò</th>
              </tr>
            </thead>
            <tbody>
              {data.units.length === 0 ? (
                <tr><td colSpan={3} className="py-10 text-center text-fg-subtle italic">Chưa có vai trò nào gắn đơn vị.</td></tr>
              ) : data.units.map(u => (
                <tr key={u.unit} className="border-b border-line last:border-0 align-top">
                  <td className="py-2.5 pr-4 font-mono font-semibold text-fg-strong">{u.unit}</td>
                  <td className="py-2.5 pr-4">
                    <button onClick={() => onOpenUnit(u.unit)} disabled={!u.member_count} className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:text-fg-subtle disabled:no-underline">
                      <Users size={12} />{u.member_count}
                    </button>
                  </td>
                  <td className="py-2.5 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(u.role_counts).map(([role, n]) => (
                        <span key={role} className={`px-1.5 py-px rounded border text-[10px] ${ROLE_COLORS[role] || 'bg-elevated text-fg-muted border-line'}`}>{role} {n}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
