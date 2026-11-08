/**
 * iThunder AI OS - Gọi thoại / video 1-1 bằng WebRTC P2P (Backend: comm_gateway/calls.py)
 *
 * AI Gateway chỉ chuyển tín hiệu qua /ws/comm: call_invite → call_ringing (người nhận) → call_accept → call_update
 * (active) → người gọi gửi offer, người nhận trả answer, hai bên trao đổi ICE candidate (call_signal). Âm thanh/hình ảnh đi
 * thẳng giữa hai máy (hoặc qua TURN coturn); máy chủ không ghi nội dung tín hiệu.
 *
 * Mỗi bên luôn có sẵn một transceiver audio và một transceiver video (sendrecv) từ đầu: bật/tắt camera, chia sẻ màn hình
 * chỉ là replaceTrack, không phải thương lượng lại. Tắt camera thì dừng hẳn track (đèn camera tắt).
 * Kết nối /ws/comm rớt: khi kết nối lại (khung "ready") gửi call_rejoin để Backend gắn cuộc gọi vào kết nối mới.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import useLatestCallback from '../hooks/useLatestCallback';
import { startTone, stopTone } from './ringtone';

const END_DISPLAY_MS = 3500;
const TERMINAL = ['ended', 'missed', 'rejected', 'cancelled', 'busy'];
const KINDS = ['audio', 'video'];

export const callsSupported = () => typeof window !== 'undefined' && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia
  && typeof window.RTCPeerConnection === 'function';
export const UNSUPPORTED_TEXT = 'Trình duyệt chỉ cho dùng micro/camera trên https hoặc localhost (hoặc ứng dụng Desktop/Mobile).';

export const formatDuration = (seconds) => {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

const endText = (c, role) => {
  if (c.end_reason === 'disconnected') return 'Cuộc gọi kết thúc do mất kết nối';
  if (c.end_reason === 'max_duration') return 'Cuộc gọi đã đạt thời lượng tối đa';
  switch (c.status) {
    case 'ended': return `Cuộc gọi đã kết thúc · ${formatDuration(c.duration)}`;
    case 'missed': return role === 'caller' ? 'Không có người trả lời' : 'Cuộc gọi nhỡ';
    case 'rejected': return role === 'caller' ? 'Người nhận đã từ chối cuộc gọi' : 'Đã từ chối cuộc gọi';
    case 'busy': return 'Người nhận đang trong cuộc gọi khác';
    default: return role === 'caller' ? 'Đã hủy cuộc gọi' : 'Người gọi đã hủy cuộc gọi';
  }
};

async function openMedia(video) {
  const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  const camera = { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' };
  try {
    return { stream: await navigator.mediaDevices.getUserMedia({ audio, video: video ? camera : false }), camera: video };
  } catch (error) {
    if (video && error?.name !== 'NotAllowedError') {
      try { return { stream: await navigator.mediaDevices.getUserMedia({ audio }), camera: false }; } catch { /* báo lỗi bên dưới */ }
    }
    throw new Error(error?.name === 'NotAllowedError' ? 'Bạn chưa cấp quyền dùng micro/camera cho AI Workspace.'
      : 'Không mở được micro/camera trên máy này (thiết bị đang bận hoặc không có).');
  }
}

