// Khối chọn AI Gateway và hiển thị Tổ chức trên các màn hình xác thực (tách từ App.jsx)
import { useEffect, useState } from 'react';
import {
  Loader2, Building2, Server, Eye, EyeOff, Lock
} from 'lucide-react';
import { gatewayAPI, gatewayKind, normalizeGatewayUrl } from '../services/api';
import { OTHER_ORG_HINT, ONPREM_ORG_HINT, CLIENT_ORG_HINT, GATEWAY_KIND_LABEL, isSafeWorkspaceUrl } from './gatewayUtils';

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

// Khối "Tổ chức" trên trang Đăng nhập: người dùng biết mình đang vào AI Workspace của Tổ chức nào trước khi nhập PassCode
export const GatewayOrgCard = ({ org, onRetry, onSwitch }) => {
  if (org.status === 'none') return null;   // ứng dụng máy trạm chưa chọn AI Gateway: chỉ hiện ô nhập AI Gateway
  if (org.status === 'loading') {
    return (
      <div className="w-full bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 text-xs rounded-xl py-3 px-4 mt-4 flex items-center justify-center gap-2">
        <Loader2 size={13} className="animate-spin" /> Đang xác định Tổ chức của AI Gateway...
      </div>
    );
  }
  if (org.status === 'error') {
    return (
      <div role="alert" className="w-full bg-amber-950/40 border border-amber-500/60 text-amber-100 text-xs rounded-xl py-3 px-4 mt-4 text-left leading-relaxed">
        <b>Chưa xác định được Tổ chức</b> của AI Gateway này{org.detail ? `: ${org.detail}` : ' (máy chủ chưa phản hồi thông tin Tổ chức).'}
        <button type="button" onClick={onRetry} className="ml-1 underline font-bold text-amber-300 hover:text-amber-200">Thử lại</button>
      </div>
    );
  }
  return (
    <div className="w-full bg-cyan-950/40 border border-cyan-500/50 rounded-xl py-3 px-4 mt-4 text-left shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5"><Building2 size={12} /> AI Workspace của Tổ chức</span>
        {org.network && (
          <span className={`px-1.5 py-0.5 rounded border text-[9px] ${org.network === 'internet' ? 'border-cyan-500/50 text-cyan-300' : 'border-slate-500/60 text-slate-300'}`}>
            {org.network === 'internet' ? 'Internet' : 'Mạng nội bộ'}
          </span>
        )}
      </div>
      <div className="text-sm font-extrabold text-white mt-1 leading-snug">{org.orgName}</div>
      <div className="text-[11px] text-cyan-200/80 mt-0.5 font-mono">
        Mã Tổ chức: {org.orgId}{org.location ? ` · Máy chủ: ${org.location}` : ''}
      </div>
      {org.switchEnabled
        ? <OrgSwitcher organizations={org.organizations} onSwitch={onSwitch} />
        : <div className="text-[11px] text-slate-400 mt-2 leading-relaxed">{onSwitch ? CLIENT_ORG_HINT : org.network === 'onpremise' ? ONPREM_ORG_HINT : OTHER_ORG_HINT}</div>}
    </div>
  );
};

// Ứng dụng máy trạm: chọn AI Gateway — On-Premise (http, IP/tên máy nội bộ) hoặc On-Clouds (https qua Internet).
// Kết nối = đọc /api/org/info để người dùng thấy đúng Tổ chức trước khi nhập PassCode; chỉ ghi nhớ sau khi xác thực thành công.
// Cha đặt key={current}: đổi AI Gateway thì khối này khởi tạo lại.
// Không hiển thị địa chỉ AI Gateway (đã kết nối, đã ghi nhớ, khai báo sẵn): chỉ hiện Tổ chức và loại kết nối; ô nhập địa
// chỉ mới mặc định che ký tự. Ứng dụng vẫn dùng địa chỉ để gọi AI Gateway nhưng người dùng không xem, không sao chép được.
const suggestionLabel = (g, i) => (g.org_name ? `${g.org_name}${g.org_id ? ` (${g.org_id})` : ''}` : g.org_id || `AI Gateway ${i + 1}`);

