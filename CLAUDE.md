# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`skill-mix` is a freshly scaffolded Vite + React 19 + TypeScript app. `src/App.tsx` is currently a placeholder (`<h1>skill-mix</h1>`); entry is `src/main.tsx`. There is no router, state layer, or feature code yet, so no architecture beyond the scaffold exists.

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
- Vitest is installed but has no test files, no `test` block in `vite.config.ts`, and no DOM environment (jsdom/happy-dom) or Testing Library set up; component tests will need that added first.
