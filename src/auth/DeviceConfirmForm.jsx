// Nhập mã xác nhận thiết bị mới (gửi qua Email) trên ứng dụng Desktop / Mobile. AI Platform: identity/devices.py.
import { useEffect, useState } from 'react';
import { Loader2, MailCheck } from 'lucide-react';

const CODE_DIGITS = 8;

export default function DeviceConfirmForm({ busy, confirm, onResend, onSubmit }) {
  const [code, setCode] = useState('');
  const [wait, setWait] = useState(0);

  // Mã mới hoặc nhập sai: xóa ô nhập, đếm lại thời gian được gửi lại
  useEffect(() => { setCode(''); }, [confirm]);
  useEffect(() => {
    const until = confirm.receivedAt + (confirm.resendIn || 0) * 1000;
    const tick = () => setWait(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [confirm.receivedAt, confirm.resendIn]);

  return (
    <form className="text-left" onSubmit={e => { e.preventDefault(); if (code.length === CODE_DIGITS && !busy) onSubmit(code); }}>
      <div className="mb-3 flex items-start gap-2 rounded-xl border border-cyan-700/40 bg-cyan-950/30 px-3 py-2.5 text-xs text-cyan-100 leading-relaxed">
        <MailCheck size={16} className="mt-0.5 shrink-0 text-cyan-400" /> <span className="min-w-0 break-words">{confirm.message}</span>
      </div>
      <input
        type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus aria-label={`Mã xác nhận thiết bị (${CODE_DIGITS} chữ số)`}
        placeholder="0000 0000" value={code.replace(/^(\d{4})(\d)/, '$1 $2')} disabled={busy}
        onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_DIGITS))}
        className="w-full bg-[#f0f5ff] text-blue-900 font-black rounded-xl px-4 py-3 text-center tracking-[0.3em] text-xl focus:outline-none border-2 border-blue-400/50 focus:border-cyan-400"
      />
      <button type="submit" disabled={busy || code.length < CODE_DIGITS}
        className="mt-3 w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-bold text-xs rounded-xl py-2.5 flex items-center justify-center gap-2">
        {busy ? <Loader2 size={14} className="animate-spin" /> : 'Đăng ký thiết bị'}
      </button>
      <button type="button" disabled={busy || wait > 0} onClick={onResend}
        className="mt-3 block mx-auto text-xs text-cyan-400 hover:text-cyan-300 disabled:text-slate-500">
        {wait > 0 ? `Gửi lại mã sau ${wait} giây` : 'Gửi lại mã'}
      </button>
    </form>
  );
}