export const GatewayPicker = ({ current, status, onConnect, disabled }) => {
  const [editing, setEditing] = useState(!current);
  const [text, setText] = useState('');
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState(() => gatewayAPI.suggestions());
  const open = editing || !current || status === 'error' || status === 'none';
  const kind = current ? gatewayKind(current) : '';

  // AI Gateway khai báo sẵn chưa biết Tổ chức: hỏi /api/org/info để gợi ý theo tên Tổ chức thay vì địa chỉ
  useEffect(() => {
    let alive = true;
    suggestions.filter(g => !g.org_id).forEach(g => {
      gatewayAPI.describe(g.url).then(org => {
        if (alive && org) setSuggestions(list => list.map(x => (x.url === g.url ? { ...x, ...org } : x)));
      });
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = (value) => {
    const res = normalizeGatewayUrl(value);
    if (res.error) { setError(res.error); return; }
    setError('');
    setText(res.url);
    setEditing(false);
    onConnect(res.url);
  };
  const forget = (url) => { gatewayAPI.forget(url); setSuggestions(gatewayAPI.suggestions()); };

  return (
    <div className="w-full mt-4 text-left">
      <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5"><Server size={12} /> AI Gateway</span>
        {kind && <span className="px-1.5 py-0.5 rounded border border-slate-500/60 text-slate-300 text-[9px]">{GATEWAY_KIND_LABEL[kind]}</span>}
      </div>
      {!open ? (
        <div className="mt-1 flex items-center gap-2 select-none">
          <span className="flex-1 min-w-0 truncate text-[11px] text-slate-200 flex items-center gap-1.5">
            <Lock size={11} className="shrink-0 text-slate-400" /> Đã kết nối AI Gateway của Tổ chức (địa chỉ được ẩn)
          </span>
          <button type="button" disabled={disabled} onClick={() => { setText(''); setReveal(false); setEditing(true); }}
            className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-cyan-500/50 text-cyan-300 hover:bg-cyan-900/40 disabled:opacity-50 transition-colors">
            Đổi
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); connect(text); }} className="mt-1 flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              {/* Che ký tự bằng CSS (không dùng type=password để trình duyệt không đề nghị lưu như mật khẩu) */}
              <input type="text" value={text} onChange={e => { setText(e.target.value); setError(''); }}
                placeholder="Địa chỉ do Quản trị viên Tổ chức cung cấp" aria-label="Địa chỉ AI Gateway"
                autoComplete="off" inputMode="url" spellCheck={false} autoCapitalize="off"
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
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {suggestions.slice(0, 6).map((g, i) => (
                <span key={g.url} className="inline-flex items-center rounded-full border border-slate-600 text-[10px] text-slate-300 overflow-hidden select-none">
                  <button type="button" disabled={disabled} onClick={() => connect(g.url)}
                    title={`Kết nối AI Gateway ${suggestionLabel(g, i)}${gatewayKind(g.url) ? ` · ${GATEWAY_KIND_LABEL[gatewayKind(g.url)]}` : ''}`}
                    className="px-2 py-0.5 hover:bg-slate-700 hover:text-white">{g.org_id || suggestionLabel(g, i)}</button>
                  {g.last_used && (
                    <button type="button" onClick={() => forget(g.url)} aria-label={`Quên AI Gateway ${suggestionLabel(g, i)}`} title="Quên AI Gateway này"
                      className="px-1.5 py-0.5 border-l border-slate-600 hover:bg-red-900/50 hover:text-red-200">×</button>
                  )}
                </span>
              ))}
            </div>
          )}
          {error && <div role="alert" className="text-[11px] text-red-300 leading-relaxed">{error}</div>}
          <p className="text-[10px] text-slate-500 leading-relaxed">
            On-Premise: <span className="font-mono">http://IP-nội-bộ:cổng</span> · On-Clouds: <span className="font-mono">https://tên-miền</span>.
            Địa chỉ chỉ được ghi nhớ sau khi xác thực PassCode thành công và không hiển thị lại.
          </p>
          {editing && current && status === 'ok' && (
            <button type="button" onClick={() => { setEditing(false); setError(''); }} className="self-end text-[11px] text-slate-400 hover:text-slate-200 underline">
              Giữ AI Gateway hiện tại
            </button>
          )}
        </form>
      )}
    </div>
  );
};

// Một dòng "Tổ chức" cho các màn hình nhận PassCode, đăng ký, FaceID
export const GatewayOrgLine = ({ org }) => (org.status === 'ok' ? (
  <p className="text-[11px] text-cyan-300 mt-1.5 flex items-center justify-center gap-1" title={OTHER_ORG_HINT}>
    <Building2 size={11} className="shrink-0" />
    <span>Tổ chức: <b className="text-white">{org.orgName}</b> ({org.orgId})</span>
  </p>
) : null);
