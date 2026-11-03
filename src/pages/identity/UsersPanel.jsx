/**
 * TARA AI Workspace - Main iThunder AI OS Entry Point (V6.11.01)
 * Tập tin tạo lập môi trường quản trị định danh người dùng.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, ScanFace, Search, UserPlus } from 'lucide-react';
import { identityAPI } from '../../services/api';
import { Button, Field, Modal, Notice, RoleChip, RolePicker, StatusBadge, controlCls, inputCls } from './shared';
import UserDrawer from './UserDrawer';

const PAGE_SIZE = 25;

function ProvisionModal({ catalog, permissions, scopeUnits, onClose, onDone }) {
  // Quản trị Đơn vị: vai trò mặc định gắn đơn vị đầu tiên được giao (Backend bắt buộc vai trò thuộc đơn vị)
  const defaultRoles = Array.isArray(scopeUnits) ? (scopeUnits[0] ? [`member:${scopeUnits[0]}`] : []) : ['member'];
  const [form, setForm] = useState({ owner_id: '', full_name: '', email: '', title: '', roles: defaultRoles, send_passcode: true });
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const canAssign = permissions.includes('identity.roles.assign');
  const canReset = permissions.includes('identity.security.reset');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setNotice(null);
    try {
      const res = await identityAPI.provisionUser({
        ...form,
        roles: canAssign ? form.roles : [],
        send_passcode: canReset && form.send_passcode,
      });
      if (res?.status === 'SUCCESS') onDone(res);
      else setNotice({ type: 'error', text: res?.detail || 'Không cấp được tài khoản.' });
    } finally { setBusy(false); }
  };

  return (
    <Modal title="Cấp tài khoản mới" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-[11px] text-fg-muted">Tài khoản được lấy từ kho tài khoản trống (template) của tổ chức; không tạo entry LDAP mới.</p>
        <Notice notice={notice} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Mã nhân sự *"><input required value={form.owner_id} onChange={e => set('owner_id', e.target.value)} pattern="[A-Za-z0-9._\-]+" title="Chữ, số và . _ -" className={`${inputCls} font-mono`} /></Field>
          <Field label="Họ và tên *"><input required value={form.full_name} onChange={e => set('full_name', e.target.value)} className={inputCls} /></Field>
          <Field label="Email *" hint="Nhận PassCode đăng nhập"><input required type="email" value={form.email} onChange={e => set('email', e.target.value)} className={inputCls} /></Field>
          <Field label="Chức danh"><input value={form.title} onChange={e => set('title', e.target.value)} className={inputCls} /></Field>
        </div>
        {canAssign && (
          <div role="group" aria-label="Vai trò & Nhóm" className="flex flex-col gap-1 text-[11px] font-medium text-fg-muted">
            <span>Vai trò & Nhóm</span>
            <div className="flex flex-wrap gap-1.5 min-h-[22px]">
              {form.roles.map(v => (
                <RoleChip key={v} role={{ value: v, role: v.split(':')[0], unit: v.split(':').slice(1).join(':') }}
                  onRemove={() => set('roles', form.roles.filter(x => x !== v))} />
              ))}
            </div>
            <RolePicker roles={catalog?.roles} groups={catalog?.groups} unitCatalog={catalog?.units} scopeUnits={scopeUnits} exclude={form.roles.map(v => `X:${v}`)}
              onAdd={(v) => set('roles', [...form.roles, v])} />
            <span className="text-[10px] font-normal text-fg-subtle">Không chọn vai trò nào: tài khoản ở trạng thái Đăng ký (registered).</span>
          </div>
        )}
        {canReset && (
          <label className="flex items-center gap-2 text-xs text-fg">
            <input type="checkbox" checked={form.send_passcode} onChange={e => set('send_passcode', e.target.checked)} />
            Cấp PassCode và gửi email ngay
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Hủy</Button>
          <Button type="submit" variant="primary" icon={UserPlus} busy={busy}>Cấp tài khoản</Button>
        </div>
      </form>
    </Modal>
  );
}

// Danh sách người dùng của tổ chức: tìm kiếm, lọc, phân trang; bấm một dòng để mở hồ sơ chi tiết
export default function UsersPanel({ catalog, permissions, actorId, scopeUnits = null, assignPolicy = null, pool, onCatalogChanged, unit = '', onUnitChange }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [openUid, setOpenUid] = useState(null);
  const [showProvision, setShowProvision] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => { setPage(1); }, [debouncedQuery, role, status, sort, unit]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await identityAPI.listUsers({ q: debouncedQuery, role, status, sort, unit, page, size: PAGE_SIZE });
      if (Array.isArray(res?.items)) { setData(res); setNotice(n => (n?.type === 'error' ? null : n)); }
      else setNotice({ type: 'error', text: res?.detail || 'Không tải được danh sách người dùng.' });
    } catch {
      setNotice({ type: 'error', text: 'Không tải được danh sách người dùng.' });
    } finally { setLoading(false); }
  }, [debouncedQuery, role, status, sort, unit, page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const canWrite = permissions.includes('identity.users.write');

  return (
    <div className="flex flex-col gap-4 min-h-0">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Họ tên, mã nhân sự, email, uid..." aria-label="Tìm người dùng" className={`${inputCls} pl-8`} />
        </div>
        <select aria-label="Lọc vai trò" value={role} onChange={e => setRole(e.target.value)} className={`${controlCls} w-auto`}>
          <option value="">Mọi vai trò</option>
          {(catalog?.roles || []).map(r => <option key={r.role} value={r.role}>{r.label}</option>)}
          <option value="registered">Đăng ký</option>
        </select>
        {/* Lọc theo đơn vị (phần thứ ba của ou): giữ trên URL (?unit=) để mở trực tiếp từ tab Đơn vị */}
        <select aria-label="Lọc đơn vị" value={unit} onChange={e => onUnitChange(e.target.value)} className={`${controlCls} w-auto`}>
          <option value="">Mọi đơn vị</option>
          {[...new Set([unit, ...(catalog?.units || []).map(u => u.unit)].filter(Boolean))].map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <select aria-label="Lọc trạng thái" value={status} onChange={e => setStatus(e.target.value)} className={`${controlCls} w-auto`}>
          <option value="">Mọi trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Chưa có PassCode</option>
          <option value="suspended">Tạm khóa</option>
          <option value="template">Tài khoản trống</option>
        </select>
        <select aria-label="Sắp xếp" value={sort} onChange={e => setSort(e.target.value)} className={`${controlCls} w-auto`}>
          <option value="name">Theo họ tên</option>
          <option value="owner_id">Theo mã nhân sự</option>
          <option value="uid">Theo uid</option>
          <option value="role">Theo vai trò</option>
        </select>
        <Button icon={RefreshCw} busy={loading} onClick={load} aria-label="Tải lại">Tải lại</Button>
        <div className="flex-1" />
        {canWrite && (
          <Button variant="primary" icon={UserPlus} onClick={() => setShowProvision(true)} disabled={pool && pool.free === 0}
            title={pool && pool.free === 0 ? 'Đã hết tài khoản trống' : undefined}>
            Cấp tài khoản{pool ? ` (còn ${pool.free})` : ''}
          </Button>
        )}
      </div>

      <Notice notice={notice} onClose={() => setNotice(null)} />

      <div className="bg-panel border border-line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-line text-fg-muted bg-elevated">
                <th className="py-2.5 px-4 font-medium">Họ và tên</th>
                <th className="py-2.5 px-4 font-medium">Mã nhân sự</th>
                <th className="py-2.5 px-4 font-medium">Email</th>
                <th className="py-2.5 px-4 font-medium">Vai trò & Nhóm</th>
                <th className="py-2.5 px-4 font-medium">Trạng thái</th>
                <th className="py-2.5 px-4 font-medium text-center">FaceID</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-fg-subtle italic">{loading ? 'Đang tải...' : 'Không có người dùng phù hợp.'}</td></tr>
              ) : data.items.map(u => (
                <tr key={u.uid_number} onClick={() => setOpenUid(u.uid_number)} className="border-b border-line last:border-0 hover:bg-hover cursor-pointer">
                  <td className="py-2.5 px-4">
                    <button type="button" className="text-left" onClick={(e) => { e.stopPropagation(); setOpenUid(u.uid_number); }}>
                      <div className="font-semibold text-fg-strong">{u.name}</div>
                      <div className="text-[10px] text-fg-subtle font-mono">uid {u.uid_number}{u.title ? ` · ${u.title}` : ''}</div>
                    </button>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-fg-muted">{u.owner_id}</td>
                  <td className="py-2.5 px-4 font-mono text-fg-muted max-w-[220px] truncate" title={u.emails.join(', ')}>{u.emails[0] || '—'}{u.emails.length > 1 ? ` +${u.emails.length - 1}` : ''}</td>
                  <td className="py-2.5 px-4"><div className="flex flex-wrap gap-1">{u.roles.map(r => <RoleChip key={r.value} role={r} />)}</div></td>
                  <td className="py-2.5 px-4"><StatusBadge status={u.status} /></td>
                  <td className="py-2.5 px-4 text-center">
                    <ScanFace size={14} aria-label={u.faceid_enrolled ? 'Đã đăng ký FaceID' : 'Chưa đăng ký FaceID'}
                      className={u.faceid_enrolled ? 'inline text-emerald-600 dark:text-emerald-400' : 'inline text-fg-subtle opacity-40'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-line text-[11px] text-fg-muted">
          <span>{data.total} người dùng</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} aria-label="Trang trước" className="p-1 rounded hover:bg-hover disabled:opacity-30"><ChevronLeft size={14} /></button>
            <span>Trang {page}/{totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} aria-label="Trang sau" className="p-1 rounded hover:bg-hover disabled:opacity-30"><ChevronRight size={14} /></button>
          </div>
        </footer>
      </div>

      {openUid && (
        <UserDrawer uid={openUid} catalog={catalog} permissions={permissions} actorId={actorId} scopeUnits={scopeUnits} assignPolicy={assignPolicy}
          onClose={() => setOpenUid(null)}
          onChanged={(user, res) => {
            load(); onCatalogChanged();
            // Thu hồi đóng ngăn chi tiết: hiện kết quả trên danh sách
            if (res?.mode) setNotice({ type: 'success', text: res.message });
          }} />
      )}

      {showProvision && (
        <ProvisionModal catalog={catalog} permissions={permissions} scopeUnits={scopeUnits} onClose={() => setShowProvision(false)}
          onDone={(res) => {
            setShowProvision(false);
            setNotice({ type: 'success', text: res.message });
            load(); onCatalogChanged();
            if (res.uid_number) setOpenUid(res.uid_number);
          }} />
      )}
    </div>
  );
}
