import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    // `tests/rules/` calisan bir Firestore emulatoru (ve Java) ister; ana pakete
    // karismasi emulator olmayan her ortamda kirmizi yanmasi demek olurdu.
    // Ayri yapilandirmayla calisir: `npm run test:rules` (bkz. vitest.rules.config.js)
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/rules/**'],
  },
})
