import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const base = '/madakoko/';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      // フロントからは /reservations/... で叩く
      '/reservations': {
        target: 'https://office.zukoshait.org',
        changeOrigin: true,
        // 必要なら自己署名証明書等を許可
        secure: true, // 社内CA等で検証を外すなら false
      },
    },
  },
  base,
})
