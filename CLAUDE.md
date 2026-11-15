# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`skill-mix` (SKILL//MIX) is a Vite + React 19 + TypeScript app; the product spec is `PRD.md`. All five screens, the four activities (each with `Stage`, `evaluate`, `buildAiPayload` and tests), storage, the AI pipeline and the motion layer exist. See `README.md` for run/deploy steps and the AI operating notes.

## Architecture (shared contracts)

- `src/types.ts` — shared types from PRD 8.2–9 (`ActivityDefinition`, `StageProps`, `SessionRecord`, `AiFeedback`, …). `EvalContext` and `SessionCore` are not defined in the PRD; their minimal shapes live here.
- `src/activities/registry.ts` — `ACTIVITIES` array and `getActivity(id: string)` (returns `undefined` for unknown ids). Each activity is registered as an `ActivityDefinition`; `Stage`/`evaluate`/`buildAiPayload` are placeholders to be filled per activity.
- `src/router.ts` — hand-written hash router: pure `parseRoute(hash)`, `useRoute()`, `navigate()`, and `paths` builders. Routes: `#/`, `#/discover`, `#/activity/:id`, `#/result/:sessionId`, `#/archive`. `App.tsx` switches on the parsed route; the `<nav>` in it is temporary scaffolding.
- `src/lib/storage.ts` — LocalStorage layer (`skillmix:v1:sessions`/`settings`): `saveSession`/`saveSessionDetailed`, `getSessions`, `getSession`, `updateSessionAi(id, patch)` (merges into `ai` only), `deleteSession`, `clearAll`, `loadSettings`/`saveSettings`. Never throws; invalid entries are skipped but not deleted, an unreadable blob is backed up before being replaced, and a session that cannot be written (quota) is kept in memory for the visit. Tests use `src/lib/testing/fakeStorage.ts` (no DOM env).
- `src/lib/ai.ts` — `requestAnalysis(sessionId)` (call on RESULT entry; consent check, in-flight set, 30s pending rule, 28s timeout, result merged via `updateSessionAi`), `retryAnalysis`, `fetchAnalysis`. `VITE_AI_MOCK=1` returns a fixed response in dev builds only.
- `src/activities/finishRun.ts` + `useActivityRun.ts` — submit pipeline: evaluate → `SessionRecord` (`ai.status` pending/skipped by consent) → save first → navigate to `#/result/:id`. Storage failures fire a window event shown by `StorageNotice`.
- `src/lib/motion.ts` — the only place that registers GSAP plugins; exports `gsap`, `useGSAP`, `ScrollTrigger`, `MQ` (matchMedia conditions: `full`, `reduced`, `mouse`) and `countUp`. All motion is `useGSAP` + `gsap.matchMedia` (reduced motion = fade/instant, mouse effects = desktop pointer only). Use `gsap.fromTo` with `clearProps`, not `gsap.from`: `from` reads its end state from the DOM and ends up invisible after StrictMode's double effect run. Route wipe lives in `App.tsx`, 3-2-1 and the closing frame in `ActivityShell.tsx`.
- `api/analyze.ts` — Vercel function (Web handler, `maxDuration` 30 in `vercel.json`); all logic is in `api/_lib/` as testable pure modules: `validate.ts` (request whitelist), `prompt.ts`, `feedback.ts` (response validator), `openrouter.ts`, `handler.ts`. The only place that reads `OPENROUTER_API_KEY`/`OPENROUTER_MODEL`. The default model is a reasoning model, so requests send `reasoning: {enabled:false}`; answers containing Han/kana characters or failing validation are retried (max 3 calls inside the 25s budget); the free tier allows 50 requests/day per account. There is no dev server for `/api/*` under plain `vite`; use `vercel dev` for live calls or `VITE_AI_MOCK=1`. `src/` imports the pure `api/_lib/constants.ts` and `feedback.ts` (no secrets in them).

## Commands

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check (`tsc --noEmit`) then `vite build`; type errors fail the build
- `npm run preview` — serve the production build
- `npm test` — run Vitest (watch mode by default; use `npx vitest run` for a single pass)
- Single test: `npx vitest run path/to/file.test.tsx` or `npx vitest run -t "test name"`

There is no lint script or ESLint/Prettier config.

## Stack notes

- Animation: `gsap` with `@gsap/react` (use its `useGSAP` hook rather than raw `useEffect` for GSAP setup/cleanup).
- Icons: `lucide-react`.
- Vitest runs in the default Node environment (tests: router, storage, ai, finishRun, and `api/_lib/*`). There is no `test` block in `vite.config.ts` and no DOM environment (jsdom/happy-dom) or Testing Library, so component/hook tests will need that added first. Tests must never call OpenRouter: mock `fetch`.

## 공통 규칙

- 먼저 PRD.md의 지정된 절을 읽고, 기존 코드/CLAUDE.md/package.json을 확인한 뒤 작업한다.
- .env의 실제 값은 절대 출력·로그·커밋하지 않는다. 변수 이름만 확인한다. 기존 API 키를 바꾸거나 새로 만들지 않는다.
- 이미 설치된 패키지(React 19, Vite, TypeScript, GSAP, @gsap/react, Lucide, Vitest)만 사용한다. 새 패키지는 꼭 필요할 때만, 설치 전에 이유를 한 줄로 알린다.
- src/types.ts의 공통 타입과 activities/registry.ts 시그니처는 임의로 바꾸지 않는다. 바꿔야 하면 이유와 영향을 먼저 보고한다.
- PRD에 없는 기능(로그인, DB, 랭킹, 레벨 등)은 추가하지 않는다. 범위가 불명확하면 PRD의 축소 규칙을 따른다.
- 작업이 끝나면 build와 vitest를 실행하고, 결과와 변경 파일, 남은 위험을 5줄 이내로 요약한다.
