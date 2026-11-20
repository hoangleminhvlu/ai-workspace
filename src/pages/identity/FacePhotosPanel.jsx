/**
 * Ảnh FaceID trong hồ sơ định danh (jpegPhoto trên OpenLDAP): xem mọi ảnh kèm đánh giá chất lượng do AI Platform tính
 * (khuôn mặt, cỡ mặt, độ nét, độ sáng, độ khớp với các ảnh còn lại), chọn và xóa ảnh không đạt. Sau khi xóa, AI Platform
 * tính lại mẫu khuôn mặt từ các ảnh còn lại nên ảnh đã xóa không còn dùng để xác thực FaceID.
 * mode "self": chính người dùng (phải còn ít nhất một ảnh dùng được); mode "admin": Quản trị viên (xóa được hết ảnh).
 * Xóa ảnh cần xác nhận lại PassCode (hộp thoại step-up của trang Quản trị Định danh).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ImageOff, Loader2, RefreshCw, ScanFace, Trash2, TriangleAlert } from 'lucide-react';
import { identityAPI } from '../../services/api';
import { Button, Notice, Section } from './shared';

const QUALITY = {
  good: { label: 'Tốt', cls: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40', Icon: CheckCircle2 },
  low: { label: 'Chất lượng thấp', cls: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40', Icon: TriangleAlert },
  unusable: { label: 'Không dùng được', cls: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40', Icon: ImageOff },
};

function PhotoCard({ photo, selected, onToggle, disabled }) {
  const q = QUALITY[photo.quality] || QUALITY.low;
  const details = [
    photo.faces === 1 ? `Mặt ${photo.face_px} px` : null,
    photo.sharpness ? `Độ nét ${Math.round(photo.sharpness)}` : null,
    photo.brightness ? `Độ sáng ${Math.round(photo.brightness)}` : null,
    photo.consistency !== null && photo.consistency !== undefined ? `Khớp ảnh khác ${Math.round(photo.consistency * 100)}%` : null,
  ].filter(Boolean);
  return (
    <label className={`relative flex flex-col rounded-xl border overflow-hidden cursor-pointer transition-all ${selected ? 'border-red-500 ring-2 ring-red-500/40' : 'border-line hover:border-fg-subtle'} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
      <input type="checkbox" className="absolute top-2 left-2 z-10 h-4 w-4 accent-red-600" checked={selected} disabled={disabled}
        onChange={onToggle} aria-label={`Chọn ảnh ${photo.index + 1} để xóa`} />
      <div className="aspect-square bg-elevated flex items-center justify-center">
        {photo.image ? <img src={photo.image} alt={`Ảnh FaceID ${photo.index + 1}`} className="w-full h-full object-cover" />
          : <ImageOff size={24} className="text-fg-subtle" />}
      </div>
      <div className="p-2 flex flex-col gap-1">
        <span className={`self-start inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-semibold ${q.cls}`}>
          <q.Icon size={10} /> {q.label}
        </span>
        {photo.issues?.length > 0 && <span className="text-[10px] text-fg-muted leading-snug">{photo.issues.join('; ')}</span>}
        {details.length > 0 && <span className="text-[10px] text-fg-subtle leading-snug">{details.join(' · ')}</span>}
      </div>
    </label>
  );
}

export default function FacePhotosPanel({ mode = 'self', uid, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState('');
  const isAdmin = mode === 'admin';

  const load = useCallback(async () => {
    setBusy('load'); setError('');
    try {
      const res = isAdmin ? await identityAPI.getUserFacePhotos(uid) : await identityAPI.getMyFacePhotos();
      if (Array.isArray(res?.photos)) { setData(res); setSelected([]); }
      else setError(res?.detail || 'Không tải được ảnh FaceID.');
    } catch { setError('Không tải được ảnh FaceID.'); }
    finally { setBusy(''); }
  }, [isAdmin, uid]);

  useEffect(() => { setData(null); setNotice(null); load(); }, [load]);

  const photos = data?.photos || [];
  const toggle = (id) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
  const usableLeft = photos.filter(p => !selected.includes(p.id) && p.quality !== 'unusable').length;
  const selfBlocked = !isAdmin && selected.length > 0 && usableLeft === 0;
  const selectPoor = () => setSelected(photos.filter(p => p.quality !== 'good').map(p => p.id));

  const remove = async () => {
    if (!selected.length) return;
    const all = selected.length === photos.length;
    const text = all
      ? `Xóa toàn bộ ${photos.length} ảnh FaceID? Lần đăng nhập sau, khuôn mặt quét đầu tiên đi kèm PassCode sẽ được đăng ký làm FaceID mới.`
      : `Xóa ${selected.length} ảnh đã chọn? Ảnh đã xóa không còn được dùng để xác thực FaceID.`;
    if (!window.confirm(text)) return;
    setBusy('delete'); setNotice(null);
    try {
      const res = isAdmin ? await identityAPI.deleteUserFacePhotos(uid, selected) : await identityAPI.deleteMyFacePhotos(selected);
      if (res?.status === 'SUCCESS') {
        setData(res); setSelected([]);
        setNotice({ type: res.photo_count > 0 && res.template_count === 0 ? 'error' : 'success', text: res.message });
        onChanged?.(res);
      } else {
        setNotice({ type: 'error', text: res?.detail || 'Không xóa được ảnh.' });
        if (res?.httpStatus === 409) load();
      }
    } finally { setBusy(''); }
  };

  const counts = data?.counts || {};
  return (
    <Section title="Ảnh FaceID trong hồ sơ" icon={ScanFace}
      actions={<Button icon={RefreshCw} busy={busy === 'load'} disabled={!!busy} onClick={load} aria-label="Tải lại ảnh FaceID" />}>
      <p className="text-[11px] text-fg-muted leading-relaxed">
        {isAdmin ? 'Ảnh khuôn mặt của người dùng lưu trên OpenLDAP' : 'Ảnh khuôn mặt của bạn lưu trên OpenLDAP'}, dùng để so khớp khi xác thực FaceID.
        Xóa ảnh mờ, tối, quá nhỏ, không thấy mặt hoặc không phải {isAdmin ? 'người dùng' : 'bạn'} để lần xác thực sau chính xác hơn; mẫu khuôn mặt được tính lại từ các ảnh còn lại.
        {isAdmin ? ' Xóa hết ảnh tương đương Xóa FaceID.' : ' Phải giữ lại ít nhất một ảnh dùng được; muốn đăng ký lại từ đầu, hãy liên hệ Quản trị viên.'}
        {' '}Xóa ảnh cần nhập lại PassCode.
      </p>
      {error && <Notice notice={{ type: 'error', text: error }} />}
      <Notice notice={notice} onClose={() => setNotice(null)} />
      {!data && !error && <div className="text-xs text-fg-subtle flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Đang tải và đánh giá ảnh...</div>}
      {data && photos.length === 0 && (
        <div className="text-xs text-fg-subtle italic">Chưa có ảnh FaceID. {isAdmin ? 'Người dùng' : 'Bạn'} sẽ đăng ký khuôn mặt ở lần đăng nhập tiếp theo.</div>
      )}
      {photos.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fg-muted">
            <span><b className="text-fg">{data.photo_count}</b> ảnh · {data.template_count} mẫu khuôn mặt</span>
            <span className="text-emerald-600 dark:text-emerald-400">{counts.good || 0} tốt</span>
            <span className="text-amber-600 dark:text-amber-400">{counts.low || 0} chất lượng thấp</span>
            <span className="text-red-600 dark:text-red-400">{counts.unusable || 0} không dùng được</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {photos.map(p => (
              <PhotoCard key={p.id} photo={p} selected={selected.includes(p.id)} onToggle={() => toggle(p.id)} disabled={!!busy} />
            ))}
          </div>
          {selfBlocked && <Notice notice={{ type: 'error', text: 'Phải giữ lại ít nhất một ảnh "Tốt" hoặc "Chất lượng thấp" để còn xác thực được FaceID.' }} />}
          <div className="flex flex-wrap items-center gap-2">
            <Button icon={TriangleAlert} disabled={!!busy || photos.every(p => p.quality === 'good')} onClick={selectPoor}>
              Chọn ảnh chưa đạt
            </Button>
            {selected.length > 0 && <Button disabled={!!busy} onClick={() => setSelected([])}>Bỏ chọn</Button>}
            <Button variant="danger" icon={busy === 'delete' ? Loader2 : Trash2} busy={busy === 'delete'}
              disabled={!!busy || !selected.length || selfBlocked} onClick={remove}>
              Xóa {selected.length || ''} ảnh đã chọn
            </Button>
          </div>
        </>
      )}
    </Section>
  );
}
