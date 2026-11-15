import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The OpenRouter key is only used by the server function api/analyze.ts (PRD 11).
// Nothing in this config reads it or exposes it to the client bundle.
export default defineConfig({
  plugins: [react()],
})
