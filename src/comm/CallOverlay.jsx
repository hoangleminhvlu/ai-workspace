/**
 * iThunder AI OS - Giao diện cuộc gọi thoại / video 1-1 (hiện trên mọi trang của AI Workspace)
 * Cuộc gọi đến: thẻ đổ chuông (Từ chối / Nghe / Nghe bằng video). Đang gọi: khung video thu gọn ở góc màn hình
 * (điện thoại: toàn màn hình), phóng to được; micro, camera, chia sẻ màn hình, gác máy.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, Mic, MicOff, Minimize2, Phone, PhoneOff, ScreenShare, ScreenShareOff, Video, VideoOff } from 'lucide-react';
import { Avatar } from '../pages/comm/shared';
import { UNSUPPORTED_TEXT, callsSupported, formatDuration } from './useCallEngine';

const MediaView = ({ stream, muted = false, mirror = false, className = '' }) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el && el.srcObject !== stream) el.srcObject = stream || null;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={`${mirror ? '-scale-x-100' : ''} ${className}`} />;
};

const Elapsed = ({ since }) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <span className="font-mono">{formatDuration((now - since) / 1000)}</span>;
};

const RoundButton = ({ onClick, label, active = true, danger = false, children, disabled = false }) => (
  <button type="button" onClick={onClick} aria-label={label} title={label} disabled={disabled}
    className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 ${danger ? 'bg-red-600 hover:bg-red-500 text-white'
      : active ? 'bg-white/15 hover:bg-white/25 text-white' : 'bg-white text-slate-900 hover:bg-slate-200'}`}>
    {children}
  </button>
);

function IncomingCall({ call, actions }) {
  const supported = callsSupported();
  const video = call.media === 'video';
  return (
    <div role="alertdialog" aria-label={`Cuộc gọi đến từ ${call.peerName}`}
      className="fixed z-[100] top-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-80 rounded-2xl bg-slate-900 text-white shadow-2xl border border-white/10 p-4">
      <div className="flex items-center gap-3">
        <span className="rounded-full ring-4 ring-emerald-500/40 animate-pulse"><Avatar name={call.peerName} /></span>
        <div className="min-w-0">
          <div className="text-[11px] text-slate-300">{video ? 'Cuộc gọi video đến' : 'Cuộc gọi thoại đến'}</div>
          <div className="text-sm font-bold truncate">{call.peerName}</div>
        </div>
      </div>
      {!supported && <p className="mt-3 text-[11px] text-amber-300 leading-relaxed">{UNSUPPORTED_TEXT}</p>}
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={actions.reject} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-500 py-2 text-xs font-bold">
          <PhoneOff size={14} /> Từ chối
        </button>
        {supported && (
          <button type="button" onClick={() => actions.accept(false)} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2 text-xs font-bold">
            <Phone size={14} /> Nghe
          </button>
        )}
        {supported && video && (
          <button type="button" onClick={() => actions.accept(true)} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2 text-xs font-bold">
            <Video size={14} /> Video
          </button>
        )}
      </div>
    </div>
  );
}

export default function CallOverlay({ call, actions }) {
  const [expanded, setExpanded] = useState(false);
  if (!call) return null;
  if (call.phase === 'incoming') return <IncomingCall call={call} actions={actions} />;

  const ended = call.phase === 'ended';
  const remoteVideo = !ended && call.remoteStream && (call.remote?.cam || call.remote?.screen);
  const localVideo = !ended && call.previewStream && (call.cam || call.screen);
  const canShare = !ended && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia && !/Android|iPhone|iPad/i.test(navigator.userAgent);
  const status = ended ? call.endText
    : call.phase === 'outgoing' ? (call.id ? 'Đang đổ chuông...' : 'Đang gọi...')
      : call.reconnecting ? 'Mất kết nối, đang thử lại...'
        : call.phase === 'connecting' ? 'Đang kết nối...' : null;

  return (
    <div role="dialog" aria-label={`Cuộc gọi với ${call.peerName}`}
      className={`fixed z-[100] bg-slate-950 text-white shadow-2xl overflow-hidden flex flex-col ${expanded ? 'inset-0'
        : 'inset-0 sm:inset-auto sm:right-4 sm:bottom-4 sm:w-[400px] sm:h-[320px] sm:rounded-2xl sm:border sm:border-white/10'}`}>
      <div className="relative flex-1 min-h-0 bg-black">
        {/* Luôn gắn phần tử video của bên kia (kể cả khi ẩn) để nghe được tiếng */}
        <MediaView stream={ended ? null : call.remoteStream} className={remoteVideo ? 'w-full h-full object-contain' : 'hidden'} />
        {!remoteVideo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
            <span className={`rounded-full ${call.phase === 'outgoing' ? 'ring-4 ring-blue-500/40 animate-pulse' : ''}`}><Avatar name={call.peerName} /></span>
            <span className="text-sm font-bold">{call.peerName}</span>
            {call.phase === 'active' && !call.remote?.mic && <span className="text-[11px] text-slate-400 inline-flex items-center gap-1"><MicOff size={11} /> Đã tắt micro</span>}
          </div>
        )}
        {localVideo && (
          <MediaView stream={call.previewStream} muted mirror={!call.screen}
            className="absolute top-3 right-3 w-28 sm:w-32 aspect-video rounded-lg object-cover border border-white/20 bg-slate-800" />
        )}
        <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
          <div className="text-[11px] text-slate-300">{call.media === 'video' ? 'Cuộc gọi video' : 'Cuộc gọi thoại'} · {call.peerName}</div>
          <div className="text-xs font-semibold" role="status">
            {status || (call.answeredAt ? <Elapsed since={call.answeredAt} /> : null)}
          </div>
          {call.notice && <div className="text-[11px] text-amber-300">{call.notice}</div>}
        </div>
      </div>
      <div className="shrink-0 flex items-center justify-center gap-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-slate-900">
        {!ended && (
          <>
            <RoundButton onClick={actions.toggleMic} label={call.mic ? 'Tắt micro' : 'Bật micro'} active={call.mic} disabled={!call.localStream}>
              {call.mic ? <Mic size={18} /> : <MicOff size={18} />}
            </RoundButton>
            <RoundButton onClick={actions.toggleCam} label={call.cam ? 'Tắt camera' : 'Bật camera'} active={call.cam} disabled={!call.localStream}>
              {call.cam ? <Video size={18} /> : <VideoOff size={18} />}
            </RoundButton>
            {canShare && (
              <RoundButton onClick={actions.toggleScreen} label={call.screen ? 'Dừng chia sẻ màn hình' : 'Chia sẻ màn hình'} active={!call.screen}
                disabled={call.phase !== 'active'}>
                {call.screen ? <ScreenShareOff size={18} /> : <ScreenShare size={18} />}
              </RoundButton>
            )}
            <span className="hidden sm:inline-flex">
              <RoundButton onClick={() => setExpanded(v => !v)} label={expanded ? 'Thu nhỏ' : 'Phóng to'}>
                {expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </RoundButton>
            </span>
          </>
        )}
        <RoundButton onClick={actions.hangup} label={ended ? 'Đóng' : call.phase === 'outgoing' ? 'Hủy cuộc gọi' : 'Gác máy'} danger>
          <PhoneOff size={18} />
        </RoundButton>
      </div>
    </div>
  );
}
