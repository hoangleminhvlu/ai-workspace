// Màn hình Nhận PassCode qua Email.
// Tách từ App.jsx: trạng thái và xử lý vẫn nằm ở App, thành phần này chỉ hiển thị và gọi lại qua props.
import {
  ShieldCheck, Loader2, CircleAlert, KeyRound, CornerDownLeft
} from 'lucide-react';
import { getGatewayConfig } from '../services/api';
import { GatewayOrgLine } from './GatewayWidgets';

export default function GetCodeScreen({ email, errorMessage, isLoading, orgInfo, setEmail, setErrorMessage, setIsLoading, setStatusMessage, setViewState, statusMessage }) {
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
    <div className="w-screen h-app overflow-y-auto bg-[#090d16] flex justify-center p-4 text-slate-200 select-none bg-cover bg-center" style={{ backgroundImage: "url('/background.jpg')" }}>
      <div className="w-full min-w-0 max-w-sm my-auto bg-[#070d16]/80 border border-slate-700/30 backdrop-blur-xl rounded-2xl p-5 sm:p-6 shadow-2xl">
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
