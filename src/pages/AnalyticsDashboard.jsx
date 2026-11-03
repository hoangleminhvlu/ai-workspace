/**
 * TARA AI Workspace - Main iThunder AI OS Entry Point (V6.11.01)
 * Tập tin tạo lập môi trường AI Workspace cho người dùng.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Cpu, HardDrive, Database, Activity, Server,
  Layers, FileText, Clock, AlertTriangle
} from 'lucide-react';
import iThunderAPI, { systemAPI } from '../services/api';

const METRICS_INTERVAL_MS = 5000;
const LOGS_INTERVAL_MS = 15000;

const formatUptime = (seconds) => {
  if (!seconds && seconds !== 0) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return days > 0 ? `${days} ngày, ${hours}h` : `${hours}h ${Math.floor((seconds % 3600) / 60)}m`;
};

const formatGb = (gb) => (gb >= 1000 ? `${(gb / 1024).toFixed(1)} TB` : `${Math.round(gb)} GB`);

const LOG_COLORS = {
  ERROR: 'text-red-600 dark:text-red-400',
  CRITICAL: 'text-red-600 dark:text-red-400',
  WARNING: 'text-amber-600 dark:text-amber-400',
  INFO: 'text-fg-subtle',
  DEBUG: 'text-fg-subtle'
};

const num = (value, digits = 1) => (typeof value === 'number' ? value.toFixed(digits) : '—');

function GpuCard({ gpu, hostName }) {
  const load = gpu.load_percent ?? 0;
  return (
    <div className="bg-panel border border-line rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
      <h3 className="text-xs font-bold text-fg-strong uppercase tracking-wider flex items-center gap-2 border-b border-line pb-2"><Cpu size={14} className="text-amber-600 dark:text-amber-500" /><span>{gpu.name}{gpu.vram_total_gb ? ` - ${Math.round(gpu.vram_total_gb)}GB` : ''}</span><span className="ml-auto text-[10px] text-fg-subtle normal-case font-medium">{hostName} · GPU {gpu.index}</span></h3>
      <div className="flex flex-col gap-1.5 mt-1">
        <div className="flex justify-between text-xs font-medium"><span className="text-fg-muted">Tải nhân đồ họa (GPU Core Load):</span><b className="font-mono text-fg-strong">{gpu.load_percent ?? '—'}%</b></div>
        <div className="w-full bg-elevated h-2.5 rounded-full p-0.5 border border-line"><div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${load}%` }} /></div>
      </div>
      <div className="grid grid-cols-3 gap-4 mt-2 border-t border-line pt-4 font-mono text-xs">
        <div className="flex flex-col gap-0.5"><span className="text-[9px] text-fg-subtle font-bold uppercase">Nhiệt độ</span><b className={`text-sm mt-0.5 ${gpu.temperature_c > 75 ? 'text-red-600 dark:text-red-400' : 'text-fg'}`}>{gpu.temperature_c ?? '—'} °C</b></div>
        <div className="flex flex-col gap-0.5"><span className="text-[9px] text-fg-subtle font-bold uppercase">Đã dùng VRAM</span><b className="text-sm text-cyan-600 dark:text-cyan-400 mt-0.5">{num(gpu.vram_used_gb)} GB</b></div>
        <div className="flex flex-col gap-0.5"><span className="text-[9px] text-fg-subtle font-bold uppercase">{gpu.power_w != null ? 'Công suất' : 'Tổng bộ nhớ VRAM'}</span><b className="text-sm text-fg-subtle mt-0.5">{gpu.power_w != null ? `${gpu.power_w} W` : `${num(gpu.vram_total_gb)} GB`}</b></div>
      </div>
    </div>
  );
}

function HostCard({ host }) {
  const ramPercent = host.memory?.total_gb ? (host.memory.used_gb / host.memory.total_gb) * 100 : 0;
  return (
    <div className="bg-panel border border-line rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
      <h3 className="text-xs font-bold text-fg-strong uppercase tracking-wider flex items-center gap-2 border-b border-line pb-2"><Server size={14} className="text-blue-600 dark:text-blue-400" /><span>{host.name}</span><span className="ml-auto text-[10px] text-fg-subtle normal-case font-medium font-mono">{host.hostname}</span></h3>
      {host.cpu && (
        <div className="flex flex-col gap-1.5 mt-1">
          <div className="flex justify-between text-xs font-medium"><span className="text-fg-muted">Xung tải vi xử lý (CPU Load{host.cpu.cores ? ` - ${host.cpu.cores} luồng` : ''}):</span><b className="font-mono text-fg-strong">{host.cpu.percent != null ? `${Math.round(host.cpu.percent)}%` : 'đang đo...'}</b></div>
          <div className="w-full bg-elevated h-2 rounded-full overflow-hidden"><div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${host.cpu.percent ?? 0}%` }} /></div>
        </div>
      )}
      {host.memory && (
        <div className="flex flex-col gap-1.5 mt-1">
          <div className="flex justify-between text-xs font-medium"><span className="text-fg-muted">{host.memory.unified ? 'Bộ nhớ hợp nhất CPU + GPU' : 'Bộ nhớ trong hệ thống'} (RAM {num(host.memory.used_gb)} / {Math.round(host.memory.total_gb)} GB):</span><b className="font-mono text-fg-strong">{Math.round(ramPercent)}%</b></div>
          <div className="w-full bg-elevated h-2 rounded-full overflow-hidden"><div className="bg-cyan-500 h-full rounded-full transition-all duration-500" style={{ width: `${ramPercent}%` }} /></div>
        </div>
      )}
      {(host.uptime_seconds != null || host.disks?.length > 0) && (
        <div className="grid grid-cols-2 gap-4 mt-1 font-mono text-[11px] text-fg-muted">
          {host.uptime_seconds != null && <span className="flex items-center gap-1"><Clock size={12} /> Uptime: <b>{formatUptime(host.uptime_seconds)}</b></span>}
          {(host.disks || []).map(disk => (
            <span key={disk.mount} className="flex items-center gap-1"><HardDrive size={12} /> {disk.mount}: <b className="text-fg-strong">{formatGb(disk.used_gb)} / {formatGb(disk.total_gb)}</b></span>
          ))}
        </div>
      )}
      {(host.errors || []).map(error => (
        <span key={error} className="flex items-center gap-2 text-[11px] text-red-600 dark:text-red-400"><AlertTriangle size={12} />{error}</span>
      ))}
    </div>
  );
}

function ModelsCard({ models, ollama }) {
  const loaded = new Map((models?.loaded || []).map(m => [m.name, m]));
  const installed = [...(models?.installed || [])].sort((a, b) => (loaded.has(b.name) - loaded.has(a.name)) || a.name.localeCompare(b.name));
  return (
    <div className="bg-panel border border-line rounded-2xl p-5 flex flex-col gap-3 shadow-sm">
      <h3 className="text-xs font-bold text-fg-strong uppercase tracking-wider flex items-center gap-2 border-b border-line pb-2"><Layers size={14} className="text-amber-600 dark:text-amber-500" /><span>Mô hình trên Máy chủ AI (Ollama{ollama?.version ? ` ${ollama.version}` : ''})</span><span className="ml-auto text-[10px] text-fg-subtle normal-case font-medium">{loaded.size} đang nạp / {installed.length} đã cài</span></h3>
      {models?.error && <span className="flex items-center gap-2 text-[11px] text-red-600 dark:text-red-400"><AlertTriangle size={12} />{models.error}</span>}
      <div className="max-h-64 overflow-y-auto custom-scrollbar flex flex-col font-mono text-[11px]">
        {installed.map(model => {
          const running = loaded.get(model.name);
          return (
            <div key={model.name} className="flex items-center gap-3 py-1.5 border-b border-line last:border-0">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${running ? 'bg-emerald-500 animate-pulse' : 'bg-fg-subtle/40'}`} />
              <b className="text-fg-strong truncate min-w-0">{model.name}</b>
              <span className="text-fg-subtle shrink-0">{model.parameter_size} · {model.quantization}</span>
              <span className="ml-auto shrink-0 text-fg-muted">{running ? <b className="text-cyan-600 dark:text-cyan-400">{num(running.vram_gb)} GB VRAM</b> : `${num(model.size_gb)} GB`}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const navigate = useNavigate();
  const [summaryData, setSummaryData] = useState({ totalFiles: 0, totalChunks: 0, totalCollections: 0 });
  // metrics: null (đang tải) | { runtimes, config_error, timestamp }; metricsError: thông điệp lỗi gần nhất
  const [metrics, setMetrics] = useState(null);
  const [metricsError, setMetricsError] = useState('');
  const [logs, setLogs] = useState([]);
  const [logsAllowed, setLogsAllowed] = useState(true);
  const logBoxRef = useRef(null);

  useEffect(() => {
    // Thống kê theo đúng các kho mà vai trò của người đăng nhập được phép truy cập (Backend đọc vai trò từ JWT)
    iThunderAPI.getCollections()
      .then(data => {
        if (Array.isArray(data)) {
          const files = data.reduce((acc, c) => acc + c.file_count, 0);
          const chunks = data.reduce((acc, c) => acc + c.chunk_count, 0);
          setSummaryData({ totalFiles: files, totalChunks: chunks, totalCollections: data.length });
        }
      }).catch(() => console.warn("Lỗi đồng bộ Dashboard Analytics."));

    let active = true;
    let metricsTimer = null;
    let logsTimer = null;

    const loadMetrics = async () => {
      const res = await systemAPI.getMetrics();
      if (!active) return;
      if (res?.status === 'SUCCESS') {
        setMetrics(res);
        setMetricsError('');
      } else {
        setMetricsError(res?.detail || 'Không lấy được số đo tài nguyên AI Server.');
        // 403: vai trò không được giám sát hạ tầng => ngừng hỏi lại
        if (res?.httpStatus === 403) clearInterval(metricsTimer);
      }
    };

    const loadLogs = async () => {
      const res = await systemAPI.getLogs(100);
      if (!active) return;
      if (res?.status === 'SUCCESS') {
        setLogs(res.lines || []);
      } else if (res?.httpStatus === 403) {
        setLogsAllowed(false);
        clearInterval(logsTimer);
      }
    };

    loadMetrics();
    loadLogs();
    metricsTimer = setInterval(loadMetrics, METRICS_INTERVAL_MS);
    logsTimer = setInterval(loadLogs, LOGS_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(metricsTimer);
      clearInterval(logsTimer);
    };
  }, []);

  useEffect(() => {
    if (logBoxRef.current) logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
  }, [logs]);

  // Mỗi runtime: { id, name, ollama, models, monitored, host } (Máy chủ AI LLM Runtime khai báo trong ai_runtimes.json)
  const runtimes = metrics?.runtimes || [];
  const loadedModels = runtimes.flatMap(rt => (rt.models?.loaded || []).map(m => ({ ...m, runtime: rt.name })));
  const installedCount = runtimes.reduce((acc, rt) => acc + (rt.models?.installed?.length || 0), 0);
  const online = metrics && !metricsError && !metrics.config_error
    && runtimes.every(rt => rt.ollama?.ok && rt.models?.ok !== false && (!rt.host || rt.host.ok));

  return (
    <div className="w-screen h-app flex flex-col bg-app text-fg font-sans antialiased overflow-hidden">
      <header className="h-14 border-b border-line bg-panel px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-1.5 rounded-lg hover:bg-hover text-fg-muted hover:text-fg-strong transition-all"><ArrowLeft size={16} /></button>
          <span className="text-sm font-bold uppercase tracking-wider text-fg">Giám sát Hạ tầng & Hiệu năng AI Server</span>
        </div>
        {online ? (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium font-mono bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 px-2.5 py-1 rounded-md">
            <Activity size={12} className="animate-pulse" /><span>Hệ thống trực tuyến</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium font-mono bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 px-2.5 py-1 rounded-md">
            <AlertTriangle size={12} /><span>{metrics || metricsError ? 'Có nguồn giám sát lỗi' : 'Đang kết nối...'}</span>
          </div>
        )}
      </header>

      <main className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-panel border border-line rounded-2xl p-4 flex items-center gap-4 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400"><Layers size={20}/></div>
            <div className="flex flex-col"><span className="text-[10px] text-fg-subtle font-bold uppercase tracking-wide">Vùng Kho</span><b className="text-fg-strong text-lg font-mono mt-0.5">{summaryData.totalCollections} Vùng</b></div>
          </div>
          <div className="bg-panel border border-line rounded-2xl p-4 flex items-center gap-4 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/10 border border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400"><FileText size={20}/></div>
            <div className="flex flex-col"><span className="text-[10px] text-fg-subtle font-bold uppercase tracking-wide">Tài liệu RAG</span><b className="text-fg-strong text-lg font-mono mt-0.5">{summaryData.totalFiles} Tệp</b></div>
          </div>
          <div className="bg-panel border border-line rounded-2xl p-4 flex items-center gap-4 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400"><Database size={20}/></div>
            <div className="flex flex-col"><span className="text-[10px] text-fg-subtle font-bold uppercase tracking-wide">Vector Chunks</span><b className="text-fg-strong text-lg font-mono mt-0.5">{summaryData.totalChunks} Đoạn</b></div>
          </div>
          <div className="bg-panel border border-line rounded-2xl p-4 flex items-center gap-4 shadow-sm" title={loadedModels.map(m => `${m.name} @ ${m.runtime} (${m.vram_gb} GB VRAM)`).join('\n')}>
            <div className="w-10 h-10 rounded-xl bg-amber-600/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400"><Server size={20}/></div>
            <div className="flex flex-col"><span className="text-[10px] text-fg-subtle font-bold uppercase tracking-wide">Mô hình nội bộ{runtimes.length > 1 ? ` · ${runtimes.length} máy` : ''}</span>
              <b className="text-fg-strong text-lg font-mono mt-0.5">{metrics ? `${loadedModels.length} Live / ${installedCount}` : '—'}</b>
            </div>
          </div>
        </div>

        {metricsError && (
          <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl px-4 py-2.5"><AlertTriangle size={14} />{metricsError}</div>
        )}

        {metrics?.config_error && (
          <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl px-4 py-2.5"><AlertTriangle size={14} />{metrics.config_error}</div>
        )}

        {runtimes.map(rt => (
          <section key={rt.id} className="flex flex-col gap-3">
            {runtimes.length > 1 && (
              <h2 className="text-xs font-bold uppercase tracking-wider text-fg-muted flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${rt.ollama?.ok ? 'bg-emerald-500' : 'bg-red-500'}`} />{rt.name}
                <span className="font-mono normal-case font-medium text-fg-subtle">{rt.ollama?.url}</span>
              </h2>
            )}
            {!rt.monitored && (
              <div className="flex items-start gap-2 text-xs text-fg-muted bg-elevated border border-line rounded-xl px-4 py-2.5">
                <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <span>Tải GPU, bộ nhớ của {rt.name} chưa hiển thị: khai báo dcgm_url (NVIDIA DCGM Exporter), node_url (node_exporter), agent_url (iThunder Metrics Agent) hoặc dgx_dashboard cho runtime "{rt.id}" trong ai_runtimes.json của Backend.</span>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ModelsCard models={rt.models} ollama={rt.ollama} />
              {(rt.host?.gpus || []).map(gpu => <GpuCard key={`${rt.id}-${gpu.index}`} gpu={gpu} hostName={rt.name} />)}
              {rt.host && <HostCard host={{ ...rt.host, id: rt.id, name: rt.name }} />}
            </div>
          </section>
        ))}

        {logsAllowed && (
          <div className="bg-panel border border-line rounded-2xl p-4 flex flex-col gap-2 shadow-sm font-mono">
            <span className="text-xs font-bold text-fg-strong uppercase tracking-wider flex items-center gap-2 border-b border-line pb-2 mb-1">Live System console log</span>
            <div ref={logBoxRef} className="bg-elevated rounded-xl p-4 text-[11px] leading-6 text-fg-muted border border-line h-44 overflow-y-auto custom-scrollbar flex flex-col gap-0.5">
              {logs.length === 0 && <p className="text-fg-subtle">Chưa có nhật ký.</p>}
              {logs.map((line, index) => <p key={index} className={`break-all ${LOG_COLORS[line.level] || 'text-fg-subtle'}`}>{line.text}</p>)}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
