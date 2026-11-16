/**
 * Tab "AI Platform" của trang Giám sát Hệ thống: dịch vụ nền mà AI Platform phụ thuộc (GET /api/system/status).
 * PostgreSQL + pgvector, OpenLDAP, Redis, Ollama Embedding, SMTP, lưu trữ Kho Dữ liệu, MCP Server bên ngoài;
 * cảnh báo cấu hình và thông tin tiến trình AI Platform. Backend tự đệm kết quả; trang hỏi lại mỗi STATUS_INTERVAL_MS.
 */
import { useEffect, useRef, useState } from 'react';
import {
  CircleCheck, CircleX, CircleMinus, TriangleAlert, Info, Database, ShieldCheck, Radio, Sparkles, Mail, HardDrive,
  Plug, Server, RefreshCw, Loader2, Building2
} from 'lucide-react';
import { systemAPI } from '../../services/api';
import useLatestCallback from '../../hooks/useLatestCallback';

const STATUS_INTERVAL_MS = 30000;

// Trạng thái của một dịch vụ: nhãn, màu chấm, màu chữ, biểu tượng
const SERVICE_STATE = {
  ok:       { label: 'Hoạt động',  dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', Icon: CircleCheck },
  warning:  { label: 'Cần xử lý',  dot: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400',     Icon: TriangleAlert },
  error:    { label: 'Lỗi',        dot: 'bg-red-500',     text: 'text-red-600 dark:text-red-400',         Icon: CircleX },
  disabled: { label: 'Tắt',        dot: 'bg-slate-400',   text: 'text-fg-subtle',                         Icon: CircleMinus },
  unknown:  { label: 'Chưa gọi',   dot: 'bg-slate-400',   text: 'text-fg-subtle',                         Icon: CircleMinus },
};

const SERVICE_ICON = { postgres: Database, ldap: ShieldCheck, redis: Radio, embedding: Sparkles, smtp: Mail, storage: HardDrive, mcp: Plug };

const WARNING_STYLE = {
  danger:  'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300',
  warning: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300',
  info:    'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40 text-blue-800 dark:text-blue-300',
};

const formatUptime = (seconds) => {
  if (seconds == null) return '—';
  const d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600), m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d} ngày ${h} giờ` : h > 0 ? `${h} giờ ${m} phút` : `${m} phút`;
};

const formatTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('vi-VN');
};

function StateBadge({ state }) {
  const s = SERVICE_STATE[state] || SERVICE_STATE.unknown;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold shrink-0 ${s.text}`}>
      <s.Icon size={13} /> {s.label}
    </span>
  );
}

