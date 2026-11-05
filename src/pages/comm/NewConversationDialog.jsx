/**
 * TARA AI Workspace - Main iThunder AI OS Entry Point (V6.09.27)
 * Tập tin tạo lập môi trường trao đổi thông tin Text/Voice/Video Chat cho người dùng.
 */

import React, { useEffect, useState } from 'react';
import { Bot, Network, User, Users } from 'lucide-react';
import { commAPI } from '../../services/api';
import { Button, Field, Modal, Notice, inputCls } from '../identity/shared';
import { UserPicker } from './shared';

// Tạo hội thoại: trực tiếp (1-1), nhóm tự lập, nhóm gắn posixGroup OpenLDAP (admin / manager của đơn vị), Trợ lý AI

const TABS = [
  { id: 'direct', label: 'Trực tiếp', icon: User },
  { id: 'group', label: 'Nhóm', icon: Users },
  { id: 'ldap', label: 'Nhóm OpenLDAP', icon: Network },
  { id: 'assistant', label: 'Trợ lý AI', icon: Bot },
];

export default function NewConversationDialog({ info, onClose, onCreated }) {
  const tabs = TABS.filter(t => (t.id !== 'group' || info.can_create_group) && (t.id !== 'ldap' || info.can_bind_ldap_group));
  const [tab, setTab] = useState('direct');
  const [people, setPeople] = useState([]);
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState(info.storages.includes('Public') ? 'Public' : info.storages[0] || '');
  const [units, setUnits] = useState(null);
  const [unit, setUnit] = useState('');
  // Hội thoại gắn phân vùng: mặc định Trợ lý AI dùng Kho Tri thức của chính phân vùng (khóa "<Nhánh>/<gid>")
  const [ldapDomain, setLdapDomain] = useState('__unit__');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (tab !== 'ldap' || units) return;
    commAPI.listUnits().then(res => {
      if (res?.status === 'SUCCESS') { setUnits(res.units); setUnit(res.units[0]?.unit || ''); }
      else setNotice({ type: 'error', text: res?.detail || 'Không tải được danh mục nhóm OpenLDAP.' });
    });
  }, [tab, units]);

  // Hội thoại với Trợ lý AI: tệp gửi cho AI được nạp vào kho này nên mặc định là kho Personal (riêng tư), không phải Public
  const switchTab = (id) => {
    setTab(id);
    setNotice(null);
    if (id === 'direct') setPeople(p => p.slice(0, 1));
    if (info.storages.includes('Personal') && info.storages.includes('Public')) setDomain(id === 'assistant' ? 'Personal' : 'Public');
  };

  const payload = () => {
    const member_ids = people.map(p => p.user_id);
    if (tab === 'direct') return { kind: 'direct', member_ids };
    if (tab === 'group') return { kind: 'group', title, member_ids, domain };
    if (tab === 'ldap') return { kind: 'group', ldap_unit: unit, title, domain: ldapDomain === '__unit__' ? unit : ldapDomain };
    return { kind: 'assistant', title, member_ids, domain };
  };
  const ready = tab === 'direct' ? people.length === 1 : tab === 'group' ? people.length > 0 && title.trim() : tab === 'ldap' ? !!unit : true;

  const submit = async () => {
    setBusy(true);
    const res = await commAPI.createConversation(payload());
    setBusy(false);
    if (res?.status === 'SUCCESS') onCreated(res.conversation);
    else setNotice({ type: 'error', text: res?.detail || 'Không tạo được hội thoại.' });
  };

  return (
    <Modal title="Hội thoại mới" onClose={onClose}>
      <div role="tablist" className="flex flex-wrap gap-1 p-1 rounded-lg bg-elevated border border-line">
        {tabs.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => switchTab(t.id)}
            className={`flex-1 min-w-[90px] inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${tab === t.id ? 'bg-blue-600 text-white shadow-sm' : 'text-fg-muted hover:text-fg hover:bg-hover'}`}>
            <t.icon size={12} />{t.label}
          </button>
        ))}
      </div>

      {tab === 'direct' && (
        <Field label="Người nhận" hint="Mỗi cặp người dùng có một hội thoại trực tiếp; mở lại sẽ tiếp tục hội thoại cũ.">
          <UserPicker selected={people} onChange={setPeople} single />
        </Field>
      )}

      {(tab === 'group' || tab === 'ldap' || tab === 'assistant') && (
        <Field label={tab === 'assistant' ? 'Tên hội thoại (không bắt buộc)' : tab === 'ldap' ? 'Tên nhóm (bỏ trống: "Nhóm <đơn vị>")' : 'Tên nhóm'}>
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={255} className={inputCls}
            placeholder={tab === 'assistant' ? 'Trợ lý AI' : 'vd. Dự án AI4Gifted'} />
        </Field>
      )}

      {tab === 'ldap' && (
        <Field label="Nhóm (posixGroup) trên OpenLDAP" hint="Thành viên tự đồng bộ theo memberUid của nhóm; không thêm/bớt thủ công.">
          {units === null ? <span className="text-xs text-fg-subtle">Đang tải...</span> : units.length === 0 ? (
            <span className="text-xs text-fg-muted">Không có nhóm nào bạn được quản trị.</span>
          ) : (
            <select value={unit} onChange={e => setUnit(e.target.value)} className={inputCls}>
              {units.map(u => <option key={u.unit} value={u.unit}>{u.unit}{u.description ? ` – ${u.description}` : ''} ({u.member_count} thành viên)</option>)}
            </select>
          )}
        </Field>
      )}

      {(tab === 'group' || tab === 'assistant') && (
        <Field label={tab === 'assistant' ? 'Mời thêm người (không bắt buộc)' : 'Thành viên'}>
          <UserPicker selected={people} onChange={setPeople} />
        </Field>
      )}

      {tab !== 'direct' && (
        <Field label="Kho Tri thức khi gọi Trợ lý AI"
          hint={tab === 'assistant' && people.length === 0 ? 'Hội thoại riêng: Trợ lý AI dùng được mọi kho của bạn (kể cả Personal) và công cụ MCP.'
            : 'Hội thoại nhiều người: Trợ lý AI chỉ dùng các kho mà mọi thành viên đều được đọc, không dùng kho Personal, không gọi công cụ MCP.'}>
          {tab === 'ldap' ? (
            <select value={ldapDomain} onChange={e => setLdapDomain(e.target.value)} className={inputCls}>
              <option value="__unit__">Kho của phân vùng {unit}</option>
              {info.storages.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <select value={domain} onChange={e => setDomain(e.target.value)} className={inputCls}>
              {info.storages.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </Field>
      )}

      <Notice notice={notice} onClose={() => setNotice(null)} />
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Hủy</Button>
        <Button variant="primary" busy={busy} disabled={!ready} onClick={submit}>{tab === 'direct' ? 'Nhắn tin' : 'Tạo hội thoại'}</Button>
      </div>
    </Modal>
  );
}
