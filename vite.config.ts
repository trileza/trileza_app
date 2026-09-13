import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
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
            if (id.includes('xlsx') || id.includes('jszip') || id.includes('mammoth')) {
              return 'vendor-office';
            }
            if (id.includes('@insforge/sdk') || id.includes('insforge')) {
              return 'vendor-insforge';
            }
            if (id.includes('core-js')) {
              return 'vendor-polyfills';
            }
            if (id.includes('@cloudflare/realtimekit') || id.includes('realtimekit')) {
              return 'vendor-rtk';
            }
            if (id.includes('zustand') || id.includes('clsx') || id.includes('tailwind-merge') || id.includes('date-fns')) {
              return 'vendor-utils';
            }
          }
        }
      }
    }
  }
})


