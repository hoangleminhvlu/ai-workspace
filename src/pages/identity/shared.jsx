/**
 * TARA AI Workspace - Main iThunder AI OS Entry Point (V6.11.01)
 * Tập tin tạo lập môi trường quản trị định danh người dùng.
 */

import React from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

// Thành phần giao diện dùng chung của trang Quản trị Định danh

export const STATUS_INFO = {
  active:   { label: 'Đang hoạt động',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50' },
  inactive: { label: 'Chưa có PassCode', cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50' },
  suspended: { label: 'Tạm khóa',       cls: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50' },
  template: { label: 'Tài khoản trống',  cls: 'bg-elevated text-fg-subtle border-line' },
};

export const ROLE_COLORS = {
  admin:      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50',
  manager:    'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900/50',
  member:     'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50',
  partner:    'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-900/50',
  intern:     'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-900/50',
  active:     'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/50',
  idle:       'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-900/50',
  shared:     'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900/50',
  graded:     'bg-lime-50 text-lime-700 border-lime-200 dark:bg-lime-950/30 dark:text-lime-400 dark:border-lime-900/50',
  stoped:     'bg-stone-100 text-stone-600 border-stone-300 dark:bg-stone-900/40 dark:text-stone-400 dark:border-stone-700',
  suspended:  'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
  registered: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50',
};

export const ACTION_LABELS = {
  'user.provision': 'Cấp tài khoản',
  'user.profile.update': 'Sửa hồ sơ',
  'user.roles.change': 'Đổi vai trò',
  'user.email.add': 'Thêm email',
  'user.email.remove': 'Xóa email',
  'user.passcode.reset': 'Cấp lại PassCode',
  'user.deactivate': 'Vô hiệu hóa',
  'user.passtime.set': 'Đặt PassTime',
  'user.faceid.reset': 'Xóa FaceID',
  'user.recycle': 'Thu hồi tài khoản',
  'self.profile.update': 'Tự sửa hồ sơ',
  'self.email.add': 'Tự thêm email',
  'self.email.remove': 'Tự xóa email',
  'security.step_up': 'Xác nhận PassCode',
  'user.import': 'Nạp CSV',
  'import.create': 'Nạp CSV: cấp tài khoản',
  'import.update': 'Nạp CSV: cập nhật',
  'import.recycle': 'Nạp CSV: thu hồi',
  'user.export': 'Xuất CSV',
  'unit.create': 'Đăng ký nhóm (cũ)',
  'unit.update': 'Sửa mô tả nhóm (cũ)',
  'unit.sync': 'Đồng bộ memberUid (cũ)',
  'cloud.allocate': 'Cấp phát phân vùng',
  'cloud.update': 'Sửa phân vùng',
  'cloud.members': 'Đổi thành viên phân vùng',
  'cloud.recycle': 'Thu hồi phân vùng',
  'mcp.server.create': 'Đăng ký MCP Server',
  'mcp.server.update': 'Sửa MCP Server',
  'mcp.server.delete': 'Gỡ MCP Server',
  'comm.conversation.create': 'Tạo hội thoại nhóm',
  'comm.members.add': 'Thêm thành viên hội thoại',
  'comm.members.remove': 'Bớt thành viên hội thoại',
};

export const formatDateTime = (value) => {
  if (!value) return '';
  const d = typeof value === 'number' ? new Date(value) : new Date(value);
  return isNaN(d) ? String(value) : d.toLocaleString('vi-VN', { hour12: false });
};

export const formatHours = (ms) => {
  if (ms === null || ms === undefined) return 'Mặc định';
  const minutes = Math.round(ms / 60000);
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h ? `${h} giờ${m ? ` ${m} phút` : ''}` : `${m} phút`;
};

export const StatusBadge = ({ status }) => {
  const info = STATUS_INFO[status] || { label: status, cls: 'bg-elevated text-fg-muted border-line' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold whitespace-nowrap ${info.cls}`}>{info.label}</span>;
};

export const RoleChip = ({ role, onRemove, disabled }) => (
  <span
    title={role.value}
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold whitespace-nowrap ${ROLE_COLORS[role.role] || 'bg-elevated text-fg-muted border-line'}`}
  >
    {role.role}{role.unit ? <span className="opacity-70">:{role.unit}</span> : null}
    {onRemove && (
      <button type="button" disabled={disabled} onClick={onRemove} aria-label={`Gỡ ${role.value}`} className="hover:opacity-60 disabled:opacity-30">
        <X size={10} />
      </button>
    )}
  </span>
);

export const Notice = ({ notice, onClose }) => {
  if (!notice?.text) return null;
  const styles = {
    error: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400',
    success: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400',
    info: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40 text-blue-600 dark:text-blue-400',
  };
  const Icon = notice.type === 'error' ? AlertCircle : notice.type === 'success' ? CheckCircle : Info;
  return (
    <div role={notice.type === 'error' ? 'alert' : 'status'} className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${styles[notice.type] || styles.info}`}>
      <Icon size={14} className="shrink-0 mt-px" />
      <span className="flex-1 break-words">{notice.text}</span>
      {onClose && <button onClick={onClose} aria-label="Đóng thông báo" className="opacity-60 hover:opacity-100"><X size={12} /></button>}
    </div>
  );
};

// controlCls không đặt độ rộng (dùng khi tự chọn w-32, w-auto...); inputCls chiếm hết độ rộng khung chứa
export const controlCls = 'bg-elevated border border-line text-xs rounded-lg px-3 py-2 text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-60';
export const inputCls = `w-full ${controlCls}`;

export const Field = ({ label, hint, children }) => (
  <label className="flex flex-col gap-1 text-[11px] font-medium text-fg-muted">
    <span>{label}</span>
    {children}
    {hint && <span className="text-[10px] font-normal text-fg-subtle">{hint}</span>}
  </label>
);

const BUTTON_VARIANTS = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600',
  secondary: 'bg-elevated hover:bg-hover text-fg border-line',
  danger: 'bg-red-600 hover:bg-red-700 text-white border-red-600',
  ghostDanger: 'bg-transparent hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50',
};

export const Button = ({ variant = 'secondary', icon: Icon, busy, children, className = '', ...props }) => (
  <button
    type="button"
    {...props}
    disabled={props.disabled || busy}
    className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${BUTTON_VARIANTS[variant]} ${className}`}
  >
    {Icon && <Icon size={13} className={busy ? 'animate-pulse' : ''} />}
    {children}
  </button>
);

export const Section = ({ title, icon: Icon, children, actions }) => (
  <section className="border border-line rounded-xl bg-card">
    <header className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-line">
      <h3 className="text-xs font-bold text-fg-strong flex items-center gap-1.5">{Icon && <Icon size={13} className="text-fg-muted" />}{title}</h3>
      {actions}
    </header>
    <div className="p-4 flex flex-col gap-3">{children}</div>
  </section>
);

export const Modal = ({ title, onClose, children, width = 'max-w-lg' }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label={title} className={`w-full ${width} bg-panel border border-line rounded-2xl shadow-xl flex flex-col max-h-[90vh]`}>
      <header className="flex items-center justify-between px-5 py-3 border-b border-line">
        <h2 className="text-sm font-bold text-fg-strong">{title}</h2>
        <button onClick={onClose} aria-label="Đóng" className="p-1 rounded-md text-fg-muted hover:bg-hover"><X size={14} /></button>
      </header>
      <div className="p-5 overflow-y-auto flex flex-col gap-4">{children}</div>
    </div>
  </div>
);

// Chọn vai trò + đơn vị (ghép thành "member:PROJ1"); groups là danh mục nhóm từ /api/identity/roles.
// Quy tắc giống Backend: admin không gắn đơn vị; vai trò scoped (manager) bắt buộc đơn vị.
// scopeUnits (Quản trị Đơn vị): chỉ chọn vai trò thường, đơn vị bắt buộc và nằm trong phạm vi được giao.
export const RolePicker = ({ roles, groups, onAdd, disabled, exclude = [], scopeUnits = null, unitCatalog = [] }) => {
  const [role, setRole] = React.useState('');
  const [unit, setUnit] = React.useState('');
  const scoped = Array.isArray(scopeUnits);
  const roleInfo = (roles || []).find(r => r.role === role);
  const choices = (roles || []).filter(r => !scoped || (r.role !== 'admin' && !r.scoped));
  const unitAllowed = role && role !== 'admin' && role !== 'suspended';
  const unitRequired = scoped || roleInfo?.scoped;
  // Gợi ý: đơn vị đang dùng trong ou của Tổ chức (bộ môn, khóa học...) + đơn vị đang dùng cho vai trò này
  const blocked = role === 'suspended';
  const units = [...new Set([
    ...(unitCatalog || []).map(u => u.unit),
    ...(groups || []).filter(g => g.role === role && g.unit).map(g => g.unit),
  ])];
  const value = role ? (unitAllowed && unit.trim() ? `${role}:${unit.trim()}` : role) : '';
  const isDuplicate = exclude.some(v => v.endsWith(`:${value}`));
  const incomplete = !value || (unitRequired && !unit.trim());

  return (
    <div className="flex flex-wrap items-end gap-2">
      <select aria-label="Vai trò" value={role} onChange={e => { setRole(e.target.value); setUnit(scoped && scopeUnits.length === 1 ? scopeUnits[0] : ''); }} disabled={disabled} className={`${controlCls} w-auto`}>
        <option value="">— Chọn vai trò —</option>
        {choices.map(r => <option key={r.role} value={r.role}>{r.label} ({r.role})</option>)}
        <option value="registered">Đăng ký (registered)</option>
        {!scoped && <option value="suspended">Tạm khóa tài khoản (suspended)</option>}
      </select>
      {scoped ? (
        <select aria-label="Đơn vị" value={unit} onChange={e => setUnit(e.target.value)} disabled={disabled || !role} className={`${controlCls} w-auto`}>
          <option value="">— Đơn vị —</option>
          {scopeUnits.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      ) : (
        <>
          <input
            aria-label="Đơn vị" list={`units-${role}`} value={unitAllowed ? unit : ''} onChange={e => setUnit(e.target.value)}
            disabled={disabled || !unitAllowed} className={`${controlCls} w-44`}
            placeholder={role === 'admin' || blocked ? 'Toàn tổ chức' : unitRequired ? 'Đơn vị (bắt buộc)' : 'Đơn vị (không bắt buộc)'}
          />
          <datalist id={`units-${role}`}>{units.map(u => <option key={u} value={u} />)}</datalist>
        </>
      )}
      <Button icon={null} disabled={disabled || incomplete || isDuplicate} onClick={() => { onAdd(value); setUnit(''); }}>Thêm</Button>
    </div>
  );
};

// Giá trị ou mà người gọi được gỡ: Quản trị Đơn vị chỉ gỡ vai trò thường thuộc đơn vị của mình
export const canTouchRole = (roleValue, scopeUnits) => {
  if (!Array.isArray(scopeUnits)) return true;
  const [, role, ...rest] = roleValue.split(':');
  return role !== 'admin' && role !== 'manager' && role !== 'suspended' && scopeUnits.includes(rest.join(':'));
};
