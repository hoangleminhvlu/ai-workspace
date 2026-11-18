/**
 * Giám sát Hệ thống › AI On-Clouds: Quản trị viên của Tổ chức nhập khóa API riêng của Tổ chức cho các dịch vụ AI bên ngoài
 * (OpenAI, Anthropic, Gemini...). Khóa chỉ đi một chiều: ô nhập không bao giờ được điền sẵn, AI Platform chỉ trả cờ
 * "đã cấu hình". Lưu / xóa khóa, sửa mô hình, bật / tắt cần xác nhận PassCode.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, CircleSlash, Cloud, ExternalLink, Eye, EyeOff, KeyRound, Loader2, Save, ShieldCheck, Trash2, Wifi } from 'lucide-react';
import { cloudAIAPI, setStepUpHandler } from '../../services/api';
import { Button, Field, Notice, Section, inputCls } from '../identity/shared';
import StepUpDialog from '../identity/StepUpDialog';

const formatTime = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }); } catch { return iso; }
};

function StatusChip({ provider }) {
  const [label, cls, Icon] = provider.undecryptable
    ? ['Không giải mã được: nhập lại khóa', 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40', CircleSlash]
    : !provider.configured
      ? ['Chưa có khóa API', 'text-fg-muted bg-elevated border-line', KeyRound]
      : !provider.enabled
        ? ['Đã có khóa · đang tắt', 'text-fg-muted bg-elevated border-line', CircleSlash]
        : ['Đang dùng', 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40', CheckCircle2];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cls}`}>
      <Icon size={11} /> {label}
    </span>
  );
}

function ProviderCard({ provider, onChanged }) {
  const [apiKey, setApiKey] = useState('');          // chỉ khóa người dùng vừa gõ, không bao giờ là khóa đã lưu
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState(provider.models.join('\n'));
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);

  useEffect(() => { setModels(provider.models.join('\n')); }, [provider.models]);

  const run = async (kind, action, success) => {
    setBusy(kind); setNotice(null);
    try {
      const res = await action();
      if (res?.status !== 'SUCCESS') { setNotice({ type: 'error', text: res?.detail || 'Thao tác không thành công.' }); return null; }
      if (success) setNotice({ type: 'success', text: success });
      if (Array.isArray(res.providers)) onChanged(res.providers);
      return res;
    } finally { setBusy(''); }
  };

  const test = async () => {
    const res = await run('test', () => cloudAIAPI.testKey(provider.id, apiKey.trim()));
    if (res) setNotice({ type: res.ok ? 'success' : 'error', text: res.detail });
  };
  const saveKey = async () => {
    const res = await run('save', () => cloudAIAPI.setKey(provider.id, apiKey.trim()),
      `Đã lưu khóa API ${provider.name}. Khóa được mã hóa và không hiển thị lại.`);
    if (res) { setApiKey(''); setShowKey(false); }
  };
  const clearKey = () => {
    if (!window.confirm(`Xóa khóa API ${provider.name} của Tổ chức? Các mô hình của ${provider.name} sẽ không còn dùng được.`)) return;
    run('clear', () => cloudAIAPI.clearKey(provider.id), `Đã xóa khóa API ${provider.name}.`);
  };
  const toggle = () => run('toggle', () => cloudAIAPI.updateProvider(provider.id, { enabled: !provider.enabled }),
    provider.enabled ? `Đã tắt ${provider.name}.` : `Đã bật ${provider.name}.`);
  const modelList = models.split(/[\n,]+/).map(m => m.trim()).filter(Boolean);
  const saveModels = () => run('models', () => cloudAIAPI.updateProvider(provider.id, { models: modelList }), 'Đã lưu danh sách mô hình.');
  const modelsChanged = modelList.join('\n') !== provider.models.join('\n');

  return (
    <Section title={provider.name} icon={Cloud} actions={<StatusChip provider={provider} />}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-fg-muted">
        <span>Địa chỉ: <span className="font-mono text-fg">{provider.base_url}</span></span>
        <a href={provider.console} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline">
          Tạo khóa API của Tổ chức <ExternalLink size={11} />
        </a>
      </div>
      {provider.key_set_at && (
        <p className="text-[11px] text-fg-subtle">Khóa cập nhật lúc {formatTime(provider.key_set_at)}{provider.key_set_by_name ? ` bởi ${provider.key_set_by_name}` : ''}.</p>
      )}
      <Notice notice={notice} onClose={() => setNotice(null)} />

      <Field label={provider.configured ? 'Thay khóa API (để trống nếu giữ khóa hiện tại)' : 'Khóa API của Tổ chức'}
        hint="Khóa được mã hóa trước khi lưu; sau khi lưu, không ai xem lại được khóa trên giao diện hay qua API.">
        <div className="flex gap-2">
          <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={e => setApiKey(e.target.value)} autoComplete="off" spellCheck={false}
            name={`cloud-ai-key-${provider.id}`} placeholder={provider.configured ? '•••••••• (đã lưu, không hiển thị)' : 'Dán khóa API'} className={`${inputCls} font-mono`} />
          <button type="button" onClick={() => setShowKey(v => !v)} aria-label={showKey ? 'Ẩn khóa vừa nhập' : 'Hiện khóa vừa nhập'}
            className="px-2 rounded-lg border border-line text-fg-muted hover:bg-hover">{showKey ? <EyeOff size={13} /> : <Eye size={13} />}</button>
        </div>
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button icon={Wifi} busy={busy === 'test'} disabled={!!busy || (!apiKey.trim() && !provider.configured)} onClick={test}
          title={apiKey.trim() ? 'Thử khóa vừa nhập (chưa lưu)' : 'Thử khóa đã lưu'}>{apiKey.trim() ? 'Kiểm tra khóa vừa nhập' : 'Kiểm tra khóa đã lưu'}</Button>
        <Button variant="primary" icon={Save} busy={busy === 'save'} disabled={!!busy || !apiKey.trim()} onClick={saveKey}>Lưu khóa</Button>
        {provider.configured && (
          <Button icon={provider.enabled ? CircleSlash : CheckCircle2} busy={busy === 'toggle'} disabled={!!busy} onClick={toggle}>
            {provider.enabled ? 'Tạm tắt' : 'Bật lại'}
          </Button>
        )}
        {(provider.configured || provider.undecryptable) && (
          <Button variant="ghostDanger" icon={Trash2} busy={busy === 'clear'} disabled={!!busy} onClick={clearKey}>Xóa khóa</Button>
        )}
      </div>

      <Field label="Mô hình chọn được trong AI Chat/Work (mỗi dòng một tên)"
        hint={provider.default_models.length ? `Mặc định: ${provider.default_models.join(', ')}` : 'Nhập đúng tên mô hình theo tài liệu của nhà cung cấp.'}>
        <textarea rows={Math.min(Math.max(modelList.length, 2), 6)} value={models} onChange={e => setModels(e.target.value)}
          spellCheck={false} className={`${inputCls} font-mono resize-y`} />
      </Field>
      {modelsChanged && (
        <div><Button icon={Save} busy={busy === 'models'} disabled={!!busy} onClick={saveModels}>Lưu danh sách mô hình</Button></div>
      )}
    </Section>
  );
}

export default function CloudAIPanel() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [stepUpRequest, setStepUpRequest] = useState(null);   // { message, resolve }

  const load = useCallback(async () => {
    const res = await cloudAIAPI.listProviders();
    if (res?.status === 'SUCCESS') { setData(res); setError(''); }
    else setError(res?.detail || 'Không đọc được cấu hình dịch vụ AI On-Clouds.');
  }, []);

  useEffect(() => { load(); }, [load]);
  // HTTP 428 (cần xác nhận PassCode) => hộp thoại; Promise trả true khi đã xác nhận
  useEffect(() => {
    setStepUpHandler((message) => new Promise(resolve => setStepUpRequest({ message, resolve })));
    return () => setStepUpHandler(null);
  }, []);
  const finishStepUp = (confirmed) => { stepUpRequest?.resolve(confirmed); setStepUpRequest(null); };

  return (
    <div className="flex flex-col gap-4 max-w-4xl w-full">
      <Section title="Kết nối mô hình AI bên ngoài bằng khóa API của Tổ chức" icon={ShieldCheck}>
        <ol className="list-decimal pl-5 text-xs text-fg leading-relaxed flex flex-col gap-1">
          <li>Tạo khóa API trên trang của nhà cung cấp bằng tài khoản thanh toán của Tổ chức (nên đặt hạn mức chi tiêu ở đó).</li>
          <li>Dán khóa vào ô của nhà cung cấp, bấm <b>Kiểm tra khóa vừa nhập</b> (không tốn phí, chưa lưu), rồi <b>Lưu khóa</b>. Thao tác lưu cần nhập lại PassCode.</li>
          <li>Các mô hình trong danh sách xuất hiện ở khung chọn mô hình của AI Chat/Work với nhãn <b>☁ On-Clouds</b>.</li>
          <li>Thay khóa: nhập khóa mới đè lên. Nghi lộ khóa: <b>Xóa khóa</b> tại đây và thu hồi khóa trên trang của nhà cung cấp.</li>
        </ol>
        <ul className="list-disc pl-5 text-[11px] text-fg-muted leading-relaxed flex flex-col gap-0.5">
          <li>Khóa không khai báo trong tập tin cấu hình hay .env; AI Platform mã hóa khóa trước khi lưu, không trả lại khóa cho bất kỳ ai, không ghi khóa vào nhật ký.</li>
          <li>Câu hỏi gửi mô hình On-Clouds đi ra Internet, nên Trợ lý AI chỉ trả lời dựa trên Kho Tri thức của Tổ chức
            {data ? (data.outside_knowledge_onclouds ? ' (kiến thức chung được trả lời kèm ghi chú "không lấy từ Kho")' : ' (Kho không có thông tin thì từ chối)') : ''}.
            Mô hình On-Premise trên Máy chủ AI của Tổ chức được dùng tự do tri thức sẵn có của mô hình.</li>
        </ul>
      </Section>
      {error && <Notice notice={{ type: 'error', text: error }} />}
      {!data && !error && <div className="text-xs text-fg-subtle flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Đang tải...</div>}
      {data?.providers.map(p => (
        <ProviderCard key={p.id} provider={p} onChanged={(providers) => setData(d => ({ ...d, providers }))} />
      ))}
      {stepUpRequest && <StepUpDialog request={stepUpRequest} minutes={data?.step_up_minutes || 10} onDone={finishStepUp} />}
    </div>
  );
}
