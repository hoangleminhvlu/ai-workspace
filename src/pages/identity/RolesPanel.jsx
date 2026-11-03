/**
 * TARA AI Workspace - Main iThunder AI OS Entry Point (V6.11.01)
 * Tập tin tạo lập môi trường quản trị định danh người dùng.
 */

import React from 'react';
import { Check, Eye, Minus } from 'lucide-react';
import { RoleChip, Section } from './shared';

const IDENTITY_PERMISSION_LABELS = {
  'identity.users.read': 'Tra cứu người dùng',
  'identity.users.write': 'Cấp, sửa, thu hồi tài khoản',
  'identity.roles.assign': 'Gán vai trò, đơn vị, tạm khóa',
  'identity.security.reset': 'PassCode, PassTime, FaceID',
  'identity.import': 'Nạp/xuất CSV',
  'identity.audit.read': 'Xem nhật ký',
  'identity.groups.manage': 'Cấp phát, sửa, thu hồi phân vùng',
};

const PermissionCell = ({ value }) => {
  if (value === 'manage') return <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><Check size={12} />Quản trị</span>;
  if (value === 'read') return <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"><Eye size={12} />Khai thác</span>;
  return <Minus size={12} className="text-fg-subtle opacity-50" aria-label="Không truy cập" />;
};

// Danh mục vai trò Workspace (khai báo trong config.py của Backend) và các nhóm/đơn vị đang dùng trên OpenLDAP
export default function RolesPanel({ catalog }) {
  if (!catalog) return <p className="text-xs text-fg-subtle">Đang tải danh mục vai trò...</p>;
  const storageKeys = [...new Set(catalog.roles.flatMap(r => Object.keys(r.storage_permissions)))];
  const permissionKeys = Object.keys(IDENTITY_PERMISSION_LABELS);

  return (
    <div className="flex flex-col gap-4">
      <Section title="Ma trận quyền theo vai trò">
        <p className="text-[11px] text-fg-muted">
          Khi một người có nhiều vai trò, vai trò ưu tiên cao nhất được dùng. Danh mục và ma trận quyền khai báo trong <code className="font-mono">config.py</code> (ROLE_CATALOG, STORAGE_PERMISSIONS, IDENTITY_PERMISSIONS).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-line text-fg-muted">
                <th className="py-2 pr-4 font-medium">Vai trò</th>
                <th className="py-2 pr-4 font-medium text-right">Người dùng</th>
                {storageKeys.map(k => <th key={k} className="py-2 pr-4 font-medium">Kho {k}</th>)}
                <th className="py-2 pr-4 font-medium">Quản trị Định danh</th>
              </tr>
            </thead>
            <tbody>
              {catalog.roles.map(r => (
                <tr key={r.role} className="border-b border-line last:border-0 align-top">
                  <td className="py-2 pr-4"><div className="font-semibold text-fg-strong">{r.label}</div><div className="text-[10px] font-mono text-fg-subtle">{r.role}{r.scoped ? ':<đơn vị>' : ''} · ưu tiên {r.priority}</div>{r.scoped && <div className="text-[10px] text-orange-600 dark:text-orange-400">Chỉ trong đơn vị được giao</div>}</td>
                  <td className="py-2 pr-4 text-right font-mono">{r.member_count}</td>
                  {storageKeys.map(k => <td key={k} className="py-2 pr-4 whitespace-nowrap"><PermissionCell value={r.storage_permissions[k]} /></td>)}
                  <td className="py-2 pr-4 text-[11px] text-fg-muted">
                    {r.identity_permissions.length ? r.identity_permissions.filter(p => permissionKeys.includes(p)).map(p => IDENTITY_PERMISSION_LABELS[p]).join(', ') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={`Giá trị vai trò (ou) đang dùng trong ${catalog.org_id}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-line text-fg-muted">
                <th className="py-2 pr-4 font-medium">Giá trị ou</th>
                <th className="py-2 pr-4 font-medium">Mô tả</th>
                <th className="py-2 pr-4 font-medium text-right">Người dùng</th>
              </tr>
            </thead>
            <tbody>
              {catalog.groups.map(g => (
                <tr key={g.value} className="border-b border-line last:border-0">
                  <td className="py-2 pr-4"><RoleChip role={g} /></td>
                  <td className="py-2 pr-4 text-fg-muted">{g.label || <span className="italic text-fg-subtle">Chưa khai báo trong GROUP_LIST</span>}</td>
                  <td className="py-2 pr-4 text-right font-mono">{g.member_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
