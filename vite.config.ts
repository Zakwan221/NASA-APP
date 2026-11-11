import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        // 3D is lazy-loaded (home story, mission builder, launch). Split it so
        // three.js and its add-ons download in parallel and stay cached separately.
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/ },
            { name: 'three-extras', test: /node_modules[\\/](@react-three|three-stdlib|postprocessing|maath|troika|camera-controls|@monogrid)/ },
          ],
        },
      },
    },
  },
})
