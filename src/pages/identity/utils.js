/**
 * TARA AI Workspace - Main iThunder AI OS Entry Point (V6.11.01)
 * Hằng số và hàm tiện ích dùng chung của trang Quản trị Định danh.
 * Tách khỏi shared.jsx (chỉ chứa component) để React Fast Refresh hoạt động đúng khi phát triển.
 */

export const STATUS_INFO = {
  active:   { label: 'Đang hoạt động',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50' },
  inactive: { label: 'Chưa có PassCode', cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50' },
  suspended: { label: 'Tạm khóa',       cls: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50' },
  template: { label: 'Tài khoản trống',  cls: 'bg-elevated text-fg-subtle border-line' },
};

export const ROLE_COLORS = {
  admin:      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50',
  manager:    'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900/50',
  member:     'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50',
  partner:    'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-900/50',
  intern:     'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-900/50',
  active:     'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/50',
  idle:       'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-900/50',
  shared:     'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900/50',
  graded:     'bg-lime-50 text-lime-700 border-lime-200 dark:bg-lime-950/30 dark:text-lime-400 dark:border-lime-900/50',
  stoped:     'bg-stone-100 text-stone-600 border-stone-300 dark:bg-stone-900/40 dark:text-stone-400 dark:border-stone-700',
  suspended:  'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
  registered: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50',
};

export const ACTION_LABELS = {
  'user.provision': 'Cấp tài khoản',
  'user.profile.update': 'Sửa hồ sơ',
  'user.roles.change': 'Đổi vai trò',
  'user.email.add': 'Thêm email',
  'user.email.remove': 'Xóa email',
  'user.passcode.reset': 'Cấp lại PassCode',
  'user.deactivate': 'Vô hiệu hóa',
  'user.passtime.set': 'Đặt PassTime',
  'user.faceid.reset': 'Xóa FaceID',
  'user.recycle': 'Thu hồi tài khoản',
  'self.profile.update': 'Tự sửa hồ sơ',
  'self.email.add': 'Tự thêm email',
  'self.email.remove': 'Tự xóa email',
  'security.step_up': 'Xác nhận PassCode',
  'user.import': 'Nạp CSV',
  'import.create': 'Nạp CSV: cấp tài khoản',
  'import.update': 'Nạp CSV: cập nhật',
  'import.recycle': 'Nạp CSV: thu hồi',
  'user.export': 'Xuất CSV',
  'unit.create': 'Đăng ký nhóm (cũ)',
  'unit.update': 'Sửa mô tả nhóm (cũ)',
  'unit.sync': 'Đồng bộ memberUid (cũ)',
  'cloud.allocate': 'Cấp phát phân vùng',
  'cloud.update': 'Sửa phân vùng',
  'cloud.members': 'Đổi thành viên phân vùng',
  'cloud.recycle': 'Thu hồi phân vùng',
  'knowledge.restore': 'Khôi phục Kho Tri thức',
  'knowledge.open': 'Mở Kho phân vùng Private (admin)',
  'mcp.server.create': 'Đăng ký MCP Server',
  'mcp.server.update': 'Sửa MCP Server',
  'mcp.server.delete': 'Gỡ MCP Server',
  'comm.conversation.create': 'Tạo hội thoại nhóm',
  'comm.members.add': 'Thêm thành viên hội thoại',
  'comm.members.remove': 'Bớt thành viên hội thoại',
};

export const formatDateTime = (value) => {
  if (!value) return '';
  const d = typeof value === 'number' ? new Date(value) : new Date(value);
  return isNaN(d) ? String(value) : d.toLocaleString('vi-VN', { hour12: false });
};

export const formatHours = (ms) => {
  if (ms === null || ms === undefined) return 'Mặc định';
  const minutes = Math.round(ms / 60000);
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h ? `${h} giờ${m ? ` ${m} phút` : ''}` : `${m} phút`;
};

// Giá trị ou mà người gọi được gỡ: Quản trị Đơn vị chỉ gỡ vai trò thường thuộc đơn vị của mình
export const canTouchRole = (roleValue, scopeUnits, policy = null) => {
  const [, role, ...rest] = roleValue.split(':');
  const unit = rest.join(':');
  if (policy) return policy.roles.includes(role) && (unit ? policy.units.includes(unit) : policy.unitless_roles.includes(role));
  if (!Array.isArray(scopeUnits)) return true;
  return role !== 'admin' && role !== 'manager' && role !== 'suspended' && scopeUnits.includes(unit);
};
