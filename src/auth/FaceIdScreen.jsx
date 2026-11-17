// Màn hình xác thực sinh trắc học FaceID sau khi PassCode đúng.
// Tách từ App.jsx: trạng thái và xử lý vẫn nằm ở App, thành phần này chỉ hiển thị và gọi lại qua props.
import {
  Camera, CircleX
} from 'lucide-react';
import { GatewayOrgLine } from './GatewayWidgets';

export default function FaceIdScreen({ canvasRef, errorMessage, faceScanStopped, isFaceProcessing, orgInfo, retryFaceScan, setErrorMessage, setFaceScanStopped, setViewState, statusMessage, stopWebcamHardware, videoRef }) {
  return (
    <div className="w-screen h-app overflow-y-auto bg-[#090d16] flex justify-center p-4 text-slate-200 select-none">
      <div className="w-full min-w-0 max-w-sm my-auto bg-slate-900/60 border border-slate-700/30 rounded-2xl p-5 sm:p-6 text-center shadow-2xl">
        <h3 className="text-base font-bold text-white flex items-center justify-center gap-2 mb-2"><Camera size={18} className="text-cyan-400" /> Kích hoạt Trắc sinh học FaceID</h3>
        <div className="-mt-1 mb-2"><GatewayOrgLine org={orgInfo} /></div>
        <p className="text-xs text-slate-400 mb-4 px-2">{statusMessage}</p>

        <div className="relative w-64 h-64 rounded-full overflow-hidden border border-slate-700 bg-slate-950 mx-auto shadow-2xl mb-4">
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
          <div className="absolute inset-0 pointer-events-none border-[16px] border-[#090d16] rounded-full">
            <div className="w-full h-full border border-dashed border-cyan-500/40 rounded-full" />
          </div>
          {isFaceProcessing && <div className="absolute inset-x-0 h-0.5 bg-cyan-400 opacity-70 shadow-[0_0_8px_#22d3ee] animate-pulse" />}
        </div>
        <canvas ref={canvasRef} className="hidden" />

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
