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

- `job`: `office` `marketing` `cs` `sales` `dev` (`data/jobs.js`), `experience`: `none` `sometimes` `often`
- `found`, `missing`, `item`: 다섯 요소 `goal` `context` `constraint` `format` `criteria` (`lib/items.js`)
- 진단 `segments`: 프롬프트를 문장별로 나눈 `[{ text, items }]`. 결과 화면과 PDF의 밑줄 색이 이걸 따라요.

화면은 `lib/api.js`의 네 함수(`diagnose`, `generatePrompt`, `refinePrompt`, `gradeAttempt`)만 불러요.

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
- `lib/server/gemini.js`: 진단과 교육 평가가 함께 쓰는 Gemini 호출 (503이면 한 번 다시 시도)
- `tests/`: `npm test`로 도는 테스트

진단 결과, 학습 기록, 설정은 브라우저 localStorage에 저장돼요 (`chameleon-state-v1`, `chameleon-settings-v1`). 서버는 아무것도 저장하지 않아요.
