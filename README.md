# SKILL//MIX

짧은 활동(QUICK THINK · PATTERN FIND · WORD WEAVE · SHAPE MIX)을 하고, 내가 낸 결과물의 관찰 가능한 특징을 AI가 설명해 주는 웹앱. 기록은 이 브라우저(LocalStorage)에만 저장됩니다. 제품 명세는 `PRD.md`.

## 로컬 개발

```bash
npm install
npm run dev          # Vite 개발 서버. /api/* 는 없음 → AI는 목업으로만 동작
```

`npm run dev`만으로는 `/api/analyze`가 없습니다. 둘 중 하나를 고르세요.

| 방법 | 용도 |
|---|---|
| `VITE_AI_MOCK=1 npm run dev` | 키 없이 UI 개발. 고정된 목업 응답(개발 빌드 한정, 배포에서는 비활성) |
| `npx vercel dev` | 실제 서버 함수 + 실제 OpenRouter 호출. 최초 1회 `vercel login`과 프로젝트 연결 필요 |

## 환경 변수 (서버 전용)

`.env`(커밋 금지, `.env.example` 참고) 또는 Vercel 프로젝트 설정에 등록합니다. 클라이언트 번들에는 들어가지 않으며 `VITE_` 접두를 붙이지 마세요.

| 이름 | 필수 | 설명 |
|---|---|---|
| `OPENROUTER_API_KEY` | 필수 | OpenRouter API 키. 서버 함수(`api/analyze.ts`)에서만 읽음 |
| `OPENROUTER_MODEL` | 선택 | 기본값 `dots-studio/dots-3-note-preview:free`. 코드 수정 없이 모델 교체 |
| `VITE_AI_MOCK` | 선택 | `1`이면 목업 응답(개발 빌드 전용) |

Vercel에는 `OPENROUTER_API_KEY`(필수), `OPENROUTER_MODEL`(선택)을 Production/Preview에 등록합니다.

## 명령

```bash
npm run build        # tsc --noEmit + vite build
npx vitest run       # 단위 테스트 (OpenRouter를 호출하지 않음; fetch는 mock)
npm run preview      # 빌드 결과 미리보기
```

## 배포 (Vercel)

- `vercel.json`은 `api/analyze.ts`의 `maxDuration: 30`만 지정합니다(서버 타임아웃 25초, 클라이언트 28초와 맞춤). 라우팅은 해시 기반이라 rewrite가 필요 없습니다.
- 배포 후 `https://<도메인>/api/analyze`를 GET으로 열어 405가 나오면 함수가 올라간 것입니다(404면 미배포).

## AI 운영 메모

- OpenRouter 무료 모델은 **계정당 하루 50회**(`free-models-per-day`) 제한이 있고 UTC 자정에 초기화됩니다. 크레딧 10달러를 충전하면 1,000회로 늘어납니다. 서버는 형식 오류(깨진 JSON, 한자/가나 섞임)일 때 시간 예산 안에서 최대 3회까지 다시 호출하므로 분석 1건이 최대 3회를 쓸 수 있습니다.
- 기본 모델은 추론(reasoning) 모델이라 서버가 `reasoning: { enabled: false }`를 보냅니다. 그렇지 않으면 토큰이 추론에 소진되어 본문이 비어 옵니다.
- 형식·한국어 품질이 불안정하면 `OPENROUTER_MODEL`만 바꾸면 됩니다(예: `inclusionai/ling-3.2-flash:free`는 한국어가 더 안정적이나 응답이 느려 타임아웃에 가까울 수 있음).
