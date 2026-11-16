import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// WEBRTC_DEBUG (без префикса VITE_) пробрасываем в клиент через define.
// loadEnv с префиксом 'WEBRTC_' читает только эти переменные — остальное в бандл не попадает.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'WEBRTC_')
  return {
  define: {
    __WEBRTC_DEBUG__: JSON.stringify(env.WEBRTC_DEBUG || ''),
  },
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // hls.js в отдельный чанк (~500 kB)
            if (id.includes('hls.js')) {
              return 'vendor-hls';
            }
            // React-семейство в отдельный чанк
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
          }
        },
      },
    },
  },
}
})
