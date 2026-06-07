import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Конфигурация Vite подключает React-плагин и задает правила сборки frontend.
export default defineConfig({
  plugins: [react()],
})
