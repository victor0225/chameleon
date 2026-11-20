# 카멜레온 (C팀) 통합본

프론트엔드와 백엔드 두 묶음을 하나로 합친 Next.js 16 (App Router, JavaScript) 프로젝트예요.
진단, 프롬프트 작성 도우미, AI 활용 교육이 모두 Google Gemini API에 연결돼 있어요.

## 실행

Node.js 20.9 이상이 필요해요.

```bash
npm install
cp .env.local.example .env.local   # Windows PowerShell: Copy-Item .env.local.example .env.local
# .env.local을 열어 GEMINI_API_KEY= 뒤에 키를 넣으세요
npm run dev      # http://localhost:3000
```

- `npm run build`: 배포 전 빌드 확인
- `npm test`: API 판단 로직 테스트 (실제 키 없이 돌아가요)

## Vercel 배포

1. 이 폴더를 Vercel에 올려요 (Vercel 사이트에서 폴더 끌어다 놓기, 또는 `npx vercel --prod`).
2. Project Settings → Environment Variables에 넣어요.
   - `GEMINI_API_KEY`: Gemini 키 (필수)
   - `GEMINI_MODEL`: 모델을 바꿀 때만 (기본값 `gemini-3.5-flash-lite`)
3. 환경변수를 넣은 뒤 다시 배포해야 반영돼요.

키는 서버(`app/api`, `lib/server`)에서만 읽어요. `.env.local`은 zip, 깃, 디스코드에 올리지 마세요.

## 키가 없거나 Gemini가 실패하면

| 기능 | 키 있음 | 키 없음 / 호출 실패 |
| --- | --- | --- |
| 진단 | Gemini가 문장마다 요소를 고르고 총평을 써요 | 규칙 기반 분석기로 같은 모양의 결과 (`source: "rule"`) |
| 교육 평가 | Gemini가 통과 기준을 하나씩 채점하고 결과물 예시를 써요 | 규칙 기반 채점 (`source: "rule"`) |
| 프롬프트 작성 도우미 | Gemini가 다섯 요소로 프롬프트를 만들어요 | 화면에 오류 문장이 떠요 |

그래서 발표 중에 Gemini가 혼잡해도 진단과 교육 화면은 멈추지 않아요. 응답의 `source`가 `"ai"`인지 `"rule"`인지 보면 어느 쪽으로 답했는지 알 수 있어요.

## API

모두 `POST`이고 본문은 JSON이에요. 실패하면 4xx/5xx와 함께 `{ "error": "화면에 그대로 보여 줄 문장" }`을 돌려줘요.

| 주소 | 요청 | 응답 |
| --- | --- | --- |
| `/api/diagnose` | `{ job, experience, prompt }` | `{ level, found, missing, comment, segments, source }` |
| `/api/prompt` | `{ mode: "generate" \| "revise", level, job, userInput, previousPrompt?, revisionRequest? }` | `{ success, prompt, segments }` |
| `/api/evaluate` | `{ lessonId, prompt }` | `{ passed, criteria, found, coaching, output, xp, source }` |
| `/api/guess` | `{ job, prompt }` | `{ output, guesses: [{ item, quote, reason }], source }` |
| `/api/compare` | `{ step: "mine" \| "refine" \| "run", job, prompt, missing, improved?, before? }` | 단계별: `{ output, guesses }` / `{ sentences: [{ item, text, why, added }] }` / `{ output, marks, diffs }`. 키가 없으면 `{ source: "rule" }` |

- `job`: `office` `marketing` `cs` `sales` `dev` (`data/jobs.js`), `experience`: `none` `sometimes` `often`
- `found`, `missing`, `item`: 다섯 요소 `goal` `context` `constraint` `format` `criteria` (`lib/items.js`)
- 진단 `segments`: 프롬프트를 문장별로 나눈 `[{ text, items }]`. 결과 화면과 PDF의 밑줄 색이 이걸 따라요.

화면은 `lib/api.js`의 네 함수(`diagnose`, `generatePrompt`, `refinePrompt`, `gradeAttempt`)만 불러요.

## 로그인과 DB (아이디·비밀번호 + PostgreSQL)

DB 설정이 없으면 로그인 버튼이 숨고, 지금처럼 브라우저에만 저장돼요. 설정하면 아이디·비밀번호로 가입한 사용자의 진단·학습 기록이 PostgreSQL에 저장되고, 개인화 엔진이 그 기록으로 "나를 위한 커리큘럼"을 골라요.

로컬에서 켜기:

```bash
npm run db:up        # Docker로 PostgreSQL 17 띄우기 (compose.yaml)
# .env.local에 DATABASE_URL, SESSION_SECRET을 넣으세요 (.env.local.example 참고)
npm run db:migrate   # 표 만들기 (db/schema.sql, 여러 번 실행해도 돼요)
npm run dev          # /signup에서 가입하면 바로 로그인돼요
npm run test:db      # 실제 DB에 쓰고 읽는 테스트
```

배포할 때: 호스팅한 PostgreSQL 주소를 `DATABASE_URL`로 넣고 `DATABASE_URL=... npm run db:migrate`를 한 번 실행해요. `SESSION_SECRET`(32자 이상, `openssl rand -base64 48`)도 넣어요.

