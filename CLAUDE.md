# Club Treasurer

운동 클럽 재무 이사용 영수증 장부 웹앱. 영수증 사진 1장 → Flue 에이전트가 날짜·상호·금액·분류 제안 → 사람이 수정·저장 → 앱 내 장부(D1).

- 의도: @docs/intent/club-treasurer-mvp.md (로컬 전용, gitignore)
- 구현 계획: @docs/implementation-plan.md (로컬 전용, gitignore)

## 작업 방식
- 사용자와는 한국어로 대화한다.
- 구현 전에 `docs/`에 계획 문서를 쓰고 사용자 승인을 받는다. 계획 모드 승인 ≠ 구현 승인.
- 추측 금지. Flue·Cloudflare API는 `npx flue docs search <q>` / 공식 문서 / 설치된 패키지 타입으로 확인한 뒤 쓴다. 답변에서 "확인함"과 "미확인·추론"을 구분한다.
- 작업 순서는 계획 문서의 단계를 따르고, 단계마다 git 커밋한다(스캐폴드 CLI 결과는 /rewind로 복원되지 않음).

## 구조
- `backend/` — Flue + Hono, Cloudflare Worker. 에이전트 규칙은 @backend/AGENTS.md
- `frontend/` — Vite + React 19 + Tailwind v4, 별도 Worker(정적 자산, SPA)

## Flue / Cloudflare 함정
- `vite.config.ts` 플러그인 순서: `flue()`가 `cloudflare()`보다 먼저.
- `src/db.ts` 파일을 만들지 않는다(Cloudflare 타깃에서 빌드 실패). D1 코드는 `src/lib/store.ts`.
- 에이전트를 추가·이름 변경하면 `wrangler.jsonc` migrations에 새 태그를 **추가**한다. 기존 항목은 수정·재정렬 금지.
- 에이전트 라우터에는 인증이 없다. 마운트 전에 미들웨어로 인증 + 대화 id 소유권 확인(서버 등록된 대화 id만, 엄격한 정규식, 기본 거부).
- 장부 쓰기는 에이전트 도구가 아니라 `POST /api/entries`(사람이 저장 버튼)만 한다.
- 모델 출력과 사용자 입력은 신뢰하지 않는다. 서버에서 Valibot으로 범위·길이 검증, 프론트에서 `dangerouslySetInnerHTML` 금지.

## 보안 (공개 레포)
- `.dev.vars*`, `.env*`, `.wrangler/`, API 키, 테스트 영수증(`samples/`)을 절대 커밋하지 않는다. 커밋 전 `git status`/`git diff --cached` 확인.
- 시크릿 값은 사용자가 직접 입력한다(`wrangler secret put`, `.dev.vars`). 채팅·코드·명령 인자에 키를 쓰지 않는다.
- GitHub 레포 생성·push, 배포(`wrangler deploy`)는 실행 전에 사용자 확인.

## 명령어
- 백엔드: `cd backend && npm run dev` / `npm run deploy` / `npm run check:types` (에이전트는 `cloudflare:workers`를 import하므로 `flue run`이 아니라 dev 서버에 이미지를 POST해 시험한다)
- 프론트엔드: `cd frontend && npm run dev` / `npm run build` / `npm run deploy`
- D1: `npx wrangler d1 migrations apply <db> --local|--remote`
