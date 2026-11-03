/**
 * TARA AI Workspace - Main iThunder AI OS Entry Point (V6.11.01)
 * Tập tin tạo lập môi trường AI Workspace cho người dùng.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FolderGit, Database, FileText, HardDrive, RefreshCw, Trash2, 
  ArrowLeft, Search, CheckCircle, AlertCircle 
} from 'lucide-react';
import iThunderAPI, { getStoragePermission } from '../services/api';

// Thông tin người dùng của phiên hiện tại (do App.jsx lưu khi đăng nhập); vai trò chỉ dùng để hiển thị,
// quyền thật do Backend kiểm tra qua JWT
const readSessionUser = () => {
  try {
    return JSON.parse(localStorage.getItem("tara_user") || "null") || {};
  } catch {
    return {};
  }
};

export default function KnowledgeManager() {
  const navigate = useNavigate();
  const [collections, setCollections] = useState([]);
  const [activeCollection, setActiveCollection] = useState(null);
  const [files, setFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState({ type: '', text: '' });

  const sessionUser = readSessionUser();
  const canManage = getStoragePermission(activeCollection, sessionUser.userRole) === 'manage';

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async (keepStorageKey = null) => {
    setLoading(true);
    try {
      const data = await iThunderAPI.getCollections();
      if (!Array.isArray(data)) {
        showMsg('error', data?.detail || 'Không thể nạp danh mục phân vùng kho tri thức.');
        return;
      }
      setCollections(data);
      // Giữ nguyên kho đang chọn sau khi đồng bộ, mặc định chọn kho đầu tiên
      const nextActive = data.find(c => c.storage_key === keepStorageKey) || data[0];
      if (nextActive) {
        setActiveCollection(nextActive);
        fetchFiles(nextActive.collection_name);
      }
    } catch (err) {
      showMsg('error', 'Không thể nạp danh mục phân vùng kho tri thức.');
    } finally { setLoading(false); }
  };

  const fetchFiles = async (collectionName) => {
    try {
      const fileData = await iThunderAPI.getCollectionFiles(collectionName);
      if (Array.isArray(fileData)) {
        setFiles(fileData);
      } else {
        setFiles([]);
        showMsg('error', fileData?.detail || 'Lỗi truy quét danh sách tệp tin trong phân vùng.');
      }
    } catch (err) {
      showMsg('error', 'Lỗi truy quét danh sách tệp tin trong phân vùng.');
    }
  };

  const handleCollectionChange = (col) => {
    setActiveCollection(col);
    fetchFiles(col.collection_name);
  };

  const handleSync = async () => {
    if (!activeCollection || !canManage) return;
    setLoading(true);
    showMsg('info', `Đang quét thư mục máy chủ cho kho: ${activeCollection.display_name}...`);
    try {
      // storage_key (Public, Admin, Finance, ...) chính là khóa kho Backend yêu cầu
      const res = await iThunderAPI.syncDirectory(activeCollection.storage_key);
      if (res.status === "SUCCESS") {
        showMsg('success', res.detail);
        fetchCollections(activeCollection.storage_key);
      } else { showMsg('error', res.detail); }
    } catch (err) { showMsg('error', 'Lỗi kết nối API Gateway để đồng bộ RAG.'); }
    finally { setLoading(false); }
  };

  const handleDeleteFile = async (fileName) => {
    if (!canManage) return;
    if (!window.confirm(`Xóa vĩnh viễn tệp \`${fileName}\` khỏi PGVector?`)) return;
    try {
      const res = await iThunderAPI.deleteFile(activeCollection.collection_name, fileName);
      if (res.status === "SUCCESS") {
        // Thông điệp Backend có thể kèm lưu ý tệp đồng bộ từ thư mục sẽ được nạp lại ở lần đồng bộ sau
        showMsg('success', res.detail || `Đã giải phóng ${res.purged_chunks} đoạn tri thức của file \`${fileName}\`.`);
        fetchFiles(activeCollection.collection_name);
      } else {
        showMsg('error', res.detail || 'Thao tác gỡ bỏ tệp tin thất bại.');
      }
    } catch (err) { showMsg('error', 'Thao tác gỡ bỏ tệp tin thất bại.'); }
  };

  const showMsg = (type, text) => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage({ type: '', text: '' }), 5000);
  };

  const filteredFiles = files.filter(f => f.file_name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="w-screen h-app flex flex-col bg-app text-fg font-sans antialiased overflow-hidden">
      <header className="h-14 border-b border-line bg-panel px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-1.5 rounded-lg hover:bg-hover text-fg-muted hover:text-fg-strong transition-all">
            <ArrowLeft size={16} />
          </button>
          <span className="text-sm font-bold uppercase tracking-wider text-fg">Quản trị Phân vùng Kho Tri thức</span>
        </div>
        <div className="text-xs font-mono bg-elevated text-fg-muted px-3 py-1 rounded-md border border-line">Node: FITLAB-03</div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 bg-panel border-r border-line p-4 flex flex-col gap-2 overflow-y-auto">
          <span className="text-[10px] font-bold text-fg-subtle uppercase tracking-wider mb-1">CÁC PHÂN VÙNG HỆ THỐNG</span>

          {/* CRITICAL FIX: Thêm toán tử điều kiện an toàn Array.isArray() trước khi .map */}
          {Array.isArray(collections) && collections.map((col) => (
            <button
              key={col.storage_key}
              onClick={() => handleCollectionChange(col)}
              className={`w-full text-left px-3 py-3 rounded-xl border text-xs font-medium transition-all flex items-center justify-between ${activeCollection?.storage_key === col.storage_key ? 'bg-blue-600/15 border-blue-500/50 text-fg-strong shadow-md' : 'bg-transparent border-transparent text-fg-muted hover:bg-hover'}`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Database size={14} className={activeCollection?.storage_key === col.storage_key ? 'text-blue-600 dark:text-blue-400' : 'text-fg-subtle'} />
                <span className="truncate">{col.display_name}</span>
              </div>
              <span className="text-[10px] bg-elevated px-1.5 py-0.5 rounded font-mono text-fg-subtle shrink-0">{col.file_count} f</span>
            </button>
          ))}

        </aside>

        <main className="flex-1 bg-app p-6 flex flex-col gap-4 overflow-y-auto">
          {activeCollection && (
            <div className="w-full bg-panel border border-line rounded-2xl p-4 flex justify-between items-center shadow-sm">
              <div className="flex flex-col gap-0.5 min-w-0">
                <h2 className="text-sm font-bold text-fg-strong flex items-center gap-1.5"><FolderGit size={15} className="text-blue-600 dark:text-blue-400" /> Phân vùng: {activeCollection.display_name}</h2>
                <span className="text-[11px] text-fg-subtle truncate">Mã Table: <code className="text-amber-600 dark:text-amber-500 font-mono text-[10px] bg-elevated px-1 py-0.5 rounded ml-1">{activeCollection.collection_name}</code></span>
                <span className={`text-[11px] font-semibold ${canManage ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  Quyền của bạn: {canManage ? 'Quản trị (xem, tải dữ liệu, đồng bộ RAG)' : 'Chỉ khai thác'}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono border-l border-line pl-6 shrink-0">
                <div className="flex flex-col items-end"><span className="text-fg-subtle uppercase text-[9px] font-bold">Tổng đoạn</span><b className="text-emerald-600 dark:text-emerald-400 text-sm mt-0.5">{activeCollection.chunk_count} chunks</b></div>
                <div className="flex flex-col items-end"><span className="text-fg-subtle uppercase text-[9px] font-bold">Dung lượng</span><b className="text-cyan-600 dark:text-cyan-400 text-sm mt-0.5">{activeCollection.storage_size}</b></div>
                <button
                  onClick={handleSync}
                  disabled={loading || !canManage}
                  title={canManage ? "Đồng bộ thư mục Kho Dữ liệu vào Kho tri thức" : "Vai trò của bạn không có quyền quản trị kho này"}
                  className="ml-2 bg-elevated border border-line hover:bg-hover text-fg font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw size={12} className={`text-blue-600 dark:text-blue-400 ${loading ? 'animate-spin' : ''}`} /> <span>Đồng bộ hóa</span>
                </button>
              </div>
            </div>
          )}

          {actionMessage.text && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${actionMessage.type === 'error' ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400' : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40 text-blue-600 dark:text-blue-400'}`}>
              <AlertCircle size={14} /> <span>{actionMessage.text}</span>
            </div>
          )}

          <div className="flex-1 bg-panel border border-line rounded-2xl p-4 flex flex-col gap-4 shadow-inner">
            <div className="relative max-w-sm">
              <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
              <input type="text" placeholder="Tìm kiếm tài liệu số hóa..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-elevated border border-line text-xs rounded-xl pl-9 pr-4 py-2.5 text-fg focus:outline-none" />
            </div>

            <div className="flex-1 overflow-x-auto custom-scrollbar">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-line text-fg-muted font-semibold bg-elevated">
                    <th className="py-3 px-4 font-medium w-12 text-center">STT</th>
                    <th className="py-3 px-4 font-medium">Tên tệp tài liệu tri thức</th>
                    <th className="py-3 px-4 font-medium w-36 text-center">Số phân đoạn</th>
                    <th className="py-3 px-4 font-medium w-40 text-center">Dung lượng vật lý</th>
                    <th className="py-3 px-4 font-medium w-24 text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.length === 0 ? (
                    <tr><td colSpan={5} className="py-12 text-center text-fg-subtle italic">Không tìm thấy tài liệu số hóa nào.</td></tr>
                  ) : (
                    filteredFiles.map((file, idx) => (
                      <tr key={idx} className="border-b border-line hover:bg-hover transition-all font-medium">
                        <td className="py-3.5 px-4 font-mono text-fg-subtle text-center">{idx + 1}</td>
                        <td className="py-3.5 px-4 text-fg flex items-center gap-2 truncate max-w-md"><FileText size={13} className="text-fg-muted shrink-0" /><span className="truncate font-mono">{file.file_name}</span></td>
                        <td className="py-3.5 px-4 text-center font-mono text-emerald-600 dark:text-emerald-400">{file.chunk_count} chunks</td>
                        <td className="py-3.5 px-4 text-center font-mono text-cyan-600 dark:text-cyan-400">{file.file_size}</td>
                        <td className="py-3.5 px-4 text-center">{canManage ? (<button onClick={() => handleDeleteFile(file.file_name)} title="Xóa tệp khỏi Kho tri thức" className="p-1.5 rounded-lg text-fg-subtle hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"><Trash2 size={13} /></button>) : (<span className="text-[10px] text-fg-subtle">Chỉ xem</span>)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