- 가입 규칙(`lib/credentials.js`, 화면과 서버가 같이 씀): 아이디는 영문 소문자와 숫자 4~20자, 비밀번호는 8자 이상(다른 조건 없음), 이름 20자까지. 비밀번호 찾기는 아직 없어요.
- 비밀번호는 scrypt 해시로만 저장해요(`lib/server/password.js`). 같은 아이디로 5번 틀리면 10분 동안 로그인을 막아요(DB에 기록하니 서버가 여러 대여도 같아요). 틀렸을 때는 아이디와 비밀번호 중 무엇이 틀렸는지 알려 주지 않아요.
- 세션은 jose로 서명한 httpOnly 쿠키(30일, `lib/server/session.js`)예요.
- 표: `users`(아이디·비밀번호 해시·이름), `profiles`(직무·수준), `progress`(XP·완료 강의·숙련도), `diagnoses`(진단할 때마다 한 줄), `attempts`(실습 제출할 때마다 한 줄, 못 넘은 기준 요소)
- 처음 로그인하면 이 브라우저의 기록을 계정 기록과 합쳐요(`lib/syncState.js`, 어느 쪽에서 끝낸 강의도 잃지 않음). 그 뒤로는 바뀔 때마다 저장하고, 로그아웃하면 이 브라우저 기록을 지워요.
- 개인화 엔진 `lib/personalize.js`: 마지막 진단에서 빠진 요소, 최근 실습에서 못 넘은 기준, 요소별 숙련도로 약한 요소를 점수 매기고, 내 수준(다 마쳤으면 다음 수준)의 강의 세 개를 이유 문장과 함께 골라요. LLM을 쓰지 않는 팀 규칙이고, 가중치는 `WEIGHT`에 모여 있어요.

| 주소 | 하는 일 |
| --- | --- |
| `POST /api/auth/signup` | `{ loginId, password, passwordConfirm, name }` → `{ user }`, 가입하면 바로 로그인. 400 입력 규칙(`field`로 틀린 칸), 409 이미 쓰는 아이디 |
| `POST /api/auth/login` | `{ loginId, password }` → `{ user }`. 401 아이디나 비밀번호가 틀림, 429 잠김 |
| `POST /api/auth/logout` | 로그아웃 |
| `GET /api/me` | `{ user, state, stats, login }` (로그인 전이면 `{ user: null, login }`) |
| `PUT /api/me` | 화면 상태 `{ profile, survey, diagnosis, record }` 저장 |
| `DELETE /api/me` | 계정은 두고 진단·학습 기록 지우기 |
| `GET /api/me/curriculum` | `{ focus, weak, items: [{ lessonId, title, level, focus, reasons }] }` |

화면: `/login`, `/signup`(로그인을 마치면 `?next=` 주소로 돌아가요). 헤더의 "로그인", 마이페이지의 계정 칸, 교육 화면의 커리큘럼 안내에서 들어가요.

## 화면과 파일

| 주소 | 화면 | 파일 |
| --- | --- | --- |
| `/` | 메인 (전후 비교 예시, 내 수준 진단하기) | `app/page.js` |
| `/diagnosis` | 진단 1/3 설문 (직무, AI 경험) | `app/diagnosis/page.js` |
| `/diagnosis/prompt` | 진단 2/3 프롬프트 써 보기 | `app/diagnosis/prompt/page.js` |
| `/diagnosis/result` | 진단 3/3 결과 | `app/diagnosis/result/page.js` |
| `/diagnosis/report` | PDF로 저장할 A4 리포트 (결과 화면의 버튼이 새 탭으로 열어요) | `app/diagnosis/report/` |
| `/prompt` | 프롬프트 작성 도우미 | `app/prompt/page.js` |
| `/learn` | AI 활용 교육 | `app/learn/page.js` |
| `/mypage` | 마이페이지 | `app/mypage/page.js` |

서버 쪽 파일:

- `app/api/diagnose/route.js`, `lib/server/diagnosis.js`: 진단
- `app/api/prompt/route.js`: 프롬프트 작성 도우미 (기능 1 백엔드 그대로)
- `app/api/evaluate/route.js`, `lib/server/evaluate.js`: 교육 평가 (기능 2 백엔드의 채점 방식을 옮김, 강의 데이터는 `data/curriculum.js` 하나만 씀)
- `app/api/compare/route.js`, `lib/server/compare.js`: 결과 비교 (`/diagnosis/compare`). 내 프롬프트 실행 → 프롬프트 다듬기 → 다듬은 프롬프트 실행을 단계마다 부른다. 키가 없으면 화면이 `data/compareSample.js`의 예시 결과를 보여 준다
- `lib/server/gemini.js`: 진단과 교육 평가가 함께 쓰는 Gemini 호출 (503이면 한 번 다시 시도)
- `tests/`: `npm test`로 도는 테스트

진단 결과, 학습 기록, 설정은 브라우저 localStorage에 저장돼요 (`chameleon-state-v1`, `chameleon-settings-v1`). 서버는 아무것도 저장하지 않아요.
