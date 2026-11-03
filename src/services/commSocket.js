/**
 * iThunder AI OS - Kênh thời gian thực Trao đổi trực tuyến (/ws/comm)
 * Xác thực bằng khung đầu tiên { type: "auth", token } (không đặt JWT trên URL), ping 25 giây/lần,
 * tự kết nối lại khi rớt mạng. Không lưu gì ở máy trạm: sau mỗi lần kết nối lại, trang tải lại dữ liệu qua REST.
 */

import { getGatewayConfig, handleUnauthorized } from './api';

const PING_MS = 25000;
const REQUEST_TIMEOUT_MS = 15000;
const MAX_BACKOFF_MS = 30000;

export class CommSocket {
  // onEvent(frame): mọi khung máy chủ gửi xuống; onStatus("connecting" | "online" | "offline")
  constructor({ onEvent, onStatus }) {
    this.onEvent = onEvent;
    this.onStatus = onStatus;
    this.ws = null;
    this.ready = false;
    this.stopped = false;
    this.attempt = 0;
    this.refSeq = 0;
    this.pending = new Map();   // ref -> { resolve, timer }
    this.pingTimer = null;
    this.retryTimer = null;
  }

  connect() {
    this.stopped = false;
    const token = localStorage.getItem("tara_token") || "";
    if (!token) return;
    this.onStatus?.("connecting");
    const ws = new WebSocket(`${getGatewayConfig().wsUrl}/ws/comm`);
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: "auth", token }));
    ws.onmessage = (e) => {
      let frame;
      try { frame = JSON.parse(e.data); } catch { return; }
      if (frame.type === "ready") {
        this.ready = true;
        this.attempt = 0;
        this.onStatus?.("online");
        clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => this.send({ type: "ping" }), PING_MS);
      }
      if (frame.ref !== undefined && this.pending.has(frame.ref)) {
        const { resolve, timer } = this.pending.get(frame.ref);
        clearTimeout(timer);
        this.pending.delete(frame.ref);
        resolve(frame);
      }
      this.onEvent?.(frame);
    };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      this.ready = false;
      clearInterval(this.pingTimer);
      this.failPending("Mất kết nối máy chủ Trao đổi trực tuyến.");
      this.onStatus?.("offline");
      if (e.code === 4401) {          // JWT hết hạn / không hợp lệ
        this.stopped = true;
        handleUnauthorized();
        return;
      }
      if (e.code === 4403) {          // vai trò không được dùng / Origin bị chặn: không thử lại
        this.stopped = true;
        return;
      }
      if (!this.stopped) {
        const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** this.attempt++) + Math.random() * 500;
        this.retryTimer = setTimeout(() => this.connect(), delay);
      }
    };
  }

  close() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    clearInterval(this.pingTimer);
    this.failPending("Đã đóng kết nối.");
    const ws = this.ws;
    this.ws = null;
    this.ready = false;
    if (ws && ws.readyState <= WebSocket.OPEN) ws.close(1000);
  }

  failPending(detail) {
    this.pending.forEach(({ resolve, timer }) => { clearTimeout(timer); resolve({ type: "error", detail }); });
    this.pending.clear();
  }

  send(frame) {
    if (!this.ready || this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(frame));
    return true;
  }

  // Gửi và chờ khung trả lời cùng ref (ack | error); null nếu chưa kết nối
  request(frame) {
    const ref = ++this.refSeq;
    if (!this.send({ ...frame, ref })) return null;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(ref);
        resolve({ type: "error", detail: "Máy chủ không phản hồi, hãy thử lại." });
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(ref, { resolve, timer });
    });
  }
}
