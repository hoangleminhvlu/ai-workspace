/**
 * TARA AI Workspace - Main iThunder AI OS Entry Point (V6.11.03)
 * Tập tin tạo lập môi trường AI Workspace cho người dùng.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Building2, FileSpreadsheet, FolderKanban, History, KeyRound, ShieldCheck, UserCircle, Users } from 'lucide-react';
import { identityAPI, setStepUpHandler } from '../services/api';
import { Button, Modal, Notice, controlCls } from './identity/shared';
import UsersPanel from './identity/UsersPanel';
import RolesPanel from './identity/RolesPanel';
import AuditPanel from './identity/AuditPanel';
import MyProfilePanel from './identity/MyProfilePanel';
import ImportPanel from './identity/ImportPanel';
import UnitsPanel from './identity/UnitsPanel';
import CloudsPanel from './identity/CloudsPanel';

const SHARED_VISITOR_UID = "1162000";

// Mỗi tab chỉ hiện khi Backend cấp quyền tương ứng; Backend vẫn kiểm tra lại quyền ở từng API
const TABS = [
  { key: 'users', label: 'Người dùng', icon: Users, permission: 'identity.users.read' },
  { key: 'clouds', label: 'Phân vùng', icon: FolderKanban, permission: 'identity.users.read' },
  { key: 'units', label: 'Đơn vị', icon: Building2, permission: 'identity.users.read' },
  { key: 'roles', label: 'Vai trò', icon: ShieldCheck, permission: 'identity.users.read' },
  { key: 'import', label: 'Nạp / Xuất CSV', icon: FileSpreadsheet, permission: 'identity.import' },
  { key: 'audit', label: 'Nhật ký', icon: History, permission: 'identity.audit.read' },
  { key: 'me', label: 'Hồ sơ của tôi', icon: UserCircle, permission: null },
];

// Hộp thoại xác nhận PassCode trước thao tác nhạy cảm (Backend trả HTTP 428 STEP_UP_REQUIRED)
function StepUpDialog({ request, minutes, onDone }) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await identityAPI.stepUp(passcode);
      if (res?.status === 'SUCCESS') onDone(true);
      else { setError(res?.detail || 'Không xác nhận được PassCode.'); setPasscode(''); inputRef.current?.focus(); }
    } finally { setBusy(false); }
  };

  return (
    <Modal title="Xác nhận PassCode" onClose={() => onDone(false)} width="max-w-sm">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-xs text-fg-muted">{request.message} Xác nhận có hiệu lực {minutes} phút cho các thao tác nhạy cảm tiếp theo.</p>
        <Notice notice={error ? { type: 'error', text: error } : null} />
        <input ref={inputRef} type="password" inputMode="numeric" autoComplete="off" pattern="\d{6}" maxLength={6} required
          value={passcode} onChange={e => setPasscode(e.target.value.replace(/\D/g, ''))} aria-label="PassCode của bạn"
          placeholder="PassCode 6 chữ số" className={`${controlCls} w-full text-center tracking-[0.5em] font-mono text-sm`} />
        <div className="flex justify-end gap-2">
          <Button onClick={() => onDone(false)}>Hủy</Button>
          <Button type="submit" variant="primary" icon={KeyRound} busy={busy} disabled={passcode.length !== 6}>Xác nhận</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function IdentityManager() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [me, setMe] = useState(null);           // { user_id, user_role, permissions, scope_units, role_changed }
  const [catalog, setCatalog] = useState(null); // /api/identity/roles
  const [pool, setPool] = useState(null);
  const [notice, setNotice] = useState(null);
  const [stepUpRequest, setStepUpRequest] = useState(null);   // { message, resolve }

  const permissions = me?.permissions || [];
  const scopeUnits = me?.scope_units ?? null;
  const tabs = TABS.filter(t => !t.permission || permissions.includes(t.permission));
  const requested = searchParams.get('tab');
  const active = tabs.find(t => t.key === requested)?.key || tabs[0]?.key || 'me';
  const unitFilter = searchParams.get('unit') || '';
  const setUnitFilter = (unit) => setSearchParams(unit ? { tab: 'users', unit } : { tab: 'users' });

  // api.js gọi handler này khi gặp HTTP 428; Promise trả true khi người dùng đã xác nhận PassCode
  useEffect(() => {
    setStepUpHandler((message) => new Promise(resolve => setStepUpRequest({ message, resolve })));
    return () => setStepUpHandler(null);
  }, []);

  const finishStepUp = (confirmed) => {
    stepUpRequest?.resolve(confirmed);
    setStepUpRequest(null);
  };

  const loadCatalog = useCallback(async () => {
    // Danh mục đơn vị (ou) đi kèm danh mục vai trò: gợi ý đơn vị khi gán vai trò, bộ lọc người dùng theo đơn vị
    const [roles, poolRes, units] = await Promise.all([identityAPI.getRoles(), identityAPI.getAccountPool(), identityAPI.listUnits()]);
    if (Array.isArray(roles?.roles)) setCatalog({ ...roles, units: Array.isArray(units?.units) ? units.units : [] });
    if (typeof poolRes?.free === 'number') setPool(poolRes);
  }, []);

  useEffect(() => {
    identityAPI.getMyPermissions()
      .then(res => {
        if (!Array.isArray(res?.permissions)) { setNotice({ type: 'error', text: res?.detail || 'Không xác định được quyền của bạn.' }); return; }
        setMe(res);
        if (res.permissions.includes('identity.users.read')) loadCatalog().catch(() => {});
      })
      .catch(() => setNotice({ type: 'error', text: 'Không kết nối được AI Gateway.' }));
  }, [loadCatalog]);

  const refreshCatalog = () => loadCatalog().catch(() => {});

  return (
    <div className="w-screen h-app flex flex-col bg-app text-fg font-sans antialiased overflow-hidden">
      <header className="h-14 border-b border-line bg-panel px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate('/')} aria-label="Về AI Workspace" className="p-1.5 rounded-lg hover:bg-hover text-fg-muted hover:text-fg-strong transition-all">
            <ArrowLeft size={16} />
          </button>
          <span className="text-sm font-bold uppercase tracking-wider text-fg truncate">
            {permissions.includes('identity.users.read') ? 'Quản trị Định danh' : 'Hồ sơ Định danh'}
          </span>
          {catalog && <span className="hidden md:inline text-xs text-fg-muted truncate">{catalog.org_name}</span>}
        </div>
        {pool && scopeUnits === null && (
          <div className="hidden sm:flex items-center gap-3 text-[11px] font-mono text-fg-muted">
            <span><b className="text-emerald-600 dark:text-emerald-400">{pool.active}</b> hoạt động</span>
            <span><b className="text-amber-600 dark:text-amber-400">{pool.inactive}</b> chưa có PassCode</span>
            {pool.suspended > 0 && <span><b className="text-rose-600 dark:text-rose-400">{pool.suspended}</b> tạm khóa</span>}
            <span><b className="text-fg">{pool.free}</b> tài khoản trống</span>
          </div>
        )}
      </header>

      <nav className="border-b border-line bg-panel px-6 flex gap-1 shrink-0 overflow-x-auto" role="tablist">
        {tabs.map(t => (
          <button key={t.key} role="tab" aria-selected={active === t.key} onClick={() => setSearchParams({ tab: t.key })}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${active === t.key ? 'border-blue-600 text-fg-strong' : 'border-transparent text-fg-muted hover:text-fg'}`}>
            <t.icon size={13} />{t.label}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        <Notice notice={notice} onClose={() => setNotice(null)} />
        {me?.role_changed && (
          <Notice notice={{ type: 'info', text: `Vai trò của bạn trên OpenLDAP hiện là "${me.user_role}" (khác lúc đăng nhập). Đăng nhập lại để Workspace áp dụng vai trò mới.` }} />
        )}
        {Array.isArray(scopeUnits) && active !== 'me' && (
          <Notice notice={{ type: 'info', text: `Bạn là Quản trị Đơn vị: ${scopeUnits.join(', ') || '(chưa được giao đơn vị)'}. Bạn chỉ thấy và quản trị người dùng có vai trò thuộc đơn vị này, chỉ thấy các phân vùng mình tham gia; nhật ký chỉ gồm thao tác của bạn.` }} />
        )}
        {me && active === 'users' && <UsersPanel catalog={catalog} permissions={permissions} actorId={me.user_id} scopeUnits={scopeUnits} pool={pool} onCatalogChanged={refreshCatalog} unit={unitFilter} onUnitChange={setUnitFilter} />}
        {me && active === 'clouds' && <CloudsPanel />}
        {me && active === 'units' && <UnitsPanel onOpenUnit={setUnitFilter} />}
        {me && active === 'roles' && <RolesPanel catalog={catalog} />}
        {me && active === 'import' && <ImportPanel onChanged={refreshCatalog} />}
        {me && active === 'audit' && <AuditPanel />}
        {me && active === 'me' && <MyProfilePanel sharedVisitor={me.user_id === SHARED_VISITOR_UID} />}
      </main>

      {stepUpRequest && <StepUpDialog request={stepUpRequest} minutes={me?.step_up_minutes || 10} onDone={finishStepUp} />}
    </div>
  );
}
