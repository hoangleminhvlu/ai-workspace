/**
 * iThunder AI OS - Ngữ cảnh Trao đổi trực tuyến dùng chung toàn AI Workspace (CommProvider.jsx cung cấp)
 * { info, infoError, status, subscribe(fn) => hủy, send(frame), request(frame), call, calls: { startCall, accept, ... } }
 */

import { createContext, useContext } from 'react';

export const CommContext = createContext(null);

export const useComm = () => useContext(CommContext);
