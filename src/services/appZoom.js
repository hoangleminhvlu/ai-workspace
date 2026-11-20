/**
 * Phóng to / thu nhỏ toàn bộ AI Workspace trong ứng dụng Windows (Tauri 2: Webview.setZoom). Bản Web dùng chức năng
 * phóng to của trình duyệt nên không cần. Mức phóng to ghi nhớ trên máy (localStorage) và áp dụng lại khi mở ứng dụng.
 * Phím tắt: Ctrl + / Ctrl - / Ctrl 0 (về 100%), Ctrl + lăn chuột.
 */
export const ZOOM_LEVELS = [0.8, 0.9, 1, 1.1, 1.2, 1.25, 1.5, 1.75, 2];
const ZOOM_KEY = 'tara_zoom';
const listeners = new Set();
let current = 1;

export const zoomSupported = () => typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);

const readSaved = () => {
  try {
    const value = parseFloat(localStorage.getItem(ZOOM_KEY));
    return ZOOM_LEVELS.includes(value) ? value : 1;
  } catch { return 1; }
};

async function apply(level) {
  if (!zoomSupported()) return;
  try {
    const { getCurrentWebview } = await import('@tauri-apps/api/webview');
    await getCurrentWebview().setZoom(level);
  } catch (error) {
    console.error('[AI Workspace] Không đặt được mức phóng to:', error);
  }
}

export const getZoom = () => current;

export const setZoom = (level) => {
  if (!ZOOM_LEVELS.includes(level)) return;
  current = level;
  try { localStorage.setItem(ZOOM_KEY, String(level)); } catch { /* chế độ riêng tư: không ghi nhớ được */ }
  apply(level);
  listeners.forEach(fn => fn(level));
};

export const stepZoom = (direction) => {
  const index = ZOOM_LEVELS.indexOf(current);
  const next = ZOOM_LEVELS[Math.min(Math.max(index + direction, 0), ZOOM_LEVELS.length - 1)];
  if (next !== current) setZoom(next);
};

export const subscribeZoom = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

/** Gọi một lần khi khởi động: áp dụng mức đã lưu, gắn phím tắt và Ctrl + lăn chuột. */
export const initZoom = () => {
  if (!zoomSupported()) return;
  current = readSaved();
  if (current !== 1) apply(current);
  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') { e.preventDefault(); stepZoom(1); }
    else if (e.key === '-' || e.code === 'NumpadSubtract') { e.preventDefault(); stepZoom(-1); }
    else if (e.key === '0' || e.code === 'Numpad0') { e.preventDefault(); setZoom(1); }
  });
  window.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    stepZoom(e.deltaY < 0 ? 1 : -1);
  }, { passive: false });
};
