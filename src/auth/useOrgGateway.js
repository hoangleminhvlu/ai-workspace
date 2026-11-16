// Tổ chức sở hữu AI Gateway (/api/org/info) và AI Gateway đang dùng (ứng dụng máy trạm chọn trên trang Đăng nhập).
// Tách từ App.jsx. onGatewayChange(): App đặt lại trạng thái đăng nhập gắn với AI Gateway cũ khi người dùng đổi AI Gateway.
// Trả setOrgInfo để App bổ sung Tổ chức từ /api/auth/me khi AI Gateway chưa phản hồi /api/org/info.
import { useEffect, useRef, useState } from 'react';
import iThunderAPI, { gatewayAPI } from '../services/api';
import useLatestCallback from '../hooks/useLatestCallback';
import { ORG_LOADING, CLIENT_APP } from './gatewayUtils';

export default function useOrgGateway({ onGatewayChange }) {
  // Tổ chức sở hữu AI Gateway này (đọc trước khi đăng nhập; trong Workspace được bổ sung từ /api/auth/me)
  const [orgInfo, setOrgInfo] = useState(ORG_LOADING);
  // AI Gateway đang dùng ('' khi ứng dụng máy trạm chưa chọn); fresh: vừa đổi AI Gateway => không giữ Tổ chức cũ
  const [activeGateway, setActiveGateway] = useState(() => gatewayAPI.current());
  const orgRequestRef = useRef(0);
  const loadOrgInfo = async ({ fresh = false } = {}) => {
    const request = ++orgRequestRef.current;   // chỉ nhận kết quả của lần đọc mới nhất (đổi AI Gateway liên tiếp)
    setOrgInfo(prev => (!fresh && prev.status === 'ok' ? prev : ORG_LOADING));
    const res = await iThunderAPI.getOrgInfo();
    if (request !== orgRequestRef.current) return false;
    if (res?.status === 'SUCCESS' && res.org_id) {
      setOrgInfo({
        status: 'ok', orgId: res.org_id, orgName: res.org_name || res.org_id, orgUrl: res.org_url || '', location: res.location || '',
        network: res.network || '', switchEnabled: !!res.switch_enabled, organizations: Array.isArray(res.organizations) ? res.organizations : []
      });
      return true;
    }
    setOrgInfo(prev => (!fresh && prev.status === 'ok' ? prev : { ...ORG_LOADING, status: 'error', detail: res?.detail || '' }));
    return false;
  };

  // Ứng dụng máy trạm: kết nối thử AI Gateway ứng viên; chỉ ghi nhớ khi xác thực PassCode thành công (gatewayAPI.commit)
  const connectGateway = async (url) => {
    gatewayAPI.setCandidate(url);
    setActiveGateway(gatewayAPI.current());
    onGatewayChange();   // App: bỏ đề nghị trở thành Khách, thông báo lỗi và kênh FaceID của AI Gateway cũ
    return loadOrgInfo({ fresh: true });
  };

  // Mở trang: Web đọc Tổ chức của chính tên miền. Ứng dụng máy trạm chưa ghi nhớ AI Gateway thì tự dò chính địa chỉ
  // đang mở (dev proxy / AI Gateway phục vụ luôn giao diện) rồi DEFAULT_GATEWAY_URL; không được thì chờ người dùng nhập.
  // Chỉ DÒ (không đổi AI Gateway ứng viên) cho tới khi tìm được địa chỉ phản hồi: hai lượt dò chạy cùng lúc (React
  // StrictMode chạy effect hai lần khi phát triển) không làm lượt này hủy kết quả của lượt kia.
  const loadOrgInfoOnMount = useLatestCallback(async () => {
    if (!CLIENT_APP || gatewayAPI.saved()) { loadOrgInfo(); return; }
    const order = gatewayAPI.discoveryOrder();
    for (const url of order) {
      const res = await iThunderAPI.getOrgInfo(url);
      if (res?.status === 'SUCCESS' && res.org_id) { await connectGateway(url); return; }
    }
    if (order.length) await connectGateway(order[order.length - 1]);   // hiện lỗi kèm địa chỉ để người dùng sửa
    else setOrgInfo({ ...ORG_LOADING, status: 'none' });
  });
  useEffect(() => { loadOrgInfoOnMount(); }, [loadOrgInfoOnMount]);

  // Tiêu đề thẻ trình duyệt kèm Mã Tổ chức: phân biệt khi mở AI Workspace của nhiều Tổ chức cùng lúc
  useEffect(() => {
    document.title = orgInfo.status === 'ok' ? `${orgInfo.orgId} · iThunder AI Workspace` : 'iThunder AI Workspace';
  }, [orgInfo.status, orgInfo.orgId]);

  return { orgInfo, setOrgInfo, activeGateway, loadOrgInfo, connectGateway };
}
