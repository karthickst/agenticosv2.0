import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:    ['react', 'react-dom'],
          flow:      ['@xyflow/react'],
          anthropic: ['@anthropic-ai/sdk'],
        }
      }
    }
  }
})
