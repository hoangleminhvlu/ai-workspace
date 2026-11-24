// Thông báo trước trang Đăng nhập của Web App: khuyến nghị cài ứng dụng Windows Desktop / Android Mobile.
// Ứng dụng Desktop / Mobile không bao giờ thấy màn hình này (xem appDownload.js).
import { Camera, Download, ExternalLink, KeyRound, Monitor, ShieldAlert, Smartphone } from 'lucide-react';
import { GatewayOrgLine } from './GatewayWidgets';
import { GUIDE_URL, RELEASE_URL, devicePlatform } from './appDownload';

const APPS = [
  { id: 'windows', icon: Monitor, name: 'Windows Desktop', device: 'Máy tính Windows 11 (64-bit)', file: '…-Windows.zip' },
  { id: 'android', icon: Smartphone, name: 'Android Mobile', device: 'Điện thoại, máy tính bảng Android 7.0 trở lên', file: '…-Android.zip' },
];

const BENEFITS = [
  { icon: Camera, title: 'Tiện lợi hơn', text: 'Quét FaceID chỉ cần nhìn thẳng vào camera, không phải quay mặt hay nhắm mắt theo hướng dẫn.' },
  { icon: KeyRound, title: 'An toàn hơn', text: 'Mỗi thiết bị có khóa riêng; thiết bị mới phải xác nhận một lần bằng mã gửi tới Email của bạn và có thể thu hồi trong Hồ sơ cá nhân.' },
];

export default function AppRecommendScreen({ onContinue, orgInfo }) {
  const platform = devicePlatform();
  const supported = APPS.some(app => app.id === platform);
  const apps = [...APPS].sort((a, b) => (b.id === platform) - (a.id === platform));
  return (
    <div
      className="w-screen h-app overflow-y-auto bg-[#090d16] flex justify-center p-4 text-slate-200 antialiased bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "linear-gradient(rgba(4,8,16,.72), rgba(4,8,16,.72)), url('/background.jpg')" }}
    >
      <main aria-labelledby="web-notice-title" className="w-full min-w-0 max-w-xl my-auto bg-slate-900/85 border border-slate-700/40 backdrop-blur-md rounded-2xl p-5 sm:p-7 shadow-2xl animate-fade-in">
        <div className="text-center">
          <img src="/logo.png" alt="iThunder Logo" className="w-36 h-16 object-contain mx-auto" />
          <h1 id="web-notice-title" className="mt-2 text-xl sm:text-2xl font-extrabold tracking-tight text-white">Nên dùng ứng dụng AI Workspace</h1>
          <div className="mt-1"><GatewayOrgLine org={orgInfo} /></div>
        </div>

        <div role="note" className="mt-4 p-3.5 bg-amber-950/40 border border-amber-500/60 text-amber-100 text-sm rounded-xl flex items-start gap-2.5 leading-relaxed">
          <ShieldAlert size={18} className="shrink-0 mt-0.5 text-amber-400" />
          <p>Bạn đang mở <b>phiên bản Web</b>. Khi cần quét FaceID, bản Web bắt buộc kiểm tra người thật (Liveness): quay mặt, nhắm mắt theo hướng dẫn trước camera, nên mất nhiều bước hơn ứng dụng.</p>
        </div>

        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {BENEFITS.map(({ icon, title, text }) => {
            const Icon = icon;
            return (
              <li key={title} className="flex items-start gap-2.5 text-sm leading-relaxed">
                <Icon size={18} className="shrink-0 mt-0.5 text-cyan-400" />
                <div><b className="text-white">{title}</b><p className="text-slate-300">{text}</p></div>
              </li>
            );
          })}
        </ul>

        {!supported && (
          <p className="mt-4 text-sm text-slate-300 leading-relaxed">
            {platform === 'ios' ? 'Chưa có ứng dụng cho iPhone, iPad' : 'Chưa có ứng dụng cho hệ điều hành của thiết bị này'}: hãy tiếp tục bằng Web App, hoặc cài ứng dụng trên máy Windows 11 hay thiết bị Android khác của bạn.
          </p>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {apps.map(({ id, icon, name, device, file }) => {
            const Icon = icon;
            const suggested = id === platform;
            return (
              <a key={id} href={RELEASE_URL} target="_blank" rel="noopener noreferrer"
                className={`flex flex-col gap-1 rounded-xl border p-4 transition-all ${suggested ? 'bg-blue-600 hover:bg-blue-500 border-blue-400 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-800/70 hover:bg-slate-700/80 border-slate-600/60 text-slate-100'}`}>
                <span className="flex items-center gap-2 text-sm font-extrabold">
                  <Icon size={18} className="shrink-0" /> <span className="min-w-0 flex-1">{name}</span> <Download size={16} className="shrink-0" />
                </span>
                {suggested && <span className="text-xs font-bold">Phù hợp với thiết bị này</span>}
                <span className={`text-xs ${suggested ? 'text-blue-50' : 'text-slate-300'}`}>{device}</span>
                <span className={`text-xs ${suggested ? 'text-blue-50' : 'text-slate-300'}`}>Trên trang GitHub, chọn tệp <b className="whitespace-nowrap">{file}</b></span>
              </a>
            );
          })}
        </div>

        <p className="mt-3 text-xs text-slate-400 leading-relaxed">
          Bản dùng thử: Windows hoặc Android có thể hiện cảnh báo khi cài đặt. Chỉ tải từ trang GitHub chính thức trên và làm theo tệp HUONG_DAN_CAI_DAT.txt trong gói.{' '}
          <a href={GUIDE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-cyan-400 hover:text-cyan-300 underline">
            Xem hướng dẫn <ExternalLink size={12} />
          </a>
        </p>

        <button type="button" onClick={onContinue}
          className="mt-5 w-full bg-slate-800 hover:bg-slate-700 border border-slate-600/60 text-slate-100 font-bold text-sm rounded-xl py-3 transition-all">
          Tiếp tục bằng Web App
        </button>
      </main>
    </div>
  );
}
