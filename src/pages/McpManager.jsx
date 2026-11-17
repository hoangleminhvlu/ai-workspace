/**
 * TARA AI Workspace - Main iThunder AI OS Entry Point (V6.11.01)
 * Tập tin tạo lập môi trường AI Workspace cho người dùng.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Cable, Check, Copy, Pencil, Plug, PlugZap, Plus, Server, Trash2, Wrench } from 'lucide-react';
import { mcpAPI } from '../services/api';
import { Button, Field, Modal, Notice, Section, controlCls, inputCls } from './identity/shared';
import { formatDateTime } from './identity/utils';

// Trang Tích hợp MCP (Model Context Protocol):
// - Mọi thành viên: địa chỉ MCP Server /api/mcp của Gateway để kết nối Claude Desktop/Claude Code, công cụ AI được dùng trong Chat
// - Quản trị viên: đăng ký MCP Server bên ngoài cho mô hình AI gọi công cụ. Backend vẫn kiểm tra quyền ở từng API.

const TOKEN_PLACEHOLDER = '<MA_TRUY_CAP>';

const useCopy = () => {
  const [copied, setCopied] = useState('');
  const copy = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(c => (c === key ? '' : c)), 1500);
    } catch { setCopied(''); }
  };
  return [copied, copy];
};

const CodeBlock = ({ id, text, copied, onCopy, onCopyWithToken }) => (
  <div className="relative">
    <pre className="bg-elevated border border-line rounded-lg p-3 pr-24 text-[11px] font-mono text-fg overflow-x-auto whitespace-pre">{text}</pre>
    <div className="absolute top-2 right-2 flex gap-1">
      <button onClick={() => onCopy(id, text)} title="Sao chép (mã truy cập để trống)" aria-label="Sao chép"
        className="p-1.5 rounded-md bg-panel border border-line text-fg-muted hover:text-fg-strong">
        {copied === id ? <Check size={12} /> : <Copy size={12} />}
      </button>
      {onCopyWithToken && (
        <button onClick={onCopyWithToken} title="Sao chép kèm mã truy cập của phiên này"
          className="px-1.5 rounded-md bg-panel border border-line text-[10px] font-semibold text-fg-muted hover:text-fg-strong">
          {copied === `${id}-token` ? <Check size={12} /> : '+ mã'}
        </button>
      )}
    </div>
  </div>
);

function ConnectSection({ info }) {
  const [copied, copy] = useCopy();
  const url = info.server.url;
  const snippets = {
    cli: `claude mcp add --transport http ithunder ${url} \\\n  --header "Authorization: Bearer ${TOKEN_PLACEHOLDER}"`,
    json: JSON.stringify({ mcpServers: { ithunder: { type: 'http', url, headers: { Authorization: `Bearer ${TOKEN_PLACEHOLDER}` } } } }, null, 2),
  };
  const withToken = (key) => () => {
    const token = localStorage.getItem('tara_token') || '';
    copy(`${key}-token`, snippets[key].replaceAll(TOKEN_PLACEHOLDER, token));
  };

  return (
    <Section title="Kết nối vào iThunder AI OS (MCP Server)" icon={Server}>
      {!info.server.enabled ? (
        <Notice notice={{ type: 'info', text: 'MCP Server của Gateway đang tắt (MCP_SERVER_ENABLED=false).' }} />
      ) : (
        <>
          <p className="text-xs text-fg-muted">
            Claude Desktop, Claude Code hoặc agent khác hỗ trợ MCP có thể khai thác Kho Tri thức và Kho Dữ liệu theo đúng quyền của bạn
            (vai trò hiện tại). Giao thức <b>Streamable HTTP</b>, xác thực bằng mã truy cập (JWT) của phiên đăng nhập.
          </p>
          <div className="flex items-center gap-2">
            <code className={`${controlCls} flex-1 font-mono truncate`}>{url}</code>
            <Button icon={copied === 'url' ? Check : Copy} onClick={() => copy('url', url)}>Sao chép</Button>
          </div>
          <Notice notice={{ type: 'info', text: 'Mã truy cập là mã cá nhân của phiên đăng nhập và hết hạn theo PassTime: không chia sẻ cho người khác; khi hết hạn, đăng nhập lại và cập nhật mã trong cấu hình Client.' }} />
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-fg-muted">Claude Code (dòng lệnh)</span>
              <CodeBlock id="cli" text={snippets.cli} copied={copied} onCopy={copy} onCopyWithToken={withToken('cli')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-fg-muted">Cấu hình JSON (.mcp.json / Client hỗ trợ HTTP)</span>
              <CodeBlock id="json" text={snippets.json} copied={copied} onCopy={copy} onCopyWithToken={withToken('json')} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-fg-muted">Công cụ được cung cấp cho vai trò của bạn ({info.server.tools.length})</span>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {info.server.tools.map(t => (
                <li key={t.name} className="border border-line rounded-lg px-3 py-2 bg-elevated">
                  <div className="text-xs font-mono font-semibold text-fg-strong">{t.name}</div>
                  <div className="text-[11px] text-fg-muted">{t.description}</div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </Section>
  );
}

function MyToolsSection({ info, refreshKey }) {
  const [state, setState] = useState(null);   // { tools } | { error }
  useEffect(() => {
    mcpAPI.getMyTools().then(res => setState(res?.status === 'SUCCESS' ? res : { error: res?.detail }));
  }, [refreshKey]);

  return (
    <Section title="Công cụ AI được dùng trong khung Chat (MCP Client)" icon={Wrench}>
      {!info.client.enabled ? (
        <Notice notice={{ type: 'info', text: 'MCP Client đang tắt (MCP_CLIENT_ENABLED=false): mô hình AI chỉ trả lời dựa trên Kho Tri thức.' }} />
      ) : !state ? (
        <span className="text-xs text-fg-subtle">Đang tải...</span>
      ) : state.error ? (
        <Notice notice={{ type: 'error', text: state.error }} />
      ) : state.tools.length === 0 ? (
        <p className="text-xs text-fg-muted">Chưa có công cụ MCP bên ngoài nào dành cho vai trò của bạn. Mô hình AI trả lời dựa trên Kho Tri thức nội bộ.</p>
      ) : (
        <>
          <p className="text-xs text-fg-muted">
            Khi Kho Tri thức không đủ thông tin, mô hình AI (hỗ trợ tool-calling, vd. gpt-oss, qwen, llama3.1) có thể tự gọi các công cụ sau,
            tối đa {info.client.max_tool_rounds} vòng mỗi câu trả lời. Mô hình không hỗ trợ tool-calling vẫn trả lời như bình thường.
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {state.tools.map(t => (
              <li key={t.name} className="border border-line rounded-lg px-3 py-2 bg-elevated">
                <div className="text-xs font-mono font-semibold text-fg-strong">{t.tool} <span className="font-normal text-fg-subtle">· {t.server_id}</span></div>
                <div className="text-[11px] text-fg-muted line-clamp-2">{t.description}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

const EMPTY_SERVER = { id: '', name: '', url: '', description: '', enabled: true, allowed_roles: [], allowed_tools: [], auth_header: 'Authorization' };

function ServerDialog({ server, roles, defaultRoles, onClose, onSaved }) {
  const creating = !server;
  const [form, setForm] = useState(() => ({ ...EMPTY_SERVER, ...(server || {}), allowed_tools: (server?.allowed_tools || []).join(', ') }));
  // keep: giữ mã cũ | env: tham chiếu biến môi trường | stored: nhập trực tiếp | none: không dùng mã
  const [tokenMode, setTokenMode] = useState(creating ? 'none' : (server.token_source ? 'keep' : 'none'));
  const [tokenValue, setTokenValue] = useState(server?.token_env || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const toggleRole = (role) => setForm(f => ({ ...f, allowed_roles: f.allowed_roles.includes(role) ? f.allowed_roles.filter(r => r !== role) : [...f.allowed_roles, role] }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    const body = {
      name: form.name.trim(), url: form.url.trim(), description: form.description, enabled: form.enabled,
      allowed_roles: form.allowed_roles, auth_header: form.auth_header.trim() || 'Authorization',
      allowed_tools: form.allowed_tools.split(',').map(s => s.trim()).filter(Boolean),
    };
    if (tokenMode === 'env') body.auth_token = `env:${tokenValue.trim()}`;
    else if (tokenMode === 'stored') body.auth_token = tokenValue.trim();
    else if (tokenMode === 'none') body.auth_token = '';
    const res = creating ? await mcpAPI.createServer({ ...body, id: form.id.trim() }) : await mcpAPI.updateServer(server.id, body);
    setBusy(false);
    if (res?.status === 'SUCCESS') onSaved(res.message);
    else setError(res?.detail || 'Không lưu được MCP Server.');
  };

  return (
    <Modal title={creating ? 'Đăng ký MCP Server bên ngoài' : `Sửa MCP Server: ${server.name}`} onClose={onClose} width="max-w-xl">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Notice notice={error ? { type: 'error', text: error } : null} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Mã định danh" hint="Chữ thường, số, gạch ngang; là tiền tố tên công cụ (vd. github__search)">
            <input required disabled={!creating} value={form.id} onChange={set('id')} pattern="[a-z0-9][a-z0-9\-]{0,31}" className={inputCls} placeholder="github" />
          </Field>
          <Field label="Tên hiển thị">
            <input required value={form.name} onChange={set('name')} maxLength={255} className={inputCls} placeholder="GitHub MCP" />
          </Field>
        </div>
        <Field label="Địa chỉ (Streamable HTTP)" hint="Chỉ hỗ trợ MCP Server qua http(s); Gateway không chạy tiến trình stdio.">
          <input required type="url" value={form.url} onChange={set('url')} className={inputCls} placeholder="https://mcp.example.com/mcp" />
        </Field>
        <Field label="Mô tả">
          <input value={form.description} onChange={set('description')} maxLength={2000} className={inputCls} />
        </Field>
        <Field label="Vai trò được dùng" hint={`Không chọn = mặc định (${defaultRoles.join(', ')})`}>
          <div className="flex flex-wrap gap-1.5">
            {roles.map(role => (
              <label key={role} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] cursor-pointer ${form.allowed_roles.includes(role) ? 'border-blue-500 text-fg-strong bg-blue-50 dark:bg-blue-950/30' : 'border-line text-fg-muted'}`}>
                <input type="checkbox" className="sr-only" checked={form.allowed_roles.includes(role)} onChange={() => toggleRole(role)} />{role}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Công cụ cho phép" hint="Tên công cụ, phân tách bằng dấu phẩy; để trống = cho phép tất cả. Dùng nút Kiểm tra để xem danh sách.">
          <input value={form.allowed_tools} onChange={set('allowed_tools')} className={`${inputCls} font-mono`} placeholder="search_repositories, get_issue" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <Field label="Header xác thực">
            <input value={form.auth_header} onChange={set('auth_header')} pattern="[A-Za-z0-9\-]{1,100}" className={`${inputCls} font-mono`} />
          </Field>
          <Field label="Mã truy cập" hint="Khuyến nghị: lưu bí mật trong .env của Gateway và tham chiếu tên biến. Mã không bao giờ được hiển thị lại.">
            <div className="flex gap-2">
              <select value={tokenMode} onChange={e => setTokenMode(e.target.value)} className={`${controlCls} w-auto`} aria-label="Nguồn mã truy cập">
                {!creating && server.token_source && <option value="keep">Giữ mã hiện tại</option>}
                <option value="none">Không dùng</option>
                <option value="env">Biến môi trường</option>
                <option value="stored">Nhập trực tiếp</option>
              </select>
              {(tokenMode === 'env' || tokenMode === 'stored') && (
                <input required value={tokenValue} onChange={e => setTokenValue(e.target.value)} type={tokenMode === 'stored' ? 'password' : 'text'}
                  autoComplete="off" className={`${inputCls} font-mono`} placeholder={tokenMode === 'env' ? 'GITHUB_MCP_TOKEN' : 'Mã Bearer'}
                  pattern={tokenMode === 'env' ? '[A-Za-z_][A-Za-z0-9_]*' : undefined} />
              )}
            </div>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-xs text-fg">
          <input type="checkbox" checked={form.enabled} onChange={set('enabled')} /> Bật cho mô hình AI sử dụng
        </label>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Hủy</Button>
          <Button type="submit" variant="primary" icon={Check} busy={busy}>{creating ? 'Đăng ký' : 'Lưu'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function TestDialog({ server, onClose, onChanged }) {
  const [result, setResult] = useState(null);
  const [allowed, setAllowed] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    mcpAPI.testServer(server.id).then(res => {
      setResult(res);
      // Danh sách cho phép rỗng = mọi công cụ
      if (Array.isArray(res?.tools)) setAllowed(new Set(server.allowed_tools?.length ? server.allowed_tools : res.tools.map(t => t.name)));
    });
  }, [server.id, server.allowed_tools]);

  const toggle = (name) => setAllowed(s => { const n = new Set(s); n.has(name) ? n.delete(name) : n.add(name); return n; });
  const save = async () => {
    if (allowed.size === 0) { setError('Chọn ít nhất một công cụ, hoặc Tắt MCP Server này.'); return; }
    setBusy(true); setError('');
    // Chọn đủ mọi công cụ = không giới hạn (công cụ mới của Server cũng được dùng)
    const list = result.tools.every(t => allowed.has(t.name)) ? [] : [...allowed];
    const res = await mcpAPI.updateServer(server.id, { allowed_tools: list });
    setBusy(false);
    if (res?.status === 'SUCCESS') onChanged(res.message); else setError(res?.detail || 'Không lưu được.');
  };

  return (
    <Modal title={`Kiểm tra kết nối: ${server.name}`} onClose={onClose} width="max-w-xl">
      {!result ? <span className="text-xs text-fg-subtle">Đang kết nối {server.url}...</span> : result.status !== 'SUCCESS' ? (
        <Notice notice={{ type: 'error', text: result.detail || 'Không kết nối được MCP Server.' }} />
      ) : (
        <>
          <Notice notice={{ type: 'success', text: `${result.message} Server: ${result.server_info?.name || '?'} ${result.server_info?.version || ''}` }} />
          <Notice notice={error ? { type: 'error', text: error } : null} />
          <p className="text-[11px] text-fg-muted">Bỏ chọn công cụ mà mô hình AI không được gọi (vd. công cụ ghi/xóa dữ liệu).</p>
          <ul className="flex flex-col gap-1.5">
            {result.tools.map(t => (
              <li key={t.name}>
                <label className="flex items-start gap-2 border border-line rounded-lg px-3 py-2 bg-elevated cursor-pointer">
                  <input type="checkbox" className="mt-0.5" checked={allowed.has(t.name)} onChange={() => toggle(t.name)} />
                  <span className="min-w-0">
                    <span className="block text-xs font-mono font-semibold text-fg-strong">{t.name}</span>
                    {t.description && <span className="block text-[11px] text-fg-muted line-clamp-2">{t.description}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            <Button onClick={onClose}>Đóng</Button>
            <Button variant="primary" icon={Check} busy={busy} onClick={save}>Lưu công cụ cho phép</Button>
          </div>
        </>
      )}
    </Modal>
  );
}

function ServersSection({ info, onChanged }) {
  const [servers, setServers] = useState(null);
  const [notice, setNotice] = useState(null);
  const [editing, setEditing] = useState(undefined);   // undefined: đóng | null: tạo mới | server: sửa
  const [testing, setTesting] = useState(null);

  const load = useCallback(async () => {
    const res = await mcpAPI.listServers();
    if (res?.status === 'SUCCESS') setServers(res.servers);
    else setNotice({ type: 'error', text: res?.detail || 'Không tải được danh mục MCP Server.' });
  }, []);
  useEffect(() => { load(); }, [load]);

  const done = (message) => {
    setEditing(undefined); setTesting(null);
    setNotice({ type: 'success', text: message });
    load(); onChanged();
  };
  const toggle = async (s) => {
    const res = await mcpAPI.updateServer(s.id, { enabled: !s.enabled });
    if (res?.status === 'SUCCESS') done(res.message); else setNotice({ type: 'error', text: res?.detail });
  };
  const remove = async (s) => {
    if (!window.confirm(`Gỡ MCP Server "${s.name}"? Mô hình AI sẽ không gọi được các công cụ của Server này nữa.`)) return;
    const res = await mcpAPI.deleteServer(s.id);
    if (res?.status === 'SUCCESS') done(res.message); else setNotice({ type: 'error', text: res?.detail });
  };

  return (
    <Section title="MCP Server bên ngoài (quản trị viên)" icon={Cable}
      actions={<Button variant="primary" icon={Plus} onClick={() => setEditing(null)}>Đăng ký</Button>}>
      <Notice notice={notice} onClose={() => setNotice(null)} />
      {!servers ? <span className="text-xs text-fg-subtle">Đang tải...</span> : servers.length === 0 ? (
        <p className="text-xs text-fg-muted">Chưa đăng ký MCP Server nào. Đăng ký một MCP Server (Streamable HTTP) để mô hình AI trong khung Chat gọi được công cụ của nó.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-fg-subtle text-left">
              <tr><th className="py-2 pr-3">MCP Server</th><th className="py-2 pr-3">Vai trò</th><th className="py-2 pr-3">Trạng thái</th><th className="py-2 text-right">Thao tác</th></tr>
            </thead>
            <tbody>
              {servers.map(s => (
                <tr key={s.id} className="border-t border-line align-top">
                  <td className="py-2.5 pr-3 min-w-[14rem]">
                    <div className="font-semibold text-fg-strong">{s.name} <span className="font-mono font-normal text-fg-subtle">({s.id})</span></div>
                    <div className="font-mono text-[11px] text-fg-muted break-all">{s.url}</div>
                    <div className="text-[10px] text-fg-subtle">
                      {s.token_source === 'env' ? `Mã: biến ${s.token_env}` : s.token_source === 'stored' ? 'Mã: đã lưu' : 'Không dùng mã'}
                      {s.allowed_tools?.length ? ` · ${s.allowed_tools.length} công cụ cho phép` : ' · mọi công cụ'}
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-[11px] text-fg-muted">{s.effective_roles.join(', ')}{!s.allowed_roles?.length && <span className="text-fg-subtle"> (mặc định)</span>}</td>
                  <td className="py-2.5 pr-3 text-[11px]">
                    <div className={s.enabled ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-fg-subtle font-semibold'}>{s.enabled ? 'Đang bật' : 'Đã tắt'}</div>
                    {s.status?.error ? <div className="text-red-600 dark:text-red-400 line-clamp-2" title={s.status.error}>{s.status.error}</div>
                      : s.status ? <div className="text-fg-muted">{s.status.tool_count} công cụ · {formatDateTime(s.status.fetched_at)}</div>
                        : <div className="text-fg-subtle">Chưa kết nối</div>}
                  </td>
                  <td className="py-2.5">
                    <div className="flex justify-end gap-1.5">
                      <Button icon={PlugZap} onClick={() => setTesting(s)}>Kiểm tra</Button>
                      <Button icon={Plug} onClick={() => toggle(s)}>{s.enabled ? 'Tắt' : 'Bật'}</Button>
                      <Button icon={Pencil} onClick={() => setEditing(s)} aria-label={`Sửa ${s.name}`} />
                      <Button variant="ghostDanger" icon={Trash2} onClick={() => remove(s)} aria-label={`Gỡ ${s.name}`} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing !== undefined && <ServerDialog server={editing} roles={info.roles} defaultRoles={info.client.default_roles} onClose={() => setEditing(undefined)} onSaved={done} />}
      {testing && <TestDialog server={testing} onClose={() => { setTesting(null); load(); }} onChanged={done} />}
    </Section>
  );
}

export default function McpManager() {
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [notice, setNotice] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    mcpAPI.getInfo().then(res => {
      if (res?.status === 'SUCCESS') setInfo(res);
      else setNotice({ type: 'error', text: res?.detail || 'Không tải được thông tin MCP.' });
    });
  }, []);

  return (
    <div className="w-screen h-app flex flex-col bg-app text-fg font-sans antialiased overflow-hidden">
      <header className="h-14 border-b border-line bg-panel px-6 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate('/')} aria-label="Về AI Workspace" className="p-1.5 rounded-lg hover:bg-hover text-fg-muted hover:text-fg-strong transition-all">
          <ArrowLeft size={16} />
        </button>
        <span className="text-sm font-bold uppercase tracking-wider text-fg truncate">Tích hợp MCP</span>
        <span className="hidden md:inline text-xs text-fg-muted truncate">Model Context Protocol</span>
      </header>
      <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        <Notice notice={notice} onClose={() => setNotice(null)} />
        {info && <ConnectSection info={info} />}
        {info && <MyToolsSection info={info} refreshKey={refreshKey} />}
        {info?.is_admin && <ServersSection info={info} onChanged={() => setRefreshKey(k => k + 1)} />}
      </main>
    </div>
  );
}
