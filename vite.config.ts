import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // three.js is big but lazy-loaded only for the hero
  build: { chunkSizeWarningLimit: 1000 },
})
