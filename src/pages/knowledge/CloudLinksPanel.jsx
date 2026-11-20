/**
 * Quản trị Kho Tri thức › Kết nối Kho Đám mây: kéo tệp từ OneDrive, Google Drive, Dropbox, S3 (Amazon, IDrive e2, MinIO...),
 * SFTP (đám mây riêng iThunder Clouds), WebDAV (Nextcloud...) về thư mục <Kho>/Cloud/<tên kết nối>, một chiều, rồi nạp vào
 * Kho Tri thức. AI Platform truy cập đám mây qua Cloud Storage MCP Server. Thông tin đăng nhập chỉ đi một chiều: ô nhập không
 * bao giờ được điền sẵn. Tạo / sửa / xóa cần xác nhận PassCode.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUp, CheckCircle2, CircleSlash, Cloud, CloudDownload, Copy, Eye, EyeOff, Folder, FileText, Loader2, Pause, Pencil,
  Play, Plus, RefreshCw, Trash2, TriangleAlert
} from 'lucide-react';
import { setStepUpHandler, storageLinksAPI } from '../../services/api';
import { Button, Field, Modal, Notice, Section, inputCls } from '../identity/shared';
import StepUpDialog from '../identity/StepUpDialog';

const SCHEDULE_LABELS = { 0: 'Chỉ khi bấm Đồng bộ ngay', 60: 'Mỗi giờ', 360: 'Mỗi 6 giờ', 1440: 'Mỗi ngày' };
const formatTime = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }); } catch { return iso; }
};

function StatusChip({ link }) {
  const [label, cls, Icon, spin] = link.last_status === 'running'
    ? ['Đang đồng bộ', 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40', Loader2, true]
    : !link.enabled
      ? ['Tạm dừng', 'text-fg-muted bg-elevated border-line', CircleSlash]
      : link.last_status === 'error'
        ? ['Lỗi', 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40', TriangleAlert]
        : link.last_status === 'ok'
          ? ['Đã đồng bộ', 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40', CheckCircle2]
          : ['Chưa đồng bộ', 'text-fg-muted bg-elevated border-line', Cloud];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold shrink-0 ${cls}`}>
      <Icon size={11} className={spin ? 'animate-spin' : ''} /> {label}
    </span>
  );
}

// Ô nhập theo mô tả trường của Cloud Storage MCP Server
function ProviderField({ field, value, onChange, savedSecret }) {
  const [show, setShow] = useState(false);
  const secret = field.kind === 'secret' || field.kind === 'secret_text';
  const placeholder = secret && savedSecret ? 'Đã lưu (không hiển thị). Bỏ trống để giữ nguyên' : (field.default || '');
  let control;
  if (field.kind === 'select') {
    control = (
      <select value={value ?? field.default ?? ''} onChange={e => onChange(e.target.value)} className={inputCls}>
        {field.choices.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
      </select>
    );
  } else if (field.kind === 'secret_text') {
    control = (
      <textarea rows={3} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        autoComplete="off" spellCheck={false} className={`${inputCls} font-mono text-[11px] resize-y ${show ? '' : '[-webkit-text-security:disc]'}`} />
    );
  } else {
    control = (
      <input type={field.kind === 'secret' && !show ? 'password' : field.kind === 'number' ? 'number' : 'text'}
        value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        autoComplete={secret ? 'new-password' : 'off'} spellCheck={false} className={inputCls} />
    );
  }
  return (
    <Field label={<span className="flex items-center gap-1">{field.label}{field.required && !(secret && savedSecret) && <span className="text-red-500">*</span>}
      {secret && <button type="button" onClick={() => setShow(s => !s)} className="ml-auto text-fg-subtle hover:text-fg" aria-label={show ? 'Ẩn' : 'Hiện'}>{show ? <EyeOff size={12} /> : <Eye size={12} />}</button>}</span>}
      hint={field.help}>
      {control}
    </Field>
  );
}

function AuthorizeHint({ provider }) {
  const kind = provider.id;
  const command = `rclone authorize "${kind}"`;
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-line bg-elevated px-3 py-2 text-[11px] text-fg-muted flex flex-col gap-1.5">
      <span>Lấy mã ủy quyền: trên máy tính cá nhân có trình duyệt, cài <a className="text-blue-600 dark:text-blue-400 underline" href="https://rclone.org/downloads/" target="_blank" rel="noreferrer">rclone</a>, chạy lệnh sau, đăng nhập tài khoản {provider.label.split(' ')[0]} và cấp quyền, rồi dán chuỗi JSON lệnh in ra vào ô Mã ủy quyền.</span>
      <span className="flex items-center gap-2">
        <code className="font-mono text-fg bg-panel border border-line rounded px-2 py-1">{command}</code>
        <button type="button" onClick={() => { navigator.clipboard?.writeText(command); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="text-fg-subtle hover:text-fg flex items-center gap-1"><Copy size={12} /> {copied ? 'Đã chép' : 'Chép'}</button>
      </span>
    </div>
  );
}

function RemoteBrowser({ request, value, onPick }) {
  const [state, setState] = useState({ loading: false, path: null, entries: [], error: '' });
  const open = async (path) => {
    setState(s => ({ ...s, loading: true, error: '' }));
    const res = await storageLinksAPI.browse({ ...request(), path });
    if (res?.status === 'SUCCESS') setState({ loading: false, path: res.path, entries: res.entries || [], error: '', truncated: res.truncated });
    else setState(s => ({ ...s, loading: false, error: res?.detail || 'Không đọc được thư mục trên đám mây.' }));
  };
  const parent = (state.path || '').split('/').slice(0, -1).join('/');
  return (
    <div className="flex flex-col gap-2">
      <Button icon={state.loading ? Loader2 : Folder} busy={state.loading} onClick={() => open(value)} className="self-start">
        Kiểm tra kết nối và xem thư mục
      </Button>
      {state.error && <Notice notice={{ type: 'error', text: state.error }} />}
      {state.path !== null && !state.error && (
        <div className="border border-line rounded-xl bg-elevated max-h-56 overflow-y-auto text-xs">
          <div className="sticky top-0 bg-elevated border-b border-line px-3 py-1.5 flex items-center gap-2">
            <span className="font-mono text-fg truncate flex-1">/{state.path}</span>
            {state.path && <button type="button" onClick={() => open(parent)} className="text-fg-subtle hover:text-fg flex items-center gap-1"><ArrowUp size={12} /> Lên</button>}
            <button type="button" onClick={() => onPick(state.path)} className="text-blue-600 dark:text-blue-400 font-semibold">Chọn thư mục này</button>
          </div>
          {state.entries.length === 0 && <div className="px-3 py-2 text-fg-subtle italic">Thư mục trống.</div>}
          {state.entries.map(e => (
            <button type="button" key={e.name} disabled={!e.is_dir} onClick={() => open(state.path ? `${state.path}/${e.name}` : e.name)}
              className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-hover disabled:hover:bg-transparent disabled:cursor-default">
              {e.is_dir ? <Folder size={12} className="text-amber-500 shrink-0" /> : <FileText size={12} className="text-fg-subtle shrink-0" />}
              <span className={`truncate ${e.is_dir ? 'text-fg' : 'text-fg-muted'}`}>{e.name}</span>
            </button>
          ))}
          {state.truncated && <div className="px-3 py-1.5 text-fg-subtle">Chỉ hiện một phần danh sách.</div>}
        </div>
      )}
    </div>
  );
}

function LinkDialog({ storage, meta, link, onClose, onSaved }) {
  const editing = !!link;
  const [providerId, setProviderId] = useState(link?.provider || '');
  const provider = meta.providers.find(p => p.id === providerId);
  const [name, setName] = useState(link?.name || '');
  const [options, setOptions] = useState(link?.options || {});
  const [secrets, setSecrets] = useState({});
  const [remotePath, setRemotePath] = useState(link?.remote_path || '');
  const [mode, setMode] = useState(link?.mode || 'mirror');
  const [autoIndex, setAutoIndex] = useState(link ? link.auto_index : true);
  const [schedule, setSchedule] = useState(link?.schedule_minutes ?? 0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const pickProvider = (id) => {
    setProviderId(id);
    const p = meta.providers.find(x => x.id === id);
    setOptions(Object.fromEntries((p?.fields || []).filter(f => f.kind === 'select' || f.kind === 'number').filter(f => f.default !== undefined).map(f => [f.name, f.default])));
    setSecrets({});
  };
  const typedSecrets = () => Object.fromEntries(Object.entries(secrets).filter(([, v]) => v && v.trim()));
  const fieldsOf = (secret) => (provider?.fields || []).filter(f => (f.kind === 'secret' || f.kind === 'secret_text') === secret);
  const cleanOptions = () => Object.fromEntries(fieldsOf(false).map(f => [f.name, options[f.name] ?? f.default ?? '']).filter(([, v]) => v !== ''));
  // Xem thư mục: kết nối đã lưu và chưa nhập lại thông tin đăng nhập thì dùng thông tin đã lưu
  const browseRequest = () => (editing && Object.keys(typedSecrets()).length === 0
    ? { storage, link_id: link.id }
    : { storage, provider: providerId, options: cleanOptions(), secrets: typedSecrets() });

  const save = async () => {
    setBusy(true); setNotice(null);
    const body = { name: name.trim(), options: cleanOptions(), secrets: typedSecrets(), remote_path: remotePath.trim(),
      mode, auto_index: autoIndex, schedule_minutes: Number(schedule) };
    const res = editing ? await storageLinksAPI.update(link.id, body)
      : await storageLinksAPI.create({ ...body, storage, provider: providerId });
    setBusy(false);
    if (res?.status === 'SUCCESS') { onSaved(res.link); return; }
    setNotice({ type: 'error', text: res?.detail || 'Không lưu được kết nối.' });
  };

  return (
    <Modal title={editing ? `Sửa kết nối: ${link.name}` : 'Thêm kết nối Kho Đám mây'} onClose={onClose} width="max-w-2xl">
      {!editing && (
        <Field label="Dịch vụ đám mây">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {meta.providers.map(p => (
              <button type="button" key={p.id} onClick={() => pickProvider(p.id)}
                className={`text-left px-3 py-2 rounded-xl border text-xs transition-all ${providerId === p.id ? 'border-blue-500 bg-blue-600/10 text-fg-strong' : 'border-line bg-elevated text-fg hover:bg-hover'}`}>
                {p.label}
              </button>
            ))}
          </div>
        </Field>
      )}
      {provider && (
        <>
          <Field label="Tên kết nối" hint={`Tệp được kéo về thư mục ${meta.subdir}/${name.trim() || '<tên>'} của Kho Dữ liệu.`}>
            <input value={name} maxLength={60} onChange={e => setName(e.target.value)} className={inputCls} placeholder="vd. OneDrive Phòng Đào tạo" />
          </Field>
          {provider.oauth && <AuthorizeHint provider={provider} />}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[...fieldsOf(false), ...fieldsOf(true)].map(f => (
              <div key={f.name} className={f.kind === 'secret_text' || f.help?.length > 60 ? 'sm:col-span-2' : ''}>
                <ProviderField field={f} savedSecret={link?.secret_fields?.includes(f.name)}
                  value={(f.kind === 'secret' || f.kind === 'secret_text') ? secrets[f.name] : options[f.name]}
                  onChange={v => ((f.kind === 'secret' || f.kind === 'secret_text') ? setSecrets : setOptions)(s => ({ ...s, [f.name]: v }))} />
              </div>
            ))}
          </div>
          <Field label="Thư mục trên đám mây" hint={provider.path_help}>
            <input value={remotePath} onChange={e => setRemotePath(e.target.value)} className={`${inputCls} font-mono`} placeholder="/" />
          </Field>
          <RemoteBrowser request={browseRequest} value={remotePath} onPick={setRemotePath} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Cách đồng bộ" hint={mode === 'mirror' ? 'Thư mục trong Kho giống hệt đám mây: tệp bị xóa trên đám mây cũng được gỡ khỏi Kho.' : 'Chỉ thêm và cập nhật, không gỡ tệp đã kéo về.'}>
              <select value={mode} onChange={e => setMode(e.target.value)} className={inputCls}>
                <option value="mirror">Gương (giống hệt đám mây)</option>
                <option value="copy">Chỉ thêm, cập nhật</option>
              </select>
            </Field>
            <Field label="Lịch đồng bộ">
              <select value={schedule} onChange={e => setSchedule(e.target.value)} className={inputCls}>
                {meta.schedules.map(m => <option key={m} value={m}>{SCHEDULE_LABELS[m] || `Mỗi ${m} phút`}</option>)}
              </select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-xs text-fg">
            <input type="checkbox" checked={autoIndex} onChange={e => setAutoIndex(e.target.checked)} />
            Nạp tệp mới / đã sửa vào Kho Tri thức sau mỗi lần đồng bộ
          </label>
          <ul className="list-disc pl-5 text-[11px] text-fg-muted leading-relaxed">
            <li>Đồng bộ một chiều từ đám mây về Kho; AI Platform không bao giờ sửa, xóa dữ liệu trên đám mây.</li>
            <li>Chỉ kéo tệp PDF, DOCX, TXT, MD, tối đa {meta.max_file_mb} MB mỗi tệp, {meta.max_total_mb} MB mỗi lần đồng bộ.</li>
            <li>Thông tin đăng nhập được mã hóa, không hiển thị lại. Nên dùng tài khoản / khóa chỉ có quyền đọc.</li>
          </ul>
        </>
      )}
      <Notice notice={notice} />
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Hủy</Button>
        <Button variant="primary" icon={busy ? Loader2 : CloudDownload} busy={busy} disabled={!provider || !name.trim()} onClick={save}>
          {editing ? 'Lưu thay đổi' : 'Kiểm tra và lưu kết nối'}
        </Button>
      </div>
    </Modal>
  );
}

function LinkRow({ link, meta, onEdit, onChanged, onDeleted, onNotice }) {
  const [busy, setBusy] = useState('');
  const providerLabel = meta.providers.find(p => p.id === link.provider)?.label || link.provider;
  const act = async (kind, fn, okText) => {
    setBusy(kind);
    const res = await fn();
    setBusy('');
    if (res?.status !== 'SUCCESS') { onNotice({ type: 'error', text: res?.detail || 'Thao tác không thành công.' }); return null; }
    if (okText) onNotice({ type: 'success', text: okText });
    return res;
  };
  const sync = async () => { const res = await act('sync', () => storageLinksAPI.sync(link.id)); if (res) onChanged(res.link); };
  const toggle = async () => { const res = await act('toggle', () => storageLinksAPI.update(link.id, { enabled: !link.enabled })); if (res) onChanged(res.link); };
  const remove = async () => {
    if (!window.confirm(`Xóa kết nối "${link.name}"? Các tệp đã kéo về thư mục ${link.folder} được giữ lại trong Kho.`)) return;
    const res = await act('delete', () => storageLinksAPI.remove(link.id), `Đã xóa kết nối "${link.name}". Tệp trong ${link.folder} được giữ lại.`);
    if (res) onDeleted(link.id);
  };
  const running = link.last_status === 'running';
  const stats = link.last_stats || {};
  return (
    <div className="border border-line rounded-xl bg-elevated/40 px-3 py-2.5 flex flex-col gap-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <Cloud size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
        <span className="text-xs font-bold text-fg-strong truncate">{link.name}</span>
        <StatusChip link={link} />
        <span className="ml-auto flex items-center gap-1.5">
          <Button icon={running || busy === 'sync' ? Loader2 : RefreshCw} busy={busy === 'sync'} disabled={running || !link.enabled} onClick={sync}
            title="Kéo tệp mới / đã sửa từ đám mây về Kho ngay">Đồng bộ ngay</Button>
          <Button icon={Pencil} onClick={() => onEdit(link)} disabled={running} aria-label="Sửa kết nối" />
          <Button icon={link.enabled ? Pause : Play} busy={busy === 'toggle'} onClick={toggle} disabled={running}
            title={link.enabled ? 'Tạm dừng đồng bộ theo lịch' : 'Bật lại'} aria-label={link.enabled ? 'Tạm dừng' : 'Bật lại'} />
          <Button variant="ghostDanger" icon={Trash2} busy={busy === 'delete'} onClick={remove} disabled={running} aria-label="Xóa kết nối" />
        </span>
      </div>
      <div className="text-[11px] text-fg-muted flex flex-wrap gap-x-3 gap-y-0.5">
        <span>{providerLabel}: <code className="font-mono">/{link.remote_path}</code> → <code className="font-mono">{link.folder}</code></span>
        <span>{link.mode === 'mirror' ? 'Gương' : 'Chỉ thêm, cập nhật'} · {SCHEDULE_LABELS[link.schedule_minutes] || `${link.schedule_minutes} phút`}{link.auto_index ? ' · tự nạp Kho Tri thức' : ''}</span>
      </div>
      {running && <div className="text-[11px] text-blue-600 dark:text-blue-400">Đang kéo dữ liệu từ đám mây về Kho{link.auto_index ? ', sau đó nạp vào Kho Tri thức' : ''}...</div>}
      {!running && (link.last_run_at || link.last_message) && (
        <div className={`text-[11px] ${link.last_status === 'error' ? 'text-red-600 dark:text-red-400' : 'text-fg-subtle'}`}>
          {link.last_run_at && <span className="font-mono mr-1.5">{formatTime(link.last_run_at)}</span>}
          {link.last_message}
          {stats.changed_files?.length > 0 && <span className="text-fg-subtle"> ({stats.changed_files.slice(0, 5).join(', ')}{stats.changed_files.length > 5 ? '...' : ''})</span>}
        </div>
      )}
      {!link.secrets_ok && <div className="text-[11px] text-amber-600 dark:text-amber-400">Không giải mã được thông tin đăng nhập đã lưu: hãy Sửa và nhập lại.</div>}
    </div>
  );
}

export default function CloudLinksPanel({ storage, storeName, onSynced }) {
  const [meta, setMeta] = useState(null);
  const [links, setLinks] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [dialog, setDialog] = useState(null);        // { link? }
  const [stepUpRequest, setStepUpRequest] = useState(null);

  const load = useCallback(async () => {
    const res = await storageLinksAPI.list(storage);
    if (res?.status === 'SUCCESS') { setLinks(res.links); setError(''); }
    else setError(res?.detail || 'Không đọc được kết nối đám mây của Kho.');
    return res;
  }, [storage]);

  useEffect(() => {
    storageLinksAPI.providers().then(res => setMeta(res?.status === 'SUCCESS' ? res : { available: false, detail: res?.detail, providers: [] }));
  }, []);
  useEffect(() => { setLinks([]); setNotice(null); load(); }, [load]);
  useEffect(() => {
    setStepUpHandler((message) => new Promise(resolve => setStepUpRequest({ message, resolve })));
    return () => setStepUpHandler(null);
  }, []);
  const finishStepUp = (confirmed) => { stepUpRequest?.resolve(confirmed); setStepUpRequest(null); };

  // Đang đồng bộ: hỏi lại trạng thái mỗi 3 giây; xong thì làm mới danh sách tệp của Kho
  const running = useMemo(() => links.some(l => l.last_status === 'running'), [links]);
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(async () => {
      const res = await load();
      if (res?.status === 'SUCCESS' && !res.links.some(l => l.last_status === 'running')) onSynced?.();
    }, 3000);
    return () => clearInterval(timer);
  }, [running, load, onSynced]);

  const replace = (link) => setLinks(ls => ls.map(l => (l.id === link.id ? link : l)));
  const atLimit = meta && links.length >= (meta.max_per_store || 5);

  return (
    <Section title="Kết nối Kho Đám mây" icon={Cloud}
      actions={meta?.available && (
        <Button variant="primary" icon={Plus} disabled={atLimit} onClick={() => setDialog({})}
          title={atLimit ? `Mỗi Kho có tối đa ${meta.max_per_store} kết nối` : ''}>Thêm kết nối</Button>
      )}>
      <p className="text-[11px] text-fg-muted leading-relaxed">
        Kéo tài liệu từ OneDrive, Google Drive, Dropbox, S3 (Amazon, IDrive e2, MinIO...), máy chủ SFTP của đám mây riêng (iThunder Clouds)
        hoặc WebDAV (Nextcloud...) về Kho Dữ liệu <b>{storeName}</b> và nạp vào Kho Tri thức. Chỉ người có quyền quản trị Kho thấy và sửa được các kết nối này.
      </p>
      {meta && !meta.available && <Notice notice={{ type: 'info', text: meta.detail || 'Dịch vụ kết nối đám mây chưa sẵn sàng.' }} />}
      {error && <Notice notice={{ type: 'error', text: error }} />}
      <Notice notice={notice} onClose={() => setNotice(null)} />
      {!meta && <div className="text-xs text-fg-subtle flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Đang tải...</div>}
      {meta?.available && links.length === 0 && !error && <div className="text-xs text-fg-subtle italic">Kho chưa có kết nối đám mây nào.</div>}
      {links.map(link => (
        <LinkRow key={link.id} link={link} meta={meta || { providers: [] }} onEdit={l => setDialog({ link: l })} onChanged={replace}
          onDeleted={id => setLinks(ls => ls.filter(l => l.id !== id))} onNotice={setNotice} />
      ))}
      {dialog && meta && (
        <LinkDialog storage={storage} meta={meta} link={dialog.link} onClose={() => setDialog(null)}
          onSaved={(link) => {
            setDialog(null);
            setLinks(ls => (ls.some(l => l.id === link.id) ? ls.map(l => (l.id === link.id ? link : l)) : [...ls, link]));
            setNotice({ type: 'success', text: `Đã lưu kết nối "${link.name}". Bấm Đồng bộ ngay để kéo dữ liệu về Kho.` });
          }} />
      )}
      {stepUpRequest && <StepUpDialog request={stepUpRequest} minutes={meta?.step_up_minutes || 10} onDone={finishStepUp} />}
    </Section>
  );
}