export default function useCallEngine({ enabled, send, request, subscribe }) {
  const [call, setCall] = useState(null);
  const callRef = useRef(null);
  const pcRef = useRef(null);
  const localRef = useRef(null);        // MediaStream micro + camera
  const screenRef = useRef(null);       // MediaStreamTrack màn hình đang chia sẻ
  const iceRef = useRef([]);
  const queueRef = useRef([]);          // ICE candidate đến trước khi có remoteDescription
  const endTimer = useRef(null);

  const put = (next) => { callRef.current = next; setCall(next); };
  const patch = (changes) => { if (callRef.current) put({ ...callRef.current, ...changes }); };
  const signal = (data) => { const cur = callRef.current; if (cur?.id) send({ type: 'call_signal', call_id: cur.id, data }); };
  const videoSender = () => pcRef.current?.getTransceivers().find(t => t.receiver.track?.kind === 'video')?.sender;
  const preview = () => (screenRef.current ? new MediaStream([screenRef.current]) : localRef.current);

  const sendState = () => {
    const cur = callRef.current;
    if (cur) signal({ kind: 'state', mic: cur.mic, cam: cur.cam, screen: cur.screen });
  };

  const releaseMedia = () => {
    stopTone();
    if (pcRef.current) { pcRef.current.onconnectionstatechange = null; pcRef.current.close(); }
    pcRef.current = null;
    localRef.current?.getTracks().forEach(t => t.stop());
    localRef.current = null;
    screenRef.current?.stop();
    screenRef.current = null;
    queueRef.current = [];
  };

  // Kết thúc ở máy này: text = null => đóng ngay (vd. đã nhận trên thiết bị khác), có text => hiện vài giây
  const finish = (text) => {
    if (!callRef.current || callRef.current.phase === 'ended') return;
    releaseMedia();
    clearTimeout(endTimer.current);
    if (!text) { put(null); return; }
    put({ ...callRef.current, phase: 'ended', endText: text, localStream: null, remoteStream: null, previewStream: null });
    endTimer.current = setTimeout(() => { if (callRef.current?.phase === 'ended') put(null); }, END_DISPLAY_MS);
  };

  const attachLocal = async (pc) => {
    for (const kind of KINDS) {
      let tr = pc.getTransceivers().find(t => t.receiver.track?.kind === kind);
      if (!tr) tr = pc.addTransceiver(kind, { direction: 'sendrecv' });
      tr.direction = 'sendrecv';
      const track = kind === 'video' ? (screenRef.current || localRef.current?.getVideoTracks()[0]) : localRef.current?.getAudioTracks()[0];
      await tr.sender.replaceTrack(track || null);
    }
  };

  const flushCandidates = async (pc) => {
    for (const c of queueRef.current.splice(0)) {
      try { await pc.addIceCandidate(c); } catch { /* candidate cũ sau khi khởi động lại ICE */ }
    }
  };

  const restartIce = async () => {
    const pc = pcRef.current;
    if (!pc || callRef.current?.role !== 'caller') return;
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      signal({ kind: 'offer', sdp: pc.localDescription.toJSON() });
    } catch (e) { console.warn('[iThunder Call] Không khởi động lại được ICE:', e); }
  };

  const createPeer = (iceServers) => {
    const pc = new RTCPeerConnection({ iceServers: iceServers || [] });
    pcRef.current = pc;
    pc.onicecandidate = (e) => { if (e.candidate) signal({ kind: 'candidate', candidate: e.candidate.toJSON() }); };
    pc.ontrack = () => patch({ remoteStream: new MediaStream(pc.getReceivers().map(r => r.track).filter(Boolean)) });
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        patch({ phase: 'active', reconnecting: false, answeredAt: callRef.current?.answeredAt || Date.now() });
        sendState();
      } else if (state === 'disconnected') {
        patch({ reconnecting: true });
      } else if (state === 'failed') {
        patch({ reconnecting: true });
        restartIce();
      }
    };
    return pc;
  };

  const onSignal = async (data) => {
    const pc = pcRef.current;
    if (!pc || !data) return;
    try {
      if (data.kind === 'offer') {
        await pc.setRemoteDescription(data.sdp);
        await attachLocal(pc);
        await flushCandidates(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        signal({ kind: 'answer', sdp: pc.localDescription.toJSON() });
      } else if (data.kind === 'answer') {
        await pc.setRemoteDescription(data.sdp);
        await flushCandidates(pc);
      } else if (data.kind === 'candidate') {
        if (pc.remoteDescription) await pc.addIceCandidate(data.candidate);
        else queueRef.current.push(data.candidate);
      } else if (data.kind === 'state') {
        patch({ remote: { mic: data.mic !== false, cam: !!data.cam, screen: !!data.screen } });
      }
    } catch (e) {
      console.warn('[iThunder Call] Lỗi xử lý tín hiệu WebRTC:', e);
    }
  };

  // Người gọi: bên kia đã nhận => tạo kết nối và gửi offer
  const beginOffer = async () => {
    stopTone();
    patch({ phase: 'connecting' });
    const pc = createPeer(iceRef.current);
    try {
      await attachLocal(pc);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      signal({ kind: 'offer', sdp: pc.localDescription.toJSON() });
    } catch (e) {
      console.warn('[iThunder Call] Không tạo được offer:', e);
      hangup();
    }
  };

  // ------------------------------------------------------------------ sự kiện từ /ws/comm
  const onEvent = useLatestCallback((f) => {
    const cur = callRef.current;
    if (f.type === 'call_ringing') {
      if (cur && cur.phase !== 'ended') return;   // máy chủ đã chặn khi bận; tab này đang gọi thì bỏ qua
      clearTimeout(endTimer.current);
      const c = f.call;
      put({ id: c.id, role: 'callee', phase: 'incoming', media: c.media, conversationId: c.conversation_id, peerId: c.caller_id,
        peerName: c.caller_name, iceServers: f.ice_servers, mic: true, cam: false, screen: false,
        remote: { mic: true, cam: c.media === 'video', screen: false } });
      startTone('ring');
    } else if (f.type === 'call_update') {
      const c = f.call;
      if (!cur || cur.id !== c.id || cur.phase === 'ended') return;
      if (c.status === 'active') {
        if (cur.role === 'caller' && cur.phase === 'outgoing') beginOffer();
        else if (cur.role === 'callee' && cur.phase === 'incoming' && !cur.accepting) finish(null);   // nhận ở thiết bị khác
      } else if (TERMINAL.includes(c.status)) {
        finish(endText(c, cur.role));
      }
    } else if (f.type === 'call_signal') {
      if (cur && f.call_id === cur.id) onSignal(f.data);
    } else if (f.type === 'ready') {
      // /ws/comm vừa kết nối lại: gắn cuộc gọi đang diễn ra vào kết nối mới
      if (cur?.id && ['outgoing', 'connecting', 'active'].includes(cur.phase)) {
        Promise.resolve(request({ type: 'call_rejoin', call_id: cur.id })).then(res => {
          if (res && res.type !== 'ack' && callRef.current?.id === cur.id) finish(res.detail || 'Cuộc gọi đã kết thúc khi mất kết nối');
        });
      }
    }
  });
  useEffect(() => subscribe(onEvent), [subscribe, onEvent]);

  // ------------------------------------------------------------------ thao tác của người dùng
  const startCall = useLatestCallback(async ({ conversationId, peerId, peerName }, media) => {
    if (callRef.current && callRef.current.phase !== 'ended') return 'Bạn đang trong một cuộc gọi khác.';
    if (!callsSupported()) return UNSUPPORTED_TEXT;
    clearTimeout(endTimer.current);
    put({ id: null, role: 'caller', phase: 'outgoing', media, conversationId, peerId, peerName, mic: true, cam: false, screen: false,
      remote: { mic: true, cam: media === 'video', screen: false } });
    let opened;
    try { opened = await openMedia(media === 'video'); } catch (e) { finish(e.message); return null; }
    if (callRef.current?.phase !== 'outgoing') { opened.stream.getTracks().forEach(t => t.stop()); return null; }   // đã hủy khi chờ quyền
    localRef.current = opened.stream;
    patch({ cam: opened.camera, localStream: opened.stream, previewStream: opened.stream });
    startTone('ringback');
    const res = await request({ type: 'call_invite', conversation_id: conversationId, media });
    if (!res) { finish('Chưa kết nối được máy chủ Trao đổi trực tuyến. Hãy thử lại.'); return null; }
    if (res.type !== 'ack') { finish(res.detail || 'Không gọi được.'); return null; }
    if (callRef.current?.phase !== 'outgoing') { request({ type: 'call_end', call_id: res.call.id }); return null; }   // hủy trước khi có mã
    iceRef.current = res.ice_servers || [];
    patch({ id: res.call.id });
    return null;
  });

  const accept = useLatestCallback(async (withVideo) => {
    const cur = callRef.current;
    if (!cur || cur.phase !== 'incoming') return;
    if (!callsSupported()) { finish(UNSUPPORTED_TEXT); request({ type: 'call_end', call_id: cur.id }); return; }
    stopTone();
    patch({ accepting: true });
    let opened;
    try { opened = await openMedia(cur.media === 'video' && withVideo); } catch (e) {
      request({ type: 'call_end', call_id: cur.id });
      finish(e.message);
      return;
    }
    if (callRef.current?.id !== cur.id || callRef.current.phase !== 'incoming') { opened.stream.getTracks().forEach(t => t.stop()); return; }
    localRef.current = opened.stream;
    createPeer(cur.iceServers);   // tạo trước khi nhận: offer có thể đến ngay sau call_accept
    patch({ phase: 'connecting', cam: opened.camera, localStream: opened.stream, previewStream: opened.stream });
    const res = await request({ type: 'call_accept', call_id: cur.id });
    if (!res || res.type !== 'ack') finish(res?.detail || 'Không nhận được cuộc gọi.');
  });

  const reject = useLatestCallback(() => {
    const cur = callRef.current;
    if (!cur || cur.phase !== 'incoming') return;
    request({ type: 'call_end', call_id: cur.id });
    finish(null);
  });

  const hangup = useLatestCallback(async () => {
    const cur = callRef.current;
    if (!cur || cur.phase === 'ended') { put(null); return; }
    if (!cur.id) { finish('Đã hủy cuộc gọi'); return; }
    releaseMedia();   // dừng micro/camera ngay, không chờ máy chủ
    const res = await request({ type: 'call_end', call_id: cur.id });
    finish(res?.type === 'ack' && res.call ? endText(res.call, cur.role) : 'Cuộc gọi đã kết thúc');
  });

  const toggleMic = useLatestCallback(() => {
    const track = localRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    patch({ mic: track.enabled });
    sendState();
  });

  const toggleCam = useLatestCallback(async () => {
    const cur = callRef.current;
    if (!cur || !localRef.current) return;
    if (cur.cam) {
      const track = localRef.current.getVideoTracks()[0];
      if (track) { track.stop(); localRef.current.removeTrack(track); }
      if (!screenRef.current) await videoSender()?.replaceTrack(null);
      patch({ cam: false, previewStream: preview() });
    } else {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } });
        const track = s.getVideoTracks()[0];
        localRef.current.addTrack(track);
        if (!screenRef.current) await videoSender()?.replaceTrack(track);
        patch({ cam: true, previewStream: preview() });
      } catch {
        patch({ notice: 'Không mở được camera.' });
        return;
      }
    }
    sendState();
  });

  const stopScreen = useLatestCallback(async () => {
    if (!screenRef.current) return;
    screenRef.current.onended = null;
    screenRef.current.stop();
    screenRef.current = null;
    await videoSender()?.replaceTrack(localRef.current?.getVideoTracks()[0] || null);
    patch({ screen: false, previewStream: preview() });
    sendState();
  });

  const toggleScreen = useLatestCallback(async () => {
    if (screenRef.current) { stopScreen(); return; }
    if (!navigator.mediaDevices?.getDisplayMedia) return;
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = s.getVideoTracks()[0];
      track.onended = () => stopScreen();    // người dùng bấm "Dừng chia sẻ" của trình duyệt
      screenRef.current = track;
      await videoSender()?.replaceTrack(track);
      patch({ screen: true, previewStream: preview() });
      sendState();
    } catch { /* người dùng hủy chọn màn hình */ }
  });

  // Đăng xuất / mất quyền Trao đổi trực tuyến: kết thúc cuộc gọi đang có
  useEffect(() => {
    if (enabled || !callRef.current) return;
    if (callRef.current.id) send({ type: 'call_end', call_id: callRef.current.id });
    releaseMedia();
    put(null);
  });

  // Đóng / tải lại trang khi đang gọi: báo ngay cho bên kia (không chờ hết thời gian kết nối lại)
  useEffect(() => {
    const leave = () => {
      const cur = callRef.current;
      if (cur?.id && cur.phase !== 'ended') send({ type: 'call_end', call_id: cur.id });
    };
    window.addEventListener('pagehide', leave);
    return () => window.removeEventListener('pagehide', leave);
  }, [send]);

  // Thẻ trình duyệt nhấp nháy khi có cuộc gọi đến
  const ringing = call?.phase === 'incoming';
  useEffect(() => {
    if (!ringing) return undefined;
    const original = document.title;
    let on = false;
    const timer = setInterval(() => { on = !on; document.title = on ? '📞 Cuộc gọi đến...' : original; }, 1000);
    return () => { clearInterval(timer); document.title = original; };
  }, [ringing]);

  useEffect(() => () => { clearTimeout(endTimer.current); stopTone(); }, []);

  const actions = useMemo(() => ({ startCall, accept, reject, hangup, toggleMic, toggleCam, toggleScreen }),
    [startCall, accept, reject, hangup, toggleMic, toggleCam, toggleScreen]);
  return { call, actions };
}
