/**
 * TARA AI Platform - Main Entry Point (V6.09.11)
 * Tập tin khởi chạy và cấu hình môi trường Desktop App độc lập cho máy trạm.
 * Tích hợp sẵn cơ chế chặn phím tắt trình duyệt để tạo trải nghiệm phần mềm Native gốc.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes';
import './index.css';
import { initZoom } from './services/appZoom';
import { isClientApp } from './services/api';

// Ứng dụng Windows: áp dụng mức phóng to đã lưu, phím tắt Ctrl + / Ctrl - / Ctrl 0
initZoom();

// Ứng dụng máy trạm (Windows, Android, iOS): bỏ menu chuột phải mặc định của WebView (sao chép liên kết, tải lại...) ngoài các
// ô nhập liệu; công cụ gỡ lỗi đã tắt ở bản phát hành (Tauri release, Capacitor webContentsDebuggingEnabled=false)
if (isClientApp() && !window.location.port) {
  window.addEventListener('contextmenu', (e) => {
    const el = e.target;
    if (el instanceof Element && el.closest('input, textarea, [contenteditable="true"]')) return;
    e.preventDefault();
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </React.StrictMode>
);
