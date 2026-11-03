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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </React.StrictMode>
);
