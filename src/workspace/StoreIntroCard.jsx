// Thẻ trạng thái Kho Tri thức đang làm việc ở đầu khung AI Chat/Work.
// Tách từ App.jsx: trạng thái và xử lý vẫn nằm ở App, thành phần này chỉ hiển thị và gọi lại qua props.
import {
  Database
} from 'lucide-react';
import { storeScopeLabel, storeDescription, storeIconOf } from './constants';

export default function StoreIntroCard({ activeCollection, canManageActive, focusStorePicker, storeList, workspaceOrgName }) {
  const ActiveStoreIcon = storeIconOf(activeCollection);
  return (
    <div className="w-full bg-card border-line border rounded-xl p-4 shadow-sm flex flex-col gap-1">
      <div className="text-sm font-bold text-fg flex items-center gap-2">
        <Database size={15} className="text-blue-600 dark:text-blue-400" />
        <span>Hệ thống Quản lý Phân vùng Kho Tri thức tự động</span>
      </div>
      {activeCollection ? (<>
        <div className="text-[13px] text-fg-muted flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span>Không gian làm việc của <b className="text-fg">{workspaceOrgName}</b> đã sẵn sàng với Kho Tri thức</span>
          <span className="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-md bg-blue-600/10 border border-blue-500/30 text-fg-strong font-semibold">
            <ActiveStoreIcon size={12} className="shrink-0 text-blue-600 dark:text-blue-400" />
            <span className="truncate">{activeCollection.display_name}</span>
          </span>
          <span className="text-fg-subtle">({storeScopeLabel(activeCollection)})</span>
        </div>
        {storeDescription(activeCollection) && (
          <span className="text-[13px] text-fg leading-relaxed break-words">{storeDescription(activeCollection)}</span>
        )}
        <div className="text-[11px] text-fg-subtle flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
          <span>{activeCollection.file_count} tệp · {activeCollection.chunk_count} đoạn tri thức</span>
          <span className={canManageActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
            Quyền của bạn: {canManageActive ? 'Quản trị' : 'Chỉ khai thác'}
          </span>
          {storeList.length > 1 && (
            <button type="button" onClick={focusStorePicker} className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
              Chọn Kho Tri thức khác ({storeList.length})
            </button>
          )}
        </div>
      </>) : (
        <span className="text-[13px] text-fg-muted">Không gian làm việc đã sẵn sàng...</span>
      )}
    </div>
  );
}
