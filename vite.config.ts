import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load ALL vars (empty prefix) for server-side use only. Never put the
  // key in a VITE_-prefixed var or in `define`: that would ship it to the browser.
  const env = loadEnv(mode, process.cwd(), '')

  // Client code calls `/api/openrouter/v1/chat/completions`; the key is added here.
  const openrouterProxy = {
    '/api/openrouter': {
      target: 'https://openrouter.ai',
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/api\/openrouter/, '/api'),
      headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY ?? ''}` },
    },
  }

  return {
    plugins: [react()],
    server: { proxy: openrouterProxy },
    preview: { proxy: openrouterProxy },
  }
})
