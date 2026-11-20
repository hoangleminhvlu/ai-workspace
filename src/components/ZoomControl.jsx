// Nút phóng to / thu nhỏ AI Workspace trong ứng dụng Windows (không hiện trên bản Web, Android: dùng chức năng của trình
// duyệt / hệ điều hành). Bấm vào phần trăm để về 100%.
import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { ZOOM_LEVELS, getZoom, setZoom, stepZoom, subscribeZoom, zoomSupported } from '../services/appZoom';

export default function ZoomControl({ className = '' }) {
  const [level, setLevel] = useState(getZoom);
  useEffect(() => subscribeZoom(setLevel), []);
  if (!zoomSupported()) return null;
  const btn = 'p-1 rounded-md text-fg-muted hover:text-fg-strong hover:bg-hover disabled:opacity-40 disabled:hover:bg-transparent';
  return (
    <div className={`flex items-center justify-between gap-1 text-[11px] text-fg-muted ${className}`}
      title="Phóng to / thu nhỏ AI Workspace (Ctrl + / Ctrl - / Ctrl 0, hoặc Ctrl + lăn chuột)">
      <span>Cỡ hiển thị</span>
      <div className="flex items-center gap-0.5 border border-line rounded-lg bg-elevated px-0.5">
        <button type="button" className={btn} onClick={() => stepZoom(-1)} disabled={level <= ZOOM_LEVELS[0]} aria-label="Thu nhỏ">
          <Minus size={12} />
        </button>
        <button type="button" onClick={() => setZoom(1)} aria-label="Về cỡ 100%"
          className="min-w-[3rem] px-1 py-0.5 rounded-md font-mono font-semibold text-fg hover:bg-hover">
          {Math.round(level * 100)}%
        </button>
        <button type="button" className={btn} onClick={() => stepZoom(1)} disabled={level >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]} aria-label="Phóng to">
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}
