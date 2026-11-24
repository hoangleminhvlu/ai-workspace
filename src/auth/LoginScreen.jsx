// Trang Đăng nhập (iThunder AI Gateway): chọn AI Gateway / Tổ chức, xác thực PassCode, đề nghị trở thành Khách.
// Tách từ App.jsx: trạng thái và xử lý vẫn nằm ở App, thành phần này chỉ hiển thị và gọi lại qua props.
import {
  ShieldCheck, Loader2, CircleAlert, UserPlus, CornerDownLeft
} from 'lucide-react';
import { CLIENT_APP } from './gatewayUtils';
import { useState } from 'react';
import { GatewayAddressForm, GatewayOrgCard } from './GatewayWidgets';

export default function LoginScreen({ acceptJoinOffer, activeGateway, connectGateway, errorMessage, handlePasscodeSubmit, isLoading, joinOffer, loadOrgInfo, onShowApps, orgInfo, passcode, setErrorMessage, setJoinOffer, setPasscode, setViewState }) {
  const [manualGateway, setManualGateway] = useState(false);   // ứng dụng máy trạm: đang nhập địa chỉ AI Gateway khác
  return (
    <div
      className="w-screen h-app bg-[#090d16] flex text-slate-200 select-none antialiased bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/background.jpg')" }}
    >
      {/* KHỐI TRỐNG BÊN TRÁI CHIẾM 2/3 CHIỀU RỘNG MÀN HÌNH */}
      {/* Chỉ hiện từ khổ lg: máy tính bảng (md) dành toàn bộ bề rộng cho khung Đăng nhập, tránh khung 1/3 quá hẹp */}
      <div className="hidden lg:flex lg:flex-1 min-w-0 h-full items-center p-12 bg-gradient-to-r from-black/60 to-transparent">
        <div className="max-w-xl">
          <span className="text-sm font-mono font-bold tracking-[0.4em] text-cyan-400 uppercase">Hạ tầng trí tuệ nhân tạo tin cậy</span>
          <h2 className="text-5xl font-black text-white tracking-tight mt-3 leading-tight">iThunder AI<br/>Operating System</h2>
          <p className="text-base text-slate-300 mt-5 leading-relaxed font-medium">Không gian làm việc số tích hợp chức năng quản trị định danh, quản lý dữ liệu và tri thức, tự động hóa và tối ưu hóa các ứng dụng Trí tuệ nhân tạo trong mạng nội bộ (AI On-Premise)</p>
        </div>
      </div>

      {/* KHỐI CHỨA FORM LOGIN CHIẾM ĐÚNG 1/3 CHIỀU RỘNG MÀN HÌNH BÊN PHẢI */}
      {/* min-w-0: ô PassCode giãn chữ (tracking) có bề rộng nội tại lớn, không được kéo khung rộng hơn màn hình điện thoại.
          overflow-y-auto: màn hình thấp (điện thoại xoay ngang, bàn phím ảo) vẫn cuộn tới được nút Xác thực */}
      <div className="w-full min-w-0 lg:w-[28rem] xl:w-1/3 lg:shrink-0 h-full overflow-y-auto bg-[#070d16]/80 border-l border-slate-800/60 backdrop-blur-2xl flex items-start justify-center p-4 sm:p-6 shadow-2xl transition-all">
        <div className="w-full min-w-0 max-w-sm my-auto bg-slate-900/50 border border-slate-700/30 backdrop-blur-md rounded-2xl p-5 sm:p-6 shadow-2xl">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-2">
              <div className="flex flex-col items-center">
                <img src="/logo.png" alt="iThunder Logo" className="w-44 h-20 object-contain shrink-0" />
              </div>
            </div>
            {/* TĂNG KÍCH THƯỚC TIÊU ĐỀ CHÍNH & MÀU TRẮNG SÁNG TOÀN PHẦN */}
            <h1 className="text-2xl font-extrabold tracking-tight text-white mt-2">iThunder AI Gateway</h1>

            {/* TỔ CHỨC SỞ HỮU AI GATEWAY: người dùng biết mình đang đăng nhập vào AI Workspace của Tổ chức nào */}
            {/* Ứng dụng máy trạm: mặc định là AI Gateway của Tổ chức khai báo sẵn (DEFAULT_GATEWAY_URL) hoặc đã ghi nhớ; đổi Tổ
                chức ngay trong khung Tổ chức. Ô nhập địa chỉ chỉ hiện khi chọn "Tổ chức khác" hoặc AI Gateway không phản hồi. */}
            <GatewayOrgCard org={orgInfo} onRetry={loadOrgInfo} client={CLIENT_APP} disabled={isLoading}
              onSwitch={CLIENT_APP ? (url) => { setManualGateway(false); connectGateway(url); } : undefined}
              onManual={() => setManualGateway(true)} />
            {CLIENT_APP && (manualGateway || orgInfo.status === 'error' || orgInfo.status === 'none') && (
              <GatewayAddressForm key={activeGateway} status={orgInfo.status} disabled={isLoading}
                onConnect={(url) => { setManualGateway(false); connectGateway(url); }}
                onCancel={orgInfo.status === 'ok' ? () => setManualGateway(false) : undefined} />
            )}
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
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-label="Mã đăng nhập PassCode (6 chữ số)"
                size={6}
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
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mt-6 pt-4 border-t border-slate-800/80 text-xs font-semibold text-slate-300">
            <button onClick={() => setViewState('GET_CODE')} className="hover:text-cyan-400 transition-colors">Tôi quên PassCode (GetCode)</button>
            <button onClick={() => setViewState('REGISTER')} className="hover:text-emerald-400 transition-colors">Tôi muốn đăng ký (Register)</button>
            {/* Chỉ Web App: mở lại khuyến nghị cài ứng dụng Desktop / Mobile */}
            {onShowApps && <button onClick={onShowApps} className="hover:text-cyan-400 transition-colors">Tải ứng dụng Windows / Android</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
