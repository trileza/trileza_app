import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'admin/index.html')
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('/node_modules/react/') || 
              id.includes('/node_modules/react-dom/') || 
              id.includes('/node_modules/react-router/') || 
              id.includes('/node_modules/react-router-dom/') ||
              id.includes('\\node_modules\\react\\') || 
              id.includes('\\node_modules\\react-dom\\') || 
              id.includes('\\node_modules\\react-router\\') || 
              id.includes('\\node_modules\\react-router-dom\\')
            ) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('framer-motion')) {
              return 'vendor-motion';
            }
            if (id.includes('recharts')) {
              return 'vendor-charts';
            }
            if (id.includes('xlsx') || id.includes('jszip') || id.includes('mammoth')) {
              return 'vendor-office';
            }
          }
        }
      }
    }
  }
})
