import { handleAnalyze } from './_lib/handler.js'

// Vercel Function (Web-standard handler). All logic lives in ./_lib so it can be unit tested.
// The key and model come from the server environment only: OPENROUTER_API_KEY, OPENROUTER_MODEL.
export const config = { maxDuration: 30 }

export default {
  fetch: (request: Request) => handleAnalyze(request, { env: process.env }),
}
