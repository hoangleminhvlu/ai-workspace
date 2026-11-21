// Khối chọn AI Gateway và hiển thị Tổ chức trên các màn hình xác thực (tách từ App.jsx)
import { useEffect, useState } from 'react';
import {
  Loader2, Building2, Eye, EyeOff
} from 'lucide-react';
import { gatewayAPI, normalizeGatewayUrl } from '../services/api';
import { OTHER_ORG_HINT, ONPREM_ORG_HINT, isSafeWorkspaceUrl } from './gatewayUtils';

// Chọn Tổ chức khác rồi chuyển sang AI Workspace của Tổ chức đó (AI Gateway chạy trên Internet)
const OrgSwitcher = ({ organizations, onSwitch }) => {
  const [target, setTarget] = useState('');
  const others = organizations.filter(o => !o.current && isSafeWorkspaceUrl(o.workspace_url));
  const chosen = others.find(o => o.org_id === target);
  if (others.length === 0) return <div className="text-[11px] text-slate-400 mt-2 leading-relaxed">{OTHER_ORG_HINT}</div>;
  return (
    <div className="mt-2 flex flex-col gap-2">
      <label htmlFor="org-switch" className="text-[11px] text-slate-400 leading-relaxed">
        Không phải Tổ chức của bạn? Chọn Tổ chức để chuyển sang AI Workspace tương ứng:
      </label>
      <div className="flex gap-2">
        <select id="org-switch" value={target} onChange={e => setTarget(e.target.value)}
          className="flex-1 min-w-0 bg-slate-900 border border-slate-600 text-slate-100 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-cyan-400">
          <option value="">— Chọn Tổ chức —</option>
          {others.map(o => <option key={o.org_id} value={o.org_id}>{o.org_name} ({o.org_id})</option>)}
        </select>
        <button type="button" disabled={!chosen} onClick={() => (onSwitch ? onSwitch(chosen.workspace_url) : window.location.assign(chosen.workspace_url))}
          className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white disabled:bg-slate-700 disabled:text-slate-400 transition-colors">
          Chuyển
        </button>
      </div>
      {chosen && !onSwitch && (
        <div className="text-[10px] text-slate-500 break-all leading-relaxed">
          {onSwitch ? 'Kết nối AI Gateway' : 'Mở AI Workspace'}: {chosen.workspace_url}{chosen.description ? ` · ${chosen.description}` : ''}
        </div>
      )}
    </div>
  );
};

// Ứng dụng máy trạm: chọn Tổ chức khác ngay trong khung Tổ chức (không hiển thị địa chỉ AI Gateway, không phân biệt
// On-Premise / On-Clouds). Danh sách gộp: danh mục Tổ chức của AI Gateway đang kết nối, AI Gateway đã dùng thành công và
// AI Gateway khai báo sẵn (KNOWN_GATEWAYS, tên Tổ chức đọc từ /api/org/info) để luôn chọn quay về được. Mục cuối cho nhập
// địa chỉ AI Gateway do Quản trị viên cung cấp (AI Gateway nội bộ của Tổ chức không có trong danh sách).
export const MANUAL_GATEWAY = '__manual__';

