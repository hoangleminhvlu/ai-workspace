import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// iThunder AI Workspace - cấu hình Vite cho Desktop App (Tauri) độc lập

export default defineConfig({
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
    proxy: {
      '/api': {
        target: 'https://aigate.is-tech.vn',
        changeOrigin: true,
        secure: true
      },
      '/ws': {
        target: 'https://aigate.is-tech.vn',
        changeOrigin: true,
        secure: true
      }
    }
  }
});
