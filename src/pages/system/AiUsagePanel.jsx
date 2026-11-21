/**
 * Giám sát Hệ thống › AI Tokens: số token mô hình AI đã dùng theo ngày / tháng, tách On-Premise (Máy chủ AI của Tổ chức) và
 * On-Clouds (dịch vụ AI qua Internet), theo người dùng, mô hình, kênh (AI Chat/Work, Trao đổi trực tuyến). Căn cứ đánh giá
 * hiệu quả sử dụng nền tảng. admin: toàn Tổ chức; manager: số tổng của Tổ chức, chi tiết người dùng thuộc đơn vị mình quản lý.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Coins, Download, History, Loader2, RefreshCw, Users } from 'lucide-react';
import { systemAPI } from '../../services/api';
import { Notice } from '../identity/shared';

const LOC = {
  onpremise: { label: 'On-Premise', color: 'var(--series-onpremise)', hint: 'Máy chủ AI của Tổ chức' },
  onclouds: { label: 'On-Clouds', color: 'var(--series-onclouds)', hint: 'Dịch vụ AI qua Internet' },
};
const RANGES = { day: [[7, '7 ngày'], [30, '30 ngày'], [90, '90 ngày']], month: [[6, '6 tháng'], [12, '12 tháng'], [24, '24 tháng']] };
const nf = new Intl.NumberFormat('vi-VN');
const fmt = (n) => nf.format(n || 0);
const compact = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(1).replace('.', ',')} tỷ` : n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')} triệu`
  : n >= 1e4 ? `${Math.round(n / 1e3)} nghìn` : fmt(n));
const pct = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : '—');
const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const periodLabel = (p, granularity) => (granularity === 'month' ? `${p.slice(5, 7)}/${p.slice(0, 4)}` : `${p.slice(8, 10)}/${p.slice(5, 7)}`);

function rangeFor(granularity, size) {
  const end = new Date();
  const start = new Date(end);
  if (granularity === 'month') { start.setDate(1); start.setMonth(start.getMonth() - (size - 1)); }
  else start.setDate(start.getDate() - (size - 1));
  return { start: isoDate(start), end: isoDate(end) };
}

function Segmented({ value, options, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line bg-elevated p-0.5">
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${value === v ? 'bg-panel text-fg-strong shadow-sm' : 'text-fg-muted hover:text-fg-strong'}`}>
          {text}
        </button>
      ))}
    </div>
  );
}

function Tile({ label, value, sub, swatch }) {
  return (
    <div className="bg-panel border border-line rounded-xl px-4 py-3 flex flex-col gap-0.5 min-w-0">
      <span className="text-[11px] text-fg-muted flex items-center gap-1.5">
        {swatch && <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: swatch }} aria-hidden="true" />}{label}
      </span>
      <span className="text-xl font-bold text-fg-strong tabular-nums">{value}</span>
      {sub && <span className="text-[11px] text-fg-subtle truncate">{sub}</span>}
    </div>
  );
}

// Cột chồng On-Premise (dưới) / On-Clouds (trên): khe 2px giữa hai phần, đầu cột bo 4px, lưới nhạt, chú thích khi rê chuột
function UsageChart({ series, granularity }) {
  const [hover, setHover] = useState(null);
  // Vẽ theo bề rộng thật của khung (chữ trên trục giữ cỡ 10px, không phóng to theo màn hình)
  const boxRef = useRef(null);
  const [W, setW] = useState(760);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(320, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 260, padL = 70, padB = 26, padT = 10, padR = 8;
  const max = Math.max(1, ...series.map(s => s.total_tokens));
  const step = (() => { const raw = max / 4; const mag = 10 ** Math.floor(Math.log10(raw)); return Math.ceil(raw / mag) * mag; })();
  const top = step * 4;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const slot = plotW / Math.max(series.length, 1);
  const barW = Math.max(2, Math.min(28, slot - 4));
  const y = (v) => padT + plotH - (v / top) * plotH;
  const labelEvery = Math.ceil(series.length / Math.max(4, Math.floor(plotW / 70)));
  const bar = (x, y0, y1, color, roundTop) => {
    const h = Math.max(0, y0 - y1);
    if (h <= 0) return null;
    const r = roundTop ? Math.min(4, h, barW / 2) : 0;
    const d = `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + barW - r} Q${x + barW},${y1} ${x + barW},${y1 + r} V${y0} Z`;
    return <path d={d} fill={color} />;
  };
  const hovered = hover !== null ? series[hover] : null;
  return (
    <div className="relative" ref={boxRef}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" role="img"
        aria-label={`Biểu đồ AI Tokens theo ${granularity === 'month' ? 'tháng' : 'ngày'}, chi tiết ở bảng bên dưới`}>
        {[0, 1, 2, 3, 4].map(i => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(step * i)} y2={y(step * i)} stroke="var(--border-main)" strokeWidth="1" />
            <text x={padL - 6} y={y(step * i) + 3} textAnchor="end" fontSize="10" fill="var(--text-subtle)">{compact(step * i)}</text>
          </g>
        ))}
        {series.map((s, i) => {
          const x = padL + i * slot + (slot - barW) / 2;
          const on = s.onpremise.total_tokens, cl = s.onclouds.total_tokens;
          const yOn = y(on), yAll = y(on + cl);
          return (
            <g key={s.period} opacity={hover === null || hover === i ? 1 : 0.6}>
              {bar(x, y(0), yOn, LOC.onpremise.color, cl === 0)}
              {cl > 0 && bar(x, on > 0 ? yOn - 2 : y(0), yAll, LOC.onclouds.color, true)}
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--text-subtle)">{periodLabel(s.period, granularity)}</text>
              )}
              <rect x={padL + i * slot} y={padT} width={slot} height={plotH} fill="transparent"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
            </g>
          );
        })}
        <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} stroke="var(--text-subtle)" strokeWidth="1" />
      </svg>
      {hovered && (
        <div className="pointer-events-none absolute top-1 bg-panel border border-line rounded-lg shadow-lg px-3 py-2 text-[11px] min-w-[11rem]"
          style={(() => {   // đặt cạnh cột đang rê chuột, phía còn trống
            const cx = padL + hover * slot + slot / 2;
            return cx > W / 2 ? { right: W - cx + barW / 2 + 8 } : { left: cx + barW / 2 + 8 };
          })()}>
          <div className="font-semibold text-fg-strong mb-1">{granularity === 'month' ? `Tháng ${periodLabel(hovered.period, 'month')}` : `Ngày ${hovered.period.split('-').reverse().join('/')}`}</div>
          {['onclouds', 'onpremise'].map(k => (
            <div key={k} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-fg-muted"><span className="w-2 h-2 rounded-sm" style={{ background: LOC[k].color }} />{LOC[k].label}</span>
              <span className="tabular-nums text-fg">{fmt(hovered[k].total_tokens)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 border-t border-line mt-1 pt-1">
            <span className="text-fg-muted">Tổng · {fmt(hovered.requests)} lượt</span><span className="tabular-nums font-semibold text-fg-strong">{fmt(hovered.total_tokens)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

const th = 'py-2 px-3 font-medium text-left';
const td = 'py-2 px-3 tabular-nums';

export default function AiUsagePanel() {
  const [granularity, setGranularity] = useState('day');
  const [size, setSize] = useState(30);
  const [location, setLocation] = useState('');
  const [channel, setChannel] = useState('');
  const [userId, setUserId] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState('');
  const params = useMemo(() => ({ granularity, ...rangeFor(granularity, size), location, channel, user_id: userId }),
    [granularity, size, location, channel, userId]);

  const load = useCallback(async () => {
    setBusy('load');
    const res = await systemAPI.getAiUsage(params);
    setBusy('');
    if (res?.status === 'SUCCESS') { setData(res); setError(''); } else setError(res?.detail || 'Không đọc được thống kê AI Tokens.');
  }, [params]);
  useEffect(() => { load(); }, [load]);

  const changeGranularity = (g) => { setGranularity(g); setSize(g === 'month' ? 12 : 30); };
  const exportCsv = async () => {
    setBusy('csv');
    const res = await systemAPI.downloadAiUsageCsv(params);
    setBusy('');
    if (res?.status !== 'SUCCESS') { setNotice({ type: 'error', text: res?.detail || 'Không xuất được CSV.' }); return; }
    const url = URL.createObjectURL(res.blob);
    const a = document.createElement('a');
    a.href = url; a.download = res.filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const backfill = async () => {
    if (!window.confirm('Nạp số token của các câu trả lời đã lưu trong lịch sử (AI Chat/Work, Trao đổi trực tuyến) vào thống kê? Chạy lại nhiều lần không bị trùng.')) return;
    setBusy('backfill');
    const res = await systemAPI.backfillAiUsage();
    setBusy('');
    setNotice({ type: res?.status === 'SUCCESS' ? 'success' : 'error', text: res?.message || res?.detail || 'Không nạp được số liệu cũ.' });
    if (res?.status === 'SUCCESS') load();
  };

  const t = data?.totals;
  const users = data?.users || [];
  const selectedUser = users.find(u => u.user_id === userId);
  const controlCls = 'bg-elevated border border-line text-[11px] rounded-lg px-2 py-1.5 text-fg focus:outline-none focus:ring-2 focus:ring-blue-500/40';

  return (
    <div className="flex flex-col gap-4 w-full max-w-6xl">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="Thống kê theo" value={granularity} onChange={changeGranularity} options={[['day', 'Theo ngày'], ['month', 'Theo tháng']]} />
        <Segmented label="Khoảng thời gian" value={size} onChange={setSize} options={RANGES[granularity]} />
        <select aria-label="Nơi chạy mô hình" value={location} onChange={e => setLocation(e.target.value)} className={controlCls}>
          <option value="">On-Premise và On-Clouds</option><option value="onpremise">Chỉ On-Premise</option><option value="onclouds">Chỉ On-Clouds</option>
        </select>
        <select aria-label="Kênh" value={channel} onChange={e => setChannel(e.target.value)} className={controlCls}>
          <option value="">Mọi kênh</option><option value="chat">AI Chat/Work</option><option value="comm">Trao đổi trực tuyến</option>
        </select>
        <select aria-label="Người dùng" value={userId} onChange={e => setUserId(e.target.value)} className={`${controlCls} max-w-[14rem]`}>
          <option value="">Mọi người dùng</option>
          {userId && !selectedUser && <option value={userId}>{userId}</option>}
          {users.map(u => <option key={u.user_id} value={u.user_id}>{u.user_name || u.user_id}{u.owner_id ? ` (${u.owner_id})` : ''}</option>)}
        </select>
        <span className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={load} disabled={!!busy} aria-label="Tải lại" title="Tải lại"
            className="p-1.5 rounded-lg border border-line bg-elevated text-fg-muted hover:text-fg-strong disabled:opacity-50">
            <RefreshCw size={13} className={busy === 'load' ? 'animate-spin' : ''} />
          </button>
          <button type="button" onClick={exportCsv} disabled={!!busy || !t?.requests}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line bg-elevated text-[11px] font-semibold text-fg hover:bg-hover disabled:opacity-50">
            {busy === 'csv' ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Xuất CSV
          </button>
          {data?.can_backfill && (
            <button type="button" onClick={backfill} disabled={!!busy} title="Nạp số liệu của các câu trả lời đã lưu trước khi có thống kê"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line bg-elevated text-[11px] font-semibold text-fg hover:bg-hover disabled:opacity-50">
              {busy === 'backfill' ? <Loader2 size={12} className="animate-spin" /> : <History size={12} />} Nạp số liệu cũ
            </button>
          )}
        </span>
      </div>

      {error && <Notice notice={{ type: 'error', text: error }} />}
      <Notice notice={notice} onClose={() => setNotice(null)} />
      {!data && !error && <div className="text-xs text-fg-subtle flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Đang tải...</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Tile label="Tổng AI Tokens" value={compact(t.total_tokens)} sub={`Vào ${compact(t.input_tokens)} · Ra ${compact(t.output_tokens)}`} />
            <Tile label="On-Premise" swatch={LOC.onpremise.color} value={compact(data.locations.onpremise.total_tokens)}
              sub={`${pct(data.locations.onpremise.total_tokens, t.total_tokens)} · ${fmt(data.locations.onpremise.requests)} lượt`} />
            <Tile label="On-Clouds" swatch={LOC.onclouds.color} value={compact(data.locations.onclouds.total_tokens)}
              sub={`${pct(data.locations.onclouds.total_tokens, t.total_tokens)} · ${fmt(data.locations.onclouds.requests)} lượt`} />
            <Tile label="Lượt trả lời" value={fmt(t.requests)} sub={`AI Chat/Work ${fmt(data.channels.chat.requests)} · Trao đổi ${fmt(data.channels.comm.requests)}`} />
            <Tile label="Người dùng" value={fmt(t.users)} sub={t.unmeasured ? `${fmt(t.unmeasured)} lượt mô hình không báo số token` : 'Mọi lượt đều có số token'} />
          </div>

          <section className="bg-panel border border-line rounded-xl p-4 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-fg-strong flex items-center gap-1.5">
                <Coins size={13} className="text-fg-muted" /> AI Tokens theo {granularity === 'month' ? 'tháng' : 'ngày'}
                {selectedUser ? ` của ${selectedUser.user_name || selectedUser.user_id}` : ''}
                <span className="font-normal text-fg-subtle">({data.start.split('-').reverse().join('/')} – {data.end.split('-').reverse().join('/')})</span>
              </h3>
              <div className="flex items-center gap-3 text-[11px] text-fg-muted" aria-label="Chú giải">
                {['onpremise', 'onclouds'].map(k => (
                  <span key={k} className="flex items-center gap-1.5" title={LOC[k].hint}>
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: LOC[k].color }} aria-hidden="true" />{LOC[k].label}
                  </span>
                ))}
              </div>
            </div>
            {t.requests ? <UsageChart series={data.series} granularity={granularity} />
              : <div className="py-10 text-center text-xs text-fg-subtle italic">Chưa có lượt trả lời nào trong khoảng thời gian này.</div>}
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="bg-panel border border-line rounded-xl overflow-hidden">
              <h3 className="text-xs font-bold text-fg-strong px-4 py-2.5 border-b border-line flex items-center gap-1.5">
                <Users size={13} className="text-fg-muted" /> Theo người dùng
                {data.scope === 'units' && <span className="font-normal text-fg-subtle">(đơn vị {data.scope_units.join(', ')}; số tổng phía trên là của toàn Tổ chức)</span>}
              </h3>
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-elevated text-fg-muted sticky top-0"><tr>
                    <th className={th}>Người dùng</th><th className={`${th} text-right`}>Lượt</th>
                    <th className={`${th} text-right`}>On-Premise</th><th className={`${th} text-right`}>On-Clouds</th><th className={`${th} text-right`}>Tổng</th>
                  </tr></thead>
                  <tbody>
                    {users.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-fg-subtle italic">Không có số liệu.</td></tr>}
                    {users.map(u => (
                      <tr key={u.user_id} className="border-t border-line hover:bg-hover cursor-pointer" onClick={() => setUserId(u.user_id === userId ? '' : u.user_id)}
                        title="Bấm để xem riêng người dùng này">
                        <td className="py-2 px-3 text-fg"><div className="font-medium truncate max-w-[14rem]">{u.user_name || `uid ${u.user_id}`}</div>
                          <div className="text-[10px] text-fg-subtle font-mono">{u.owner_id || '—'} · uid {u.user_id}</div></td>
                        <td className={`${td} text-right text-fg-muted`}>{fmt(u.requests)}</td>
                        <td className={`${td} text-right text-fg`}>{fmt(u.onpremise_tokens)}</td>
                        <td className={`${td} text-right text-fg`}>{fmt(u.onclouds_tokens)}</td>
                        <td className={`${td} text-right font-semibold text-fg-strong`}>{fmt(u.total_tokens)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-panel border border-line rounded-xl overflow-hidden">
              <h3 className="text-xs font-bold text-fg-strong px-4 py-2.5 border-b border-line">Theo mô hình</h3>
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-elevated text-fg-muted sticky top-0"><tr>
                    <th className={th}>Mô hình</th><th className={th}>Nơi chạy</th><th className={`${th} text-right`}>Lượt</th>
                    <th className={`${th} text-right`}>Vào</th><th className={`${th} text-right`}>Ra</th><th className={`${th} text-right`}>Tổng</th>
                  </tr></thead>
                  <tbody>
                    {data.models.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-fg-subtle italic">Không có số liệu.</td></tr>}
                    {data.models.map(m => (
                      <tr key={`${m.model}|${m.location}|${m.provider}`} className="border-t border-line">
                        <td className="py-2 px-3 font-mono text-fg truncate max-w-[12rem]" title={m.runtime_name}>{m.model}</td>
                        <td className="py-2 px-3 text-fg-muted whitespace-nowrap">
                          <span className="inline-block w-2 h-2 rounded-sm mr-1.5" style={{ background: LOC[m.location]?.color }} aria-hidden="true" />
                          {LOC[m.location]?.label}{m.provider ? ` · ${m.provider}` : ''}
                        </td>
                        <td className={`${td} text-right text-fg-muted`}>{fmt(m.requests)}</td>
                        <td className={`${td} text-right text-fg`}>{fmt(m.input_tokens)}</td>
                        <td className={`${td} text-right text-fg`}>{fmt(m.output_tokens)}</td>
                        <td className={`${td} text-right font-semibold text-fg-strong`}>{fmt(m.total_tokens)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <section className="bg-panel border border-line rounded-xl overflow-hidden">
            <h3 className="text-xs font-bold text-fg-strong px-4 py-2.5 border-b border-line">Bảng số liệu theo {granularity === 'month' ? 'tháng' : 'ngày'}</h3>
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-elevated text-fg-muted sticky top-0"><tr>
                  <th className={th}>{granularity === 'month' ? 'Tháng' : 'Ngày'}</th><th className={`${th} text-right`}>Lượt</th>
                  <th className={`${th} text-right`}>On-Premise</th><th className={`${th} text-right`}>On-Clouds</th><th className={`${th} text-right`}>Tổng</th>
                </tr></thead>
                <tbody>
                  {[...data.series].reverse().filter(s => s.requests).map(s => (
                    <tr key={s.period} className="border-t border-line">
                      <td className="py-2 px-3 text-fg">{granularity === 'month' ? periodLabel(s.period, 'month') : s.period.split('-').reverse().join('/')}</td>
                      <td className={`${td} text-right text-fg-muted`}>{fmt(s.requests)}</td>
                      <td className={`${td} text-right text-fg`}>{fmt(s.onpremise.total_tokens)}</td>
                      <td className={`${td} text-right text-fg`}>{fmt(s.onclouds.total_tokens)}</td>
                      <td className={`${td} text-right font-semibold text-fg-strong`}>{fmt(s.total_tokens)}</td>
                    </tr>
                  ))}
                  {!data.series.some(s => s.requests) && <tr><td colSpan={5} className="py-6 text-center text-fg-subtle italic">Không có số liệu.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <p className="text-[11px] text-fg-subtle leading-relaxed">
            Số token do mô hình báo về sau mỗi lượt trả lời (On-Premise: Ollama; On-Clouds: nhà cung cấp), gồm token vào (câu hỏi, ngữ cảnh
            từ Kho Tri thức, lịch sử, kết quả công cụ) và token ra (câu trả lời). Chưa gồm token tạo embedding khi nạp Kho Tri thức. Ngày, tháng
            tính theo giờ {data.timezone}. Lượt bị từ chối vì Kho không có thông tin (không gọi mô hình) không được tính.
          </p>
        </>
      )}
    </div>
  );
}
