// Thanh tiêu đề cửa sổ AI Chat/Work: Tổ chức, Kho Tri thức đang dùng, giao diện sáng/tối, chọn mô hình AI.
// Tách từ App.jsx: trạng thái và xử lý vẫn nằm ở App, thành phần này chỉ hiển thị và gọi lại qua props.
import {
  Sun, Moon, Sparkles, Menu, Building2
} from 'lucide-react';
import { storeScopeLabel, storeDescription, storeIconOf } from './constants';

export default function ChatHeader({ activeCollection, chatModels, focusStorePicker, isLeftSidebarOpen, modelGroups, modelKey, modelLabel, orgInfo, refreshChatModels, selectedModel, selectedRuntime, selectModel, setIsLeftSidebarOpen, setTheme, theme, workspaceOrgName }) {
  const ActiveStoreIcon = storeIconOf(activeCollection);
  return (
    <header className="h-14 border-b border-line bg-panel px-3 sm:px-4 flex items-center justify-between gap-2 shrink-0">
      {/* flex-1 min-w-0: trên điện thoại khối tiêu đề co lại (cắt chữ) thay vì bị nút theme / ô chọn mô hình đè lên */}
      <div className="flex flex-1 items-center gap-2 min-w-0">
        {!isLeftSidebarOpen && (
          <button onClick={() => setIsLeftSidebarOpen(true)} aria-label="Mở thanh bên trái" className="p-1 text-fg-muted hover:text-fg-strong mr-1 shrink-0"><Menu size={16} /></button>
        )}
        <Sparkles size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
        <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider text-fg whitespace-nowrap">AI Chat/Work</span>
        {/* Màn hình rộng: nhắc Tổ chức ngay trên thanh tiêu đề (màn hình hẹp: chú thích khi rê chuột lên dòng tiêu đề của Left Sidebar) */}
        <span className="hidden xl:inline-flex items-center gap-1 min-w-0 max-w-[22rem] text-[11px] text-fg-muted" title={`AI Workspace của ${workspaceOrgName}`}>
          <span className="text-fg-subtle">·</span>
          <Building2 size={12} className="shrink-0 text-blue-600 dark:text-blue-400" />
          <span className="truncate">{workspaceOrgName}</span>
          {orgInfo.orgId && <span className="shrink-0 font-mono text-fg-subtle">({orgInfo.orgId})</span>}
        </span>
        {/* Kho Tri thức đang làm việc (tương đương Project của phiên Chat/Work): bấm để chọn Kho khác ở thanh bên */}
        {activeCollection && (
          <button type="button" onClick={focusStorePicker}
            title={`Kho Tri thức đang dùng: ${activeCollection.display_name}${storeDescription(activeCollection) ? ` – ${storeDescription(activeCollection)}` : ''} (${storeScopeLabel(activeCollection)}). Bấm để chọn Kho khác.`}
            className="inline-flex items-center gap-1 min-w-0 max-w-[9rem] sm:max-w-[14rem] lg:max-w-[20rem] text-[11px] text-fg-muted hover:text-fg-strong rounded-md px-1 py-0.5 hover:bg-hover transition-all">
            <span className="hidden sm:inline text-fg-subtle">·</span>
            <ActiveStoreIcon size={12} className="shrink-0 text-blue-600 dark:text-blue-400" />
            <span className="hidden lg:inline shrink-0 text-fg-subtle">Kho Tri thức:</span>
            <span className="truncate font-semibold text-fg">{activeCollection.display_name}</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">

        {/* --- NÚT BẤM CHUYỂN ĐỔI STYLE LIGHT / DARK THEME MỚI --- */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-xl bg-elevated border border-line text-fg-muted hover:text-fg-strong transition-all shadow-sm flex items-center justify-center"
          title={theme === 'dark' ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
        >
          {theme === 'dark' ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-indigo-600 dark:text-indigo-400" />}
        </button>

        <select
          value={modelKey(selectedRuntime, selectedModel)}
          onChange={e => selectModel(e.target.value)}
          onFocus={refreshChatModels}
          title={(() => {
            const model = chatModels.find(m => m.name === selectedModel && m.runtime === selectedRuntime);
            return model ? `${model.runtime_name} · ${model.capabilities.join(', ')}` : selectedModel;
          })()}
          aria-label="Chọn mô hình AI"
          className="bg-elevated border border-line text-xs rounded-lg px-2 sm:px-2.5 py-1.5 text-fg focus:outline-none font-medium cursor-pointer max-w-[9.5rem] sm:max-w-[320px]"
        >
          {chatModels.length === 0 && <option value={modelKey(selectedRuntime, selectedModel)}>{selectedModel}</option>}
          {modelGroups.length === 1
            ? modelGroups[0].models.map(model => (
                <option key={modelKey(model.runtime, model.name)} value={modelKey(model.runtime, model.name)}>{modelLabel(model)}</option>
              ))
            : modelGroups.map(group => (
                <optgroup key={group.runtime} label={group.name}>
                  {group.models.map(model => (
                    <option key={modelKey(model.runtime, model.name)} value={modelKey(model.runtime, model.name)}>{modelLabel(model)}</option>
                  ))}
                </optgroup>
              ))}
        </select>

      </div>
    </header>
  );
}
