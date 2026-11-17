// Thanh bên trái của AI Workspace: chức năng, Kho Tri thức (RAG), Định danh, người dùng và Đăng xuất.
// Tách từ App.jsx: trạng thái và xử lý vẫn nằm ở App, thành phần này chỉ hiển thị và gọi lại qua props.
import {
  LogOut, Database, Eye, X, Users, UserCircle, MessagesSquare, FolderKanban, Globe, History, Activity
} from 'lucide-react';
import { getStoragePermission } from '../services/api';
import { STORE_GROUPS, storeGroup, storeLabel, storeDescription, ROLE_BADGE } from './constants';
import { CLIENT_APP, gatewayHost } from '../auth/gatewayUtils';

export default function LeftSidebar({ activeDomain, activeGateway, activeOther, handleClosePublicCloud, handleLogout, handleSelectDomain, identityPermissions, isLeftSidebarOpen, navigate, orgInfo, otherStores, personalStore, setShowPublicClouds, userData, workspaceOrgName }) {
  return (
    <aside className={`h-app bg-panel border-r border-line flex flex-col justify-between transition-all duration-300 shrink-0 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 ${isLeftSidebarOpen ? 'w-64 opacity-100 visibility-visible' : 'w-0 opacity-0 pointer-events-none'}`}>
      {/* Dòng tiêu đề cao bằng thanh tiêu đề của cửa sổ AI Chat/Work (h-14). Tổ chức đang làm việc đã hiện ở cửa sổ AI Chat/Work;
          ở đây chỉ còn trong chú thích khi rê chuột, kèm cách chuyển sang Tổ chức khác. */}
      <div className="h-14 px-4 border-b border-line flex items-center gap-2 shrink-0"
        title={`AI Workspace của ${workspaceOrgName}${orgInfo.orgId ? ` (${orgInfo.orgId})` : ''}.${CLIENT_APP && activeGateway ? ` AI Gateway: ${gatewayHost(activeGateway)}.` : ''} Cần làm việc với Tổ chức khác? ${CLIENT_APP ? 'Hãy Đăng xuất rồi đổi AI Gateway trên trang Đăng nhập.' : orgInfo.switchEnabled ? 'Hãy Đăng xuất rồi chọn Tổ chức ngay trên trang Đăng nhập.' : 'Hãy Đăng xuất rồi truy cập AI Gateway của Tổ chức đó.'}`}>
        <h2 className="text-sm font-bold text-fg-strong tracking-wide truncate">iThunder AI Workspace</h2>
      </div>

      {/* Phần giữa cuộn được; khung người dùng + Đăng xuất (shrink-0) luôn nằm ở đáy thanh bên */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col p-4 gap-4">
        {/* Logo giữ nguyên một dòng riêng, kích thước 80px; nằm trong phần cuộn được nên màn hình thấp vẫn tới được mọi nút menu */}
        <img src="/logo.png" alt="iThunder Logo" className="w-40 h-20 object-contain shrink-0" />
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold text-fg-subtle uppercase tracking-wider">CHỨC NĂNG</span>
          <div className="flex flex-col gap-1">
            {/* Trang Kho Tri thức và Tích hợp MCP mở bằng lệnh nhanh /knowledge, /mcp trong khung Chat */}
            {/* Ẩn với Khách (tài khoản dùng chung); Backend vẫn kiểm tra COMM_ROLES ở từng API */}
            {userData.userRole !== 'visitor' && (
              <button onClick={() => navigate('/comm')} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium hover:bg-hover text-fg-muted transition-all">
                <MessagesSquare size={13} className="text-fg-subtle" />
                <span>Trao đổi trực tuyến</span>
              </button>
            )}
            <button onClick={() => navigate('/history')} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium hover:bg-hover text-fg-muted transition-all">
              <History size={13} className="text-fg-subtle" />
              <span>Lịch sử Làm việc</span>
            </button>
            {/* Chỉ hiện với vai trò admin; Backend vẫn kiểm tra SYSTEM_MONITOR_ROLES ở từng API */}
            {userData.userRole === 'admin' && (
              <button onClick={() => navigate('/analytics')} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium hover:bg-hover text-fg-muted transition-all">
                <Activity size={13} className="text-fg-subtle" />
                <span>Giám sát Hệ thống</span>
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold text-fg-subtle uppercase tracking-wider">KHO TRI THỨC (RAG)</span>
          <div className="flex flex-col gap-1">

            {/* Chỉ Kho Cá nhân hiện đầy đủ (số tệp); các Kho còn lại (Tổ chức, Dự án được tham gia, phân vùng Public đã mở)
                chọn qua danh sách theo tên để thanh bên không tràn chiều cao khi người dùng có nhiều Kho */}
            {personalStore && (
              <button onClick={() => handleSelectDomain(personalStore)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${activeDomain === personalStore.storage_key ? 'bg-blue-600/15 border border-blue-500/40 text-fg-strong' : 'hover:bg-hover text-fg-muted'}`}>
                <span className="flex items-center gap-2 min-w-0">
                  <Database size={13} className={activeDomain === personalStore.storage_key ? 'text-blue-600 dark:text-blue-400' : 'text-fg-subtle'} />
                  <span className="truncate" title={storeDescription(personalStore) || undefined}>{personalStore.display_name}</span>
                </span>
                <span className="text-[10px] bg-elevated text-fg-muted px-1.5 py-0.5 rounded-md font-mono shrink-0">{personalStore.file_count} tệp</span>
              </button>
            )}

            {otherStores.length > 0 && (
              <div className={`flex flex-col gap-1.5 rounded-lg p-2 mt-1 ${activeOther ? 'bg-blue-600/10 border border-blue-500/40' : 'border border-line'}`}>
                <label htmlFor="sidebar-store-select" className="text-[10px] font-semibold text-fg-subtle flex items-center gap-1">
                  <FolderKanban size={11} />Kho Tổ chức và Dự án ({otherStores.length})
                </label>
                <select id="sidebar-store-select" value={activeOther ? activeOther.storage_key : ''}
                  onChange={e => { const col = otherStores.find(c => c.storage_key === e.target.value); if (col) handleSelectDomain(col); }}
                  className="w-full bg-elevated border border-line text-xs rounded-md px-2 py-1.5 text-fg focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                  <option value="" disabled>Chọn Kho Tri thức...</option>
                  {STORE_GROUPS.map(g => {
                    const list = otherStores.filter(c => storeGroup(c) === g.id);
                    return list.length > 0 && (
                      <optgroup key={g.id} label={g.label}>
                        {list.map(c => (
                          <option key={c.storage_key} value={c.storage_key}>
                            {storeLabel(c)}{getStoragePermission(c, userData.userRole) === 'read' ? ' (chỉ khai thác)' : ''}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
                {activeOther && (
                  <div className="flex items-center gap-1.5 text-[10px] text-fg-muted min-w-0">
                    <span className="truncate flex-1" title={`${storeLabel(activeOther)}${storeDescription(activeOther) ? ` – ${storeDescription(activeOther)}` : ''}`}>
                      {storeDescription(activeOther) || activeOther.display_name}
                    </span>
                    {getStoragePermission(activeOther, userData.userRole) === 'read' && (
                      <Eye size={11} className="text-amber-600 dark:text-amber-400 shrink-0" title="Chỉ khai thác" aria-label="Chỉ khai thác" />
                    )}
                    <span className="bg-elevated px-1.5 py-0.5 rounded-md font-mono shrink-0">{activeOther.file_count} tệp</span>
                    {activeOther.opened && (
                      <button onClick={() => handleClosePublicCloud(activeOther)} title="Gỡ khỏi danh mục" aria-label={`Gỡ ${storeLabel(activeOther)} khỏi danh mục`}
                        className="p-1 rounded-md text-fg-subtle hover:text-red-600 dark:hover:text-red-400 hover:bg-hover shrink-0">
                        <X size={11} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <button onClick={() => setShowPublicClouds(true)}
              className="w-full flex items-center gap-2 px-3 py-2 mt-1 rounded-lg text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:bg-hover transition-all">
              <Globe size={13} />
              <span>{userData.userRole === 'admin' ? 'Mở Kho phân vùng...' : 'Mở phân vùng Public...'}</span>
            </button>

          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold text-fg-subtle uppercase tracking-wider">ĐỊNH DANH</span>
          <div className="flex flex-col gap-1">
            {/* Chỉ hiện với vai trò có quyền identity.users.read; Backend vẫn kiểm tra quyền ở từng API */}
            {identityPermissions.includes('identity.users.read') && (
              <button onClick={() => navigate('/identity?tab=users')} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium hover:bg-hover text-fg-muted transition-all">
                <Users size={13} className="text-fg-subtle" />
                <span>Quản trị Định danh</span>
              </button>
            )}
            <button onClick={() => navigate('/identity?tab=me')} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium hover:bg-hover text-fg-muted transition-all">
              <UserCircle size={13} className="text-fg-subtle" />
              <span>Hồ sơ cá nhân</span>
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-2.5 border-t border-line bg-app shrink-0 flex flex-col gap-1.5">
        {/* Họ tên (Mã ID) và vai trò: không cần tiêu đề, phân biệt bằng màu; rê chuột lên để xem đầy đủ */}
        <div className="flex items-center gap-1 min-w-0 text-[12px]"
          title={`${userData.userName}\nMã ID: ${userData.ownerId || '—'}\nVai trò: ${ROLE_BADGE[userData.userRole]?.label || userData.userRole} (${userData.userRole})`}>
          <UserCircle size={14} className="shrink-0 text-fg-subtle" />
          <span className="truncate font-semibold text-fg-strong">{userData.userName}</span>
          {userData.ownerId && <span className="shrink-0 font-mono text-[11px] text-blue-600 dark:text-blue-400">({userData.ownerId})</span>}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider truncate ${(ROLE_BADGE[userData.userRole] || ROLE_BADGE.visitor).cls}`}
            title={`Vai trò: ${ROLE_BADGE[userData.userRole]?.label || userData.userRole}`}>
            {ROLE_BADGE[userData.userRole]?.label || userData.userRole}
          </span>
        <button
          onClick={handleLogout}
          title="Đăng xuất hệ thống"
          className="shrink-0 flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium px-2 py-1 rounded-md hover:bg-hover transition-all"
        >
          <LogOut size={13}/> <span>Đăng xuất</span>
        </button>
        </div>
      </div>
    </aside>
  );
}
