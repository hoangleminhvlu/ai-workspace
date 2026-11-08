/**
 * TARA AI Workspace - Main iThunder AI OS Entry Point (V6.09.27)
 * Tập tin khởi chạy và cấu hình môi trường AI Workspace cho người dùng.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Sun, Moon,
  ShieldCheck, Camera, Loader2, CircleAlert, CircleX, KeyRound,
  UserPlus, CornerDownLeft, Sparkles, FolderGit, MessageSquare,
  LogOut, Plus, Send, Paperclip, ChevronLeft, ChevronRight, Menu,
  Database, FileText, HardDrive, RefreshCw, Trash2, Eye,
  Upload, Download, X, FolderOpen, Search, Users, UserCircle, Cable, MessagesSquare, FolderKanban, Globe, History, Activity, Library,
  Building2, Server
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import iThunderAPI, { handleUnauthorized, describeError, getStoragePermission, identityAPI, openCloud, closeCloud, takePendingDomain, takePendingThread, getGatewayConfig, notifyAuthChanged, gatewayAPI, gatewayKind, normalizeGatewayUrl } from './services/api';
import PublicCloudsDialog from './pages/PublicCloudsDialog';
import useLatestCallback from './hooks/useLatestCallback';

// Mã phiên hội thoại (thread) mới: mỗi lần đăng nhập/đăng xuất hoặc đổi kho tri thức là một thread riêng,
// tránh ghi vào thread của người dùng trước (Backend trả 403) và để danh sách thread theo kho khớp nội dung
const newThreadId = () => {
  const unique = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `thread_${unique}`;
};

// Nhóm Kho Tri thức trong danh sách chọn ở thanh bên (Kho Cá nhân hiện riêng)
const PERSONAL_STORE = 'Personal';
const STORE_GROUPS = [
  { id: 'org', label: 'Kho của Tổ chức' },
  { id: 'cloud', label: 'Dự án / phân vùng của bạn' },
  { id: 'opened', label: 'Phân vùng đã mở' },
];
const storeGroup = (c) => (c?.opened ? 'opened' : c?.scope === 'cloud' ? 'cloud' : 'org');
const storeLabel = (c) => (c?.scope === 'cloud' ? c.cloud?.name || c.display_name : c?.display_name || c?.storage_key);

// Số khung hình FaceID không khớp/không thấy khuôn mặt liên tiếp trước khi tạm dừng quét
const MAX_FACE_ATTEMPTS = 8;

// Chính sách lưu lịch sử hội thoại khi chưa biết (chưa nạp /api/auth/me hoặc Backend chưa có API này)
const UNKNOWN_HISTORY_POLICY = { enabled: null, roles: [] };

// Danh mục lệnh nhanh (Slash Commands) hiển thị khi gõ "/" trong ô Chat/Work
const SLASH_COMMANDS = [
  { cmd: '/menu', desc: 'Hiển thị thanh điều hướng tác vụ chính' },
  { cmd: '/history', desc: 'Xem lịch sử hội thoại của kho đang chọn (mọi kho: mục Lịch sử Làm việc)' },
  { cmd: '/thread', desc: 'Khôi phục hội thoại gần nhất (/thread <số> theo /history)' },
  { cmd: '/knowledge', desc: 'Quản trị và kiểm tra danh mục kho tri thức' },
  { cmd: '/analytics', desc: 'Giám sát hạ tầng và hiệu năng AI Server' },
  { cmd: '/mcp', desc: 'Tích hợp MCP: kết nối Claude Desktop/Claude Code, công cụ AI bên ngoài' },
  { cmd: '/comm', desc: 'Trao đổi trực tuyến: nhắn tin người dùng, nhóm, Trợ lý AI' },
  { cmd: '/rag-sync', desc: 'Kích hoạt đồng bộ hóa thư mục vật lý tại Backend' }
];

// Trạng thái đồng bộ của tập tin Kho Dữ liệu vào Kho Tri thức (trường sync_state do Backend trả về)
const SYNC_STATE = {
  synced:     { label: 'Đã RAG',      dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  outdated:   { label: 'Cần RAG lại', dot: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400' },
  not_synced: { label: 'Chưa RAG',    dot: 'bg-slate-400',   text: 'text-fg-subtle' }
};

// Hiển thị thời gian ISO theo định dạng Việt Nam
const formatDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString('vi-VN');
};

// Tổ chức sở hữu AI Gateway (Backend /api/org/info): status 'loading' | 'ok' | 'error'
// network: 'internet' | 'onpremise'; switchEnabled + organizations: chọn Tổ chức khác (chỉ AI Gateway chạy trên Internet)
const ORG_LOADING = { status: 'loading', orgId: '', orgName: '', orgUrl: '', location: '', network: '', switchEnabled: false, organizations: [] };
const OTHER_ORG_HINT = 'Không phải Tổ chức của bạn? Hãy đăng nhập tại AI Gateway của Tổ chức mình (địa chỉ do Quản trị viên Tổ chức cung cấp).';
const ONPREM_ORG_HINT = 'AI Gateway nội bộ (On-Premise): chỉ phục vụ mạng của Tổ chức này. Không phải Tổ chức của bạn? Hãy dùng AI Gateway do Quản trị viên Tổ chức mình cung cấp.';
const CLIENT_ORG_HINT = 'Không phải Tổ chức của bạn? Bấm "Đổi" ở mục AI Gateway để kết nối AI Gateway của Tổ chức mình (địa chỉ do Quản trị viên Tổ chức cung cấp).';

// AI Workspace chạy như ứng dụng máy trạm (http://localhost, Desktop, Mobile): người dùng chọn AI Gateway trên trang Đăng nhập
const CLIENT_APP = gatewayAPI.isClientApp();
const GATEWAY_KIND_LABEL = { onpremise: 'On-Premise · Mạng nội bộ', onclouds: 'On-Clouds · Internet' };
const gatewayHost = (url) => { try { return new URL(url).host; } catch { return url; } };

// Chỉ chuyển trang tới https (hoặc http://localhost khi phát triển): kiểm tra lại phía máy trạm dù Backend đã lọc danh mục
const isSafeWorkspaceUrl = (url) => /^https:\/\/[^\s/@]+/i.test(url) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url);

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
      {chosen && (
        <div className="text-[10px] text-slate-500 break-all leading-relaxed">
          {onSwitch ? 'Kết nối AI Gateway' : 'Mở AI Workspace'}: {chosen.workspace_url}{chosen.description ? ` · ${chosen.description}` : ''}
        </div>
      )}
    </div>
  );
};

// Khối "Tổ chức" trên trang Đăng nhập: người dùng biết mình đang vào AI Workspace của Tổ chức nào trước khi nhập PassCode
const GatewayOrgCard = ({ org, onRetry, onSwitch }) => {
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
// Cha đặt key={current}: đổi AI Gateway thì khối này khởi tạo lại (thu gọn, ô nhập mang địa chỉ mới).
const GatewayPicker = ({ current, status, onConnect, disabled }) => {
  const [editing, setEditing] = useState(!current);
  const [text, setText] = useState(current || '');
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState(() => gatewayAPI.suggestions());
  const open = editing || !current || status === 'error' || status === 'none';
  const kind = current ? gatewayKind(current) : '';

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
        <div className="mt-1 flex items-center gap-2">
          <span className="flex-1 min-w-0 truncate font-mono text-[11px] text-slate-200" title={current}>{current}</span>
          <button type="button" disabled={disabled} onClick={() => { setText(current); setEditing(true); }}
            className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-cyan-500/50 text-cyan-300 hover:bg-cyan-900/40 disabled:opacity-50 transition-colors">
            Đổi
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); connect(text); }} className="mt-1 flex flex-col gap-2">
          <div className="flex gap-2">
            <input type="text" list="gateway-suggestions" value={text} onChange={e => { setText(e.target.value); setError(''); }}
              placeholder="https://aigate.to-chuc.vn · http://192.168.1.10:8088" aria-label="Địa chỉ AI Gateway"
              autoComplete="url" inputMode="url" spellCheck={false} autoCapitalize="off"
              className="flex-1 min-w-0 bg-slate-900 border border-slate-600 text-slate-100 text-xs font-mono rounded-lg px-2 py-1.5 focus:outline-none focus:border-cyan-400" />
            <button type="submit" disabled={disabled || status === 'loading' || !text.trim()}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white disabled:bg-slate-700 disabled:text-slate-400 transition-colors">
              {status === 'loading' ? <Loader2 size={13} className="animate-spin" /> : 'Kết nối'}
            </button>
          </div>
          <datalist id="gateway-suggestions">
            {suggestions.map(g => <option key={g.url} value={g.url}>{g.org_name ? `${g.org_name} (${g.org_id})` : ''}</option>)}
          </datalist>
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {suggestions.slice(0, 6).map(g => (
                <span key={g.url} className="inline-flex items-center rounded-full border border-slate-600 text-[10px] text-slate-300 overflow-hidden">
                  <button type="button" disabled={disabled} onClick={() => connect(g.url)} title={g.org_name ? `${g.org_name} · ${g.url}` : g.url}
                    className="px-2 py-0.5 hover:bg-slate-700 hover:text-white">{g.org_id || gatewayHost(g.url)}</button>
                  {g.last_used && (
                    <button type="button" onClick={() => forget(g.url)} aria-label={`Quên AI Gateway ${g.url}`} title="Quên AI Gateway này"
                      className="px-1.5 py-0.5 border-l border-slate-600 hover:bg-red-900/50 hover:text-red-200">×</button>
                  )}
                </span>
              ))}
            </div>
          )}
          {error && <div role="alert" className="text-[11px] text-red-300 leading-relaxed">{error}</div>}
          <p className="text-[10px] text-slate-500 leading-relaxed">
            On-Premise: <span className="font-mono">http://IP-nội-bộ:cổng</span> · On-Clouds: <span className="font-mono">https://tên-miền</span>.
            Địa chỉ chỉ được ghi nhớ sau khi xác thực PassCode thành công.
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
const GatewayOrgLine = ({ org }) => (org.status === 'ok' ? (
  <p className="text-[11px] text-cyan-300 mt-1.5 flex items-center justify-center gap-1" title={OTHER_ORG_HINT}>
    <Building2 size={11} className="shrink-0" />
    <span>Tổ chức: <b className="text-white">{org.orgName}</b> ({org.orgId})</span>
  </p>
) : null);

export default function App() {
  const navigate = useNavigate();
  // Điều hướng phân cảnh giao diện: 'LOGIN' | 'FACEID' | 'GET_CODE' | 'REGISTER' | 'WORKSPACE'
  const [viewState, setViewState] = useState('LOGIN');
 
  // Trạng thái Form & Xác thực
  const [passcode, setPasscode] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [clientIp, setClientIp] = useState('127.0.0.1');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  // PassCode đúng nhưng tài khoản chưa thuộc Tổ chức: { token, message, orgName, sent } để đề nghị đăng ký trở thành Khách
  const [joinOffer, setJoinOffer] = useState(null);

  // Tổ chức sở hữu AI Gateway này (đọc trước khi đăng nhập; trong Workspace được bổ sung từ /api/auth/me)
  const [orgInfo, setOrgInfo] = useState(ORG_LOADING);
  // AI Gateway đang dùng ('' khi ứng dụng máy trạm chưa chọn); fresh: vừa đổi AI Gateway => không giữ Tổ chức cũ
  const [activeGateway, setActiveGateway] = useState(() => gatewayAPI.current());
  const orgRequestRef = useRef(0);
  const loadOrgInfo = async ({ fresh = false } = {}) => {
    const request = ++orgRequestRef.current;   // chỉ nhận kết quả của lần đọc mới nhất (đổi AI Gateway liên tiếp)
    setOrgInfo(prev => (!fresh && prev.status === 'ok' ? prev : ORG_LOADING));
    const res = await iThunderAPI.getOrgInfo();
    if (request !== orgRequestRef.current) return false;
    if (res?.status === 'SUCCESS' && res.org_id) {
      setOrgInfo({
        status: 'ok', orgId: res.org_id, orgName: res.org_name || res.org_id, orgUrl: res.org_url || '', location: res.location || '',
        network: res.network || '', switchEnabled: !!res.switch_enabled, organizations: Array.isArray(res.organizations) ? res.organizations : []
      });
      return true;
    }
    setOrgInfo(prev => (!fresh && prev.status === 'ok' ? prev : { ...ORG_LOADING, status: 'error', detail: res?.detail || '' }));
    return false;
  };

  // Ứng dụng máy trạm: kết nối thử AI Gateway ứng viên; chỉ ghi nhớ khi xác thực PassCode thành công (gatewayAPI.commit)
  const connectGateway = async (url) => {
    gatewayAPI.setCandidate(url);
    setActiveGateway(gatewayAPI.current());
    setJoinOffer(null);
    setErrorMessage('');
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }   // kênh FaceID của AI Gateway cũ
    return loadOrgInfo({ fresh: true });
  };

  // Mở trang: Web đọc Tổ chức của chính tên miền. Ứng dụng máy trạm chưa ghi nhớ AI Gateway thì tự dò chính địa chỉ
  // đang mở (dev proxy / AI Gateway phục vụ luôn giao diện) rồi DEFAULT_GATEWAY_URL; không được thì chờ người dùng nhập.
  // Chỉ DÒ (không đổi AI Gateway ứng viên) cho tới khi tìm được địa chỉ phản hồi: hai lượt dò chạy cùng lúc (React
  // StrictMode chạy effect hai lần khi phát triển) không làm lượt này hủy kết quả của lượt kia.
  const loadOrgInfoOnMount = useLatestCallback(async () => {
    if (!CLIENT_APP || gatewayAPI.saved()) { loadOrgInfo(); return; }
    const order = gatewayAPI.discoveryOrder();
    for (const url of order) {
      const res = await iThunderAPI.getOrgInfo(url);
      if (res?.status === 'SUCCESS' && res.org_id) { await connectGateway(url); return; }
    }
    if (order.length) await connectGateway(order[order.length - 1]);   // hiện lỗi kèm địa chỉ để người dùng sửa
    else setOrgInfo({ ...ORG_LOADING, status: 'none' });
  });
  useEffect(() => { loadOrgInfoOnMount(); }, [loadOrgInfoOnMount]);

  // Tiêu đề thẻ trình duyệt kèm Mã Tổ chức: phân biệt khi mở AI Workspace của nhiều Tổ chức cùng lúc
  useEffect(() => {
    document.title = orgInfo.status === 'ok' ? `${orgInfo.orgId} · iThunder AI Workspace` : 'iThunder AI Workspace';
  }, [orgInfo.status, orgInfo.orgId]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFaceProcessing, setIsFaceProcessing] = useState(false);

  // Điều khiển ẩn/hiện Sidebar Trái & Phải
  // Điện thoại (< 768px): hai thanh bên mặc định đóng và mở dạng lớp phủ, nhường toàn bộ chiều ngang cho khung Chat
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(() => window.matchMedia('(min-width: 1024px)').matches);

  // --- BỔ SUNG KHỐI STATE THEME VÀO ĐÂY ---
  const [theme, setTheme] = useState(localStorage.getItem('tara_theme') || 'dark');

  // Chu kỳ đồng bộ class `.dark` lên thẻ html tổng của trang web
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('tara_theme', theme);
  }, [theme]);

  // Quản lý Dữ liệu Workspace
  const [userData, setUserData] = useState({ userId: "1162000", ownerId: "", userName: "Khách", userRole: "visitor", userOrg: "AI-TECH Center" });
  const [activeDomain, setActiveDomain] = useState('Personal');
  // Mô hình LLM: danh mục đọc động từ Máy chủ AI (Backend /api/models <- Ollama /api/tags); lựa chọn được nhớ trên máy trạm
  // Mỗi mô hình thuộc một Máy chủ AI LLM Runtime (ai_runtimes.json của Backend); runtime rỗng => Backend tự chọn
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('tara_model') || window.TARA_CONFIG?.DEFAULT_MODEL || 'gemma4:latest');
  const [selectedRuntime, setSelectedRuntime] = useState(() => localStorage.getItem('tara_runtime') || '');
  const [chatModels, setChatModels] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(newThreadId);

  // Kho dữ liệu RAG & Chat
  const [collections, setCollections] = useState([]);
  const [showPublicClouds, setShowPublicClouds] = useState(false);   // hộp thoại mở Kho của phân vùng Public
  const [messages, setMessages] = useState([]);
  const [inputPrompt, setInputPrompt] = useState('');

  // Kho Dữ liệu (tập tin trên máy chủ Backend) của kho đang chọn — bảng quản trị ở RightSidebar
  const [dataFiles, setDataFiles] = useState([]);
  const [dataFilesLoading, setDataFilesLoading] = useState(false);
  const [dataFilesError, setDataFilesError] = useState('');
  const [dataFilter, setDataFilter] = useState('');
  const [dataNotice, setDataNotice] = useState(null);       // { type: 'success' | 'error' | 'info', text }
  const [dataBusyPath, setDataBusyPath] = useState(null);   // Tệp đang đồng bộ/xóa; '__upload__' khi đang tải lên
  const [autoSyncUpload, setAutoSyncUpload] = useState(true);
  const [viewer, setViewer] = useState(null);               // Tập tin đang xem trong cửa sổ Chat/Work
  const dataFileInputRef = useRef(null);
  const dataRequestRef = useRef(0);                         // Bỏ kết quả cũ khi người dùng đã đổi kho trong lúc chờ
  const viewerRequestRef = useRef(0);
  const dataNoticeTimerRef = useRef(null);

  // Hàm nạp/làm mới danh mục kho tri thức thời gian thực từ API Gateway [2]
  // Đã chuẩn hóa: Tiếp nhận đối tượng overrideUser để triệt tiêu độ trễ cập nhật State của React
  const refreshCollections = async (overrideUser = null) => {
    // Ưu tiên sử dụng dữ liệu truyền vào trực tiếp, nếu không có mới dùng State hiện tại
    const currentUser = overrideUser || userData;

    // Nếu chưa có bất kỳ thông tin user nào, không phát lệnh gọi API
    if (!currentUser || !currentUser.userId) return;

    try {
      // Backend xác định định danh và vai trò từ JWT; mỗi kho trả về kèm quyền 'manage' | 'read'
      const data = await iThunderAPI.getCollections();
      if (Array.isArray(data)) {
        setCollections(data);
        // Kho đang chọn không còn quyền truy cập (vd. tài khoản Khách dùng chung không có Kho Cá nhân): chuyển sang kho đầu tiên
        if (data.length > 0) setActiveDomain(cur => data.some(c => c.storage_key === cur) ? cur : data[0].storage_key);
        // Lối tắt "Mở Kho" từ tab Phân vùng của Quản trị Định danh: chọn kho đó làm kho đang dùng
        const pending = takePendingDomain();
        const target = pending && data.find(c => c.storage_key === pending);
        if (target) { setActiveDomain(target.storage_key); setActiveThreadId(newThreadId()); }
        // Nút "Tiếp tục hội thoại" ở trang Lịch sử Làm việc: chọn kho của phiên rồi nạp lại tin nhắn
        const thread = takePendingThread();
        if (thread && data.some(c => c.storage_key === thread.domain)) {
          setActiveDomain(thread.domain);
          restoreThread(thread);
        } else if (thread) {
          setMessages([{ role: "assistant", content: "⚠️ **[Không thể tiếp tục]:** Bạn không còn quyền truy cập Kho Tri thức `" + (thread.domain || "?") + "` của phiên _" + (thread.title || thread.thread_id) + "_." }]);
        }
      }
    } catch (err) {
      console.warn("[iThunder Data] Không thể liên thông nạp dữ liệu thống kê phân vùng:", err);
    }
  };

  // Chính sách lưu lịch sử hội thoại theo vai trò: khai báo DUY NHẤT tại Backend (config.py: CHAT_HISTORY_ROLES),
  // giao diện đọc qua /api/auth/me. enabled = null khi chưa biết (chưa nạp hoặc Backend chưa có API này).
  const [historyPolicy, setHistoryPolicy] = useState(UNKNOWN_HISTORY_POLICY);

  const refreshHistoryPolicy = async () => {
    try {
      const me = await iThunderAPI.getCurrentUser();
      // Gateway chưa trả /api/org/info (vd. phiên bản Backend cũ) => lấy Tổ chức từ thông tin phiên
      if (me?.org_id) {
        setOrgInfo(prev => (prev.status === 'ok' ? prev : { ...ORG_LOADING, status: 'ok', orgId: me.org_id, orgName: me.org_name || me.user_org || me.org_id }));
      }
      if (me?.owner_id) {
        setUserData(prev => {
          if (prev.ownerId === me.owner_id || String(prev.userId) !== String(me.user_id)) return prev;
          const next = { ...prev, ownerId: me.owner_id };
          localStorage.setItem("tara_user", JSON.stringify(next));
          return next;
        });
      }
      if (me && typeof me.chat_history_enabled === "boolean") {
        const policy = { enabled: me.chat_history_enabled, roles: Array.isArray(me.chat_history_roles) ? me.chat_history_roles : [] };
        setHistoryPolicy(policy);
        return policy;
      }
    } catch (err) {
      console.warn("[iThunder Data] Không thể nạp chính sách lưu lịch sử hội thoại:", err);
    }
    return UNKNOWN_HISTORY_POLICY;
  };

  // Tự động làm mới thông số khi người dùng click chuyển đổi qua lại giữa các dòng tên Kho Tri thức [2, 4]
  // Cho phép gọi nạp kho tri thức cho TẤT CẢ vai trò (bao gồm cả visitor)
  // useLatestCallback: effect chỉ chạy khi viewState đổi nhưng luôn gọi các hàm làm mới phiên bản mới nhất
  const onViewStateChange = useLatestCallback(() => {
    if (viewState === 'WORKSPACE')  {
      refreshCollections();
      refreshHistoryPolicy();
      refreshIdentityPermissions();
      refreshChatModels();
    } else {
      setHistoryPolicy(UNKNOWN_HISTORY_POLICY);  // Đăng xuất / hết phiên: quên chính sách của người dùng trước
      setIdentityPermissions([]);
    }
  });
  useEffect(() => { onViewStateChange(); }, [viewState, onViewStateChange]);

  // Danh mục mô hình của các Máy chủ AI; lựa chọn cũ không còn => cùng tên ở runtime khác, hoặc mô hình mặc định của Backend
  const refreshChatModels = async () => {
    const res = await iThunderAPI.getModels();
    if (res?.status !== 'SUCCESS' || !Array.isArray(res.models) || res.models.length === 0) return;
    setChatModels(res.models);
    const model = localStorage.getItem('tara_model');
    const runtime = localStorage.getItem('tara_runtime');
    const match = res.models.find(m => m.name === model && m.runtime === runtime) || res.models.find(m => m.name === model);
    setSelectedModel(match ? match.name : res.default_model);
    setSelectedRuntime(match ? match.runtime : (res.default_runtime || ''));
  };

  useEffect(() => {
    localStorage.setItem('tara_model', selectedModel);
    localStorage.setItem('tara_runtime', selectedRuntime);
  }, [selectedModel, selectedRuntime]);

  const modelKey = (runtime, name) => `${runtime}::${name}`;
  const selectModel = (key) => {
    const [runtime, ...name] = key.split('::');
    setSelectedRuntime(runtime);
    setSelectedModel(name.join('::'));
  };
  const modelLabel = (model) => {
    const known = window.TARA_CONFIG?.MODEL_LIST?.[model.name];
    const info = [model.parameter_size, model.loaded ? '● sẵn sàng' : null].filter(Boolean).join(' · ');
    return known ? `${known}${model.loaded ? ' · ● sẵn sàng' : ''}` : `${model.name}${info ? ` (${info})` : ''}`;
  };
  const modelGroups = chatModels.reduce((groups, model) => {
    const group = groups.find(g => g.runtime === model.runtime);
    if (group) group.models.push(model);
    else groups.push({ runtime: model.runtime, name: model.runtime_name, models: [model] });
    return groups;
  }, []);

  // Quyền Quản trị Định danh do Backend đọc lại từ OpenLDAP: quyết định có hiện mục "Quản trị Định danh" ở LeftSidebar
  const [identityPermissions, setIdentityPermissions] = useState([]);
  const refreshIdentityPermissions = async () => {
    try {
      const res = await identityAPI.getMyPermissions();
      setIdentityPermissions(Array.isArray(res?.permissions) ? res.permissions : []);
    } catch {
      setIdentityPermissions([]);
    }
  };

  const onActiveDomainChange = useLatestCallback(() => {
    if (viewState === 'WORKSPACE') {
      refreshCollections();
    }
  });
  useEffect(() => { onActiveDomainChange(); }, [activeDomain, onActiveDomainChange]);

  // Trạng thái bộ lọc lệnh gạch chéo (Slash Commands)
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState([]);
  const [selectedCmdIndex, setSelectedCmdIndex] = useState(0);

  const slashCommands = SLASH_COMMANDS;
  const historyListRef = useRef([]);  // Danh sách thread của lần /history gần nhất, dùng cho /thread <số>

  // Tham chiếu phần cứng máy trạm
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const faceIntervalRef = useRef(null);
  const faceAwaitingRef = useRef(false);   // Đang chờ kết quả khung hình trước: không gửi dồn khung mới
  const faceFailCountRef = useRef(0);      // Số khung hình thất bại liên tiếp
  const faceSucceededRef = useRef(false);  // Lượt quét hiện tại đã xác thực thành công
  const [faceScanStopped, setFaceScanStopped] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const promptInputRef = useRef(null);

  // Ô nhập Prompt tự giãn theo nội dung (bắt đầu 1 dòng, tối đa 40% chiều cao màn hình rồi mới cuộn)
  useEffect(() => {
    const el = promptInputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, Math.round(window.innerHeight * 0.4))}px`;
  }, [inputPrompt, viewState]);

 // --- TỰ ĐỘNG PHỤC HỒI PHIÊN LÀM VIỆC KHI REFRESH TRÌNH DUYỆT (F5) ---
  // Chạy một lần khi mở trang (restoreSession ổn định nhờ useLatestCallback)
  const restoreSession = useLatestCallback(() => {
    // Lý do bị đăng xuất khi đang ở trang khác "/" (vd. tài khoản bị tạm khóa trong lúc mở /identity)
    try {
      const reason = sessionStorage.getItem("tara_logout_reason");
      if (reason) { sessionStorage.removeItem("tara_logout_reason"); setErrorMessage(reason); }
    } catch { /* sessionStorage có thể bị chặn: bỏ qua */ }

    const savedToken = localStorage.getItem("tara_token");
    const savedUserStr = localStorage.getItem("tara_user");

    // Nếu tồn tại token hợp lệ và khác chuỗi rỗng/None
    if (savedToken && savedToken !== "None" && savedToken !== "") {
      setIsLoading(true);

      // CHUẨN HÓA: Phục hồi thông tin nhân sự chính chủ, triệt tiêu bẫy Guest 1162000
      if (savedUserStr) {
        try {
          const parsedUser = JSON.parse(savedUserStr);
          if (parsedUser && parsedUser.userId) {
            setUserData(parsedUser); // <--- Trả lại chính xác ID và Tên người dùng
            setViewState('WORKSPACE');
            // Ép lệnh refresh đọc trực tiếp gói biến đệm vừa phân rã để kéo đúng dữ liệu RBAC
            refreshCollections(parsedUser);
          }
        } catch (e) {
          console.error("Lỗi phân giải cấu trúc dữ liệu người dùng:", e);
          setViewState('WORKSPACE');
          refreshCollections();
        }
      } else {
        setViewState('WORKSPACE');
        refreshCollections();
      }

      setIsLoading(false);
    }
  });
  useEffect(() => { restoreSession(); }, [restoreSession]);

  useEffect(() => {
    // Thu thập IP máy trạm tự động
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setClientIp(data.ip))
      .catch(() => console.warn("[iThunder] Sử dụng IP mạng nội bộ dự phòng."));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Backend trả 401 (token hết hạn / không hợp lệ): api.js đã xóa phiên cục bộ, đưa người dùng về màn hình đăng nhập
  useEffect(() => {
    const onSessionExpired = (e) => {
      setMessages([]);
      setCollections([]);
      setActiveThreadId(newThreadId());
      setUserData({ userId: "1162000", ownerId: "", userName: "Khách", userRole: "visitor", userOrg: "AI-TECH Center" });
      setErrorMessage(e.detail || "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại!");
      setIsLoading(false);
      setViewState('LOGIN');
    };
    window.addEventListener('tara:session-expired', onSessionExpired);
    return () => window.removeEventListener('tara:session-expired', onSessionExpired);
  }, []);

  // =========================================================================
  // XỬ LÝ LỆNH GẠCH CHÉO (SLASH COMMANDS) ENGINE
  // =========================================================================
  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputPrompt(value);

    if (value.startsWith('/')) {
      const searchWord = value.toLowerCase();
      const filtered = slashCommands.filter(c => c.cmd.toLowerCase().startsWith(searchWord));
      setFilteredCommands(filtered);
      setShowSlashMenu(filtered.length > 0);
      setSelectedCmdIndex(0);
    } else {
      setShowSlashMenu(false);
    }
  };

  const selectCommand = (commandStr) => {
    setInputPrompt(commandStr + " ");
    setShowSlashMenu(false);
  };

  const handleInputKeyDown = (e) => {
    if (showSlashMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCmdIndex(prev => (prev + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCmdIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectCommand(filteredCommands[selectedCmdIndex].cmd);
      } else if (e.key === 'Escape') {
        setShowSlashMenu(false);
      }
    } else {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendPrompt();
      }
    }
  };

  // =========================================================================
  // KẾT NỐI WEBSOCKET XÁC THỰC VÀ BIỂU MẪU ĐĂNG NHẬP
  // =========================================================================
  // =========================================================================
  // KẾT NỐI WEBSOCKET XÁC THỰC VÀ BIỂU MẪU ĐĂNG NHẬP
  // =========================================================================
  
  // Địa chỉ AI Gateway: dùng chung getGatewayConfig của services/api.js (mặc định là chính tên miền đang mở AI Workspace)

  const initWebSocketConnection = (onOpenCallback) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      if (onOpenCallback) onOpenCallback();
      return;
    }

    const { wsUrl } = getGatewayConfig();

    // Khởi tạo thực thể kênh truyền trắc sinh học FaceID bảo mật
    const socket = new WebSocket(`${wsUrl}/ws/auth`);

    socket.onopen = () => {
      wsRef.current = socket;
      if (onOpenCallback) onOpenCallback();
    };

    socket.onmessage = (event) => {
      try {
        const res = JSON.parse(event.data);
        setIsLoading(false);
        faceAwaitingRef.current = false; // Kết quả khung hình trước đã về: cho phép gửi khung tiếp theo

        if (res.status === "REQUIRE_FACEID") {
          setStatusMessage(res.message);
          setViewState('FACEID');
          setTimeout(() => startWebcamHardware(), 500);
        } else if (res.status === "SUCCESS") {
          // Khung hình còn đang xử lý có thể trả thêm SUCCESS: chỉ xử lý lần đầu của mỗi lượt quét
          if (faceSucceededRef.current) return;
          faceSucceededRef.current = true;
          setStatusMessage(res.message);
          setErrorMessage('');
          stopWebcamHardware();
          faceFailCountRef.current = 0;
          gatewayAPI.commit();   // ứng dụng máy trạm: ghi nhớ AI Gateway vừa xác thực thành công
          localStorage.setItem("tara_token", res.access_token || "");

          const sessionUser = {
            userId: res.user_id,
            ownerId: res.owner_id || "",
            userName: res.user_name,
            userRole: res.user_role || "member",
            userOrg: res.user_org
          };
          localStorage.setItem("tara_user", JSON.stringify(sessionUser));
          notifyAuthChanged();

          setUserData(sessionUser);
          setActiveThreadId(newThreadId());
          setViewState('WORKSPACE');
        } else if (res.status === "JOIN_REQUIRED") {
          // Kênh WebSocket xác thực PassCode: tài khoản chưa thuộc Tổ chức
          stopWebcamHardware();
          setJoinOffer({ token: res.join_token, message: res.message, orgName: res.org_name, sent: false });
          setViewState('LOGIN');
        } else if (res.status === "BAD_IMAGE" || res.status === "FAIL" || res.status === "ERROR") {
          setErrorMessage(res.message);
          faceFailCountRef.current += 1;

          // Lỗi PassCode/hệ thống: dừng ngay. Lỗi tạm thời (không thấy mặt, ảnh mờ, chưa khớp): tiếp tục quét đến giới hạn
          const fatal = res.status === "ERROR" || res.code === "ACCOUNT_SUSPENDED" || res.code === "JOIN_REQUIRED" || /passcode/i.test(res.message || "");
          if (fatal || faceFailCountRef.current >= MAX_FACE_ATTEMPTS) {
            stopWebcamHardware();
            setFaceScanStopped(true);
          }
        }
      } catch (err) { console.error("Lỗi phân rã gói tin trắc sinh học WS:", err); }
    };

    socket.onerror = () => {
      setErrorMessage("Mất kết nối cổng bảo mật tới AI Gateway.");
      setIsLoading(false);
    };

    // Kênh bị đóng (Backend khởi động lại, mất mạng): dừng gửi khung hình vào socket đã chết
    socket.onclose = () => {
      if (wsRef.current === socket) wsRef.current = null;
      faceAwaitingRef.current = false;
      if (faceIntervalRef.current) {
        stopWebcamHardware();
        setFaceScanStopped(true);
        setErrorMessage("Kênh xác thực FaceID đã bị ngắt. Hãy bấm Quét lại.");
      }
    };
  };

  const startWebcamHardware = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 480, facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsFaceProcessing(true);
        setFaceScanStopped(false);
        faceAwaitingRef.current = false;
        faceSucceededRef.current = false;
        if (faceIntervalRef.current) clearInterval(faceIntervalRef.current);
        faceIntervalRef.current = setInterval(() => {
          if (!videoRef.current || !canvasRef.current || !wsRef.current) return;
          if (wsRef.current.readyState !== WebSocket.OPEN) return;
          // Backend xử lý tuần tự: chỉ gửi khung mới khi kết quả khung trước đã về, tránh dồn hàng đợi
          if (faceAwaitingRef.current) return;
          faceAwaitingRef.current = true;
          const context = canvasRef.current.getContext('2d');
          canvasRef.current.width = 320;
          canvasRef.current.height = 320;
          context.drawImage(videoRef.current, 0, 0, 320, 320);
          const base64Frame = canvasRef.current.toDataURL('image/jpeg', 0.85).replace(/^data:image\/[a-z]+;base64,/, "");
          wsRef.current.send(JSON.stringify({ action: "verify_faceid", passcode: passcode, domain: activeDomain, clientIp: clientIp, image: base64Frame }));
        }, 1200);
      }
    } catch { setErrorMessage("Không thể kích hoạt Webcam máy trạm. Vui lòng cấp quyền."); }
  };

  const stopWebcamHardware = () => {
    if (faceIntervalRef.current) clearInterval(faceIntervalRef.current);
    faceIntervalRef.current = null;
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setIsFaceProcessing(false);
  };

  // Quét lại sau khi tạm dừng: mở lại kênh WebSocket nếu đã bị đóng, reset bộ đếm lỗi
  const retryFaceScan = () => {
    faceFailCountRef.current = 0;
    setErrorMessage('');
    setFaceScanStopped(false);
    initWebSocketConnection(() => setTimeout(() => startWebcamHardware(), 300));
  };

  // Người dùng đồng ý trở thành Khách: Backend gửi liên kết xác nhận tới Email đăng ký của tài khoản
  const acceptJoinOffer = async () => {
    if (!joinOffer?.token) return;
    setIsLoading(true);
    setErrorMessage('');
    const res = await iThunderAPI.requestJoin(joinOffer.token);
    setIsLoading(false);
    if (res.status === "SUCCESS") setJoinOffer({ ...joinOffer, sent: true, message: res.message });
    else setErrorMessage(res.message || "Không gửi được yêu cầu trở thành Khách của Tổ chức.");
  };

  const handlePasscodeSubmit = async (e) => {
    e.preventDefault();
    if (CLIENT_APP && orgInfo.status !== 'ok') {
      setErrorMessage('Hãy nhập địa chỉ và Kết nối AI Gateway của Tổ chức trước khi xác thực PassCode.');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    setJoinOffer(null);

    try {
      // Cùng AI Gateway với mọi API khác (/api/org/info, /ws/auth...): đúng Backend của Tổ chức đang mở
      const response = await fetch(`${getGatewayConfig().httpUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcode, clientIp: clientIp })
      });

      const res = await response.json();
      setIsLoading(false);

      if (res.status === "SUCCESS") {
        // LUỒNG MIỄN FACEID: Lưu token và thông tin, vào thẳng luôn Workspace
        gatewayAPI.commit();   // ứng dụng máy trạm: ghi nhớ AI Gateway vừa xác thực thành công
        localStorage.setItem("tara_token", res.access_token || "");
        const sessionUser = {
          userId: res.user_id,
          ownerId: res.owner_id || "",
          userName: res.user_name,
          userRole: res.user_role || "member",
          userOrg: res.user_org
        };
        localStorage.setItem("tara_user", JSON.stringify(sessionUser));
        notifyAuthChanged();
        setUserData(sessionUser);
        setActiveThreadId(newThreadId());
        setViewState('WORKSPACE'); // Chuyển thẳng trang
      }
      else if (res.status === "JOIN_REQUIRED") {
        // PassCode đúng nhưng chưa là thành viên của Tổ chức: đề nghị đăng ký trở thành Khách (xác nhận qua Email)
        setPasscode('');
        setJoinOffer({ token: res.join_token, message: res.message, orgName: res.org_name, sent: false });
      }
      else if (res.status === "REQUIRE_FACEID") {
        // LUỒNG BẮT BUỘC QUÉT FACEID: Kích hoạt kết nối và bật camera quét
        setStatusMessage(res.message);
        setViewState('FACEID');
        initWebSocketConnection(() => {
          // Bật ngầm luồng WebSocket để sẵn sàng hứng base64 camera gửi lên
          console.log("[iThunder Gateway] Đã kết nối kênh trắc sinh học FaceID.");
          setTimeout(() => startWebcamHardware(), 500);
        });
      } 
      else {
        setErrorMessage(res.message || "Mã PassCode không chính xác!");
      }
    } catch {
      setIsLoading(false);
      const gateway = getGatewayConfig().httpUrl;
      setErrorMessage(`Không thể kết nối API xác thực của AI Gateway${gateway ? ` ${gateway}` : ''}.`);
    }
  };

  // =========================================================================
  // XỬ LÝ KẾT XUẤT LUỒNG CHAT STREAMING (SSE CHAT)
  // =========================================================================
  const handleSendPrompt = async () => {
    if (!inputPrompt.trim() || isLoading) return;

    const userQuery = inputPrompt.trim();
    setInputPrompt('');
    setShowSlashMenu(false);
    setIsLoading(true);
    closeViewer();  // Gửi câu hỏi: quay lại khung hội thoại để thấy câu trả lời

    setMessages(prev => [...prev, { role: "user", content: userQuery }]);
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    if (userQuery.startsWith('/')) {
      try {
        await runSlashCommand(userQuery);
      } catch (err) {
        console.error("[iThunder Slash Command]", err);
        replaceLastAssistant("❌ **[Lỗi lệnh nhanh]:** Không thể thực thi lệnh `" + userQuery.split(/\s+/)[0] + "` do mất kết nối tới AI Gateway.");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      const token = localStorage.getItem("tara_token") || "";
      // Định danh/vai trò do Backend lấy từ JWT nên không gửi user_id, user_role trên URL
      const streamUrl = `${getGatewayConfig().httpUrl}/api/chat/rag-stream?thread_id=${encodeURIComponent(activeThreadId)}&user_ip=${encodeURIComponent(clientIp)}&domain=${encodeURIComponent(activeDomain)}&aimodel=${encodeURIComponent(selectedModel)}&runtime=${encodeURIComponent(selectedRuntime)}&prompt=${encodeURIComponent(userQuery)}`;

      const response = await fetch(streamUrl, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!response.ok || !response.body) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          handleUnauthorized(describeError(errData, 401));
          return;
        }
        // 403: vai trò không có quyền khai thác kho đang chọn; 422: mô hình không còn trên Máy chủ AI => nạp lại danh mục
        if (response.status === 422) refreshChatModels();
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: `⛔ **${response.status === 422 ? "Không thể dùng mô hình AI" : "Không thể khai thác Kho tri thức"}:** ${describeError(errData, response.status)}`
          };
          return updated;
        });
        return;
      }

      // --- KHỐI XỬ LÝ ĐỌC LUỒNG STREAM ĐÃ CHUẨN HÓA TRIỆT TIÊU TRÙNG LẶP ---
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let accumulatedText = ""; // Biến cục bộ để giữ vết chuỗi sạch tránh re-render đè
      let lineBuffer = "";      // Giữ phần dòng SSE bị cắt dở giữa hai chunk mạng

      const appendToken = (text) => {
        accumulatedText += text; // Cộng dồn vào biến đệm sạch
        const snapshot = accumulatedText;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: snapshot };
          return updated;
        });
      };

      const processLine = (line) => {
        const cleanLine = line.trim();

        // Loại bỏ dòng trống hoặc dòng kết thúc hội thoại
        if (!cleanLine || cleanLine === "data: [DONE]") return;

        if (cleanLine.startsWith("data: ")) {
          try {
            // Trích xuất chính xác chuỗi JSON nằm sau cụm "data: "
            const parsed = JSON.parse(cleanLine.substring(6).trim());
            const tokenContent = parsed.choices?.[0]?.delta?.content;
            if (tokenContent) appendToken(tokenContent);
          } catch {
            // Phòng hờ API trả về text thô không theo chuẩn OpenAI
            if (cleanLine.includes('"text":')) {
              try {
                const parsedRaw = JSON.parse(cleanLine);
                if (parsedRaw.text) appendToken(parsedRaw.text);
              } catch { /* Không phải JSON hợp lệ: bỏ qua dòng này */ }
            }
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop(); // Dòng cuối có thể chưa trọn vẹn, chờ chunk kế tiếp

        for (const line of lines) processLine(line);
      }

      // Xả phần còn lại trong bộ giải mã và bộ đệm dòng khi luồng đóng
      lineBuffer += decoder.decode();
      if (lineBuffer) processLine(lineBuffer);

    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: `❌ **Lỗi kết nối mạng:** Không thể nhận dữ liệu phát trực tuyến từ cổng AI Platform.`
        };
        return updated;
      });
    } finally {
      // TIẾN TRÌNH KẾT THÚC (THÀNH CÔNG HAY LỖI) -> GIẢI PHÓNG CỜ KHÓA
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    // Xóa giá trị input để có thể chọn lại cùng một tệp ở lần sau
    e.target.value = "";
    if (!file) return;

    const targetDomain = activeDomain;
    if (!canManageActive) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "⛔ **[Không đủ quyền]:** Vai trò `" + userData.userRole + "` chỉ được khai thác (không được nạp tài liệu) vào phân vùng `" + targetDomain + "`."
      }]);
      return;
    }

    // Gộp cả 2 tin nhắn vào một lượt cập nhật state để tối ưu hiệu năng render
    setMessages(prev => [
      ...prev,
      { role: "user", content: "📎 Đính kèm tệp tin tài liệu: `" + file.name + "`" },
      { role: "assistant", content: "⏳ Đang tải tệp lên hệ thống và tiến hành phân đoạn băm nhỏ dữ liệu (Chunks) vào phân vùng `" + targetDomain + "`..." }
    ]);

    const setUploadResult = (content) => {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content };
        return updated;
      });
    };

    try {
      const res = await iThunderAPI.uploadDocument(file, targetDomain);

      if (res && res.status === "SUCCESS") {
        await refreshCollections();
        setUploadResult("✅ **[Nạp tri thức thành công]:** Đã tích hợp thành công tài liệu `" + file.name + "` vào phân vùng `" + targetDomain + "`." + (res.detail ? "\n\n* Chi tiết: " + res.detail : ""));
      } else {
        // FastAPI có thể trả detail dạng mảng (lỗi 422) hoặc chuỗi
        const reason = typeof res?.detail === "string" ? res.detail : (res?.message || "Backend từ chối tiếp nhận tệp tin.");
        setUploadResult("⚠️ **[Nạp tri thức thất bại]:** Không thể tích hợp tài liệu `" + file.name + "`.\n\n* Nguyên nhân: " + reason);
      }
    } catch {
      setUploadResult("❌ **[Lỗi kết nối]:** Không thể tải tệp `" + file.name + "` lên AI Gateway.");
    }
  };


  // Đổi kho tri thức: mở một phiên hội thoại (thread) mới gắn với kho vừa chọn
  const storeList = Array.isArray(collections) ? collections : [];
  const personalStore = storeList.find(c => c.storage_key === PERSONAL_STORE);
  const otherStores = storeList.filter(c => c.storage_key !== PERSONAL_STORE);
  const activeOther = otherStores.find(c => c.storage_key === activeDomain);

  const handleSelectDomain = (col) => {
    if (col.storage_key === activeDomain) return;
    setActiveDomain(col.storage_key);
    setActiveThreadId(newThreadId());
    if (messages.length > 0) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "🔀 **[Hệ thống]:** Đã chuyển sang Kho tri thức `" + col.display_name + "`. Các câu hỏi tiếp theo thuộc một phiên hội thoại mới."
      }]);
    }
  };

  // Mở Kho của một phân vùng Public (chỉ khai thác): thêm vào danh mục kho ở thanh bên rồi chuyển sang kho đó
  const handleOpenPublicCloud = async (col, maxOpened) => {
    openCloud(col.storage_key, maxOpened || 10);
    setShowPublicClouds(false);
    await refreshCollections();
    handleSelectDomain(col);
  };

  // Gỡ phân vùng Public đã mở khỏi danh mục; đang dùng kho đó thì quay về kho Cá nhân
  const handleClosePublicCloud = async (col) => {
    closeCloud(col.storage_key);
    if (activeDomain === col.storage_key) handleSelectDomain({ storage_key: "Personal", display_name: "Cá nhân" });
    await refreshCollections();
  };

  // =========================================================================
  // LỆNH NHANH (SLASH COMMANDS): thực thi tại máy trạm bằng các API sẵn có của AI Gateway
  // =========================================================================

  // Thay nội dung bong bóng trả lời đang chờ (tin nhắn cuối) bằng kết quả của lệnh
  const replaceLastAssistant = (content) => {
    setMessages(prev => {
      const updated = [...prev];
      updated[updated.length - 1] = { role: "assistant", content };
      return updated;
    });
  };

  const syncProgressMessage = () =>
    "⏳ **[Hệ thống]:** Đang kích hoạt tiến trình quét và đồng bộ dữ liệu thư mục vật lý tại Backend cho phân vùng `" + selectedColDetails.display_name + "`...";

  // Đồng bộ thư mục Kho Dữ liệu của kho đang chọn; dùng chung cho nút "Đồng bộ Kho Tri thức" và lệnh /rag-sync
  const syncActiveCollection = async () => {
    const col = selectedColDetails;
    try {
      const res = await iThunderAPI.syncDirectory(col.storage_key);
      if (res && res.status === "SUCCESS") {
        await Promise.all([refreshCollections(), refreshDataFiles()]);
        return "✅ **[Đồng bộ thành công]:** Hệ thống đã hoàn tất quét phân vùng `" + col.display_name + "`.\n\n* Chi tiết: " + (res.detail || "Đã cập nhật danh mục tệp tin nhúng.");
      }
      return "⚠️ **[Đồng bộ thất bại]:** Backend phản hồi lỗi xử lý.\n\n* Nguyên nhân: " + (res?.detail || "Không rõ nguyên nhân cấu hình.");
    } catch {
      return "❌ **[Lỗi kết nối]:** Không thể gửi lệnh đồng bộ tới AI Gateway.";
    }
  };

  // Lấy danh sách thread của kho đang chọn (mới nhất trước) và ghi nhớ cho /thread <số>
  const fetchThreadList = async () => {
    const data = await iThunderAPI.getChatThreads(activeDomain);
    if (!Array.isArray(data)) throw new Error(data?.detail || data?.message || "Không đọc được danh sách hội thoại.");
    historyListRef.current = data;
    return data;
  };

  // Nạp lại toàn bộ tin nhắn của một thread và tiếp tục ghi vào thread đó
  const restoreThread = async (thread) => {
    const data = await iThunderAPI.getChatHistory(thread.thread_id);
    if (!Array.isArray(data)) {
      replaceLastAssistant("⚠️ **[Không thể khôi phục]:** " + (data?.detail || "Phiên hội thoại không tồn tại hoặc không thuộc về bạn."));
      return;
    }
    const restored = data.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content ?? "") }));
    setActiveThreadId(thread.thread_id);
    setMessages([
      ...restored,
      {
        role: "assistant",
        content: "📂 **[Đã khôi phục hội thoại]:** _" + (thread.title || thread.thread_id) + "_ (" + restored.length +
          " tin nhắn, cập nhật " + formatDateTime(thread.created_at) + "). Các câu hỏi tiếp theo sẽ được ghi tiếp vào phiên này."
      }
    ]);
  };

  const historyNotSavedMessage = (policy) =>
    "ℹ️ **[Lịch sử hội thoại]:** Hệ thống không lưu lịch sử hội thoại cho vai trò `" + userData.userRole + "`" +
    (policy.roles.length ? " (chỉ lưu cho " + policy.roles.join(", ") + ")." : ".");

  // Kiểm tra chính sách trước khi gọi API lịch sử; nạp lại nếu chưa biết.
  // Nếu Backend chưa hỗ trợ /api/auth/me (enabled = null) thì vẫn gọi API lịch sử như bình thường.
  const historyBlocked = async () => {
    const policy = historyPolicy.enabled === null ? await refreshHistoryPolicy() : historyPolicy;
    if (policy.enabled === false) {
      replaceLastAssistant(historyNotSavedMessage(policy));
      return true;
    }
    return false;
  };

  const runSlashCommand = async (text) => {
    const [rawCmd, ...args] = text.trim().split(/\s+/);
    const cmd = rawCmd.toLowerCase();
    const storeName = activeCollection?.display_name || activeDomain;

    switch (cmd) {
      case '/menu': {
        setIsLeftSidebarOpen(true);
        setIsRightSidebarOpen(true);
        replaceLastAssistant(
          "🧭 **[Menu tác vụ chính]** — Kho đang làm việc: `" + storeName + "` (" + (canManageActive ? "Quản trị" : "Chỉ khai thác") + ")\n\n" +
          SLASH_COMMANDS.map(c => "* `" + c.cmd + "` — " + c.desc).join("\n") +
          "\n\nĐã mở thanh Kho tri thức (bên trái) và Thông số phân vùng (bên phải)."
        );
        return;
      }

      case '/history': {
        if (await historyBlocked()) return;
        const threads = await fetchThreadList();
        if (threads.length === 0) {
          replaceLastAssistant("🗂️ **[Lịch sử hội thoại]:** Chưa có hội thoại nào được lưu trong kho `" + storeName + "`.");
          return;
        }
        const shown = threads.slice(0, 20);
        replaceLastAssistant(
          "🗂️ **[Lịch sử hội thoại — kho `" + storeName + "`]:** " + threads.length + " phiên" + (threads.length > shown.length ? " (hiển thị 20 phiên mới nhất)" : "") + "\n\n" +
          shown.map((t, i) => (i + 1) + ". **" + (t.title || "(không tiêu đề)") + "** — " + formatDateTime(t.created_at) +
            (t.thread_id === activeThreadId ? " _(đang mở)_" : "")).join("\n") +
          "\n\nGõ `/thread <số>` để mở lại một phiên, hoặc `/thread` để mở phiên gần nhất."
        );
        return;
      }

      case '/thread': {
        if (await historyBlocked()) return;
        const arg = args[0];
        let target = null;
        if (arg && /^\d+$/.test(arg)) {
          // Số thứ tự theo danh sách /history gần nhất (tự nạp nếu chưa gọi /history)
          const list = historyListRef.current.length ? historyListRef.current : await fetchThreadList();
          target = list[Number(arg) - 1] || null;
          if (!target) { replaceLastAssistant("⚠️ **[Không tìm thấy]:** Không có phiên số " + arg + ". Gõ `/history` để xem danh sách."); return; }
        } else if (arg) {
          target = { thread_id: arg, title: arg };  // Mã thread cụ thể (thread_...)
        } else {
          const list = await fetchThreadList();
          target = list[0] || null;
          if (!target) { replaceLastAssistant("🗂️ **[Khôi phục hội thoại]:** Chưa có hội thoại nào được lưu trong kho `" + storeName + "`."); return; }
        }
        await restoreThread(target);
        return;
      }

      case '/knowledge':
        replaceLastAssistant("📚 Đang mở trang **Quản trị Phân vùng Kho Tri thức**...");
        navigate('/knowledge');
        return;

      case '/analytics':
        if (userData.userRole !== 'admin') {
          replaceLastAssistant("⛔ **[Không có quyền]:** Giám sát Hệ thống chỉ dành cho Quản trị viên (vai trò `admin`).");
          return;
        }
        replaceLastAssistant("📊 Đang mở trang **Giám sát Hạ tầng & Hiệu năng AI Server**...");
        navigate('/analytics');
        return;

      case '/mcp':
        replaceLastAssistant("🔌 Đang mở trang **Tích hợp MCP (Model Context Protocol)**...");
        navigate('/mcp');
        return;

      case '/comm':
        replaceLastAssistant("💬 Đang mở trang **Trao đổi trực tuyến**...");
        navigate('/comm');
        return;

      case '/rag-sync': {
        if (!canManageActive) {
          replaceLastAssistant("⛔ **[Không đủ quyền]:** Vai trò `" + userData.userRole + "` chỉ được khai thác kho `" + storeName + "`, không được đồng bộ dữ liệu.");
          return;
        }
        replaceLastAssistant(syncProgressMessage());
        const result = await syncActiveCollection();
        setMessages(prev => [...prev, { role: "assistant", content: result }]);
        return;
      }

      default:
        replaceLastAssistant(
          "❓ **[Lệnh không hợp lệ]:** `" + rawCmd + "`. Các lệnh nhanh được hỗ trợ:\n\n" +
          SLASH_COMMANDS.map(c => "* `" + c.cmd + "` — " + c.desc).join("\n")
        );
    }
  };

  // =========================================================================
  // QUẢN TRỊ KHO DỮ LIỆU: xem, tải lên, xóa tập tin và đồng bộ từng tập tin vào Kho Tri thức
  // =========================================================================
  const showDataNotice = (type, text) => {
    setDataNotice({ type, text });
    if (dataNoticeTimerRef.current) clearTimeout(dataNoticeTimerRef.current);
    dataNoticeTimerRef.current = setTimeout(() => setDataNotice(null), 10000);
  };

  const refreshDataFiles = async () => {
    const requestId = ++dataRequestRef.current;
    setDataFilesLoading(true);
    setDataFilesError('');
    try {
      const res = await iThunderAPI.listDataFiles(activeDomain);
      if (requestId !== dataRequestRef.current) return;  // Người dùng đã chuyển kho trong lúc chờ
      if (res?.status === "SUCCESS" && Array.isArray(res.files)) {
        setDataFiles(res.files);
      } else {
        setDataFiles([]);
        setDataFilesError(res?.detail || "Không đọc được danh sách tập tin của Kho Dữ liệu.");
      }
    } catch {
      if (requestId === dataRequestRef.current) {
        setDataFiles([]);
        setDataFilesError("Mất kết nối tới AI Gateway khi đọc Kho Dữ liệu.");
      }
    } finally {
      if (requestId === dataRequestRef.current) setDataFilesLoading(false);
    }
  };

  const closeViewer = () => {
    viewerRequestRef.current += 1;  // Hủy kết quả của lần mở tệp đang chờ (nếu có)
    setViewer(prev => {
      if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
      return null;
    });
  };

  // Mở tệp trong cửa sổ Chat/Work: PDF hiển thị bản gốc, các định dạng khác hiển thị văn bản đã bóc tách
  const openDataFile = async (file) => {
    closeViewer();
    const requestId = viewerRequestRef.current;
    setViewer({ ...file, loading: true });
    try {
      if (file.ext === '.pdf') {
        const res = await iThunderAPI.getDataFileBlob(activeDomain, file.path);
        if (res?.status !== "SUCCESS") throw new Error(res?.detail || "Không mở được tập tin.");
        const blobUrl = URL.createObjectURL(new Blob([res.blob], { type: 'application/pdf' }));
        if (requestId !== viewerRequestRef.current) { URL.revokeObjectURL(blobUrl); return; }
        setViewer(prev => prev && { ...prev, loading: false, blobUrl });
      } else {
        const res = await iThunderAPI.getDataFileText(activeDomain, file.path);
        if (res?.status !== "SUCCESS") throw new Error(res?.detail || "Không mở được tập tin.");
        if (requestId !== viewerRequestRef.current) return;
        setViewer(prev => prev && { ...prev, loading: false, content: res.content, truncated: res.truncated });
      }
    } catch (err) {
      if (requestId === viewerRequestRef.current) {
        setViewer(prev => prev && { ...prev, loading: false, error: err.message || "Không mở được tập tin." });
      }
    }
  };

  const downloadDataFile = async (file) => {
    try {
      const res = await iThunderAPI.getDataFileBlob(activeDomain, file.path);
      if (res?.status !== "SUCCESS") { showDataNotice('error', res?.detail || "Không tải được tập tin."); return; }
      const url = URL.createObjectURL(res.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      showDataNotice('error', "Mất kết nối tới AI Gateway khi tải tập tin.");
    }
  };

  const syncOneDataFile = async (file) => {
    setDataBusyPath(file.path);
    try {
      const res = await iThunderAPI.syncDataFile(activeDomain, file.path);
      if (res?.status === "SUCCESS") {
        showDataNotice('success', res.detail);
        await Promise.all([refreshDataFiles(), refreshCollections()]);
      } else {
        showDataNotice('error', res?.detail || "Đồng bộ tập tin thất bại.");
      }
    } catch {
      showDataNotice('error', "Mất kết nối tới AI Gateway khi đồng bộ tập tin.");
    } finally {
      setDataBusyPath(null);
    }
  };

  const deleteOneDataFile = async (file) => {
    if (!window.confirm(`Xóa tập tin "${file.path}" khỏi Kho Dữ liệu?\n\nTập tin được chuyển vào thùng rác (.Trash) của Kho và toàn bộ tri thức RAG liên quan sẽ bị gỡ khỏi Kho Tri thức.`)) return;
    setDataBusyPath(file.path);
    try {
      const res = await iThunderAPI.deleteDataFile(activeDomain, file.path);
      if (res?.status === "SUCCESS") {
        if (viewer?.path === file.path) closeViewer();
        showDataNotice('success', res.detail);
        await Promise.all([refreshDataFiles(), refreshCollections()]);
      } else {
        showDataNotice('error', res?.detail || "Xóa tập tin thất bại.");
      }
    } catch {
      showDataNotice('error', "Mất kết nối tới AI Gateway khi xóa tập tin.");
    } finally {
      setDataBusyPath(null);
    }
  };

  // Tải lên một hoặc nhiều tập tin; trùng tên (HTTP 409) thì hỏi trước khi ghi đè
  const uploadDataFiles = async (files) => {
    if (!files.length) return;
    setDataBusyPath('__upload__');
    const done = [];
    const failed = [];
    for (const file of files) {
      try {
        let res = await iThunderAPI.uploadDataFile(file, activeDomain, { sync: autoSyncUpload });
        if (res?.httpStatus === 409) {
          if (!window.confirm(`Tập tin "${file.name}" đã có trong Kho Dữ liệu. Ghi đè bằng bản mới?`)) {
            failed.push(`${file.name}: bỏ qua (đã tồn tại).`);
            continue;
          }
          res = await iThunderAPI.uploadDataFile(file, activeDomain, { sync: autoSyncUpload, overwrite: true });
        }
        if (res?.status === "SUCCESS") done.push(res.detail);
        else failed.push(`${file.name}: ${res?.detail || "tải lên thất bại."}`);
      } catch {
        failed.push(`${file.name}: mất kết nối tới AI Gateway.`);
      }
    }
    setDataBusyPath(null);
    showDataNotice(failed.length ? 'error' : 'success', [...done, ...failed].join("\n"));
    await Promise.all([refreshDataFiles(), refreshCollections()]);
  };

  // Nạp danh sách tập tin khi vào Workspace hoặc đổi kho; đóng trình xem tệp của kho trước
  const onDataScopeChange = useLatestCallback(() => {
    closeViewer();
    setDataFilter('');
    setDataNotice(null);  // Thông báo thuộc kho trước, không hiển thị sang kho mới
    if (viewState === 'WORKSPACE') {
      refreshDataFiles();
    } else {
      dataRequestRef.current += 1;
      setDataFiles([]);
    }
  });
  useEffect(() => { onDataScopeChange(); }, [viewState, activeDomain, onDataScopeChange]);

  const visibleDataFiles = dataFiles.filter(f => f.path.toLowerCase().includes(dataFilter.trim().toLowerCase()));

  const selectedColDetails = collections.find(c => c.storage_key === activeDomain) || collections[0] || {
    storage_key: "Personal",
    display_name: "Đang nạp...",
    collection_name: "personal_knowledge",
    file_count: 0,
    chunk_count: 0,
    storage_size: "0 Bytes"
  };

  // Quyền trên kho đang làm việc (activeDomain): 'manage' = xem, tải dữ liệu, đồng bộ RAG; 'read' = chỉ khai thác hội thoại
  const activeCollection = collections.find(c => c.storage_key === activeDomain);
  const activePermission = getStoragePermission(activeCollection, userData.userRole);
  const canManageActive = activePermission === 'manage';

  // =========================================================================
  // GIAO DIỆN KẾT XUẤT CHÍNH (HTML CORES)
  // =========================================================================

  // Tên Tổ chức hiển thị trong Workspace: theo AI Gateway; dự phòng bằng Tổ chức ghi trong phiên đăng nhập
  const workspaceOrgName = orgInfo.status === 'ok' ? orgInfo.orgName : (userData.userOrg || 'Chưa xác định Tổ chức');

  // =========================================================================
  // XỬ LÝ KHỐI CHỨC NĂNG: NHẬN PASSCODE QUA EMAIL (GET_CODE)
  // =========================================================================
  if (viewState === 'GET_CODE') {
    const handleGetCodeSubmit = async (e) => {
      e.preventDefault();
      setIsLoading(true);
      setErrorMessage('');
      setStatusMessage('');

      try {
        // Gọi trực tiếp Endpoint Backend xử lý trên cùng AI Gateway với các API khác
        const response = await fetch(`${getGatewayConfig().httpUrl}/api/auth/get-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email })
        });

        const res = await response.json();
        setIsLoading(false);

        if (res && res.status === "SUCCESS") {
          setStatusMessage(res.message || "Hệ thống đã gửi PassCode về Email của bạn thành công.");
          setEmail(''); // Xóa trắng trường nhập liệu
        } else {
          setErrorMessage(res.message || "Địa chỉ Email không được quản lý trong hạ tầng AI On-Premise!");
        }
      } catch (err) {
        setIsLoading(false);
        console.error("[iThunder Frontend Error]:", err);
        setErrorMessage("Không thể kết nối API để thực thi trên AI Gateway.");
      }
    };

    return (
      <div className="w-screen h-app bg-[#090d16] flex items-center justify-center text-slate-200 select-none bg-cover bg-center" style={{ backgroundImage: "url('/background.jpg')" }}>
        <div className="w-full max-w-sm bg-[#070d16]/80 border border-slate-700/30 backdrop-blur-xl rounded-2xl p-6 shadow-2xl">
          <div className="text-center mb-5">
            <h3 className="text-base font-bold text-white flex items-center justify-center gap-2">
              <KeyRound size={18} className="text-indigo-400" /> Nhận PassCode qua Email
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">Cung cấp tài khoản Email đã đăng ký với tổ chức</p>
            <GatewayOrgLine org={orgInfo} />
          </div>

          <form onSubmit={handleGetCodeSubmit} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email đã đăng ký *</label>
              <input 
                type="email" 
                required 
                placeholder="username@company.vn" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-[#162235]/60 text-slate-100 font-medium rounded-xl px-4 py-3 text-xs focus:outline-none border border-slate-700/60 focus:border-indigo-500 transition-all"
              />
            </div>

            {statusMessage && (
              <div className="p-3 bg-emerald-950/30 border border-emerald-900/30 text-emerald-400 text-[11px] rounded-xl flex items-start gap-2 leading-relaxed">
                <ShieldCheck size={13} className="shrink-0 mt-0.5 text-emerald-500" />
                <span>{statusMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 bg-red-950/30 border border-red-900/30 text-red-400 text-[11px] rounded-xl flex items-start gap-2 leading-relaxed">
                <CircleAlert size={13} className="shrink-0 mt-0.5 text-red-500" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoading || !email}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-bold text-xs rounded-xl py-3 shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <span>Gửi PassCode về Email</span>}
            </button>
          </form>

          <div className="mt-5 pt-3 border-t border-slate-800/60 text-center">
            <button 
              onClick={() => { setErrorMessage(''); setStatusMessage(''); setViewState('LOGIN'); }} 
              className="text-[11px] font-medium text-slate-400 hover:text-indigo-400 transition-colors inline-flex items-center gap-1"
            >
              <CornerDownLeft size={12} /> Quay lại màn hình đăng nhập
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // XỬ LÝ KHỐI CHỨC NĂNG: ĐĂNG KÝ TÀI KHOẢN MỚI (REGISTER)
  // =========================================================================
  if (viewState === 'REGISTER') {
    const handleRegisterSubmit = async (e) => {
      e.preventDefault();
      setIsLoading(true);
      setErrorMessage('');
      setStatusMessage('');

      const res = await iThunderAPI.registerUser(email, fullName);
      setIsLoading(false);

      // Email đã có tài khoản định danh trên iThunder AI OS: không đăng ký mới.
      // - JOIN_LINK_SENT: tài khoản của Tổ chức khác => Backend gửi liên kết gia nhập Tổ chức (vai trò Khách) tới Email;
      // - ACCOUNT_EXISTS: đã có vai trò trong Tổ chức => đăng nhập bằng PassCode.
      if (res.status === "SUCCESS") {
        setStatusMessage(res.code === "JOIN_LINK_SENT"
          ? `${res.message} Hãy mở Email và bấm liên kết "Thêm tài khoản vào Tổ chức"; sau đó đăng nhập bằng PassCode được gửi kèm.`
          : (res.message || "Gửi yêu cầu đăng ký tài khoản mới lên hệ thống thành công. Vui lòng đợi phê duyệt."));
        setEmail('');
        setFullName('');
      } else {
        setErrorMessage(res.message || "Tài khoản Email này đã tồn tại hoặc không hợp lệ!");
      }
    };

    return (
      <div className="w-screen h-app bg-[#090d16] flex items-center justify-center text-slate-200 select-none bg-cover bg-center" style={{ backgroundImage: "url('/background.jpg')" }}>
        <div className="w-full max-w-sm bg-[#070d16]/80 border border-slate-700/30 backdrop-blur-xl rounded-2xl p-6 shadow-2xl">
          <div className="text-center mb-5">
            <h3 className="text-base font-bold text-white flex items-center justify-center gap-2">
              <UserPlus size={18} className="text-emerald-400" /> Đăng ký Tài khoản mới
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">Khởi tạo hồ sơ định danh làm việc trên iThunder AI OS</p>
            <GatewayOrgLine org={orgInfo} />
            <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">Đã có tài khoản ở Tổ chức khác? Nhập Email đó: hệ thống gửi liên kết để thêm tài khoản vào Tổ chức này.</p>
          </div>

          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email đăng ký *</label>
              <input 
                type="email" 
                required 
                placeholder="username@company.vn"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-[#162235]/60 text-slate-100 font-medium rounded-xl px-4 py-3 text-xs focus:outline-none border border-slate-700/60 focus:border-emerald-500 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tên hiển thị *</label>
              <input 
                type="text" 
                required 
                placeholder="Nhập họ và tên của bạn" 
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full bg-[#162235]/60 text-slate-100 font-medium rounded-xl px-4 py-3 text-xs focus:outline-none border border-slate-700/60 focus:border-emerald-500 transition-all"
              />
            </div>

            {statusMessage && (
              <div className="p-3 bg-emerald-950/30 border border-emerald-900/30 text-emerald-400 text-[11px] rounded-xl flex items-start gap-2 leading-relaxed">
                <ShieldCheck size={13} className="shrink-0 mt-0.5 text-emerald-500" />
                <span>{statusMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 bg-red-950/30 border border-red-900/30 text-red-400 text-[11px] rounded-xl flex items-start gap-2 leading-relaxed">
                <CircleAlert size={13} className="shrink-0 mt-0.5 text-red-500" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoading || !email || !fullName}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-bold text-xs rounded-xl py-3 shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <span>Gửi yêu cầu đăng ký</span>}
            </button>
          </form>

          <div className="mt-5 pt-3 border-t border-slate-800/60 text-center">
            <button 
              onClick={() => { setErrorMessage(''); setStatusMessage(''); setViewState('LOGIN'); }} 
              className="text-[11px] font-medium text-slate-400 hover:text-emerald-400 transition-colors inline-flex items-center gap-1"
            >
              <CornerDownLeft size={12} /> Quay lại màn hình đăng nhập
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // XỬ LÝ KHỐI CHỨC NĂNG: XÁC THỰC PASSCODE  (LOGIN)
  // =========================================================================
  if (viewState === 'LOGIN') {
    return (
      <div
        className="w-screen h-app bg-[#090d16] flex text-slate-200 select-none antialiased bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/background.jpg')" }}
      >
        {/* KHỐI TRỐNG BÊN TRÁI CHIẾM 2/3 CHIỀU RỘNG MÀN HÌNH */}
        <div className="hidden md:flex md:w-2/3 h-full items-center p-12 bg-gradient-to-r from-black/60 to-transparent">
          <div className="max-w-xl">
            <span className="text-sm font-mono font-bold tracking-[0.4em] text-cyan-400 uppercase">Hạ tầng trí tuệ nhân tạo tin cậy</span>
            <h2 className="text-5xl font-black text-white tracking-tight mt-3 leading-tight">iThunder AI<br/>Operating System</h2>
            <p className="text-base text-slate-300 mt-5 leading-relaxed font-medium">Không gian làm việc số tích hợp chức năng quản trị định danh, quản lý dữ liệu và tri thức, tự động hóa và tối ưu hóa các ứng dụng Trí tuệ nhân tạo trong mạng nội bộ (AI On-Premise)</p>
          </div>
        </div>

        {/* KHỐI CHỨA FORM LOGIN CHIẾM ĐÚNG 1/3 CHIỀU RỘNG MÀN HÌNH BÊN PHẢI */}
        <div className="w-full md:w-1/3 h-full bg-[#070d16]/80 border-l border-slate-800/60 backdrop-blur-2xl flex items-center justify-center p-6 shadow-2xl transition-all">
          <div className="w-full max-w-sm bg-slate-900/50 border border-slate-700/30 backdrop-blur-md rounded-2xl p-6 shadow-2xl">
            <div className="text-center mb-6">
              <div className="flex justify-center mb-2">
                <div className="flex flex-col items-center">
                  <img src="/logo.png" alt="iThunder Logo" className="w-44 h-20 object-contain shrink-0" />
                </div>
              </div>
              {/* TĂNG KÍCH THƯỚC TIÊU ĐỀ CHÍNH & MÀU TRẮNG SÁNG TOÀN PHẦN */}
              <h1 className="text-2xl font-extrabold tracking-tight text-white mt-2">iThunder AI Gateway</h1>
 
              {/* TỔ CHỨC SỞ HỮU AI GATEWAY: người dùng biết mình đang đăng nhập vào AI Workspace của Tổ chức nào */}
              {CLIENT_APP && <GatewayPicker key={activeGateway} current={activeGateway} status={orgInfo.status} onConnect={connectGateway} disabled={isLoading} />}
              <GatewayOrgCard org={orgInfo} onRetry={loadOrgInfo} onSwitch={CLIENT_APP ? connectGateway : undefined} />
            </div>

            {joinOffer ? (
              // PassCode đúng nhưng chưa thuộc Tổ chức: đề nghị đăng ký trở thành Khách (liên kết xác nhận gửi qua Email)
              <div className="space-y-4">
                <div className={`p-3.5 border text-xs rounded-xl flex items-start gap-2 leading-relaxed font-medium ${joinOffer.sent ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200' : 'bg-amber-950/40 border-amber-500/60 text-amber-100'}`}>
                  {joinOffer.sent ? <ShieldCheck size={14} className="shrink-0 mt-0.5 text-emerald-400" /> : <UserPlus size={14} className="shrink-0 mt-0.5 text-amber-400" />}
                  <span>{joinOffer.message}</span>
                </div>
                {errorMessage && (
                  <div className="p-3.5 bg-red-950/40 border border-red-500/60 text-red-200 text-xs rounded-xl flex items-start gap-2 leading-relaxed font-medium">
                    <CircleAlert size={14} className="shrink-0 mt-0.5 text-red-400" />
                    <span>{errorMessage}</span>
                  </div>
                )}
                {!joinOffer.sent && (
                  <button type="button" onClick={acceptJoinOffer} disabled={isLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-extrabold text-sm rounded-xl py-3.5 shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wider">
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <span>Đăng ký trở thành Khách</span>}
                  </button>
                )}
                <button type="button" onClick={() => { setJoinOffer(null); setErrorMessage(''); }}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl py-3 transition-all flex items-center justify-center gap-2">
                  <CornerDownLeft size={13} /> {joinOffer.sent ? 'Quay lại đăng nhập' : 'Không, quay lại'}
                </button>
              </div>
            ) : (
            <form onSubmit={handlePasscodeSubmit} className="space-y-4">
              <div className="flex flex-col gap-2">
                {/* TĂNG KÍCH THƯỚC LABEL VÀ CHUYỂN SANG MÀU CYAN ĐỂ ĐỒNG BỘ THƯƠNG HIỆU */}
                <label className="text-xs font-bold text-cyan-400 uppercase tracking-wider">NHẬP MÃ ĐĂNG NHẬP (PASSCODE)</label>
                <input 
                  type="password"
                  maxLength={6}
                  required
                  placeholder="••••••"
                  value={passcode}
                  onChange={e => setPasscode(e.target.value.replace(/\D/g, ''))}
                  /* TĂNG SIZE TEXT, ĐỔI CHỮ SANG MÀU XANH BLUE ĐẬM SẮC NÉT TRÊN NỀN TRẮNG */
                  className="w-full bg-[#f0f5ff] text-blue-900 font-black rounded-xl px-4 py-3.5 text-center tracking-[1.5em] text-xl focus:outline-none shadow-inner border-2 border-blue-400/50 focus:border-cyan-400 transition-all"
                />
              </div>

              {errorMessage && (
                <div className="p-3.5 bg-red-950/40 border border-red-500/60 text-red-200 text-xs rounded-xl flex items-start gap-2 leading-relaxed font-medium">
                  <CircleAlert size={14} className="shrink-0 mt-0.5 text-red-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button 
                type="submit"
                disabled={isLoading || passcode.length < 6} 
                /* TĂNG SIZE CHỮ TRÊN BUTTON, THÊM HIGHLIGHT ĐỔ BÓNG GLOW */
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-extrabold text-sm rounded-xl py-3.5 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all flex items-center justify-center gap-2 uppercase tracking-wider"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <span>Xác thực Định danh</span>}
              </button>
            </form>
            )}

            {/* TĂNG ĐỘ RÕ NÉT VÀ ĐỔI MÀU HOVER CỦA HAI NÚT TASK PHỤ */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800/80 text-xs font-semibold text-slate-300">
              <button onClick={() => setViewState('GET_CODE')} className="hover:text-cyan-400 transition-colors">Tôi quên PassCode (GetCode)</button>
              <button onClick={() => setViewState('REGISTER')} className="hover:text-emerald-400 transition-colors">Tôi muốn đăng ký (Register)</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (viewState === 'FACEID') {
    return (
      <div className="w-screen h-app bg-[#090d16] flex items-center justify-center text-slate-200 select-none">
        <div className="w-full max-w-sm bg-slate-900/60 border border-slate-700/30 rounded-2xl p-6 text-center shadow-2xl">
          <h3 className="text-base font-bold text-white flex items-center justify-center gap-2 mb-2"><Camera size={18} className="text-cyan-400" /> Kích hoạt Trắc sinh học FaceID</h3>
          <div className="-mt-1 mb-2"><GatewayOrgLine org={orgInfo} /></div>
          <p className="text-xs text-slate-400 mb-4 px-2">{statusMessage}</p>

          <div className="relative w-64 h-64 rounded-full overflow-hidden border border-slate-700 bg-slate-950 mx-auto shadow-2xl mb-4">
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
            <div className="absolute inset-0 pointer-events-none border-[16px] border-[#090d16] rounded-full">
              <div className="w-full h-full border border-dashed border-cyan-500/40 rounded-full" />
            </div>
            {isFaceProcessing && <div className="absolute inset-x-0 h-0.5 bg-cyan-400 opacity-70 shadow-[0_0_8px_#22d3ee] animate-pulse" />}
          </div>
          <canvas ref={canvasRef} className="hidden" />

          {errorMessage && (
            <div className="mt-4 p-2.5 bg-red-950/20 border border-red-900/30 text-red-400 text-xs rounded-xl">
              <span>{errorMessage}</span>
              {isFaceProcessing && <span className="block mt-1 text-slate-400">Hệ thống vẫn đang tiếp tục quét, hãy giữ khuôn mặt trong khung tròn.</span>}
            </div>
          )}

          {faceScanStopped && (
            <button
              onClick={retryFaceScan}
              className="mt-4 w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl py-2.5 flex items-center justify-center gap-2 transition-all"
            >
              <Camera size={14} /> Quét lại khuôn mặt
            </button>
          )}

          <button
            onClick={() => { stopWebcamHardware(); setFaceScanStopped(false); setErrorMessage(''); setViewState('LOGIN'); }}
            className="mt-6 text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1 mx-auto"
          >
            <CircleX size={14} /> Hủy quét, quay lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-app flex overflow-hidden bg-app text-fg font-sans antialiased selection:bg-blue-600/30">

      {/* Điện thoại: lớp nền mờ khi mở thanh bên, chạm để đóng */}
      {(isLeftSidebarOpen || isRightSidebarOpen) && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/40" aria-hidden="true"
          onClick={() => { setIsLeftSidebarOpen(false); setIsRightSidebarOpen(false); }} />
      )}

      {/* 1. THANH SIDEBAR TRÁI: QUẢN LÝ KHO TRI THỨC */}
      <aside className={`h-app bg-panel border-r border-line flex flex-col justify-between transition-all duration-300 shrink-0 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 ${isLeftSidebarOpen ? 'w-64 opacity-100 visibility-visible' : 'w-0 opacity-0 pointer-events-none'}`}>
        {/* Phần trên cuộn được; khung Đăng xuất (shrink-0) luôn nằm ở đáy thanh bên */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col p-4 gap-4">
          <div className="flex flex-col gap-1">
            <img src="/logo.png" alt="iThunder Logo"  className="w-40 h-20 object-contain shrink-0" />
            <h2 className="text-sm font-bold text-fg-strong tracking-wide truncate">iThunder AI Workspace</h2>
            {/* Tổ chức đang làm việc: cần Tổ chức khác thì đăng xuất rồi vào AI Gateway của Tổ chức đó */}
            <div className="my-1 px-2.5 py-2 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30"
              title={`Bạn đang làm việc trong AI Workspace của ${workspaceOrgName}. Cần làm việc với Tổ chức khác? ${CLIENT_APP ? 'Hãy Đăng xuất rồi đổi AI Gateway trên trang Đăng nhập.' : orgInfo.switchEnabled ? 'Hãy Đăng xuất rồi chọn Tổ chức ngay trên trang Đăng nhập.' : 'Hãy Đăng xuất rồi truy cập AI Gateway của Tổ chức đó.'}`}>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 flex items-center gap-1">
                <Building2 size={11} /> Tổ chức
              </span>
              <span className="block text-[12px] font-semibold text-fg-strong leading-snug break-words">{workspaceOrgName}</span>
              {orgInfo.orgId && <span className="block text-[11px] text-fg-muted font-mono">Mã: {orgInfo.orgId}</span>}
              {CLIENT_APP && activeGateway && (
                <span className="block text-[10px] text-fg-subtle font-mono truncate" title={activeGateway}>AI Gateway: {gatewayHost(activeGateway)}</span>
              )}
            </div>
            <span className="text-[12px] text-fg-muted truncate">Họ và Tên: <b className="text-fg">{userData.userName}</b></span>
            <span className="text-[12px] text-fg-muted truncate">Mã ID: <b className="text-fg font-mono">{userData.ownerId || '—'}</b></span>
            <span className="text-[12px] text-fg-muted truncate">Vai trò: <b className="text-fg">{userData.userRole}</b></span>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold text-fg-subtle uppercase tracking-wider">CHỨC NĂNG</span>
            <div className="flex flex-col gap-1">
              <button onClick={() => navigate('/knowledge')} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium hover:bg-hover text-fg-muted transition-all">
                <Library size={13} className="text-fg-subtle" />
                <span>Kho Tri thức</span>
              </button>
              {/* Ẩn với Khách (tài khoản dùng chung); Backend vẫn kiểm tra COMM_ROLES ở từng API */}
              {userData.userRole !== 'visitor' && (
                <button onClick={() => navigate('/comm')} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium hover:bg-hover text-fg-muted transition-all">
                  <MessagesSquare size={13} className="text-fg-subtle" />
                  <span>Trao đổi trực tuyến</span>
                </button>
              )}
              <button onClick={() => navigate('/history')} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium hover:bg-hover text-fg-muted transition-all">
                <History size={13} className="text-fg-subtle" />
                <span>Lịch sử Làm việc</span>
              </button>
              {/* Chỉ hiện với vai trò admin; Backend vẫn kiểm tra SYSTEM_MONITOR_ROLES ở từng API */}
              {userData.userRole === 'admin' && (
                <button onClick={() => navigate('/analytics')} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium hover:bg-hover text-fg-muted transition-all">
                  <Activity size={13} className="text-fg-subtle" />
                  <span>Giám sát Hệ thống</span>
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold text-fg-subtle uppercase tracking-wider">KHO TRI THỨC (RAG)</span>
            <div className="flex flex-col gap-1">

              {/* Chỉ Kho Cá nhân hiện đầy đủ (số tệp); các Kho còn lại (Tổ chức, Dự án được tham gia, phân vùng Public đã mở)
                  chọn qua danh sách theo tên để thanh bên không tràn chiều cao khi người dùng có nhiều Kho */}
              {personalStore && (
                <button onClick={() => handleSelectDomain(personalStore)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${activeDomain === personalStore.storage_key ? 'bg-blue-600/15 border border-blue-500/40 text-fg-strong' : 'hover:bg-hover text-fg-muted'}`}>
                  <span className="flex items-center gap-2 min-w-0">
                    <Database size={13} className={activeDomain === personalStore.storage_key ? 'text-blue-600 dark:text-blue-400' : 'text-fg-subtle'} />
                    <span className="truncate">{personalStore.display_name}</span>
                  </span>
                  <span className="text-[10px] bg-elevated text-fg-muted px-1.5 py-0.5 rounded-md font-mono shrink-0">{personalStore.file_count} tệp</span>
                </button>
              )}

              {otherStores.length > 0 && (
                <div className={`flex flex-col gap-1.5 rounded-lg p-2 mt-1 ${activeOther ? 'bg-blue-600/10 border border-blue-500/40' : 'border border-line'}`}>
                  <label htmlFor="sidebar-store-select" className="text-[10px] font-semibold text-fg-subtle flex items-center gap-1">
                    <FolderKanban size={11} />Kho Tổ chức và Dự án ({otherStores.length})
                  </label>
                  <select id="sidebar-store-select" value={activeOther ? activeOther.storage_key : ''}
                    onChange={e => { const col = otherStores.find(c => c.storage_key === e.target.value); if (col) handleSelectDomain(col); }}
                    className="w-full bg-elevated border border-line text-xs rounded-md px-2 py-1.5 text-fg focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                    <option value="" disabled>Chọn Kho Tri thức...</option>
                    {STORE_GROUPS.map(g => {
                      const list = otherStores.filter(c => storeGroup(c) === g.id);
                      return list.length > 0 && (
                        <optgroup key={g.id} label={g.label}>
                          {list.map(c => (
                            <option key={c.storage_key} value={c.storage_key}>
                              {storeLabel(c)}{getStoragePermission(c, userData.userRole) === 'read' ? ' (chỉ khai thác)' : ''}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                  {activeOther && (
                    <div className="flex items-center gap-1.5 text-[10px] text-fg-muted min-w-0">
                      <span className="truncate flex-1" title={activeOther.cloud ? `${activeOther.cloud.name} – ${activeOther.cloud.description}` : activeOther.display_name}>
                        {activeOther.cloud?.description || activeOther.display_name}
                      </span>
                      {getStoragePermission(activeOther, userData.userRole) === 'read' && (
                        <Eye size={11} className="text-amber-600 dark:text-amber-400 shrink-0" title="Chỉ khai thác" aria-label="Chỉ khai thác" />
                      )}
                      <span className="bg-elevated px-1.5 py-0.5 rounded-md font-mono shrink-0">{activeOther.file_count} tệp</span>
                      {activeOther.opened && (
                        <button onClick={() => handleClosePublicCloud(activeOther)} title="Gỡ khỏi danh mục" aria-label={`Gỡ ${storeLabel(activeOther)} khỏi danh mục`}
                          className="p-1 rounded-md text-fg-subtle hover:text-red-600 dark:hover:text-red-400 hover:bg-hover shrink-0">
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <button onClick={() => setShowPublicClouds(true)}
                className="w-full flex items-center gap-2 px-3 py-2 mt-1 rounded-lg text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:bg-hover transition-all">
                <Globe size={13} />
                <span>{userData.userRole === 'admin' ? 'Mở Kho phân vùng...' : 'Mở phân vùng Public...'}</span>
              </button>

            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold text-fg-subtle uppercase tracking-wider">ĐỊNH DANH</span>
            <div className="flex flex-col gap-1">
              {/* Chỉ hiện với vai trò có quyền identity.users.read; Backend vẫn kiểm tra quyền ở từng API */}
              {identityPermissions.includes('identity.users.read') && (
                <button onClick={() => navigate('/identity?tab=users')} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium hover:bg-hover text-fg-muted transition-all">
                  <Users size={13} className="text-fg-subtle" />
                  <span>Quản trị Định danh</span>
                </button>
              )}
              <button onClick={() => navigate('/identity?tab=me')} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium hover:bg-hover text-fg-muted transition-all">
                <UserCircle size={13} className="text-fg-subtle" />
                <span>Hồ sơ cá nhân</span>
              </button>
              <button onClick={() => navigate('/mcp')} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium hover:bg-hover text-fg-muted transition-all">
                <Cable size={13} className="text-fg-subtle" />
                <span>Tích hợp MCP</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-line bg-app shrink-0">
          <button
            onClick={async () => {
              try {
                // Gửi kèm JWT để Backend hủy đúng PassTime của chính chủ phiên trên OpenLDAP
                await iThunderAPI.logout();
              } catch (err) {
                console.error("Không thể thông báo hủy phiên tới Backend:", err);
              } finally {
                // 2. Xóa sạch dấu vết lưu trữ cục bộ trên trình duyệt vật lý
                localStorage.removeItem("tara_token");
                localStorage.removeItem("tara_user");
                notifyAuthChanged();   // đóng kết nối /ws/comm dùng chung, kết thúc cuộc gọi đang có
                // Giữ lại "tara_theme": đây là tùy chọn giao diện của máy trạm, không phải dữ liệu phiên

                // 3. Xóa sạch vùng nhớ đệm phiên (nếu có)
                sessionStorage.clear();

                // 4. Reset toàn bộ trạng thái dữ liệu trong bộ nhớ RAM của React về mặc định
                setPasscode('');
                setEmail('');
                setFullName('');
                setMessages([]);
                setCollections([]);
                setActiveThreadId(newThreadId());
                setUserData({ userId: "1162000", ownerId: "", userName: "Khách", userRole: "visitor", userOrg: "AI-TECH Center" });

                // 5. Trục xuất người dùng về màn hình khóa trung tâm
                setViewState('LOGIN');
              }
            }}
            className="w-full flex items-center gap-2 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium px-2 py-1.5 transition-all"
          >
            <LogOut size={13}/> <span>Đăng xuất hệ thống</span>
          </button>
        </div>
      </aside>

      {/* NÚT THU HẸP THANH TRÁI */}
      <div className="h-app flex items-center justify-center z-10 shrink-0 bg-app">
        <button 
          onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)} 
          className="w-4 h-12 bg-panel hover:bg-hover border-y border-r border-line text-fg-muted hover:text-fg-strong flex items-center justify-center rounded-r-md shadow-md focus:outline-none"
        >
          {isLeftSidebarOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>
      </div>

      {/* 2. CỬA SỔ CHÍNH TRUNG TÂM */}
      {/* min-w-0: cho phép vùng giữa co lại, nội dung dài (tên tệp, văn bản) không đẩy RightSidebar ra ngoài màn hình */}
      <main className="flex-1 min-w-0 h-app flex flex-col justify-between bg-app">
        <header className="h-14 border-b border-line bg-panel px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {!isLeftSidebarOpen && (
              <button onClick={() => setIsLeftSidebarOpen(true)} className="p-1 text-fg-muted hover:text-fg-strong mr-1"><Menu size={16} /></button>
            )}
            <Sparkles size={14} className="text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-fg whitespace-nowrap">AI Chat/Work</span>
            {/* Màn hình rộng: nhắc Tổ chức ngay trên thanh tiêu đề (màn hình hẹp đã có ở LeftSidebar) */}
            <span className="hidden xl:inline-flex items-center gap-1 min-w-0 max-w-[22rem] text-[11px] text-fg-muted" title={`AI Workspace của ${workspaceOrgName}`}>
              <span className="text-fg-subtle">·</span>
              <Building2 size={12} className="shrink-0 text-blue-600 dark:text-blue-400" />
              <span className="truncate">{workspaceOrgName}</span>
              {orgInfo.orgId && <span className="shrink-0 font-mono text-fg-subtle">({orgInfo.orgId})</span>}
            </span>
          </div>

          <div className="flex items-center gap-3">

            {/* --- NÚT BẤM CHUYỂN ĐỔI STYLE LIGHT / DARK THEME MỚI --- */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-xl bg-elevated border border-line text-fg-muted hover:text-fg-strong transition-all shadow-sm flex items-center justify-center"
              title={theme === 'dark' ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
            >
              {theme === 'dark' ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-indigo-600 dark:text-indigo-400" />}
            </button>

            <select
              value={modelKey(selectedRuntime, selectedModel)}
              onChange={e => selectModel(e.target.value)}
              onFocus={refreshChatModels}
              title={(() => {
                const model = chatModels.find(m => m.name === selectedModel && m.runtime === selectedRuntime);
                return model ? `${model.runtime_name} · ${model.capabilities.join(', ')}` : selectedModel;
              })()}
              className="bg-elevated border border-line text-xs rounded-lg px-2.5 py-1.5 text-fg focus:outline-none font-medium cursor-pointer max-w-[320px]"
            >
              {chatModels.length === 0 && <option value={modelKey(selectedRuntime, selectedModel)}>{selectedModel}</option>}
              {modelGroups.length === 1
                ? modelGroups[0].models.map(model => (
                    <option key={modelKey(model.runtime, model.name)} value={modelKey(model.runtime, model.name)}>{modelLabel(model)}</option>
                  ))
                : modelGroups.map(group => (
                    <optgroup key={group.runtime} label={group.name}>
                      {group.models.map(model => (
                        <option key={modelKey(model.runtime, model.name)} value={modelKey(model.runtime, model.name)}>{modelLabel(model)}</option>
                      ))}
                    </optgroup>
                  ))}
            </select>

          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 flex justify-center custom-scrollbar">
          <div className="w-full min-w-0 flex flex-col gap-4">

            {viewer ? (
              // TRÌNH XEM TẬP TIN KHO DỮ LIỆU (thay khung hội thoại cho đến khi đóng hoặc gửi câu hỏi mới)
              <div className="w-full bg-card border border-line rounded-xl shadow-sm flex flex-col">
                <div className="flex items-start justify-between gap-3 p-4 border-b border-line">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-fg-strong flex items-center gap-2">
                      <FileText size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="truncate min-w-0">{viewer.name}</span>
                    </div>
                    <div className="text-[11px] text-fg-subtle mt-0.5 truncate">
                      Kho {selectedColDetails.display_name}: {viewer.path} · {viewer.size_display} · cập nhật {formatDateTime(viewer.modified)}
                    </div>
                    <div className={`text-[11px] mt-0.5 flex items-center gap-1 ${(SYNC_STATE[viewer.sync_state] || SYNC_STATE.not_synced).text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${(SYNC_STATE[viewer.sync_state] || SYNC_STATE.not_synced).dot}`} />
                      {(SYNC_STATE[viewer.sync_state] || SYNC_STATE.not_synced).label}
                      {viewer.chunk_count ? ` · ${viewer.chunk_count} đoạn tri thức` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {canManageActive && (
                      <button onClick={() => syncOneDataFile(viewer)} disabled={dataBusyPath === viewer.path} title="Đồng bộ tập tin vào Kho Tri thức"
                        className="px-2 py-1.5 rounded-lg text-[11px] font-bold bg-elevated border border-line text-fg hover:bg-hover flex items-center gap-1 disabled:opacity-50">
                        <RefreshCw size={12} className={`text-blue-600 dark:text-blue-400 ${dataBusyPath === viewer.path ? 'animate-spin' : ''}`} /> RAG
                      </button>
                    )}
                    <button onClick={() => downloadDataFile(viewer)} title="Tải tập tin về máy" className="p-1.5 rounded-lg text-fg-muted hover:text-fg-strong hover:bg-hover"><Download size={14} /></button>
                    {canManageActive && (
                      <button onClick={() => deleteOneDataFile(viewer)} disabled={dataBusyPath === viewer.path} title="Xóa (chuyển vào thùng rác)" className="p-1.5 rounded-lg text-fg-muted hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 disabled:opacity-50"><Trash2 size={14} /></button>
                    )}
                    <button onClick={closeViewer} title="Đóng, quay lại hội thoại" className="p-1.5 rounded-lg text-fg-muted hover:text-fg-strong hover:bg-hover"><X size={14} /></button>
                  </div>
                </div>
                <div className="p-4">
                  {viewer.loading ? (
                    <div className="py-16 flex items-center justify-center gap-2 text-xs text-fg-muted"><Loader2 size={14} className="animate-spin" /> Đang mở tập tin...</div>
                  ) : viewer.error ? (
                    <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-xs rounded-xl">{viewer.error}</div>
                  ) : viewer.blobUrl ? (
                    <iframe src={viewer.blobUrl} title={viewer.name} className="w-full h-[68vh] rounded-lg border border-line bg-white" />
                  ) : viewer.ext === '.md' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none break-words"><ReactMarkdown>{viewer.content || ''}</ReactMarkdown></div>
                  ) : (
                    <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words font-mono text-fg">{viewer.content || '(Tập tin không có nội dung văn bản)'}</pre>
                  )}
                  {viewer.truncated && (
                    <div className="mt-3 text-[11px] text-amber-700 dark:text-amber-400">Nội dung quá dài nên chỉ hiển thị phần đầu. Hãy tải tập tin về để xem đầy đủ.</div>
                  )}
                </div>
              </div>
            ) : (<>
            <div className="w-full bg-card border-line border rounded-xl p-4 shadow-sm flex flex-col gap-1">
              <div className="text-sm font-bold text-fg flex items-center gap-2">
                <Database size={15} className="text-blue-600 dark:text-blue-400" />
                <span>Hệ thống Quản lý Phân vùng Kho Tri thức tự động</span>
              </div>
              <span className="text-[13px] text-fg-muted">Không gian làm việc đã sẵn sàng...</span>
            </div>

            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
                <div className="w-12 h-12 rounded-xl bg-card border-line border flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xl mb-4">
                  <Sparkles size={24} />
                </div>
                <h3 className="text-base font-bold text-fg mb-1">Chào {userData.userName}!</h3>
                <p className="text-sm text-fg-subtle max-w-md leading-relaxed">Hãy nhập nội dung câu hỏi hoặc gõ dấu `/` để dùng các phím điều hướng nhanh.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 mt-2">
                {messages.map((msg, i) => {
                  const isAsst = msg.role === 'assistant';
                  return (
                    <div key={i} className={`w-full flex gap-3 ${isAsst ? 'justify-start' : 'justify-end'}`}>
                      <div className={`min-w-0 rounded-2xl p-4 text-sm leading-relaxed border shadow-sm ${isAsst ? 'w-full bg-card border-line text-fg' : 'max-w-[85%] bg-blue-600 border-blue-500 text-white'}`}>
                        <div className={`font-bold text-[12px] uppercase mb-1 ${isAsst ? 'text-fg-muted' : 'text-blue-100'}`}>{isAsst ? 'iThunder AI' : 'Bạn'}</div>
                        {/* Bong bóng AI đổi màu chữ theo theme; bong bóng người dùng luôn nền xanh chữ sáng */}
                        <div className={`prose max-w-none break-words ${isAsst ? 'dark:prose-invert' : 'prose-invert'}`}>
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
            </>)}
          </div>
        </div>

        <div className="p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-line bg-app flex flex-col items-center shrink-0">
          <div className="w-full min-w-0 relative">

            {showSlashMenu && (
              <div className="absolute bottom-full left-0 w-full bg-panel border border-line rounded-xl p-1.5 shadow-2xl mb-2 z-20 flex flex-col max-h-48 overflow-y-auto">
                <div className="text-[10px] font-bold text-fg-subtle px-2.5 py-1 uppercase tracking-wider border-b border-line mb-1">Phím lệnh nhanh iThunder AI</div>
                {filteredCommands.map((item, idx) => (
                  <button
                    key={item.cmd}
                    onClick={() => selectCommand(item.cmd)}
                    className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between text-sm transition-all ${idx === selectedCmdIndex ? 'bg-blue-600 text-white font-medium' : 'hover:bg-hover text-fg'}`}
                  >
                    <span className="font-mono">{item.cmd}</span>
                    <span className={idx === selectedCmdIndex ? 'text-blue-100 text-[12px]' : 'text-fg-subtle text-[12px]'}>{item.desc}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="w-full bg-panel border border-line rounded-2xl p-2.5 flex flex-col gap-2 shadow-lg">
              <textarea
                ref={promptInputRef}
                value={inputPrompt}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                placeholder="Nhập tin nhắn của bạn ở đây... (Gõ / để dùng lệnh nhanh)"
                rows={1}
                className="w-full bg-transparent resize-none text-[15px] text-fg placeholder-fg-subtle focus:outline-none px-2 py-1 leading-relaxed custom-scrollbar overflow-y-auto"
              />
              <div className="flex items-center justify-between px-2 pt-1 border-t border-line">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current.click()}
                    disabled={!canManageActive}
                    className={`p-1.5 rounded-lg transition-all ${canManageActive ? 'text-fg-muted hover:text-fg-strong hover:bg-hover' : 'text-fg-subtle opacity-40 cursor-not-allowed'}`}
                    title={canManageActive ? "Đính kèm tài liệu RAG" : "Bạn chỉ có quyền khai thác (không được nạp tài liệu) ở kho này"}
                  >
                    <Paperclip size={14} />
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.txt" className="hidden" />
                  <span className="hidden sm:inline text-[12px] text-fg-subtle font-medium">Enter để gửi · Shift+Enter để xuống hàng</span>
                </div>

                <button 
                  onClick={handleSendPrompt}
                  disabled={!inputPrompt.trim()} 
                  className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${inputPrompt.trim() ? 'bg-blue-600 text-white shadow-md' : 'bg-elevated text-fg-subtle cursor-not-allowed'}`}
                >
                  <Send size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* NÚT THU HẸP THANH PHẢI */}
      <div className="h-app flex items-center justify-center z-10 shrink-0 bg-app">
        <button 
          onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)} 
          className="w-4 h-12 bg-panel hover:bg-hover border-y border-l border-line text-fg-muted hover:text-fg-strong flex items-center justify-center rounded-l-md shadow-md focus:outline-none"
        >
          {isRightSidebarOpen ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </div>

      {/* 3. THANH SIDEBAR PHẢI: QUẢN TRỊ VÀ PHÂN QUYỀN TRỰC QUAN */}
      <aside className={`h-app bg-panel border-l border-line flex flex-col p-4 justify-between transition-all duration-300 shrink-0 max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-40 max-md:overflow-y-auto ${isRightSidebarOpen ? 'w-72 opacity-100 visibility-visible' : 'w-0 p-0 overflow-hidden opacity-0 pointer-events-none'}`}>

        <div className="flex flex-col gap-4 shrink-0">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <span className="text-xs font-bold text-fg-strong tracking-wide flex items-center gap-1.5">
              <HardDrive size={13} className="text-blue-600 dark:text-blue-400" />
              <span>Thông số phân vùng</span>
            </span>
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-900/30">
              Kho: {selectedColDetails?.display_name || "Đang tải..." }
            </span>
          </div>

          <div className="bg-elevated border border-line rounded-xl p-3 flex flex-col gap-2.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-fg-subtle font-bold uppercase">Mã định danh vùng:</span>
              <span className="text-xs font-mono text-amber-600 dark:text-amber-500 font-semibold">{selectedColDetails.collection_name}</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-fg-muted flex items-center gap-1.5"><FileText size={12}/> Số lượng tập tin:</span>
              <span className="font-bold text-fg font-mono">{selectedColDetails.file_count} tệp tin</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-fg-muted flex items-center gap-1.5"><Database size={12}/> Số đoạn (Chunks):</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{selectedColDetails.chunk_count} đoạn</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-fg-muted flex items-center gap-1.5"><HardDrive size={12}/> Dung lượng thực tế:</span>
              <span className="font-bold text-cyan-600 dark:text-cyan-400 font-mono">{selectedColDetails.storage_size}</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-fg-muted flex items-center gap-1.5"><ShieldCheck size={12}/> Quyền của bạn:</span>
              <span className={`font-bold ${canManageActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {activePermission === 'manage' ? 'Quản trị' : activePermission === 'read' ? 'Chỉ khai thác' : 'Không truy cập'}
              </span>
            </div>
          </div>

          {/* THÔNG BÁO QUYỀN HẠN TRỰC QUAN KHI CHỈ CÓ QUYỀN KHAI THÁC (vd. Visitor trên Kho Công khai) */}
          {activePermission === 'read' && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-500/30 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
              ⚠️ <b>Chế độ xem giới hạn:</b> Bạn có quyền khai thác hội thoại trên Kho tri thức <b>{selectedColDetails.display_name}</b> nhưng không có quyền nạp, xóa hay đồng bộ dữ liệu.
            </div>
          )}
        </div>

        {/* KHO DỮ LIỆU: TẬP TIN TRÊN MÁY CHỦ BACKEND CỦA KHO ĐANG CHỌN (xem / tải lên / xóa / RAG từng tệp) */}
        <div className="flex-1 min-h-0 flex flex-col gap-2 my-4 pt-3 border-t border-line">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-fg-strong tracking-wide flex items-center gap-1.5">
              <FolderOpen size={13} className="text-blue-600 dark:text-blue-400" />
              <span>Kho Dữ liệu</span>
              <span className="text-[10px] font-mono font-normal text-fg-subtle">({dataFiles.length} tệp)</span>
            </span>
            <span className="flex items-center gap-0.5">
              <button onClick={refreshDataFiles} title="Làm mới danh sách tập tin" className="p-1 rounded-md text-fg-muted hover:text-fg-strong hover:bg-hover">
                <RefreshCw size={12} className={dataFilesLoading ? 'animate-spin' : ''} />
              </button>
              {canManageActive && (
                <button onClick={() => dataFileInputRef.current?.click()} disabled={dataBusyPath === '__upload__'} title="Tải tập tin lên Kho Dữ liệu"
                  className="p-1 rounded-md text-fg-muted hover:text-fg-strong hover:bg-hover disabled:opacity-40">
                  {dataBusyPath === '__upload__' ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                </button>
              )}
            </span>
          </div>
          <input
            type="file" ref={dataFileInputRef} multiple accept=".pdf,.txt,.md,.docx" className="hidden"
            onChange={(e) => { const picked = Array.from(e.target.files || []); e.target.value = ''; uploadDataFiles(picked); }}
          />

          {canManageActive && (
            <label className="flex items-center gap-1.5 text-[10px] text-fg-muted cursor-pointer select-none">
              <input type="checkbox" checked={autoSyncUpload} onChange={(e) => setAutoSyncUpload(e.target.checked)} className="accent-blue-600" />
              Tự động RAG vào Kho Tri thức khi tải lên
            </label>
          )}

          {dataFiles.length > 5 && (
            <div className="relative">
              <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-fg-subtle" />
              <input value={dataFilter} onChange={(e) => setDataFilter(e.target.value)} placeholder="Lọc theo tên tệp, thư mục..."
                className="w-full bg-elevated border border-line text-[11px] rounded-lg pl-6 pr-2 py-1.5 text-fg placeholder-fg-subtle focus:outline-none" />
            </div>
          )}

          {dataNotice && (
            <div className={`p-2 rounded-lg border text-[11px] leading-relaxed whitespace-pre-line break-words ${dataNotice.type === 'error' ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400'}`}>
              {dataNotice.text}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col gap-1 -mx-1 px-1">
            {dataFilesError ? (
              <div className="text-[11px] text-red-600 dark:text-red-400 py-2">{dataFilesError}</div>
            ) : visibleDataFiles.length === 0 ? (
              <div className="text-[11px] text-fg-subtle italic py-4 text-center">
                {dataFilesLoading ? 'Đang tải danh sách tập tin...'
                  : dataFiles.length ? 'Không có tập tin khớp bộ lọc.'
                  : canManageActive ? 'Kho chưa có tập tin. Bấm nút tải lên để thêm.' : 'Kho chưa có tập tin.'}
              </div>
            ) : visibleDataFiles.map((file) => {
              const st = SYNC_STATE[file.sync_state] || SYNC_STATE.not_synced;
              const busy = dataBusyPath === file.path;
              return (
                <div key={file.path} className={`rounded-lg border px-2 py-1.5 transition-all ${viewer?.path === file.path ? 'border-blue-500/40 bg-active' : 'border-transparent hover:bg-hover'}`}>
                  <button onClick={() => openDataFile(file)} title={`Xem nội dung: ${file.path}`} className="w-full text-left flex items-start gap-1.5">
                    <FileText size={12} className="mt-0.5 shrink-0 text-fg-subtle" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-medium text-fg truncate">{file.name}</span>
                      <span className="block text-[10px] text-fg-subtle truncate">{file.folder ? `${file.folder} · ` : ''}{file.size_display}</span>
                    </span>
                  </button>
                  <div className="flex items-center justify-between mt-1 pl-[18px]">
                    <span className={`text-[10px] flex items-center gap-1 ${st.text}`} title={file.last_sync ? `RAG lần cuối: ${formatDateTime(file.last_sync)}` : 'Chưa đồng bộ vào Kho Tri thức'}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                      {st.label}{file.chunk_count ? ` · ${file.chunk_count} đoạn` : ''}
                    </span>
                    <span className="flex items-center gap-0.5">
                      {busy ? (
                        <Loader2 size={12} className="animate-spin text-fg-muted" />
                      ) : (<>
                        <button onClick={() => openDataFile(file)} title="Xem nội dung" className="p-1 rounded text-fg-muted hover:text-fg-strong hover:bg-elevated"><Eye size={12} /></button>
                        {canManageActive && (
                          <button onClick={() => syncOneDataFile(file)} title="Đồng bộ tập tin vào Kho Tri thức" className="p-1 rounded text-fg-muted hover:text-blue-600 dark:hover:text-blue-400 hover:bg-elevated"><RefreshCw size={12} /></button>
                        )}
                        {canManageActive && (
                          <button onClick={() => deleteOneDataFile(file)} title="Xóa (chuyển vào thùng rác)" className="p-1 rounded text-fg-muted hover:text-red-600 dark:hover:text-red-400 hover:bg-elevated"><Trash2 size={12} /></button>
                        )}
                      </>)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* KHỐI ĐIỀU KHIỂN NÚT ĐỒNG BỘ NÂNG CAO (RBAC LƠP 2) */}
        <div className="flex flex-col gap-2 shrink-0">
          {!canManageActive ? (
            // Kịch bản 1: Khóa hoàn toàn nút bấm khi vai trò chỉ có quyền khai thác kho đang chọn
            <button
              disabled={true}
              className="w-full bg-elevated border border-line text-fg-subtle font-bold text-xs rounded-xl py-2.5 flex items-center justify-center gap-2 cursor-not-allowed opacity-60"
              title="Vai trò của bạn không có quyền quản trị kho này"
            >
              <RefreshCw size={12} className="text-fg-subtle" />
              <span>Yêu cầu quyền Admin</span>
            </button>
          ) : (
            // Kịch bản 2: Mở nút đồng bộ khi vai trò có quyền quản trị kho (Admin: mọi kho; Visitor: kho Personal)
            <button
              onClick={async () => {
                setMessages(prev => [...prev, { role: "assistant", content: syncProgressMessage() }]);
                const result = await syncActiveCollection();
                setMessages(prev => [...prev, { role: "assistant", content: result }]);
              }}
              className="w-full bg-elevated hover:bg-hover border border-line text-fg font-bold text-xs rounded-xl py-2.5 flex items-center justify-center gap-2 shadow transition-all"
            >
              <RefreshCw size={12} className="text-blue-600 dark:text-blue-400" />
              <span>Đồng bộ Kho Tri thức</span>
            </button>
          )}
        </div>
      </aside>

      {showPublicClouds && (
        <PublicCloudsDialog
          openedKeys={collections.filter(c => c.opened || c.scope === 'cloud').map(c => c.storage_key)}
          onOpen={(col, maxOpened) => collections.some(c => c.storage_key === col.storage_key)
            ? (setShowPublicClouds(false), handleSelectDomain(col)) : handleOpenPublicCloud(col, maxOpened)}
          onClose={() => setShowPublicClouds(false)} />
      )}
    </div>
  );
}
