/**
 * iThunder AI OS - Kết nối Trao đổi trực tuyến dùng chung toàn AI Workspace
 *
 * Một kết nối /ws/comm cho mọi trang (Workspace, Kho Tri thức, Trao đổi trực tuyến...) khi đã đăng nhập và vai trò được
 * dùng Trao đổi trực tuyến: cuộc gọi đến đổ chuông ở bất kỳ trang nào; trang /comm đăng ký nhận cùng các khung đó.
 * Đăng nhập / đăng xuất được báo qua sự kiện "tara:auth" (services/api.js notifyAuthChanged) và "storage" (tab khác).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { commAPI } from '../services/api';
import { CommSocket } from '../services/commSocket';
import { CommContext } from './commContext';
import useCallEngine from './useCallEngine';
import CallOverlay from './CallOverlay';

const readToken = () => {
  try {
    const token = localStorage.getItem('tara_token');
    return token && token !== 'None' ? token : '';
  } catch { return ''; }
};

export default function CommProvider({ children }) {
  const [token, setToken] = useState(readToken);
  const [info, setInfo] = useState(null);
  const [infoError, setInfoError] = useState('');
  const [status, setStatus] = useState('connecting');
  const socketRef = useRef(null);
  const listeners = useRef(new Set());

  useEffect(() => {
    const sync = () => setToken(readToken());
    window.addEventListener('tara:auth', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('tara:auth', sync); window.removeEventListener('storage', sync); };
  }, []);

  useEffect(() => {
    setInfo(null);
    setInfoError('');
    setStatus('connecting');
    if (!token) return undefined;
    let socket = null;
    let cancelled = false;
    commAPI.getInfo().then(res => {
      if (cancelled) return;
      if (res?.status !== 'SUCCESS') { setInfoError(res?.detail || 'Không tải được thông tin Trao đổi trực tuyến.'); return; }
      setInfo(res);
      if (!res.allowed) return;
      socket = new CommSocket({ onEvent: (frame) => listeners.current.forEach(fn => fn(frame)), onStatus: setStatus });
      socketRef.current = socket;
      socket.connect();
    });
    return () => { cancelled = true; socket?.close(); socketRef.current = null; };
  }, [token]);

  const subscribe = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);
  const send = useCallback((frame) => socketRef.current?.send(frame) || false, []);
  const request = useCallback((frame) => socketRef.current?.request(frame) || null, []);

  const { call, actions } = useCallEngine({ enabled: !!(token && info?.allowed), send, request, subscribe });

  const value = useMemo(() => ({ info, infoError, status, subscribe, send, request, call, calls: actions }),
    [info, infoError, status, subscribe, send, request, call, actions]);

  return (
    <CommContext.Provider value={value}>
      {children}
      <CallOverlay call={call} actions={actions} />
    </CommContext.Provider>
  );
}
