// Khóa thiết bị của ứng dụng Desktop / Mobile (AI Platform: identity/devices.py).
// Cặp khóa ECDSA P-256 do WebCrypto sinh, khóa riêng không xuất ra được (extractable: false) và nằm trong IndexedDB của ứng dụng.
// Mỗi AI Gateway một khóa riêng để các Tổ chức không liên kết được cùng một thiết bị. Trên kênh /ws/auth, ứng dụng ký số ngẫu
// nhiên của AI Platform; khóa được đăng ký sau khi khuôn mặt khớp và người dùng nhập mã gửi qua Email (DeviceConfirmForm.jsx). Không có WebCrypto / IndexedDB, hay AI Gateway bản cũ:
// bỏ qua, AI Platform kiểm tra người thật như Web.
import { getGatewayConfig } from '../services/api';

const DB_NAME = 'tara_device', STORE = 'keys';
const PROOF_TIMEOUT_MS = 5000;

const openDb = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => req.result.createObjectStore(STORE);
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

const readKey = (db, id) => new Promise((resolve, reject) => {
  const req = db.transaction(STORE).objectStore(STORE).get(id);
  req.onsuccess = () => resolve(req.result || null);
  req.onerror = () => reject(req.error);
});

// add (không phải put): hai cửa sổ cùng tạo khóa thì giữ khóa đầu tiên
const addKey = (db, id, pair) => new Promise((resolve, reject) => {
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).add(pair, id);
  tx.oncomplete = () => resolve();
  tx.onabort = () => reject(tx.error);
});

async function deviceKeyPair(gateway) {
  const db = await openDb();
  try {
    const saved = await readKey(db, gateway);
    if (saved) return saved;
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
    try { await addKey(db, gateway, pair); } catch { /* cửa sổ khác vừa tạo */ }
    return (await readKey(db, gateway)) || null;     // chỉ dùng khóa đã lưu được: khóa tạm sẽ thành thiết bị mới mỗi lần mở
  } finally { db.close(); }
}

const toBase64 = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)));

// Tên gợi nhớ trong danh sách thiết bị, vd. "Windows", "Android 14, Pixel 7"
export const deviceName = (ua = navigator.userAgent) => {
  const android = /Android ([\d.]+)(?:; ([^;)]+))?/.exec(ua);
  if (android) return `Android ${android[1]}${android[2] ? `, ${android[2].replace(/ Build\/.*$/, '').trim()}` : ''}`;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac OS X/.test(ua)) return 'macOS';
  return /Linux/.test(ua) ? 'Linux' : '';
};

/**
 * Chứng minh khóa thiết bị trên một kênh WebSocket. onDone gọi đúng một lần, kể cả khi không chứng minh được.
 * handle(res) trả true nếu phản hồi thuộc bước này (không chuyển cho xử lý kết quả quét).
 */
export function createDeviceProof(socket, kind, onDone) {
  let pending = false, timer = null;
  const finish = () => {
    if (!pending) return;
    pending = false;
    clearTimeout(timer);
    onDone();
  };
  const sign = async ({ nonce, org_id: orgId }) => {
    try {
      const pair = await deviceKeyPair(getGatewayConfig().httpUrl);
      if (!pair) { finish(); return; }
      const message = new TextEncoder().encode(`iThunder-FaceID-Device:v1:${orgId}:${nonce}`);
      const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, message);
      const publicKey = await crypto.subtle.exportKey('spki', pair.publicKey);
      if (!pending || socket.readyState !== WebSocket.OPEN) { finish(); return; }
      socket.send(JSON.stringify({ action: 'device_auth', client: kind, name: deviceName(), public_key: toBase64(publicKey), signature: toBase64(signature) }));
    } catch (err) {
      console.warn('[Device Key] Không dùng được khóa thiết bị:', err);
      finish();
    }
  };
  return {
    start() {
      pending = true;
      if (kind === 'web' || !globalThis.crypto?.subtle || !globalThis.indexedDB) { finish(); return; }
      timer = setTimeout(finish, PROOF_TIMEOUT_MS);
      socket.send(JSON.stringify({ action: 'device_challenge' }));
    },
    handle(res) {
      if (res.status === 'DEVICE_CHALLENGE') { if (pending) sign(res); return true; }
      if (res.status === 'DEVICE_OK' || res.status === 'DEVICE_REJECTED') { finish(); return true; }
      if (!pending) return false;
      finish();          // AI Gateway bản cũ trả FAIL "không hỗ trợ thao tác": quét như trước
      return true;
    },
  };
}
