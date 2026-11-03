/**
 * TARA AI Workspace - Main iThunder AI OS Entry Point (V6.11.01)
 * Tập tin tạo lập môi trường quản trị định danh người dùng.
 */

import React, { useRef, useState } from 'react';
import { Download, FileSpreadsheet, FlaskConical, Play, Upload } from 'lucide-react';
import { identityAPI } from '../../services/api';
import { Button, Notice, Section, controlCls } from './shared';

const ACTION_INFO = {
  create:    { label: 'Cấp mới',      cls: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-900/50' },
  update:    { label: 'Cập nhật',     cls: 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/30 dark:border-blue-900/50' },
  recycle:   { label: 'Thu hồi',      cls: 'text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950/30 dark:border-orange-900/50' },
  unchanged: { label: 'Không đổi',    cls: 'text-fg-subtle bg-elevated border-line' },
  error:     { label: 'Lỗi',          cls: 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/30 dark:border-red-900/50' },
};

const SAMPLE_CSV = 'code,full_name,email,group,title\n' +
  'NV100,Nguyễn Văn Mẫu,mau@to-chuc.vn,member|member:PROJ1,Kỹ sư\n' +
  'TT200,Trần Thị Thực Tập,thuctap@to-chuc.vn,intern:LAB1,\n' +
  'NV003,Người Nghỉ Việc,nghiviec@to-chuc.vn,delete,\n';

const show = (v) => Array.isArray(v) ? (v.join(', ') || '∅') : (v === '' || v === null || v === undefined ? '∅' : String(v));

const downloadSample = () => {
  const url = URL.createObjectURL(new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'mau_nap_nguoi_dung.csv' });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Nạp người dùng từ CSV (chạy thử bắt buộc trước khi áp dụng) và xuất CSV cùng định dạng
export default function ImportPanel({ onChanged }) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [sendPasscode, setSendPasscode] = useState(false);
  const [result, setResult] = useState(null);        // phản hồi của lần chạy thử / áp dụng gần nhất
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  const [exportStatus, setExportStatus] = useState('');
  const [filter, setFilter] = useState('changes');

  const pickFile = (f) => { setFile(f || null); setResult(null); setNotice(null); };

  const dryRun = async () => {
    setBusy('dry'); setNotice(null);
    try {
      const res = await identityAPI.importUsers(file, { dryRun: true });
      if (res?.summary) { setResult(res); setFilter('changes'); }
      else setNotice({ type: 'error', text: res?.detail || 'Không phân tích được tệp CSV.' });
    } finally { setBusy(''); }
  };

  const apply = async () => {
    const s = result.summary;
    if (!window.confirm(`Áp dụng ${s.create} cấp mới, ${s.update} cập nhật, ${s.recycle} thu hồi lên OpenLDAP? ${s.error} dòng lỗi sẽ bị bỏ qua.`)) return;
    setBusy('apply'); setNotice(null);
    try {
      const res = await identityAPI.importUsers(file, { dryRun: false, expectedHash: result.file_hash, sendPasscode });
      if (res?.summary) {
        setResult(res); setFilter('changes');
        setNotice({ type: res.summary.failed ? 'error' : 'success', text: `Đã áp dụng: ${res.summary.done} dòng thành công, ${res.summary.failed} dòng lỗi.` });
        onChanged();
      } else setNotice({ type: 'error', text: res?.detail || 'Không áp dụng được tệp CSV.' });
    } finally { setBusy(''); }
  };

  const exportCsv = async () => {
    setBusy('export'); setNotice(null);
    try {
      const res = await identityAPI.exportUsersCsv({ status: exportStatus });
      setNotice(res?.status === 'SUCCESS' ? { type: 'success', text: `Đã tải tệp ${res.fileName}.` } : { type: 'error', text: res?.detail || 'Không xuất được CSV.' });
    } finally { setBusy(''); }
  };

  const applied = result && !result.dry_run;
  const pending = result?.dry_run ? result.summary.create + result.summary.update + result.summary.recycle : 0;
  const rows = (result?.rows || []).filter(r => filter === 'all' || (filter === 'errors' ? (r.action === 'error' || r.status === 'failed') : r.action !== 'unchanged'));

  return (
    <div className="flex flex-col gap-4">
      <Notice notice={notice} onClose={() => setNotice(null)} />

      <Section title="Xuất danh sách người dùng" icon={Download}>
        <p className="text-[11px] text-fg-muted">Tệp CSV (UTF-8) cùng định dạng với tệp nạp: sửa trong Excel rồi nạp lại để cập nhật hàng loạt. Xuất dữ liệu cá nhân hàng loạt cần xác nhận PassCode.</p>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Trạng thái xuất" value={exportStatus} onChange={e => setExportStatus(e.target.value)} className={`${controlCls} w-auto`}>
            <option value="">Mọi trạng thái (trừ tài khoản trống)</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Chưa có PassCode</option>
            <option value="suspended">Tạm khóa</option>
          </select>
          <Button icon={Download} busy={busy === 'export'} disabled={!!busy} onClick={exportCsv}>Xuất CSV</Button>
        </div>
      </Section>

      <Section title="Nạp người dùng từ CSV" icon={Upload} actions={<Button icon={FileSpreadsheet} onClick={downloadSample}>Tải tệp mẫu</Button>}>
        <ul className="text-[11px] text-fg-muted list-disc pl-4 flex flex-col gap-0.5">
          <li>Cột: <code className="font-mono text-fg">code, full_name, email, group[, title]</code> — tương thích tệp nạp của AI-LMS; phân cách bằng dấu phẩy hoặc chấm phẩy.</li>
          <li><b>code</b> là mã nhân sự: đã có trong tổ chức thì cập nhật, chưa có thì cấp tài khoản từ kho tài khoản trống.</li>
          <li><b>group</b> là tập vai trò mong muốn, phân cách bằng <code className="font-mono">|</code> (vd. <code className="font-mono">member|member:PROJ1</code>); để trống: giữ nguyên; <code className="font-mono">delete</code>: thu hồi.</li>
          <li><b>email</b> được thêm vào tài khoản nếu chưa có (không xóa email cũ).</li>
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={e => pickFile(e.target.files?.[0])} className="hidden" aria-label="Chọn tệp CSV" />
          <Button icon={Upload} disabled={!!busy} onClick={() => fileRef.current?.click()}>{file ? 'Chọn tệp khác' : 'Chọn tệp CSV'}</Button>
          {file && <span className="text-xs font-mono text-fg truncate max-w-[260px]" title={file.name}>{file.name}</span>}
          <Button variant="primary" icon={FlaskConical} busy={busy === 'dry'} disabled={!file || !!busy} onClick={dryRun}>Chạy thử</Button>
        </div>

        {result && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="font-semibold text-fg">{applied ? 'Kết quả áp dụng:' : 'Kết quả chạy thử (chưa ghi gì lên OpenLDAP):'}</span>
              {Object.entries(ACTION_INFO).map(([k, info]) => (
                <span key={k} className={`px-2 py-0.5 rounded-md border font-semibold ${info.cls}`}>{info.label}: {result.summary[k] || 0}</span>
              ))}
              {applied && <span className="text-fg-muted">· {result.summary.done} thành công · {result.summary.failed} lỗi</span>}
            </div>

            {result.dry_run && (
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-fg">
                  <input type="checkbox" checked={sendPasscode} onChange={e => setSendPasscode(e.target.checked)} />
                  Cấp PassCode và gửi email cho tài khoản cấp mới
                </label>
                <Button variant="primary" icon={Play} busy={busy === 'apply'} disabled={!!busy || pending === 0} onClick={apply}>
                  Áp dụng {pending} thay đổi
                </Button>
              </div>
            )}

            <div className="flex gap-1 text-[11px]" role="radiogroup" aria-label="Lọc dòng">
              {[['changes', 'Có thay đổi / lỗi'], ['errors', 'Chỉ dòng lỗi'], ['all', 'Tất cả']].map(([k, label]) => (
                <button key={k} role="radio" aria-checked={filter === k} onClick={() => setFilter(k)}
                  className={`px-2.5 py-1 rounded-md border ${filter === k ? 'border-blue-500 text-fg-strong bg-active' : 'border-line text-fg-muted hover:bg-hover'}`}>{label}</button>
              ))}
            </div>

            <div className="border border-line rounded-xl overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-line text-fg-muted bg-elevated">
                    <th className="py-2 px-3 font-medium w-14">Dòng</th>
                    <th className="py-2 px-3 font-medium">Mã / Họ tên</th>
                    <th className="py-2 px-3 font-medium">Thao tác</th>
                    <th className="py-2 px-3 font-medium">Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={4} className="py-8 text-center text-fg-subtle italic">Không có dòng phù hợp.</td></tr>
                  ) : rows.map(r => {
                    const info = ACTION_INFO[r.action] || ACTION_INFO.error;
                    return (
                      <tr key={r.line} className="border-b border-line last:border-0 align-top">
                        <td className="py-2 px-3 font-mono text-fg-subtle">{r.line}</td>
                        <td className="py-2 px-3"><div className="font-mono text-fg">{r.owner_id || '—'}</div><div className="text-fg-muted">{r.full_name}</div></td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold ${info.cls}`}>{info.label}</span>
                          {r.status && <div className={`mt-1 text-[10px] font-semibold ${r.status === 'done' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{r.status === 'done' ? 'Đã ghi' : 'Thất bại'}{r.passcode_sent ? ' · đã gửi PassCode' : ''}</div>}
                        </td>
                        <td className="py-2 px-3">
                          {r.changes.map((c, n) => <div key={n} className="text-[10px] font-mono text-fg-muted break-all">{c.field}: {show(c.old)} → {show(c.new)}</div>)}
                          {r.errors.map((e, n) => <div key={`e${n}`} className="text-[11px] text-red-600 dark:text-red-400">{e}</div>)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
