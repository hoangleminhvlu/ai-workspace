/**
 * TARA AI Workspace - Main iThunder AI OS Entry Point (V6.09.27)
 * Tập tin tạo lập môi trường trao đổi thông tin Text/Voice/Video Chat cho người dùng.
 */

import React, { useState } from 'react';
import { Crown, LogOut, Save, UserMinus, UserPlus } from 'lucide-react';
import { commAPI } from '../../services/api';
import { Button, Field, Modal, Notice, inputCls } from '../identity/shared';
import { Avatar, UserPicker, conversationTitle } from './shared';

// Thông tin hội thoại: thành viên (online, quyền quản lý), thêm/bớt thành viên, đổi tên/kho Trợ lý AI, rời hội thoại.
// Backend kiểm tra lại mọi quyền; nhóm gắn OpenLDAP chỉ đồng bộ thành viên theo memberUid.

export default function MembersDialog({ conversation, me, storages, onClose, onLeft, onChanged }) {
  const isOwner = conversation.member_role === 'owner';
  const editable = conversation.kind !== 'direct';
  const manualMembers = editable && !conversation.ldap_unit;
  const [title, setTitle] = useState(conversation.title || '');
  const [domain, setDomain] = useState(conversation.metadata?.domain || 'Public');
  const [adding, setAdding] = useState([]);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);

  const run = async (key, action, success) => {
    setBusy(key);
    const res = await action();
    setBusy('');
    if (res?.status === 'SUCCESS') {
      setNotice(success ? { type: 'success', text: success } : null);
      onChanged();
      return true;
    }
    setNotice({ type: 'error', text: res?.detail || 'Thao tác không thành công.' });
    return false;
  };

  const save = () => run('save', () => commAPI.updateConversation(conversation.id, { title: title.trim() || undefined, domain }), 'Đã lưu thông tin hội thoại.');
  const add = async () => {
    if (await run('add', () => commAPI.addMembers(conversation.id, adding.map(u => u.user_id)), 'Đã thêm thành viên.')) setAdding([]);
  };
  const remove = (m) => {
    if (!window.confirm(`Mời ${m.user_name} ra khỏi hội thoại?`)) return;
    run(`rm-${m.user_id}`, () => commAPI.removeMember(conversation.id, m.user_id), `Đã mời ${m.user_name} ra khỏi hội thoại.`);
  };
  const leave = async () => {
    if (!window.confirm('Rời hội thoại này? Bạn sẽ không đọc được tin nhắn mới.')) return;
    setBusy('leave');
    const res = await commAPI.removeMember(conversation.id, me);
    setBusy('');
    if (res?.status === 'SUCCESS') onLeft();
    else setNotice({ type: 'error', text: res?.detail || 'Không rời được hội thoại.' });
  };

  return (
    <Modal title={conversationTitle(conversation, me)} onClose={onClose}>
      <Notice notice={notice} onClose={() => setNotice(null)} />
      {conversation.ldap_unit && (
        <Notice notice={{ type: 'info', text: `Nhóm gắn posixGroup "${conversation.ldap_unit}" trên OpenLDAP: thành viên đồng bộ theo memberUid của nhóm.` }} />
      )}

      {editable && isOwner && (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] items-end">
          <Field label="Tên hội thoại">
            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={255} className={inputCls} />
          </Field>
          <Field label="Kho Tri thức (@ai)">
            <select value={domain} onChange={e => setDomain(e.target.value)} className={inputCls}>
              {storages.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Button icon={Save} busy={busy === 'save'} onClick={save}>Lưu</Button>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold text-fg-muted">Thành viên ({conversation.members.length})</span>
        <ul className="border border-line rounded-lg divide-y divide-line max-h-72 overflow-y-auto">
          {conversation.members.map(m => (
            <li key={m.user_id} className="flex items-center gap-2.5 px-3 py-2">
              <Avatar name={m.user_name} online={m.online} size="sm" />
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-semibold text-fg-strong truncate">
                  {m.user_name}{m.user_id === me && <span className="font-normal text-fg-subtle"> (bạn)</span>}
                </span>
                <span className="block text-[10px] text-fg-subtle">{m.online ? 'Đang trực tuyến' : 'Ngoại tuyến'} · #{m.user_id}</span>
              </span>
              {m.member_role === 'owner' && <span title="Quản lý nhóm" className="text-amber-500"><Crown size={13} /></span>}
              {manualMembers && isOwner && m.user_id !== me && (
                <Button variant="ghostDanger" icon={UserMinus} busy={busy === `rm-${m.user_id}`} onClick={() => remove(m)} aria-label={`Mời ${m.user_name} ra khỏi nhóm`} />
              )}
            </li>
          ))}
        </ul>
      </div>

      {manualMembers && isOwner && (
        <Field label="Thêm thành viên">
          <UserPicker selected={adding} onChange={setAdding} exclude={conversation.members.map(m => m.user_id)} />
          {adding.length > 0 && <div><Button icon={UserPlus} variant="primary" busy={busy === 'add'} onClick={add}>Thêm {adding.length} người</Button></div>}
        </Field>
      )}

      {editable && (
        <div className="flex justify-between items-center pt-1 border-t border-line">
          <span className="text-[10px] text-fg-subtle">{isOwner && conversation.members.length > 1 ? 'Khi bạn rời, quyền quản lý chuyển cho thành viên khác.' : ''}</span>
          <Button variant="ghostDanger" icon={LogOut} busy={busy === 'leave'} onClick={leave}>Rời hội thoại</Button>
        </div>
      )}
    </Modal>
  );
}
