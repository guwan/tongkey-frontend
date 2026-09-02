import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/console': 'http://localhost:8180',
      '/api': 'http://localhost:8180',
      '/v3': 'http://localhost:8180',
      '/swagger-ui': 'http://localhost:8180',
      '/actuator': 'http://localhost:8180',
    },
  },
})
