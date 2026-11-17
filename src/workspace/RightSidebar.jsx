// Thanh bên phải: thông số phân vùng, Kho Dữ liệu (thư mục, tệp, tệp chỉ còn RAG) và đồng bộ Kho Tri thức.
// Tách từ App.jsx: trạng thái và xử lý vẫn nằm ở App, thành phần này chỉ hiển thị và gọi lại qua props.
import React from 'react';
import {
  ShieldCheck, Loader2, ChevronRight, Database, FileText, HardDrive, RefreshCw, Trash2, Eye, Upload, FolderOpen, Search, Eraser, FileX
} from 'lucide-react';
import { SYNC_STATE, formatDateTime } from './constants';

export default function RightSidebar({ activePermission, autoSyncUpload, canManageActive, dataBusyPath, dataCrumbs, dataFileInputRef, dataFiles, dataFilesError, dataFilesLoading, dataFilter, dataFolders, dataNotice, dataSubdir, deleteOneDataFile, isRightSidebarOpen, openDataFile, openDataFolder, ragListError, ragOnlyFiles, refreshDataFiles, removeRagChunks, runFolderSync, selectedColDetails, setAutoSyncUpload, setDataFilter, setSyncForce, syncForce, syncOneDataFile, syncRunning, uploadDataFiles, viewer, visibleDataFiles, visibleDataFolders, visibleRagOnly }) {
  return (
    <aside className={`h-app bg-panel border-l border-line flex flex-col p-4 justify-between transition-all duration-300 shrink-0 max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-40 max-md:overflow-y-auto ${isRightSidebarOpen ? 'w-72 opacity-100 visibility-visible' : 'w-0 p-0 overflow-hidden opacity-0 pointer-events-none'}`}>

      <div className="flex flex-col gap-4 shrink-0">
        <div className="flex items-center justify-between border-b border-line pb-2">
          <span className="text-xs font-bold text-fg-strong tracking-wide flex items-center gap-1.5">
            <HardDrive size={13} className="text-blue-600 dark:text-blue-400" />
            <span>Thông số phân vùng</span>
          </span>
          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-900/30">
            Kho: {selectedColDetails?.display_name || "Đang tải..." }
          </span>
        </div>

        <div className="bg-elevated border border-line rounded-xl p-3 flex flex-col gap-2.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-fg-subtle font-bold uppercase">Mã định danh vùng:</span>
            <span className="text-xs font-mono text-amber-600 dark:text-amber-500 font-semibold">{selectedColDetails.collection_name}</span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-fg-muted flex items-center gap-1.5"><FileText size={12}/> Số lượng tập tin:</span>
            <span className="font-bold text-fg font-mono">{selectedColDetails.file_count} tệp tin</span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-fg-muted flex items-center gap-1.5"><Database size={12}/> Số đoạn (Chunks):</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{selectedColDetails.chunk_count} đoạn</span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-fg-muted flex items-center gap-1.5"><HardDrive size={12}/> Dung lượng thực tế:</span>
            <span className="font-bold text-cyan-600 dark:text-cyan-400 font-mono">{selectedColDetails.storage_size}</span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-fg-muted flex items-center gap-1.5"><ShieldCheck size={12}/> Quyền của bạn:</span>
            <span className={`font-bold ${canManageActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {activePermission === 'manage' ? 'Quản trị' : activePermission === 'read' ? 'Chỉ khai thác' : 'Không truy cập'}
            </span>
          </div>
        </div>

        {/* THÔNG BÁO QUYỀN HẠN TRỰC QUAN KHI CHỈ CÓ QUYỀN KHAI THÁC (vd. Visitor trên Kho Công khai) */}
        {activePermission === 'read' && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-500/30 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
            ⚠️ <b>Chế độ xem giới hạn:</b> Bạn có quyền khai thác hội thoại trên Kho tri thức <b>{selectedColDetails.display_name}</b> nhưng không có quyền nạp, xóa hay đồng bộ dữ liệu.
          </div>
        )}
      </div>

      {/* KHO DỮ LIỆU: TẬP TIN TRÊN MÁY CHỦ BACKEND CỦA KHO ĐANG CHỌN (xem / tải lên / xóa / RAG từng tệp) */}
      <div className="flex-1 min-h-0 flex flex-col gap-2 my-4 pt-3 border-t border-line">
        <div className="flex items-center justify-between gap-2">
          {/* Tiêu đề không xuống dòng; số đếm co lại (cắt chữ) và hiện đầy đủ khi rê chuột */}
          <span className="min-w-0 text-xs font-bold text-fg-strong tracking-wide flex items-center gap-1.5">
            <FolderOpen size={13} className="text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="whitespace-nowrap shrink-0">Kho Dữ liệu</span>
            <span className="min-w-0 truncate text-[10px] font-mono font-normal text-fg-subtle"
              title={`${dataFolders.length} thư mục, ${dataFiles.length} tệp trong thư mục đang xem${ragOnlyFiles.length ? `; ${ragOnlyFiles.length} tệp chỉ còn trong Kho Tri thức` : ''}`}>
              ({dataFolders.length ? `${dataFolders.length} thư mục · ` : ''}{dataFiles.length} tệp{ragOnlyFiles.length ? ` · ${ragOnlyFiles.length} chỉ RAG` : ''})
            </span>
          </span>
          <span className="flex items-center gap-0.5 shrink-0">
            <button onClick={refreshDataFiles} title="Làm mới danh sách tập tin" className="p-1 rounded-md text-fg-muted hover:text-fg-strong hover:bg-hover">
              <RefreshCw size={12} className={dataFilesLoading ? 'animate-spin' : ''} />
            </button>
            {canManageActive && (
              <button onClick={() => dataFileInputRef.current?.click()} disabled={dataBusyPath === '__upload__'} title={dataSubdir ? `Tải tập tin lên thư mục ${dataSubdir}` : "Tải tập tin lên thư mục gốc của Kho Dữ liệu"}
                className="p-1 rounded-md text-fg-muted hover:text-fg-strong hover:bg-hover disabled:opacity-40">
                {dataBusyPath === '__upload__' ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              </button>
            )}
          </span>
        </div>
        <input
          type="file" ref={dataFileInputRef} multiple accept=".pdf,.txt,.md,.docx" className="hidden"
          onChange={(e) => { const picked = Array.from(e.target.files || []); e.target.value = ''; uploadDataFiles(picked); }}
        />

        {canManageActive && (
          <label className="flex items-center gap-1.5 text-[10px] text-fg-muted cursor-pointer select-none">
            <input type="checkbox" checked={autoSyncUpload} onChange={(e) => setAutoSyncUpload(e.target.checked)} className="accent-blue-600" />
            Tự động RAG vào Kho Tri thức khi tải lên
          </label>
        )}

        {/* Thư mục đang xem: bấm vào một cấp để quay lên. Thư mục con chỉ hiện tên, bấm vào mới nạp nội dung bên trong. */}
        <div className="flex items-center flex-wrap gap-x-1 text-[11px] text-fg-muted leading-relaxed">
          <button onClick={() => openDataFolder('')} disabled={!dataSubdir} title="Thư mục gốc của Kho Dữ liệu"
            className={dataSubdir ? 'text-blue-600 dark:text-blue-400 hover:underline' : 'font-semibold text-fg cursor-default'}>Kho</button>
          {dataCrumbs.map((c, i) => (
            <React.Fragment key={c.path}>
              <ChevronRight size={10} className="text-fg-subtle shrink-0" />
              <button onClick={() => openDataFolder(c.path)} disabled={i === dataCrumbs.length - 1} title={c.path}
                className={`max-w-[120px] truncate ${i === dataCrumbs.length - 1 ? 'font-semibold text-fg cursor-default' : 'text-blue-600 dark:text-blue-400 hover:underline'}`}>{c.name}</button>
            </React.Fragment>
          ))}
        </div>

        {dataFolders.length + dataFiles.length + ragOnlyFiles.length > 5 && (
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-fg-subtle" />
            <input value={dataFilter} onChange={(e) => setDataFilter(e.target.value)} placeholder="Lọc trong thư mục đang xem..."
              className="w-full bg-elevated border border-line text-[11px] rounded-lg pl-6 pr-2 py-1.5 text-fg placeholder-fg-subtle focus:outline-none" />
          </div>
        )}

        {dataNotice && (
          <div className={`p-2 rounded-lg border text-[11px] leading-relaxed whitespace-pre-line break-words ${dataNotice.type === 'error' ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400'}`}>
            {dataNotice.text}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col gap-1 -mx-1 px-1">
          {dataFilesError ? (
            <div className="text-[11px] text-red-600 dark:text-red-400 py-2">{dataFilesError}</div>
          ) : (<>
          {visibleDataFolders.map((dir) => (
            <div key={dir.path} className="rounded-lg border border-transparent hover:bg-hover px-2 py-1.5 flex items-center gap-1.5 transition-all">
              <button onClick={() => openDataFolder(dir.path)} title={`Mở thư mục: ${dir.path}`} className="min-w-0 flex-1 text-left flex items-center gap-1.5">
                <FolderOpen size={12} className="shrink-0 text-amber-500" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-medium text-fg truncate">{dir.name}</span>
                  <span className="block text-[10px] text-fg-subtle truncate">{dir.rag_files ? `${dir.rag_files} tệp đã RAG` : 'Chưa RAG tệp nào'}</span>
                </span>
                <ChevronRight size={12} className="shrink-0 text-fg-subtle" />
              </button>
              {canManageActive && (
                <button onClick={() => runFolderSync(dir.path)} disabled={syncRunning}
                  title={`RAG các tệp chưa đồng bộ / đã sửa trong thư mục ${dir.path} (gồm thư mục con)`}
                  className="p-1 rounded-md text-fg-muted hover:text-blue-600 dark:hover:text-blue-400 hover:bg-hover disabled:opacity-40">
                  <RefreshCw size={12} />
                </button>
              )}
            </div>
          ))}
          {visibleDataFolders.length + visibleDataFiles.length === 0 && (
            <div className={`text-[11px] text-fg-subtle italic text-center ${ragOnlyFiles.length ? 'py-2' : 'py-4'}`}>
              {dataFilesLoading ? 'Đang tải danh sách tập tin...'
                : dataFolders.length + dataFiles.length ? 'Không có thư mục, tập tin khớp bộ lọc.'
                : dataSubdir ? 'Thư mục này chưa có tập tin.'
                : canManageActive ? 'Kho chưa có tập tin. Bấm nút tải lên để thêm.' : 'Kho chưa có tập tin.'}
            </div>
          )}
          {visibleDataFiles.map((file) => {
            const st = SYNC_STATE[file.sync_state] || SYNC_STATE.not_synced;
            const busy = dataBusyPath === file.path || (file.rag_id && dataBusyPath === `rag:${file.rag_id}`);
            return (
              <div key={file.path} className={`rounded-lg border px-2 py-1.5 transition-all ${viewer?.path === file.path ? 'border-blue-500/40 bg-active' : 'border-transparent hover:bg-hover'}`}>
                <button onClick={() => openDataFile(file)} title={`Xem nội dung: ${file.path}`} className="w-full text-left flex items-start gap-1.5">
                  <FileText size={12} className="mt-0.5 shrink-0 text-fg-subtle" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-medium text-fg truncate">{file.name}</span>
                    <span className="block text-[10px] text-fg-subtle truncate">{file.size_display}</span>
                  </span>
                </button>
                <div className="flex items-center justify-between mt-1 pl-[18px]">
                  <span className={`text-[10px] flex items-center gap-1 ${st.text}`} title={file.last_sync ? `RAG lần cuối: ${formatDateTime(file.last_sync)}` : 'Chưa đồng bộ vào Kho Tri thức'}>
                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                    {st.label}{file.chunk_count ? ` · ${file.chunk_count} đoạn` : ''}
                  </span>
                  <span className="flex items-center gap-0.5">
                    {busy ? (
                      <Loader2 size={12} className="animate-spin text-fg-muted" />
                    ) : (<>
                      <button onClick={() => openDataFile(file)} title="Xem nội dung" className="p-1 rounded text-fg-muted hover:text-fg-strong hover:bg-elevated"><Eye size={12} /></button>
                      {canManageActive && (
                        <button onClick={() => syncOneDataFile(file)} title="Đồng bộ tập tin vào Kho Tri thức" className="p-1 rounded text-fg-muted hover:text-blue-600 dark:hover:text-blue-400 hover:bg-elevated"><RefreshCw size={12} /></button>
                      )}
                      {canManageActive && file.rag_id && (
                        <button onClick={() => removeRagChunks(file)} title={`Gỡ ${file.chunk_count} đoạn tri thức khỏi Kho Tri thức (giữ tập tin trong Kho Dữ liệu)`} aria-label={`Gỡ đoạn tri thức của ${file.name}`}
                          className="p-1 rounded text-fg-muted hover:text-amber-600 dark:hover:text-amber-400 hover:bg-elevated"><Eraser size={12} /></button>
                      )}
                      {canManageActive && (
                        <button onClick={() => deleteOneDataFile(file)} title="Xóa tập tin (chuyển vào thùng rác) và gỡ đoạn tri thức liên quan" className="p-1 rounded text-fg-muted hover:text-red-600 dark:hover:text-red-400 hover:bg-elevated"><Trash2 size={12} /></button>
                      )}
                    </>)}
                  </span>
                </div>
              </div>
            );
          })}
          </>)}

          {/* TỆP CHỈ CÒN TRONG KHO TRI THỨC: đoạn tri thức vẫn nằm trong PGVector (và vẫn được dùng khi hỏi đáp) dù tập tin
              đã bị xóa / chuyển khỏi Kho Dữ liệu, hoặc được nạp trực tiếp từ AI Chat/Work, Trao đổi trực tuyến */}
          {!dataFilesError && ragListError && (
            <div className="text-[10px] text-amber-700 dark:text-amber-400 py-1">{ragListError}</div>
          )}
          {!dataFilesError && ragOnlyFiles.length > 0 && (
            <div className="mt-2 pt-2 border-t border-dashed border-line flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1"
                title="Các tệp đã RAG: đoạn tri thức vẫn được lưu trong Kho Tri thức (PGVector) và vẫn được dùng khi hỏi đáp, dù tập tin không có trong Kho Dữ liệu.">
                <Database size={11} /> Chỉ còn trong Kho Tri thức ({ragOnlyFiles.length})
              </span>
              {visibleRagOnly.length === 0 && (
                <div className="text-[11px] text-fg-subtle italic py-1 text-center">Không có tệp đã RAG khớp bộ lọc.</div>
              )}
              {visibleRagOnly.map((item) => (
                <div key={item.id} className="rounded-lg border border-transparent hover:bg-hover px-2 py-1.5">
                  <div className="flex items-start gap-1.5" title={item.path || item.name}>
                    <FileX size={12} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-medium text-fg truncate">{item.name}</span>
                      <span className="block text-[10px] text-fg-subtle truncate">
                        {item.origin === 'deleted'
                          ? (item.path && item.path !== item.name ? `${item.path} · ` : '') + 'Tập tin không còn trong Kho Dữ liệu'
                          : 'Nạp trực tiếp, không qua Kho Dữ liệu'}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1 pl-[18px]">
                    <span className="text-[10px] flex items-center gap-1 text-amber-700 dark:text-amber-400"
                      title={item.last_sync ? `RAG lần cuối: ${formatDateTime(item.last_sync)}` : undefined}>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Đã RAG · {item.chunk_count} đoạn · {item.size_display}
                    </span>
                    {dataBusyPath === `rag:${item.id}` ? (
                      <Loader2 size={12} className="animate-spin text-fg-muted" />
                    ) : canManageActive && (
                      <button onClick={() => removeRagChunks(item)} title={`Gỡ ${item.chunk_count} đoạn tri thức của tệp này khỏi Kho Tri thức`} aria-label={`Gỡ đoạn tri thức của ${item.name}`}
                        className="p-1 rounded text-fg-muted hover:text-red-600 dark:hover:text-red-400 hover:bg-elevated"><Eraser size={12} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* KHỐI ĐIỀU KHIỂN NÚT ĐỒNG BỘ NÂNG CAO (RBAC LƠP 2) */}
      <div className="flex flex-col gap-2 shrink-0">
        {!canManageActive ? (
          // Kịch bản 1: Khóa hoàn toàn nút bấm khi vai trò chỉ có quyền khai thác kho đang chọn
          <button
            disabled={true}
            className="w-full bg-elevated border border-line text-fg-subtle font-bold text-xs rounded-xl py-2.5 flex items-center justify-center gap-2 cursor-not-allowed opacity-60"
            title="Vai trò của bạn không có quyền quản trị kho này"
          >
            <RefreshCw size={12} className="text-fg-subtle" />
            <span>Yêu cầu quyền Admin</span>
          </button>
        ) : (
          // Kịch bản 2: vai trò có quyền quản trị kho tự chọn phạm vi RAG (toàn bộ Kho hoặc một thư mục con).
          // Mở Kho và xem danh sách không tự RAG; chỉ tệp chưa RAG / đã sửa được nạp, trừ khi chọn "RAG lại".
          <>
            <label className="flex items-center gap-1.5 text-[10px] text-fg-muted select-none cursor-pointer">
              <input type="checkbox" checked={syncForce} onChange={(e) => setSyncForce(e.target.checked)} disabled={syncRunning} className="accent-blue-600" />
              RAG lại cả tệp đã đồng bộ
            </label>
            <button
              disabled={syncRunning}
              onClick={() => runFolderSync(dataSubdir)}
              title={dataSubdir ? `RAG các tệp chưa đồng bộ / đã sửa trong thư mục ${dataSubdir} (gồm thư mục con)` : 'RAG các tệp chưa đồng bộ / đã sửa của toàn bộ Kho Dữ liệu'}
              className="w-full bg-elevated hover:bg-hover border border-line text-fg font-bold text-xs rounded-xl py-2.5 flex items-center justify-center gap-2 shadow transition-all disabled:opacity-60 disabled:cursor-wait"
            >
              <RefreshCw size={12} className={"text-blue-600 dark:text-blue-400" + (syncRunning ? " animate-spin" : "")} />
              <span>{syncRunning ? 'Đang RAG...' : dataSubdir ? 'RAG thư mục đang xem' : 'Đồng bộ Kho Tri thức'}</span>
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
