// Màn hình xác thực sinh trắc học FaceID sau khi PassCode đúng.
// Tách từ App.jsx: trạng thái và xử lý vẫn nằm ở App, thành phần này chỉ hiển thị và gọi lại qua props.
// Kiểm tra người thật (liveness): AI Platform phát thử thách ngẫu nhiên và tự kiểm tra trên khung hình; màn hình chỉ hiển thị
// hướng dẫn. Ảnh xem trước được lật gương nên "quay sang trái của bạn" cũng là sang trái trên màn hình.
import {
  ArrowLeft, ArrowRight, Camera, CircleX, Eye, ScanFace, ShieldCheck
} from 'lucide-react';
import { GatewayOrgLine } from './GatewayWidgets';

const CHALLENGE_ICON = { TURN_LEFT: ArrowLeft, TURN_RIGHT: ArrowRight, BLINK: Eye, FINAL: ScanFace };

function LivenessPrompt({ liveness }) {
  if (!liveness) {
    return (
      <div className="mb-3 flex items-center justify-center gap-2 rounded-xl border border-slate-700/40 bg-slate-950/40 px-3 py-2 text-xs text-slate-300">
        <ScanFace size={16} className="shrink-0 text-cyan-400" /> Nhìn thẳng vào camera, giữ khuôn mặt trong khung tròn.
      </div>
    );
  }
  const Icon = CHALLENGE_ICON[liveness.challenge] || ScanFace;
  const done = liveness.challenge === 'FINAL' ? liveness.steps : Math.max((liveness.step || 1) - 1, 0);
  return (
    <div className="mb-3 rounded-xl border border-cyan-700/40 bg-cyan-950/30 px-3 py-2.5" aria-live="polite">
      <div className="flex items-center justify-center gap-2 text-sm font-semibold text-cyan-200">
        <Icon size={18} className="shrink-0 text-cyan-400" /> <span>{liveness.message}</span>
      </div>
      {liveness.steps > 0 && (
        <div className="mt-2 flex items-center justify-center gap-1.5" aria-label={`Đã xong ${done}/${liveness.steps} bước kiểm tra người thật`}>
          {Array.from({ length: liveness.steps }, (_, i) => (
            <span key={i} className={`h-1.5 w-6 rounded-full ${i < done ? 'bg-cyan-400' : 'bg-slate-700'}`} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FaceIdScreen({ canvasRef, errorMessage, faceHint, faceScanStopped, isFaceProcessing, liveness, orgInfo, retryFaceScan, setErrorMessage, setFaceScanStopped, setViewState, statusMessage, stopWebcamHardware, videoRef }) {
  return (
    <div className="w-screen h-app overflow-y-auto bg-[#090d16] flex justify-center p-4 text-slate-200 select-none">
      <div className="w-full min-w-0 max-w-sm my-auto bg-slate-900/60 border border-slate-700/30 rounded-2xl p-5 sm:p-6 text-center shadow-2xl">
        <h3 className="text-base font-bold text-white flex items-center justify-center gap-2 mb-2"><Camera size={18} className="text-cyan-400" /> Kích hoạt Trắc sinh học FaceID</h3>
        <div className="-mt-1 mb-2"><GatewayOrgLine org={orgInfo} /></div>
        <p className="text-xs text-slate-400 mb-4 px-2">{statusMessage}</p>
        {isFaceProcessing && <LivenessPrompt liveness={liveness} />}

        <div className="relative w-64 h-64 rounded-full overflow-hidden border border-slate-700 bg-slate-950 mx-auto shadow-2xl mb-4">
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
          <div className="absolute inset-0 pointer-events-none border-[16px] border-[#090d16] rounded-full">
            <div className="w-full h-full border border-dashed border-cyan-500/40 rounded-full" />
          </div>
          {isFaceProcessing && <div className="absolute inset-x-0 h-0.5 bg-cyan-400 opacity-70 shadow-[0_0_8px_#22d3ee] animate-pulse" />}
        </div>
        <canvas ref={canvasRef} className="hidden" />
        {isFaceProcessing && faceHint && <p className="text-xs text-amber-300/90 px-2">{faceHint}</p>}
        <p className="mt-3 flex items-center justify-center gap-1 text-[11px] text-slate-500">
          <ShieldCheck size={12} /> Có kiểm tra người thật: ảnh chụp không dùng để đăng nhập được.
        </p>

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
