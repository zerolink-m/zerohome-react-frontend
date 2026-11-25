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
      // Сохраняем браузерные цели сборки Vite 5.
      target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: 'vendor-hls', test: /\/node_modules\/hls\.js\// },
              { name: 'vendor-react', test: /\/node_modules\/(?:react|react-dom|react-router|scheduler|@fontsource)\// },
            ],
          },
        },
      },
    },
  }
})
