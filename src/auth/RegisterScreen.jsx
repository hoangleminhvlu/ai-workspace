// Màn hình Đăng ký Tài khoản mới (hoặc nhận liên kết gia nhập Tổ chức cho tài khoản đã có).
// Tách từ App.jsx: trạng thái và xử lý vẫn nằm ở App, thành phần này chỉ hiển thị và gọi lại qua props.
import {
  ShieldCheck, Loader2, CircleAlert, UserPlus, CornerDownLeft
} from 'lucide-react';
import iThunderAPI from '../services/api';
import { GatewayOrgLine } from './GatewayWidgets';

export default function RegisterScreen({ email, errorMessage, fullName, isLoading, orgInfo, setEmail, setErrorMessage, setFullName, setIsLoading, setStatusMessage, setViewState, statusMessage }) {
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
    <div className="w-screen h-app overflow-y-auto bg-[#090d16] flex justify-center p-4 text-slate-200 select-none bg-cover bg-center" style={{ backgroundImage: "url('/background.jpg')" }}>
      <div className="w-full min-w-0 max-w-sm my-auto bg-[#070d16]/80 border border-slate-700/30 backdrop-blur-xl rounded-2xl p-5 sm:p-6 shadow-2xl">
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
