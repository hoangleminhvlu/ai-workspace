/**
 * Thiết bị FaceID: các ứng dụng Desktop / Mobile đã đăng ký khóa riêng (AI Platform: identity/devices.py). Thu hồi để thiết bị
 * không quét FaceID đăng nhập được nữa; khôi phục khi thu hồi nhầm. Cần xác nhận lại PassCode (hộp thoại step-up).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Ban, Loader2, Monitor, RefreshCw, RotateCcw, Smartphone } from 'lucide-react';
import { identityAPI } from '../../services/api';
import { Button, Notice, Section } from './shared';
import { formatDateTime } from './utils';

export default function FaceDevicesPanel({ mode = 'self', uid }) {
  const [devices, setDevices] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState('');
  const isAdmin = mode === 'admin';

  const load = useCallback(async () => {
    setBusy('load');
    try {
      const res = isAdmin ? await identityAPI.getUserFaceDevices(uid) : await identityAPI.getMyFaceDevices();
      if (Array.isArray(res?.devices)) setDevices(res.devices);
      else setNotice({ type: 'error', text: res?.detail || 'Không tải được danh sách thiết bị.' });
    } catch { setNotice({ type: 'error', text: 'Không tải được danh sách thiết bị.' }); }
    finally { setBusy(''); }
  }, [isAdmin, uid]);

  useEffect(() => { setDevices(null); setNotice(null); load(); }, [load]);

  const change = async (device, revoked) => {
    const name = device.name || device.device_id.slice(0, 8);
    if (!window.confirm(revoked ? `Thu hồi thiết bị ${name}? Thiết bị sẽ không quét FaceID đăng nhập được nữa.` : `Khôi phục thiết bị ${name}?`)) return;
    setBusy(device.device_id); setNotice(null);
    try {
      const res = isAdmin ? await identityAPI.setUserFaceDevice(uid, device.device_id, revoked) : await identityAPI.setMyFaceDevice(device.device_id, revoked);
      if (res?.status === 'SUCCESS') { setDevices(res.devices); setNotice({ type: 'success', text: res.message }); }
      else setNotice({ type: 'error', text: res?.detail || 'Không cập nhật được thiết bị.' });
    } finally { setBusy(''); }
  };

  return (
    <Section title="Thiết bị FaceID" icon={Smartphone}
      actions={<Button icon={RefreshCw} busy={busy === 'load'} disabled={!!busy} onClick={load} aria-label="Tải lại danh sách thiết bị" />}>
      <p className="text-[11px] text-fg-muted leading-relaxed">
        Ứng dụng Desktop / Mobile đăng ký khóa riêng ở lần quét FaceID đầu tiên, sau khi nhập mã xác nhận gửi qua Email. Thu hồi thiết bị bị mất hoặc lạ: thiết bị không quét
        FaceID đăng nhập được nữa; phiên đang mở và PassTime còn hiệu lực không bị ngắt. Cần nhập lại PassCode.
      </p>
      <Notice notice={notice} onClose={() => setNotice(null)} />
      {!devices && busy === 'load' && <div className="text-xs text-fg-subtle flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Đang tải...</div>}
      {devices?.length === 0 && <div className="text-xs text-fg-subtle italic">Chưa có thiết bị nào đăng ký.</div>}
      {devices?.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {devices.map(d => {
            const Icon = d.kind === 'desktop' ? Monitor : Smartphone;
            return (
              <li key={d.device_id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs bg-elevated border border-line rounded-lg px-3 py-2">
                <Icon size={14} className="shrink-0 text-fg-muted" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-fg">{d.name || (d.kind === 'desktop' ? 'Desktop' : 'Mobile')}</span>
                    <span className="font-mono text-[10px] text-fg-subtle">{d.device_id.slice(0, 8)}</span>
                    {d.revoked_at && <span className="px-1.5 py-0.5 rounded-full border text-[10px] font-semibold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40">Đã thu hồi</span>}
                  </div>
                  <div className="text-[10px] text-fg-subtle">
                    Đăng ký {formatDateTime(d.created_at)} · dùng gần nhất {formatDateTime(d.last_used_at)}{d.last_ip ? ` · ${d.last_ip}` : ''}
                  </div>
                </div>
                {d.revoked_at
                  ? <Button icon={RotateCcw} busy={busy === d.device_id} disabled={!!busy} onClick={() => change(d, false)}>Khôi phục</Button>
                  : <Button variant="danger" icon={Ban} busy={busy === d.device_id} disabled={!!busy} onClick={() => change(d, true)}>Thu hồi</Button>}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
