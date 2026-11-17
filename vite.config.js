import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// iThunder AI Workspace - cấu hình Vite cho Desktop App (Tauri) độc lập

// AI Workspace gọi AI Gateway trên chính tên miền đang mở (window.TARA_CONFIG để trống trong index.html):
// bản build triển khai sau nginx của từng Tổ chức; ứng dụng Desktop (Tauri/Capacitor) dùng Gateway mặc định trong api.js.
// Chế độ phát triển (npm run dev): trang chạy ở localhost:5173, server.proxy bên dưới chuyển /api và /ws về Backend FastAPI
// trong WSL (cổng 8088). Đổi bằng biến môi trường, vd. dùng Gateway thật: VITE_DEV_GATEWAY=https://aigate.is-tech.vn npm run dev
const devGateway = (env) => (env.VITE_DEV_GATEWAY || 'http://localhost:8088').replace(/\/$/, '');

export default defineConfig(({ mode }) => {
  const gateway = devGateway(loadEnv(mode, process.cwd(), 'VITE_'));
  return {
  plugins: [react()],
  clearScreen: false,
  base: './', // Bắt buộc: đảm bảo build ra file tĩnh chạy được ở mọi nơi độc lập (Tauri/Electron)
  
  build: {
    // Tăng giới hạn cảnh báo lên 1000 kB để giảm bớt thông báo không cần thiết
    chunkSizeWarningLimit: 1000,
    
    // Cấu hình chia nhỏ bundle (Code Splitting)
    rollupOptions: {
      output: {
        // Gom cụm tự động các thư viện lớn trong node_modules thành các file vendor riêng biệt
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Tách riêng thư viện render markdown và các thành phần đi kèm phụ trợ
            if (id.includes('react-markdown') || id.includes('micromark') || id.includes('unist')) {
              return 'vendor-markdown';
            }
            // Tách riêng bộ icon lucide-react rất lớn để không gây nghẽn luồng UI chính
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            // Tách các thư viện cốt lõi của React
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react-core';
            }
            // Toàn bộ các thư viện bên thứ ba còn lại
            return 'vendor-libs';
          }
        }
      }
    }
  },

  server: {
    // Cổng 5173 nằm trong danh sách origins (CORS) của aiplatform.py
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: gateway,
        changeOrigin: true,
        secure: gateway.startsWith('https')
      },
      '/ws': {
        target: gateway,
        ws: true,
        changeOrigin: true,
        secure: gateway.startsWith('https')
      }
    }
  }
  };
});
