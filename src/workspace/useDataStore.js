// Kho Dữ liệu của Kho Tri thức đang chọn (thanh bên phải và trình xem tệp trong khung AI Chat/Work):
// danh sách theo từng cấp thư mục, tệp chỉ còn trong Kho Tri thức, xem / tải / xóa / RAG từng tệp, tải lên, RAG theo thư mục.
// Tách từ App.jsx. Tham số:
//   activeDomain, viewState  : Kho đang chọn và phân cảnh (chỉ nạp danh sách khi ở WORKSPACE)
//   refreshCollections()     : làm mới số tệp / số đoạn của các Kho Tri thức sau khi dữ liệu thay đổi
//   runSync(subdir, force)   : RAG một thư mục và báo kết quả trong khung Chat (do App cung cấp)
import { useRef, useState, useEffect } from 'react';
import iThunderAPI from '../services/api';
import useLatestCallback from '../hooks/useLatestCallback';

export default function useDataStore({ activeDomain, viewState, refreshCollections, runSync }) {
  // Kho Dữ liệu (tập tin trên máy chủ Backend) của kho đang chọn — bảng quản trị ở RightSidebar
  const [dataFiles, setDataFiles] = useState([]);
  const [dataFilesLoading, setDataFilesLoading] = useState(false);
  const [dataFilesError, setDataFilesError] = useState('');
  // Tệp đã RAG nhưng không còn trong Kho Dữ liệu (đã xóa / chuyển chỗ) hoặc nạp trực tiếp vào Kho Tri thức
  const [ragOnlyFiles, setRagOnlyFiles] = useState([]);
  const [ragListError, setRagListError] = useState('');
  const [dataFilter, setDataFilter] = useState('');
  // Kho Dữ liệu được xem theo từng cấp: thư mục đang mở ('' = thư mục gốc) và các thư mục con của nó
  const [dataSubdir, setDataSubdir] = useState('');
  const [dataFolders, setDataFolders] = useState([]);
  // RAG theo yêu cầu: có nạp lại cả tệp đã đồng bộ hay không
  const [syncForce, setSyncForce] = useState(false);
  const [syncRunning, setSyncRunning] = useState(false);
  const [dataNotice, setDataNotice] = useState(null);       // { type: 'success' | 'error' | 'info', text }
  const [dataBusyPath, setDataBusyPath] = useState(null);   // Tệp đang đồng bộ/xóa; '__upload__' khi đang tải lên
  const [autoSyncUpload, setAutoSyncUpload] = useState(true);
  const [viewer, setViewer] = useState(null);               // Tập tin đang xem trong cửa sổ Chat/Work
  const dataFileInputRef = useRef(null);
  const dataRequestRef = useRef(0);                         // Bỏ kết quả cũ khi người dùng đã đổi kho trong lúc chờ
  const viewerRequestRef = useRef(0);
  const dataNoticeTimerRef = useRef(null);

  // =========================================================================
  // QUẢN TRỊ KHO DỮ LIỆU: xem, tải lên, xóa tập tin và đồng bộ từng tập tin vào Kho Tri thức
  // =========================================================================
  const showDataNotice = (type, text) => {
    setDataNotice({ type, text });
    if (dataNoticeTimerRef.current) clearTimeout(dataNoticeTimerRef.current);
    dataNoticeTimerRef.current = setTimeout(() => setDataNotice(null), 10000);
  };

  // target: thư mục cần mở (chuỗi); không truyền (hoặc là sự kiện click) = nạp lại thư mục đang xem
  const refreshDataFiles = async (target) => {
    const subdir = typeof target === 'string' ? target : dataSubdir;
    const requestId = ++dataRequestRef.current;
    setDataFilesLoading(true);
    setDataFilesError('');
    try {
      let res = await iThunderAPI.listDataFiles(activeDomain, subdir);
      // Thư mục đang xem vừa bị xóa / đổi tên trên máy chủ: quay về thư mục gốc của Kho
      if (subdir && res?.status !== "SUCCESS" && requestId === dataRequestRef.current) res = await iThunderAPI.listDataFiles(activeDomain, '');
      if (requestId !== dataRequestRef.current) return;  // Người dùng đã chuyển kho / thư mục trong lúc chờ
      if (res?.status === "SUCCESS" && Array.isArray(res.files)) {
        setDataSubdir(res.subdir || '');
        setDataFolders(Array.isArray(res.folders) ? res.folders : []);
        setDataFiles(res.files);
        setRagOnlyFiles(Array.isArray(res.rag_only) ? res.rag_only : []);
        setRagListError(res.rag_error || '');
      } else {
        setDataFolders([]);
        setDataFiles([]);
        setRagOnlyFiles([]);
        setDataFilesError(res?.detail || "Không đọc được danh sách tập tin của Kho Dữ liệu.");
      }
    } catch {
      if (requestId === dataRequestRef.current) {
        setDataFolders([]);
        setDataFiles([]);
        setRagOnlyFiles([]);
        setDataFilesError("Mất kết nối tới AI Gateway khi đọc Kho Dữ liệu.");
      }
    } finally {
      if (requestId === dataRequestRef.current) setDataFilesLoading(false);
    }
  };

  const closeViewer = () => {
    viewerRequestRef.current += 1;  // Hủy kết quả của lần mở tệp đang chờ (nếu có)
    setViewer(prev => {
      if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
      return null;
    });
  };

  // Mở tệp trong cửa sổ Chat/Work: PDF hiển thị bản gốc, các định dạng khác hiển thị văn bản đã bóc tách
  const openDataFile = async (file) => {
    closeViewer();
    const requestId = viewerRequestRef.current;
    setViewer({ ...file, loading: true });
    try {
      if (file.ext === '.pdf') {
        const res = await iThunderAPI.getDataFileBlob(activeDomain, file.path);
        if (res?.status !== "SUCCESS") throw new Error(res?.detail || "Không mở được tập tin.");
        const blobUrl = URL.createObjectURL(new Blob([res.blob], { type: 'application/pdf' }));
        if (requestId !== viewerRequestRef.current) { URL.revokeObjectURL(blobUrl); return; }
        setViewer(prev => prev && { ...prev, loading: false, blobUrl });
      } else {
        const res = await iThunderAPI.getDataFileText(activeDomain, file.path);
        if (res?.status !== "SUCCESS") throw new Error(res?.detail || "Không mở được tập tin.");
        if (requestId !== viewerRequestRef.current) return;
        setViewer(prev => prev && { ...prev, loading: false, content: res.content, truncated: res.truncated });
      }
    } catch (err) {
      if (requestId === viewerRequestRef.current) {
        setViewer(prev => prev && { ...prev, loading: false, error: err.message || "Không mở được tập tin." });
      }
    }
  };

  const downloadDataFile = async (file) => {
    try {
      const res = await iThunderAPI.getDataFileBlob(activeDomain, file.path);
      if (res?.status !== "SUCCESS") { showDataNotice('error', res?.detail || "Không tải được tập tin."); return; }
      const url = URL.createObjectURL(res.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      showDataNotice('error', "Mất kết nối tới AI Gateway khi tải tập tin.");
    }
  };

  // Gỡ các đoạn tri thức của một tệp đã RAG khỏi Kho Tri thức (tập tin trong Kho Dữ liệu, nếu còn, được giữ nguyên).
  // item: tệp trong Kho Dữ liệu (dùng rag_id) hoặc mục "chỉ còn trong Kho Tri thức" (dùng id)
  const removeRagChunks = async (item) => {
    const ragId = item.rag_id || item.id;
    if (!ragId) return;
    const kept = item.rag_id ? "\n\nTập tin trong Kho Dữ liệu được giữ nguyên và trở về trạng thái Chưa RAG." : "";
    if (!window.confirm(`Gỡ ${item.chunk_count} đoạn tri thức của "${item.name}" khỏi Kho Tri thức?${kept}\n\nKhông hoàn tác được.`)) return;
    setDataBusyPath(`rag:${ragId}`);
    try {
      const res = await iThunderAPI.deleteRagChunks(activeDomain, ragId);
      if (res?.status === "SUCCESS") {
        showDataNotice('success', res.detail);
      } else {
        showDataNotice('error', res?.detail || "Gỡ đoạn tri thức thất bại.");
      }
      await Promise.all([refreshDataFiles(), refreshCollections()]);
    } catch {
      showDataNotice('error', "Mất kết nối tới AI Gateway khi gỡ đoạn tri thức.");
    } finally {
      setDataBusyPath(null);
    }
  };

  const syncOneDataFile = async (file) => {
    setDataBusyPath(file.path);
    try {
      const res = await iThunderAPI.syncDataFile(activeDomain, file.path);
      if (res?.status === "SUCCESS") {
        showDataNotice('success', res.detail);
        await Promise.all([refreshDataFiles(), refreshCollections()]);
      } else {
        showDataNotice('error', res?.detail || "Đồng bộ tập tin thất bại.");
      }
    } catch {
      showDataNotice('error', "Mất kết nối tới AI Gateway khi đồng bộ tập tin.");
    } finally {
      setDataBusyPath(null);
    }
  };

  const deleteOneDataFile = async (file) => {
    if (!window.confirm(`Xóa tập tin "${file.path}" khỏi Kho Dữ liệu?\n\nTập tin được chuyển vào thùng rác (.Trash) của Kho và toàn bộ tri thức RAG liên quan sẽ bị gỡ khỏi Kho Tri thức.`)) return;
    setDataBusyPath(file.path);
    try {
      const res = await iThunderAPI.deleteDataFile(activeDomain, file.path);
      if (res?.status === "SUCCESS") {
        if (viewer?.path === file.path) closeViewer();
        showDataNotice('success', res.detail);
        await Promise.all([refreshDataFiles(), refreshCollections()]);
      } else {
        showDataNotice('error', res?.detail || "Xóa tập tin thất bại.");
      }
    } catch {
      showDataNotice('error', "Mất kết nối tới AI Gateway khi xóa tập tin.");
    } finally {
      setDataBusyPath(null);
    }
  };

  // Tải lên một hoặc nhiều tập tin; trùng tên (HTTP 409) thì hỏi trước khi ghi đè
  const uploadDataFiles = async (files) => {
    if (!files.length) return;
    setDataBusyPath('__upload__');
    const done = [];
    const failed = [];
    for (const file of files) {
      try {
        let res = await iThunderAPI.uploadDataFile(file, activeDomain, { sync: autoSyncUpload, subdir: dataSubdir });
        if (res?.httpStatus === 409) {
          if (!window.confirm(`Tập tin "${file.name}" đã có trong Kho Dữ liệu. Ghi đè bằng bản mới?`)) {
            failed.push(`${file.name}: bỏ qua (đã tồn tại).`);
            continue;
          }
          res = await iThunderAPI.uploadDataFile(file, activeDomain, { sync: autoSyncUpload, overwrite: true, subdir: dataSubdir });
        }
        if (res?.status === "SUCCESS") done.push(res.detail);
        else failed.push(`${file.name}: ${res?.detail || "tải lên thất bại."}`);
      } catch {
        failed.push(`${file.name}: mất kết nối tới AI Gateway.`);
      }
    }
    setDataBusyPath(null);
    showDataNotice(failed.length ? 'error' : 'success', [...done, ...failed].join("\n"));
    await Promise.all([refreshDataFiles(), refreshCollections()]);
  };

  // Nạp danh sách tập tin khi vào Workspace hoặc đổi kho; đóng trình xem tệp của kho trước
  const onDataScopeChange = useLatestCallback(() => {
    closeViewer();
    setDataFilter('');
    setDataNotice(null);  // Thông báo thuộc kho trước, không hiển thị sang kho mới
    setDataSubdir('');     // Kho khác: bắt đầu lại từ thư mục gốc
    if (viewState === 'WORKSPACE') {
      refreshDataFiles('');
    } else {
      dataRequestRef.current += 1;
      setDataFolders([]);
      setDataFiles([]);
      setRagOnlyFiles([]);
    }
  });
  useEffect(() => { onDataScopeChange(); }, [viewState, activeDomain, onDataScopeChange]);

  // Mở một thư mục con (hoặc quay lên thư mục cha): chỉ nạp danh sách của đúng cấp đó
  const openDataFolder = (path) => {
    setDataFilter('');
    refreshDataFiles(path || '');
  };
  // Đường dẫn dạng "docs/2026" -> [{ name: 'docs', path: 'docs' }, { name: '2026', path: 'docs/2026' }]
  const dataCrumbs = dataSubdir.split('/').filter(Boolean).map((name, i, parts) => ({ name, path: parts.slice(0, i + 1).join('/') }));
  const visibleDataFolders = dataFolders.filter(d => d.name.toLowerCase().includes(dataFilter.trim().toLowerCase()));
  // RAG một thư mục con (đệ quy) theo lựa chọn của người dùng; dùng cho nút trên từng thư mục và nút ở cuối thanh bên
  const runFolderSync = async (subdir) => {
    if (syncRunning) return;
    setSyncRunning(true);
    try {
      await runSync(subdir, syncForce);
    } finally {
      setSyncRunning(false);
    }
  };
  const visibleDataFiles = dataFiles.filter(f => f.name.toLowerCase().includes(dataFilter.trim().toLowerCase()));
  const visibleRagOnly = ragOnlyFiles.filter(f => `${f.path || ''} ${f.name}`.toLowerCase().includes(dataFilter.trim().toLowerCase()));

  return {
    dataFiles,
    dataFilesLoading,
    dataFilesError,
    ragOnlyFiles,
    ragListError,
    dataFilter,
    setDataFilter,
    dataSubdir,
    dataFolders,
    syncForce,
    setSyncForce,
    syncRunning,
    dataNotice,
    dataBusyPath,
    autoSyncUpload,
    setAutoSyncUpload,
    viewer,
    dataFileInputRef,
    refreshDataFiles,
    closeViewer,
    openDataFile,
    downloadDataFile,
    removeRagChunks,
    syncOneDataFile,
    deleteOneDataFile,
    uploadDataFiles,
    openDataFolder,
    dataCrumbs,
    visibleDataFolders,
    runFolderSync,
    visibleDataFiles,
    visibleRagOnly,
  };
}
