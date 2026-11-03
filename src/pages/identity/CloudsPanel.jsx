/**
 * TARA AI Workspace - Main iThunder AI OS Entry Point (V6.11.03)
 * Tập tin tạo lập môi trường quản trị định danh người dùng.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Database, FolderKanban, Pencil, Plus, RefreshCw, Save, Trash2, UserMinus, UserPlus, Users } from 'lucide-react';
import { identityAPI } from '../../services/api';
import { Button, Field, Modal, Notice, Section, controlCls, inputCls } from './shared';

// Phân vùng làm việc iDragonCloud trên OpenLDAP: cn=<gidNumber>,ou=<Nhánh>,ou=<ORGID> (khóa là DN).
// Cấp phát = điền vào phân vùng trống (Template); thu hồi = trả về Template. Thành viên (memberUid) độc lập với vai trò (ou).
const NAME_PATTERN = '[A-Za-z0-9][A-Za-z0-9_.:\\-]{0,63}';
const EMPTY_FORM = { branch: 'Projects', name: '', description: '', type: '', status: 'Private', primary_member: '', supervisors: '', members: '' };

const LIFECYCLE_CLS = {
  Pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50',
  Reported: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50',
  Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50',
};

// "1001, 1002 1003" => ["1001", "1002", "1003"]
const parseUids = (text) => [...new Set(String(text || '').split(/[\s,;]+/).map(s => s.trim()).filter(Boolean))];
const badUids = (text) => parseUids(text).filter(u => !/^\d+$/.test(u));

const StatusBadges = ({ status, visibility, lifecycle }) => (
  <div className="flex flex-wrap gap-1">
    <span className={`px-1.5 py-px rounded border text-[10px] ${status.visibility === 'Public' ? 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-900/50' : 'bg-elevated text-fg-muted border-line'}`}>
      {visibility?.[status.visibility] || status.visibility}
    </span>
    {status.lifecycle && <span className={`px-1.5 py-px rounded border text-[10px] ${LIFECYCLE_CLS[status.lifecycle] || ''}`}>{lifecycle?.[status.lifecycle] || status.lifecycle}</span>}
    {status.schedule && <span className="px-1.5 py-px rounded border text-[10px] bg-elevated text-fg-muted border-line" title="Lịch làm việc (iDCloudStatus)">{status.schedule}</span>}
  </div>
);

// Gợi ý iDCloudStatus: phạm vi, tiến độ hoặc tự nhập lịch làm việc
const StatusInput = ({ value, onChange, data }) => (
  <>
    <input list="cloud-status" maxLength={100} value={value} onChange={e => onChange(e.target.value)} className={inputCls}
      placeholder="Private / Public / Pending / Reported / Completed / lịch làm việc" />
    <datalist id="cloud-status">
      {[...Object.entries(data.visibility || {}), ...Object.entries(data.lifecycle || {})].map(([k, label]) => <option key={k} value={k}>{label}</option>)}
    </datalist>
  </>
);

function EditDialog({ cloud, data, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: cloud.name, description: cloud.description, type: cloud.type, status: cloud.status.raw,
    provider_uri: cloud.provider_uri, primary_member: cloud.primary_member, supervisors: cloud.supervisors.join(', '),
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const invalid = badUids(form.supervisors).length > 0 || (form.primary_member && !/^\d+$/.test(form.primary_member));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const patch = { ...form, supervisors: parseUids(form.supervisors) };
      Object.keys(patch).forEach(k => { if (typeof patch[k] === 'string') patch[k] = patch[k].trim(); });
      const res = await identityAPI.updateCloud(cloud.branch, cloud.gid_number, patch);
      if (res?.status === 'SUCCESS') onSaved(res.message);
      else setError(res?.detail || 'Không cập nhật được phân vùng.');
    } finally { setBusy(false); }
  };

  return (
    <Modal title={`Sửa phân vùng ${cloud.branch}/${cloud.gid_number}`} onClose={onClose}>
      <form onSubmit={save} className="flex flex-col gap-3">
        <Notice notice={error ? { type: 'error', text: error } : null} />
        <Field label="Mã phân vùng (iDCloudName) *"><input required pattern={NAME_PATTERN} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={`${inputCls} font-mono`} /></Field>
        <Field label="Tên đề tài / dự án (iDCloudDescription) *"><input required maxLength={255} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputCls} /></Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Loại (iDCloudPrimaryType)">
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={inputCls}>
              {!data.types[form.type] && <option value={form.type}>{form.type || '—'}</option>}
              {Object.entries(data.types).map(([k, label]) => <option key={k} value={k}>{label} ({k})</option>)}
            </select>
          </Field>
          <Field label="Trạng thái (iDCloudStatus)"><StatusInput value={form.status} onChange={v => setForm({ ...form, status: v })} data={data} /></Field>
        </div>
        <Field label="Máy chủ cung cấp dịch vụ (iDCloudPrimaryProviderURI)"><input maxLength={255} value={form.provider_uri} onChange={e => setForm({ ...form, provider_uri: e.target.value })} className={`${inputCls} font-mono`} /></Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Trưởng nhóm (uidNumber)"><input inputMode="numeric" value={form.primary_member} onChange={e => setForm({ ...form, primary_member: e.target.value.trim() })} className={`${inputCls} font-mono`} /></Field>
          <Field label="Người hướng dẫn (uidNumber)" hint="Phân tách bằng dấu phẩy"><input value={form.supervisors} onChange={e => setForm({ ...form, supervisors: e.target.value })} className={`${inputCls} font-mono`} /></Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Hủy</Button>
          <Button type="submit" variant="primary" icon={Save} busy={busy} disabled={invalid}>Lưu</Button>
        </div>
      </form>
    </Modal>
  );
}

function MembersDialog({ cloud, canManage, onClose, onSaved }) {
  const [current, setCurrent] = useState(cloud);
  const [adding, setAdding] = useState('');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState('');

  const apply = async (key, add, remove) => {
    setBusy(key); setNotice(null);
    try {
      const res = await identityAPI.changeCloudMembers(current.branch, current.gid_number, add, remove);
      if (res?.status === 'SUCCESS') {
        setCurrent(res.cloud); setNotice({ type: 'success', text: res.message }); onSaved();
        return true;
      }
      setNotice({ type: 'error', text: res?.detail || 'Không cập nhật được thành viên.' });
      return false;
    } finally { setBusy(''); }
  };

  const add = async (e) => {
    e.preventDefault();
    if (await apply('add', parseUids(adding), [])) setAdding('');
  };

  return (
    <Modal title={`Thành viên ${current.name} (${current.branch}/${current.gid_number})`} onClose={onClose} width="max-w-xl">
      <div className="flex flex-col gap-3">
        <Notice notice={notice} onClose={() => setNotice(null)} />
        <div className="text-[11px] text-fg-muted">
          Trưởng nhóm: <b className="font-mono text-fg">{current.primary_member || '—'}</b> · Người hướng dẫn: <b className="font-mono text-fg">{current.supervisors.join(', ') || '—'}</b>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {current.member_uids.length === 0 && <span className="text-xs italic text-fg-subtle">Chưa có thành viên.</span>}
          {current.member_uids.map(uid => (
            <span key={uid} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-line bg-elevated text-[11px] font-mono">
              {uid}
              {canManage && (
                <button onClick={() => apply(`rm-${uid}`, [], [uid])} disabled={!!busy} aria-label={`Bớt thành viên ${uid}`} className="text-red-600 dark:text-red-400 hover:opacity-70 disabled:opacity-40">
                  <UserMinus size={11} />
                </button>
              )}
            </span>
          ))}
          {current.legacy_member_uids.map(uid => (
            <span key={uid} title="memberUid kiểu tên đăng nhập cũ (NISCI), được giữ nguyên" className="px-2 py-0.5 rounded-md border border-dashed border-line text-[11px] font-mono text-fg-subtle">{uid}</span>
          ))}
        </div>
        {canManage && (
          <form onSubmit={add} className="flex gap-2 items-end">
            <Field label="Thêm thành viên (uidNumber, phân tách bằng dấu phẩy)">
              <input value={adding} onChange={e => setAdding(e.target.value)} className={`${controlCls} w-72 font-mono`} placeholder="1172204, 1172205" />
            </Field>
            <Button type="submit" variant="primary" icon={UserPlus} busy={busy === 'add'} disabled={!parseUids(adding).length || badUids(adding).length > 0}>Thêm</Button>
          </form>
        )}
      </div>
    </Modal>
  );
}

export default function CloudsPanel() {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({ branch: '', lifecycle: '', q: '', include_templates: false });
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [membersOf, setMembersOf] = useState(null);

  const load = useCallback(async (f = filters) => {
    try {
      const res = await identityAPI.listClouds(f);
      if (Array.isArray(res?.clouds)) setData(res);
      else setNotice({ type: 'error', text: res?.detail || 'Không tải được danh mục phân vùng.' });
    } catch {
      setNotice({ type: 'error', text: 'Không tải được danh mục phân vùng.' });
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (patch) => setFilters(f => ({ ...f, ...patch }));

  const allocate = async (e) => {
    e.preventDefault();
    setBusy('create'); setNotice(null);
    try {
      const res = await identityAPI.allocateCloud({
        branch: form.branch, name: form.name.trim(), description: form.description.trim(), type: form.type,
        status: form.status.trim() || 'Private', primary_member: form.primary_member.trim(),
        supervisors: parseUids(form.supervisors), members: parseUids(form.members),
      });
      if (res?.status === 'SUCCESS') {
        // Cấp phát trên OpenLDAP đã xong; chưa đăng ký được Kho Tri thức (PostgreSQL) thì chỉ cảnh báo
        setNotice(res.knowledge_warning ? { type: 'error', text: `${res.message} ${res.knowledge_warning}` } : { type: 'success', text: res.message });
        setForm(EMPTY_FORM); setShowCreate(false); await load();
      } else setNotice({ type: 'error', text: res?.detail || 'Không cấp phát được phân vùng.' });
    } finally { setBusy(''); }
  };

  const recycle = async (c) => {
    const typed = window.prompt(`Thu hồi phân vùng ${c.branch}/${c.gid_number} về Template?\nThành viên, trưởng nhóm, người hướng dẫn sẽ bị gỡ; Kho Dữ liệu ${c.folder} phải đã được lưu trữ hoặc dọn sạch; Kho Tri thức ${c.collection} được tự động lưu trữ.\n\nNhập lại mã phân vùng "${c.name}" để xác nhận:`);
    if (typed === null) return;
    setBusy(`recycle-${c.dn}`); setNotice(null);
    try {
      const res = await identityAPI.recycleCloud(c.branch, c.gid_number, typed.trim());
      setNotice(res?.status === 'SUCCESS' ? { type: 'success', text: res.message } : { type: 'error', text: res?.detail || 'Không thu hồi được phân vùng.' });
      await load();
    } finally { setBusy(''); }
  };

  if (!data) return <div className="flex flex-col gap-4"><Notice notice={notice} />{!notice && <p className="text-xs text-fg-subtle">Đang tải danh mục phân vùng...</p>}</div>;
  const canManage = data.can_manage;
  const freeTotal = Object.values(data.templates_free || {}).reduce((a, b) => a + b, 0);
  const createInvalid = badUids(form.supervisors).length > 0 || badUids(form.members).length > 0 || (form.primary_member && !/^\d+$/.test(form.primary_member.trim()));

  return (
    <div className="flex flex-col gap-4">
      <Notice notice={notice} onClose={() => setNotice(null)} />

      <Section title="Phân vùng làm việc (iDragonCloud)" icon={FolderKanban} actions={
        <div className="flex gap-2">
          <Button icon={RefreshCw} onClick={() => load()} disabled={!!busy}>Tải lại</Button>
          {canManage && <Button variant="primary" icon={Plus} disabled={!freeTotal} onClick={() => { setForm(EMPTY_FORM); setShowCreate(v => !v); }}>Cấp phát phân vùng</Button>}
        </div>
      }>
        <p className="text-[11px] text-fg-muted leading-relaxed">
          Mỗi phân vùng (dự án, nhóm thực tập, hội đồng) là một entry <code className="font-mono">cn=&lt;gid&gt;,ou=&lt;Nhánh&gt;,ou=&lt;ORGID&gt;</code> trên OpenLDAP,
          có Kho Dữ liệu và Kho Tri thức riêng. Thành viên được quản trị tại đây, độc lập với vai trò của người dùng.
          Phân vùng trống còn lại: {Object.entries(data.templates_free || {}).map(([b, n]) => <span key={b} className="mr-2"><b className="text-fg">{n}</b> {data.branches[b] || b}</span>)}
        </p>

        <div className="flex flex-wrap gap-2">
          <select aria-label="Nhánh" value={filters.branch} onChange={e => setFilter({ branch: e.target.value })} className={`${controlCls} w-auto`}>
            <option value="">Mọi nhánh</option>
            {Object.entries(data.branches).map(([k, label]) => <option key={k} value={k}>{label} ({k})</option>)}
          </select>
          <select aria-label="Tiến độ" value={filters.lifecycle} onChange={e => setFilter({ lifecycle: e.target.value })} className={`${controlCls} w-auto`}>
            <option value="">Mọi tiến độ</option>
            {Object.entries(data.lifecycle).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <input aria-label="Tìm phân vùng" value={filters.q} onChange={e => setFilter({ q: e.target.value })} placeholder="Mã, tên đề tài hoặc gidNumber" className={`${controlCls} w-60`} />
          {canManage && (
            <label className="inline-flex items-center gap-1.5 text-[11px] text-fg-muted">
              <input type="checkbox" checked={filters.include_templates} onChange={e => setFilter({ include_templates: e.target.checked })} /> Hiện phân vùng trống
            </label>
          )}
        </div>

        {showCreate && canManage && (
          <form onSubmit={allocate} className="flex flex-col gap-3 border border-line rounded-xl p-3 bg-elevated/40">
            <div className="grid grid-cols-1 sm:grid-cols-[160px_220px_1fr] gap-3">
              <Field label="Nhánh">
                <select value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })} className={inputCls}>
                  {Object.entries(data.branches).map(([k, label]) => <option key={k} value={k} disabled={!data.templates_free?.[k]}>{label} ({data.templates_free?.[k] || 0} trống)</option>)}
                </select>
              </Field>
              <Field label="Mã phân vùng *"><input required pattern={NAME_PATTERN} title="Chữ, số và . _ : - (tối đa 64 ký tự)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={`${inputCls} font-mono`} placeholder="252_71ITNW30203_TC02" /></Field>
              <Field label="Tên đề tài / dự án *"><input required maxLength={255} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputCls} /></Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-3">
              <Field label="Loại" hint="Bỏ trống: giữ loại của phân vùng trống">
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={inputCls}>
                  <option value="">—</option>
                  {Object.entries(data.types).map(([k, label]) => <option key={k} value={k}>{label} ({k})</option>)}
                </select>
              </Field>
              <Field label="Trạng thái"><StatusInput value={form.status} onChange={v => setForm({ ...form, status: v })} data={data} /></Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Trưởng nhóm (uidNumber)"><input inputMode="numeric" value={form.primary_member} onChange={e => setForm({ ...form, primary_member: e.target.value })} className={`${inputCls} font-mono`} /></Field>
              <Field label="Người hướng dẫn (uidNumber)"><input value={form.supervisors} onChange={e => setForm({ ...form, supervisors: e.target.value })} className={`${inputCls} font-mono`} placeholder="1172201" /></Field>
              <Field label="Thành viên (uidNumber)"><input value={form.members} onChange={e => setForm({ ...form, members: e.target.value })} className={`${inputCls} font-mono`} placeholder="1172204, 1172205" /></Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setShowCreate(false)}>Hủy</Button>
              <Button type="submit" variant="primary" icon={Save} busy={busy === 'create'} disabled={createInvalid}>Cấp phát</Button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-line text-fg-muted">
                <th className="py-2 pr-4 font-medium">Phân vùng</th>
                <th className="py-2 pr-4 font-medium">Tên đề tài / dự án</th>
                <th className="py-2 pr-4 font-medium">Trạng thái</th>
                <th className="py-2 pr-4 font-medium">Thành viên</th>
                <th className="py-2 pr-4 font-medium">Kho Tri thức</th>
                <th className="py-2 pr-0 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.clouds.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-fg-subtle italic">Không có phân vùng nào.</td></tr>
              ) : data.clouds.map(c => (
                <tr key={c.dn} className={`border-b border-line last:border-0 align-top ${c.template ? 'opacity-60' : ''}`}>
                  <td className="py-2.5 pr-4">
                    <div className="font-mono font-semibold text-fg-strong">{c.name || 'Template'}</div>
                    <div className="text-[10px] font-mono text-fg-subtle">{c.branch}/{c.gid_number} · {data.types[c.type] || c.type || '—'}</div>
                  </td>
                  <td className="py-2.5 pr-4 min-w-[220px] text-fg">{c.template ? <i className="text-fg-subtle">Phân vùng trống</i> : c.description}</td>
                  <td className="py-2.5 pr-4"><StatusBadges status={c.status} visibility={data.visibility} lifecycle={data.lifecycle} /></td>
                  <td className="py-2.5 pr-4 whitespace-nowrap">
                    <button onClick={() => setMembersOf(c)} disabled={c.template} className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:text-fg-subtle disabled:no-underline">
                      <Users size={12} />{c.member_uids.length}
                    </button>
                    {c.legacy_member_uids.length > 0 && <span className="text-[10px] text-fg-subtle"> +{c.legacy_member_uids.length} cũ</span>}
                    <div className="text-[10px] text-fg-subtle">HD: <span className="font-mono">{c.supervisors.join(', ') || '—'}</span></div>
                  </td>
                  <td className="py-2.5 pr-4">
                    <div className="inline-flex items-center gap-1 font-mono text-[10px] text-fg-muted" title={c.folder}><Database size={11} />{c.collection}</div>
                  </td>
                  <td className="py-2.5 pr-0 text-right whitespace-nowrap">
                    {canManage && !c.template && (
                      <div className="inline-flex gap-1.5">
                        <Button icon={Pencil} disabled={!!busy} onClick={() => setEditing(c)}>Sửa</Button>
                        <Button variant="ghostDanger" icon={Trash2} busy={busy === `recycle-${c.dn}`} disabled={!!busy} onClick={() => recycle(c)}>Thu hồi</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {editing && <EditDialog cloud={editing} data={data} onClose={() => setEditing(null)}
        onSaved={(message) => { setEditing(null); setNotice({ type: 'success', text: message }); load(); }} />}
      {membersOf && <MembersDialog cloud={membersOf} canManage={canManage} onClose={() => setMembersOf(null)} onSaved={() => load()} />}
    </div>
  );
}