function ServiceCard({ service }) {
  const Icon = SERVICE_ICON[service.id] || Server;
  return (
    <div className="bg-panel border border-line rounded-2xl p-4 flex flex-col gap-2 shadow-sm min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-elevated border border-line flex items-center justify-center shrink-0">
            <Icon size={15} className="text-blue-600 dark:text-blue-400" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-bold text-fg-strong truncate">{service.name}</div>
            <div className="text-[11px] text-fg-subtle truncate" title={service.role}>{service.role}</div>
          </div>
        </div>
        <StateBadge state={service.state} />
      </div>
      <div className="text-xs text-fg leading-relaxed break-words">{service.detail || '—'}</div>
      <div className="flex items-center justify-between gap-2 text-[11px] text-fg-subtle font-mono min-w-0">
        <span className="truncate" title={service.target}>{service.target || ''}</span>
        {service.latency_ms != null && <span className="shrink-0">{service.latency_ms} ms</span>}
      </div>
      {Array.isArray(service.items) && service.items.length > 0 && (
        <ul className="mt-1 border-t border-line pt-2 flex flex-col gap-1">
          {service.items.map(item => {
            const s = SERVICE_STATE[item.state] || SERVICE_STATE.unknown;
            return (
              <li key={item.id} className="flex items-center gap-2 text-[11px] min-w-0"
                title={item.checked_at ? `Lần gọi gần nhất: ${formatTime(item.checked_at)}` : undefined}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                <span className="font-semibold text-fg truncate">{item.name}</span>
                <span className="font-mono text-fg-subtle truncate hidden sm:inline">{item.target}</span>
                <span className={`ml-auto shrink-0 ${s.text}`}>{item.detail}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function InfoRow({ label, children, mono = false }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-line last:border-0 text-xs">
      <span className="text-fg-muted shrink-0">{label}</span>
      <span className={`text-fg-strong text-right break-all ${mono ? 'font-mono text-[11px]' : 'font-medium'}`}>{children}</span>
    </div>
  );
}

const FEATURE_LABELS = {
  mcp_server: 'MCP Server (/api/mcp)',
  mcp_client: 'MCP Client trong khung Chat',
  comm: 'Trao đổi trực tuyến',
  comm_calls_turn: 'Máy chủ TURN cho gọi thoại / video',
  org_switch: 'Chọn Tổ chức trên trang Đăng nhập',
};

function PlatformCard({ platform }) {
  return (
    <div className="bg-panel border border-line rounded-2xl p-4 shadow-sm flex flex-col gap-3 min-w-0">
      <h3 className="text-xs font-bold text-fg-strong uppercase tracking-wider flex items-center gap-2 border-b border-line pb-2">
        <Server size={14} className="text-blue-600 dark:text-blue-400" /> Tiến trình AI Platform
      </h3>
      <div>
        <InfoRow label="Phiên bản" mono>{platform.version || '—'}</InfoRow>
        <InfoRow label="Máy chủ" mono>{platform.hostname} · PID {platform.pid}</InfoRow>
        <InfoRow label="Hệ điều hành / Python" mono>{platform.os} · Python {platform.python}</InfoRow>
        <InfoRow label="Đã chạy">{formatUptime(platform.uptime_seconds)} (từ {formatTime(platform.started_at)})</InfoRow>
      </div>
      <h3 className="text-xs font-bold text-fg-strong uppercase tracking-wider flex items-center gap-2 border-b border-line pb-2 mt-1">
        <Building2 size={14} className="text-blue-600 dark:text-blue-400" /> Tổ chức và AI Gateway
      </h3>
      <div>
        <InfoRow label="Tổ chức">{platform.org_name} ({platform.org_id})</InfoRow>
        <InfoRow label="Địa điểm máy chủ" mono>{platform.location || '—'}</InfoRow>
        <InfoRow label="AI Gateway">{platform.gateway_network === 'internet' ? 'Internet (On-Clouds)' : 'Mạng nội bộ (On-Premise)'}</InfoRow>
        <InfoRow label="AI Workspace" mono>{platform.workspace_url || '—'}</InfoRow>
        <InfoRow label="Địa chỉ AI Gateway" mono>{platform.gateway_url || '—'}</InfoRow>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(platform.features || {}).map(([key, on]) => (
          <span key={key} className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${on
            ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10'
            : 'border-line text-fg-subtle bg-elevated'}`} title={on ? 'Đang bật' : 'Đang tắt'}>
            {on ? '●' : '○'} {FEATURE_LABELS[key] || key}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function PlatformStatusPanel() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const activeRef = useRef(true);

  const load = async (refresh = false) => {
    setLoading(true);
    const res = await systemAPI.getStatus(refresh);
    if (!activeRef.current) return;
    setLoading(false);
    if (res?.status === 'SUCCESS' && Array.isArray(res.services)) {
      setData(res);
      setError('');
    } else {
      setError(res?.detail || 'Không lấy được trạng thái AI Platform.');
    }
  };
  // Hỏi lại định kỳ khi tab đang mở (loadLatest ổn định nhờ useLatestCallback)
  const loadLatest = useLatestCallback(load);
  useEffect(() => {
    activeRef.current = true;
    loadLatest();
    const timer = setInterval(() => loadLatest(), STATUS_INTERVAL_MS);
    return () => { activeRef.current = false; clearInterval(timer); };
  }, [loadLatest]);

  const summary = data?.summary || {};
  const overall = summary.error ? 'error' : summary.warning ? 'warning' : data ? 'ok' : null;
  const overallText = { ok: 'Mọi dịch vụ nền hoạt động bình thường', warning: 'Có dịch vụ cần xử lý', error: 'Có dịch vụ đang lỗi' };

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="bg-panel border border-line rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {overall ? <StateBadge state={overall} /> : <Loader2 size={14} className="animate-spin text-fg-muted" />}
          <div className="min-w-0">
            <div className="text-sm font-bold text-fg-strong">{overall ? overallText[overall] : 'Đang kiểm tra các dịch vụ nền...'}</div>
            {data && (
              <div className="text-[11px] text-fg-subtle">
                {summary.ok || 0} hoạt động · {summary.warning || 0} cần xử lý · {summary.error || 0} lỗi · {summary.disabled || 0} tắt
                {' · '}kiểm tra lúc {formatTime(data.timestamp)}
              </div>
            )}
          </div>
        </div>
        <button onClick={() => load(true)} disabled={loading}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-elevated border border-line text-fg hover:bg-hover disabled:opacity-60">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Kiểm tra lại
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl px-4 py-2.5">
          <TriangleAlert size={14} className="shrink-0" />{error}
        </div>
      )}

      {data?.warnings?.length > 0 && (
        <div className="flex flex-col gap-2">
          {data.warnings.map((w, i) => (
            <div key={i} className={`flex items-start gap-2 text-xs leading-relaxed border rounded-xl px-4 py-2.5 ${WARNING_STYLE[w.level] || WARNING_STYLE.info}`}>
              {w.level === 'info' ? <Info size={14} className="shrink-0 mt-0.5" /> : <TriangleAlert size={14} className="shrink-0 mt-0.5" />}
              <span>{w.message}</span>
            </div>
          ))}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6 items-start">
          <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.services.map(service => <ServiceCard key={service.id} service={service} />)}
          </div>
          {data.platform && <PlatformCard platform={data.platform} />}
        </div>
      )}
    </div>
  );
}
