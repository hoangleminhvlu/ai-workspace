/**
 * TARA AI Platform - Main Entry Point (V6.09.11)
 * Tập tin điều phối môi trường Desktop App độc lập cho máy trạm.
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import App from './App'; // Component giao diện chính chứa Workspace/Login tích hợp của bạn
import KnowledgeManager from './pages/KnowledgeManager'; // Trang phụ quản trị nâng cao chuyên sâu
import AnalyticsDashboard from './pages/AnalyticsDashboard'; // Trang phụ thống kê tải GPU/Hạ tầng
import IdentityManager from './pages/IdentityManager'; // Trang phụ Quản trị Định danh (OpenLDAP)
import McpManager from './pages/McpManager'; // Trang phụ Tích hợp MCP (MCP Server /api/mcp và MCP Server bên ngoài)
import CommManager from './pages/CommManager'; // Trang phụ Trao đổi trực tuyến (Text Chat người dùng/nhóm/Trợ lý AI)
import HistoryManager from './pages/HistoryManager'; // Trang phụ Lịch sử Làm việc (phiên hội thoại trên các Kho Tri thức)

// --- RÀO CHẮN BẢO MẬT PHÂN QUYỀN (ROUTER GUARD) ---
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("tara_token");

  // Nếu chưa quét FaceID hoặc chưa đăng nhập, cưỡng bức nhảy về màn hình gốc
  if (!token || token === "None") {
    return <Navigate to="/" replace />;
  }
  return children;
};

// Giám sát Hệ thống chỉ dành cho vai trò admin (Backend vẫn kiểm tra SYSTEM_MONITOR_ROLES ở từng API)
const AdminRoute = ({ children }) => {
  let role = '';
  try { role = JSON.parse(localStorage.getItem("tara_user") || "null")?.userRole || ''; } catch { /* phiên hỏng: coi như không phải admin */ }
  return role === 'admin' ? <ProtectedRoute>{children}</ProtectedRoute> : <Navigate to="/" replace />;
};

export default function AppRoutes() {
  return (
    <Routes>
      {/* 1. Trang chủ tích hợp (Chứa các state chuyển đổi LOGIN -> FACEID -> WORKSPACE) */}
      <Route path="/" element={<App />} />

      {/* 2. Trang phụ Quản trị Kho Tri thức chuyên sâu phong cách NotebookLM */}
      <Route 
        path="/knowledge" 
        element={
          <ProtectedRoute>
            <KnowledgeManager />
          </ProtectedRoute>
        } 
      />

      {/* 3. Trang phụ Giám sát tài nguyên máy chủ AI (GPU, Chunks, Octet Size) */}
      <Route 
        path="/analytics" 
        element={
          <AdminRoute>
            <AnalyticsDashboard />
          </AdminRoute>
        } 
      />

      {/* 4. Trang phụ Quản trị Định danh: người dùng, vai trò, nhóm (quản trị viên) và hồ sơ cá nhân (mọi thành viên) */}
      <Route
        path="/identity"
        element={
          <ProtectedRoute>
            <IdentityManager />
          </ProtectedRoute>
        }
      />

      {/* 5. Trang phụ Tích hợp MCP: kết nối Claude Desktop/Claude Code (mọi thành viên), MCP Server bên ngoài (quản trị viên) */}
      <Route
        path="/mcp"
        element={
          <ProtectedRoute>
            <McpManager />
          </ProtectedRoute>
        }
      />

      {/* 6. Trang phụ Trao đổi trực tuyến: nhắn tin người dùng ↔ người dùng / nhóm / Trợ lý AI (dữ liệu lưu ở Backend) */}
      <Route
        path="/comm"
        element={
          <ProtectedRoute>
            <CommManager />
          </ProtectedRoute>
        }
      />

      {/* 7. Trang phụ Lịch sử Làm việc: xem lại, tiếp tục hoặc xóa phiên hội thoại của chính người dùng */}
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <HistoryManager />
          </ProtectedRoute>
        }
      />

      {/* Rẽ nhánh dự phòng: Mọi đường dẫn không hợp lệ đều chuyển hướng về trang chủ */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
