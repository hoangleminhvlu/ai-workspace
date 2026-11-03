/**
 * TARA AI Workspace - Main iThunder AI OS Entry Point (V6.11.01)
 * Tập tin tạo lập môi trường quản trị định danh người dùng.
 */

import React, { useEffect, useState } from 'react';
import { KeyRound, Mail, Plus, Save, Shield, Trash2, UserCog } from 'lucide-react';
import { identityAPI } from '../../services/api';
import { Button, Field, Notice, RoleChip, Section, formatDateTime, formatHours, inputCls } from './shared';

const SELF_KEYS = ['display_name', 'title', 'mobile', 'postal_address'];

// Hồ sơ định danh của chính người đăng nhập: sửa thông tin liên hệ và email nhận PassCode
export default function MyProfilePanel({ sharedVisitor }) {
  const [me, setMe] = useState(null);
  const [form, setForm] = useState({});
  const [newEmail, setNewEmail] = useState('');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState('');

  const apply = (u) => { setMe(u); setForm(Object.fromEntries(SELF_KEYS.map(k => [k, u[k] || '']))); };

  useEffect(() => {
    identityAPI.getMyProfile()
      .then(res => res?.uid_number ? apply(res) : setNotice({ type: 'error', text: res?.detail || 'Không tải được hồ sơ.' }))
      .catch(() => setNotice({ type: 'error', text: 'Không tải được hồ sơ.' }));
  }, []);

  const run = async (key, call) => {
    setBusy(key); setNotice(null);
    try {
      const res = await call();
      if (res?.status === 'SUCCESS') { setNotice({ type: 'success', text: res.message }); if (res.user) apply(res.user); return true; }
      setNotice({ type: 'error', text: res?.detail || 'Thao tác không thành công.' });
      return false;
    } finally { setBusy(''); }
  };

  const save = () => {
    const patch = Object.fromEntries(SELF_KEYS.filter(k => form[k] !== (me[k] || '')).map(k => [k, form[k]]));
    if (!Object.keys(patch).length) { setNotice({ type: 'info', text: 'Hồ sơ không có thay đổi.' }); return; }
    run('profile', () => identityAPI.updateMyProfile(patch));
  };

  if (!me) return <div className="max-w-2xl"><Notice notice={notice} />{!notice && <p className="text-xs text-fg-subtle">Đang tải hồ sơ...</p>}</div>;
  const editable = !sharedVisitor;
  const labels = { display_name: 'Tên hiển thị', title: 'Chức danh', mobile: 'Di động', postal_address: 'Địa chỉ' };

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <Notice notice={notice} onClose={() => setNotice(null)} />
      {sharedVisitor && <Notice notice={{ type: 'info', text: 'Bạn đang dùng tài khoản Khách dùng chung nên không sửa được hồ sơ.' }} />}

      <Section title="Thông tin định danh" icon={Shield}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
          <dt className="text-fg-muted">Họ và tên</dt><dd className="text-fg font-semibold">{me.name}</dd>
          <dt className="text-fg-muted">Mã nhân sự</dt><dd className="font-mono">{me.owner_id || '—'}</dd>
          <dt className="text-fg-muted">Mã định danh</dt><dd className="font-mono">{me.uid_number}</dd>
          <dt className="text-fg-muted">Vai trò</dt><dd><div className="flex flex-wrap gap-1">{me.roles.length ? me.roles.map(r => <RoleChip key={r.value} role={r} />) : '—'}</div></dd>
        </dl>
        <p className="text-[10px] text-fg-subtle">Họ tên, mã nhân sự và vai trò do Quản trị viên cập nhật.</p>
      </Section>

      <Section title="Liên hệ" icon={UserCog} actions={editable && <Button variant="primary" icon={Save} busy={busy === 'profile'} disabled={!!busy} onClick={save}>Lưu</Button>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SELF_KEYS.map(k => (
            <Field key={k} label={labels[k]}>
              <input value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} disabled={!editable || !!busy} className={inputCls} />
            </Field>
          ))}
        </div>
      </Section>

      <Section title="Email nhận PassCode" icon={Mail}>
        <ul className="flex flex-col gap-1.5">
          {me.emails.map(email => (
            <li key={email} className="flex items-center justify-between gap-2 text-xs bg-elevated border border-line rounded-lg px-3 py-1.5">
              <span className="font-mono truncate">{email}</span>
              {editable && me.emails.length > 1 && (
                <button onClick={() => window.confirm(`Xóa email ${email}?`) && run('email', () => identityAPI.removeMyEmail(email))} disabled={!!busy}
                  aria-label={`Xóa ${email}`} className="p-1 rounded text-fg-subtle hover:text-red-600 dark:hover:text-red-400"><Trash2 size={12} /></button>
              )}
            </li>
          ))}
        </ul>
        {editable && (
          <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (await run('email', () => identityAPI.addMyEmail(newEmail.trim()))) setNewEmail(''); }}>
            <input type="email" required value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@to-chuc.vn" aria-label="Email mới" className={inputCls} disabled={!!busy} />
            <button type="submit" disabled={!!busy || !newEmail.trim()} className="inline-flex items-center gap-1 px-3 rounded-lg border border-line bg-elevated hover:bg-hover text-xs font-semibold disabled:opacity-50"><Plus size={12} />Thêm</button>
          </form>
        )}
      </Section>

      <Section title="Bảo mật đăng nhập" icon={KeyRound}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
          <dt className="text-fg-muted">FaceID</dt><dd>{me.security.faceid_enrolled ? 'Đã đăng ký khuôn mặt' : 'Chưa đăng ký'}</dd>
          <dt className="text-fg-muted">FaceID gần nhất</dt><dd>{me.security.last_faceid ? `${formatDateTime(me.security.last_faceid.time)} · ${me.security.last_faceid.ip}` : '—'}</dd>
          <dt className="text-fg-muted">PassTime</dt><dd>{formatHours(me.security.passtime_ms)}</dd>
        </dl>
        <p className="text-[10px] text-fg-subtle">Quên PassCode: dùng chức năng "Tôi quên PassCode" ở màn hình đăng nhập.</p>
      </Section>
    </div>
  );
}