const ClientOrgSwitcher = ({ org, onSwitch, onManual, disabled }) => {
  const [known, setKnown] = useState(() => gatewayAPI.suggestions());
  const [target, setTarget] = useState('');
  useEffect(() => {
    let alive = true;
    known.filter(g => !g.org_id).forEach(g => {
      gatewayAPI.describe(g.url).then(info => {
        if (alive && info) setKnown(list => list.map(x => (x.url === g.url ? { ...x, ...info } : x)));
      });
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const current = gatewayAPI.current();
  const choices = new Map();
  for (const o of org.organizations || []) {
    if (!o.current && o.org_id !== org.orgId && isSafeWorkspaceUrl(o.workspace_url)) {
      choices.set(o.org_id, { org_id: o.org_id, org_name: o.org_name || o.org_id, url: o.workspace_url });
    }
  }
  for (const g of known) {
    if (g.org_id && g.org_id !== org.orgId && g.url !== current && !choices.has(g.org_id)) {
      choices.set(g.org_id, { org_id: g.org_id, org_name: g.org_name || g.org_id, url: g.url });
    }
  }
  const list = [...choices.values()].sort((a, b) => a.org_name.localeCompare(b.org_name, 'vi'));
  const chosen = list.find(o => o.org_id === target);
  return (
    <div className="mt-2 flex flex-col gap-2">
      <label htmlFor="org-switch" className="text-[11px] text-slate-400 leading-relaxed">
        Không phải Tổ chức của bạn? Chọn Tổ chức để làm việc:
      </label>
      <div className="flex gap-2">
        <select id="org-switch" value={target} disabled={disabled}
          onChange={e => { if (e.target.value === MANUAL_GATEWAY) { setTarget(''); onManual(); } else setTarget(e.target.value); }}
          className="flex-1 min-w-0 bg-slate-900 border border-slate-600 text-slate-100 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-cyan-400">
          <option value="">— Chọn Tổ chức —</option>
          {list.map(o => <option key={o.org_id} value={o.org_id}>{o.org_name} ({o.org_id})</option>)}
          <option value={MANUAL_GATEWAY}>Tổ chức khác: nhập địa chỉ do Quản trị viên cung cấp…</option>
        </select>
        <button type="button" disabled={!chosen || disabled} onClick={() => { onSwitch(chosen.url); setTarget(''); }}
          className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white disabled:bg-slate-700 disabled:text-slate-400 transition-colors">
          Chuyển
        </button>
      </div>
    </div>
  );
};

// Khối "Tổ chức" trên trang Đăng nhập: người dùng biết mình đang vào AI Workspace của Tổ chức nào trước khi nhập PassCode.
// client: ứng dụng máy trạm (chọn Tổ chức bằng ClientOrgSwitcher, không hiện mạng Internet / nội bộ).
export const GatewayOrgCard = ({ org, onRetry, onSwitch, onManual, client = false, disabled = false }) => {
  if (org.status === 'none') return null;   // ứng dụng máy trạm chưa có AI Gateway: chỉ hiện ô nhập địa chỉ
  if (org.status === 'loading') {
    return (
      <div className="w-full bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 text-xs rounded-xl py-3 px-4 mt-4 flex items-center justify-center gap-2">
        <Loader2 size={13} className="animate-spin" /> Đang xác định Tổ chức...
      </div>
    );
  }
  if (org.status === 'error') {
    return (
      <div role="alert" className="w-full bg-amber-950/40 border border-amber-500/60 text-amber-100 text-xs rounded-xl py-3 px-4 mt-4 text-left leading-relaxed">
        <b>Chưa kết nối được AI Workspace của Tổ chức</b>{org.detail ? `: ${org.detail}` : ' (máy chủ chưa phản hồi).'}
        <button type="button" onClick={onRetry} className="ml-1 underline font-bold text-amber-300 hover:text-amber-200">Thử lại</button>
      </div>
    );
  }
  return (
    <div className="w-full bg-cyan-950/40 border border-cyan-500/50 rounded-xl py-3 px-4 mt-4 text-left shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5"><Building2 size={12} /> AI Workspace của Tổ chức</span>
        {!client && org.network && (
          <span className={`px-1.5 py-0.5 rounded border text-[9px] ${org.network === 'internet' ? 'border-cyan-500/50 text-cyan-300' : 'border-slate-500/60 text-slate-300'}`}>
            {org.network === 'internet' ? 'Internet' : 'Mạng nội bộ'}
          </span>
        )}
      </div>
      <div className="text-sm font-extrabold text-white mt-1 leading-snug">{org.orgName}</div>
      <div className="text-[11px] text-cyan-200/80 mt-0.5 font-mono">
        Mã Tổ chức: {org.orgId}{org.location ? ` · Máy chủ: ${org.location}` : ''}
      </div>
      {client
        ? <ClientOrgSwitcher org={org} onSwitch={onSwitch} onManual={onManual} disabled={disabled} />
        : org.switchEnabled
          ? <OrgSwitcher organizations={org.organizations} onSwitch={onSwitch} />
          : <div className="text-[11px] text-slate-400 mt-2 leading-relaxed">{org.network === 'onpremise' ? ONPREM_ORG_HINT : OTHER_ORG_HINT}</div>}
    </div>
  );
};

// Ứng dụng máy trạm: nhập địa chỉ AI Gateway do Quản trị viên cung cấp. Chỉ hiện khi chọn "Tổ chức khác" hoặc khi AI
// Gateway hiện tại không phản hồi. Ô nhập che ký tự (nút mắt để xem khi gõ), chặn sao chép; địa chỉ chỉ được ghi nhớ
// sau khi xác thực PassCode thành công và không hiển thị lại.
export const GatewayAddressForm = ({ status, onConnect, onCancel, disabled }) => {
  const [text, setText] = useState('');
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState('');
  const connect = () => {
    const res = normalizeGatewayUrl(text);
    if (res.error) { setError(res.error); return; }
    setError('');
    onConnect(res.url);
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); connect(); }} className="w-full mt-4 text-left flex flex-col gap-2">
      <label htmlFor="gateway-address" className="text-[11px] text-slate-400 leading-relaxed">
        Địa chỉ AI Workspace / AI Gateway do Quản trị viên của Tổ chức cung cấp:
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          {/* Che ký tự bằng CSS (không dùng type=password để trình duyệt không đề nghị lưu như mật khẩu) */}
          <input id="gateway-address" type="text" value={text} onChange={e => { setText(e.target.value); setError(''); }}
            autoComplete="off" inputMode="url" spellCheck={false} autoCapitalize="off" autoFocus
            onCopy={e => e.preventDefault()} onCut={e => e.preventDefault()} onContextMenu={e => e.preventDefault()}
            className={`w-full bg-slate-900 border border-slate-600 text-slate-100 text-xs font-mono rounded-lg pl-2 pr-7 py-1.5 focus:outline-none focus:border-cyan-400 ${reveal ? '' : '[-webkit-text-security:disc]'}`} />
          <button type="button" onClick={() => setReveal(v => !v)} aria-label={reveal ? 'Che địa chỉ' : 'Hiện địa chỉ đang nhập'}
            title={reveal ? 'Che địa chỉ' : 'Hiện địa chỉ đang nhập'}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
            {reveal ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
        <button type="submit" disabled={disabled || status === 'loading' || !text.trim()}
          className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white disabled:bg-slate-700 disabled:text-slate-400 transition-colors">
          {status === 'loading' ? <Loader2 size={13} className="animate-spin" /> : 'Kết nối'}
        </button>
      </div>
      {error && <div role="alert" className="text-[11px] text-red-300 leading-relaxed">{error}</div>}
      {onCancel && (
        <button type="button" onClick={onCancel} className="self-end text-[11px] text-slate-400 hover:text-slate-200 underline">Hủy</button>
      )}
    </form>
  );
};

// Một dòng "Tổ chức" cho các màn hình nhận PassCode, đăng ký, FaceID
export const GatewayOrgLine = ({ org }) => (org.status === 'ok' ? (
  <p className="text-[11px] text-cyan-300 mt-1.5 flex items-center justify-center gap-1" title={OTHER_ORG_HINT}>
    <Building2 size={11} className="shrink-0" />
    <span>Tổ chức: <b className="text-white">{org.orgName}</b> ({org.orgId})</span>
  </p>
) : null);
