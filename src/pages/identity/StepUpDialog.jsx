/**
 * Hộp thoại xác nhận PassCode trước thao tác nhạy cảm (Backend trả HTTP 428 STEP_UP_REQUIRED), dùng chung cho
 * Quản trị Định danh và khóa API dịch vụ AI On-Clouds. Trang dùng: setStepUpHandler((message) => Promise<boolean>).
 */
import React, { useEffect, useRef, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { identityAPI } from '../../services/api';
import { Button, Modal, Notice, controlCls } from './shared';

// Hộp thoại xác nhận PassCode trước thao tác nhạy cảm (Backend trả HTTP 428 STEP_UP_REQUIRED)
export default function StepUpDialog({ request, minutes, onDone }) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await identityAPI.stepUp(passcode);
      if (res?.status === 'SUCCESS') onDone(true);
      else { setError(res?.detail || 'Không xác nhận được PassCode.'); setPasscode(''); inputRef.current?.focus(); }
    } finally { setBusy(false); }
  };

  return (
    <Modal title="Xác nhận PassCode" onClose={() => onDone(false)} width="max-w-sm">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-xs text-fg-muted">{request.message} Xác nhận có hiệu lực {minutes} phút cho các thao tác nhạy cảm tiếp theo.</p>
        <Notice notice={error ? { type: 'error', text: error } : null} />
        <input ref={inputRef} type="password" inputMode="numeric" autoComplete="off" pattern="\d{6}" maxLength={6} required
          value={passcode} onChange={e => setPasscode(e.target.value.replace(/\D/g, ''))} aria-label="PassCode của bạn"
          placeholder="PassCode 6 chữ số" className={`${controlCls} w-full text-center tracking-[0.5em] font-mono text-sm`} />
        <div className="flex justify-end gap-2">
          <Button onClick={() => onDone(false)}>Hủy</Button>
          <Button type="submit" variant="primary" icon={KeyRound} busy={busy} disabled={passcode.length !== 6}>Xác nhận</Button>
        </div>
      </form>
    </Modal>
  );
}
