/**
 * TARA AI Workspace - Main iThunder AI OS Entry Point (V6.11.01)
 * Tập tin tạo lập môi trường quản trị định danh người dùng.
 */

import React, { useEffect, useState } from 'react';
import { Archive, Ban, KeyRound, Mail, Plus, Save, ScanFace, Shield, Timer, Trash2, UserCog, X } from 'lucide-react';
import { identityAPI } from '../../services/api';
import { Button, Field, Notice, RoleChip, RolePicker, Section, StatusBadge, canTouchRole, formatDateTime, formatHours, controlCls, inputCls } from './shared';

const PROFILE_KEYS = ['full_name', 'owner_id', 'display_name', 'title', 'mobile', 'telephone', 'postal_address', 'description'];
const profileForm = (u) => ({
  full_name: u.name || '', owner_id: u.owner_id || '', display_name: u.display_name || '', title: u.title || '',
  mobile: u.mobile || '', telephone: u.telephone || '', postal_address: u.postal_address || '', description: u.description || '',
});

// Ngăn chi tiết một người dùng: hồ sơ, vai trò, email, bảo mật (PassCode/PassTime/FaceID) và thu hồi
export default function UserDrawer({ uid, catalog, permissions, actorId, scopeUnits = null, assignPolicy = null, onClose, onChanged }) {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [passHours, setPassHours] = useState('');
  const [confirmId, setConfirmId] = useState('');

  const can = (p) => permissions.includes(p);
  const isSelf = String(uid) === String(actorId);

  const applyUser = (u) => {
    setUser(u);
    setForm(profileForm(u));
    setPassHours(u.security?.passtime_ms ? String(+(u.security.passtime_ms / 3600000).toFixed(2)) : '');
  };

  useEffect(() => {
    let alive = true;
    setUser(null); setNotice(null); setConfirmId('');
    identityAPI.getUser(uid)
      .then(res => { if (!alive) return; res?.uid_number ? applyUser(res) : setNotice({ type: 'error', text: res?.detail || 'Không tải được hồ sơ người dùng.' }); })
      .catch(() => alive && setNotice({ type: 'error', text: 'Không tải được hồ sơ người dùng.' }));
    return () => { alive = false; };
  }, [uid]);

  // Chạy một thao tác ghi, hiển thị kết quả và cập nhật hồ sơ mới nhất do Backend trả về
  const run = async (key, call, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key); setNotice(null);
    try {
      const res = await call();
      if (res?.status === 'SUCCESS') {
        setNotice({ type: 'success', text: res.message });
        if (res.user) applyUser(res.user);
        onChanged(res.user || null, res);
        return res;
      }
      setNotice({ type: 'error', text: res?.detail || 'Thao tác không thành công.' });
    } finally { setBusy(''); }
  };

  const saveProfile = () => {
    const before = profileForm(user);
    const patch = Object.fromEntries(PROFILE_KEYS.filter(k => form[k] !== before[k]).map(k => [k, form[k]]));
    if (!Object.keys(patch).length) { setNotice({ type: 'info', text: 'Hồ sơ không có thay đổi.' }); return; }
    run('profile', () => identityAPI.updateUser(uid, patch));
  };

  const savePassTime = () => {
    const hours = parseFloat(passHours);
    if (!(hours > 0)) { setNotice({ type: 'error', text: 'PassTime phải là số giờ lớn hơn 0.' }); return; }
    run('passtime', () => identityAPI.setPassTime(uid, Math.round(hours * 3600000)));
  };

  const recycle = async () => {
    const res = await run('recycle', () => identityAPI.recycleUser(uid, confirmId),
      `Thu hồi tài khoản ${user.name} (${user.owner_id})? Hồ sơ, email, FaceID của tài khoản sẽ bị xóa khỏi tổ chức.`);
    if (res) onClose();
  };

  const field = (key, label, props = {}) => (
    <Field label={label}>
      <input value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} disabled={!can('identity.users.write') || !!busy} className={inputCls} {...props} />
    </Field>
  );

  const sec = user?.security || {};
  const isTemplate = user?.status === 'template';

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-label="Hồ sơ người dùng" className="w-full max-w-xl h-full bg-panel border-l border-line shadow-2xl flex flex-col">
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-line">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-fg-strong truncate">{user?.name || `Người dùng ${uid}`}</h2>
            {user && (
              <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-fg-muted">
                <span className="font-mono">uid {user.uid_number}</span><span>·</span>
                <span className="font-mono">{user.owner_id}</span>
                <StatusBadge status={user.status} />
                {isSelf && <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">(bạn)</span>}
              </div>
            )}
          </div>
          <button onClick={onClose} aria-label="Đóng" className="p-1.5 rounded-lg text-fg-muted hover:bg-hover"><X size={15} /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          <Notice notice={notice} onClose={() => setNotice(null)} />
          {!user && !notice && <p className="text-xs text-fg-subtle">Đang tải hồ sơ...</p>}

          {user && form && !isTemplate && (
            <>
              <Section title="Hồ sơ" icon={UserCog} actions={can('identity.users.write') && (
                <Button variant="primary" icon={Save} busy={busy === 'profile'} disabled={!!busy} onClick={saveProfile}>Lưu hồ sơ</Button>
              )}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {field('full_name', 'Họ và tên')}
                  {field('owner_id', 'Mã nhân sự')}
                  {field('display_name', 'Tên hiển thị')}
                  {field('title', 'Chức danh')}
                  {field('mobile', 'Di động')}
                  {field('telephone', 'Điện thoại')}
                </div>
                {field('postal_address', 'Địa chỉ')}
                {field('description', 'Mô tả')}
              </Section>

              <Section title="Vai trò & Nhóm" icon={Shield}>
                <p className="text-[11px] text-fg-muted">Vai trò Workspace hiện tại: <b className="text-fg">{user.primary_role}</b>. Người dùng nhận quyền mới ở lần đăng nhập sau.</p>
                <div className="flex flex-wrap gap-1.5">
                  {user.roles.map(r => (
                    <RoleChip key={r.value} role={r} disabled={!!busy}
                      onRemove={can('identity.roles.assign') && user.roles.length > 1 && canTouchRole(r.value, scopeUnits, assignPolicy) ? () => run('roles', () => identityAPI.changeRoles(uid, [], [r.value]), `Gỡ vai trò ${r.value}?`) : null} />
                  ))}
                </div>
                {can('identity.roles.assign') && (
                  <RolePicker roles={catalog?.roles} groups={catalog?.groups} unitCatalog={catalog?.units} scopeUnits={scopeUnits} policy={assignPolicy} disabled={!!busy} exclude={user.roles.map(r => r.value)}
                    onAdd={(value) => run('roles', () => identityAPI.changeRoles(uid, [value], []))} />
                )}
              </Section>

              <Section title="Email nhận PassCode" icon={Mail}>
                <ul className="flex flex-col gap-1.5">
                  {user.emails.map(email => (
                    <li key={email} className="flex items-center justify-between gap-2 text-xs bg-elevated border border-line rounded-lg px-3 py-1.5">
                      <span className="font-mono truncate">{email}</span>
                      {can('identity.users.write') && user.emails.length > 1 && (
                        <button onClick={() => run('email', () => identityAPI.removeUserEmail(uid, email), `Xóa email ${email}?`)} disabled={!!busy}
                          aria-label={`Xóa ${email}`} className="p-1 rounded text-fg-subtle hover:text-red-600 dark:hover:text-red-400"><Trash2 size={12} /></button>
                      )}
                    </li>
                  ))}
                </ul>
                {can('identity.users.write') && (
                  <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (await run('email', () => identityAPI.addUserEmail(uid, newEmail.trim()))) setNewEmail(''); }}>
                    <input type="email" required value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@to-chuc.vn" aria-label="Email mới" className={inputCls} disabled={!!busy} />
                    <button type="submit" disabled={!!busy || !newEmail.trim()} className="inline-flex items-center gap-1 px-3 rounded-lg border border-line bg-elevated hover:bg-hover text-xs font-semibold disabled:opacity-50"><Plus size={12} />Thêm</button>
                  </form>
                )}
              </Section>

              <Section title="Bảo mật đăng nhập" icon={KeyRound}>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
                  <dt className="text-fg-muted">PassCode</dt><dd className="text-fg">{sec.has_passcode ? 'Đã cấp' : 'Chưa cấp — chưa đăng nhập được'}</dd>
                  <dt className="text-fg-muted">FaceID</dt><dd className="text-fg">{sec.faceid_enrolled ? 'Đã đăng ký khuôn mặt' : 'Chưa đăng ký'}{sec.faceid_threshold ? ` · ngưỡng ${sec.faceid_threshold}` : ''}</dd>
                  <dt className="text-fg-muted">FaceID gần nhất</dt><dd className="text-fg">{sec.last_faceid ? `${formatDateTime(sec.last_faceid.time)} · ${sec.last_faceid.ip} · độ khớp ${sec.last_faceid.accuracy}` : '—'}</dd>
                  <dt className="text-fg-muted">PassTime</dt><dd className="text-fg">{formatHours(sec.passtime_ms)}</dd>
                </dl>
                {can('identity.security.reset') && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="primary" icon={KeyRound} busy={busy === 'passcode'} disabled={!!busy}
                        onClick={() => run('passcode', () => identityAPI.resetPasscode(uid), `Cấp PassCode mới cho ${user.name}? PassCode cũ hết hiệu lực ngay; PassCode mới được gửi tới ${user.emails.join(', ')}.`)}>
                        {sec.has_passcode ? 'Cấp lại PassCode' : 'Cấp PassCode & gửi email'}
                      </Button>
                      <Button icon={ScanFace} busy={busy === 'faceid'} disabled={!!busy || !sec.faceid_enrolled}
                        onClick={() => run('faceid', () => identityAPI.resetFaceId(uid), 'Xóa dữ liệu khuôn mặt? Ở lần đăng nhập sau, khuôn mặt quét đầu tiên đi kèm PassCode sẽ được đăng ký làm FaceID mới — nên cấp lại PassCode cùng lúc nếu nghi PassCode bị lộ.')}>
                        Xóa FaceID
                      </Button>
                      {sec.has_passcode && !isSelf && (
                        <Button variant="ghostDanger" icon={Ban} busy={busy === 'deactivate'} disabled={!!busy}
                          onClick={() => run('deactivate', () => identityAPI.deactivateUser(uid), `Vô hiệu hóa đăng nhập của ${user.name}? Hồ sơ và vai trò được giữ nguyên.`)}>
                          Vô hiệu hóa
                        </Button>
                      )}
                    </div>
                    <div className="flex items-end gap-2">
                      <Field label="PassTime (giờ)" hint="Thời gian được miễn quét FaceID sau lần xác thực gần nhất (5 phút – 7 ngày).">
                        <input type="number" min="0.1" max="168" step="0.5" value={passHours} onChange={e => setPassHours(e.target.value)} className={`${controlCls} w-32`} disabled={!!busy} />
                      </Field>
                      <Button icon={Timer} busy={busy === 'passtime'} disabled={!!busy || !passHours} onClick={savePassTime} className="mb-[18px]">Đặt PassTime</Button>
                    </div>
                  </>
                )}
              </Section>

              {can('identity.users.write') && !isSelf && (
                <Section title="Thu hồi tài khoản" icon={Archive}>
                  <p className="text-[11px] text-fg-muted leading-relaxed">
                    Theo nguyên tắc không xóa entry LDAP: tài khoản trở về kho tài khoản trống để cấp lại. Nếu tài khoản đang được tổ chức khác dùng chung,
                    chỉ các vai trò của tổ chức này bị gỡ. Nhập lại mã nhân sự <b className="font-mono text-fg">{user.owner_id}</b> để xác nhận.
                  </p>
                  <div className="flex gap-2">
                    <input value={confirmId} onChange={e => setConfirmId(e.target.value)} placeholder={user.owner_id} aria-label="Mã nhân sự xác nhận" className={`${controlCls} w-48 font-mono`} disabled={!!busy} />
                    <Button variant="danger" icon={Archive} busy={busy === 'recycle'} disabled={!!busy || confirmId.trim() !== user.owner_id} onClick={recycle}>Thu hồi</Button>
                  </div>
                </Section>
              )}
            </>
          )}

          {user && isTemplate && (
            <p className="text-xs text-fg-muted">Đây là tài khoản trống (template) chờ cấp phát. Dùng nút <b>Cấp tài khoản</b> trên danh sách để cấp cho người dùng mới.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
