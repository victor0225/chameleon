// 직무별 시험 문제와 정답표. 서버에서만 읽는다(화면에는 publicExam()으로 정답을 뺀 것만 보낸다).
// 채점은 lib/examScore.js, 부문 순서와 공통 값은 data/exams.js.
//
// 직무 파일 lib/server/exams/<직무 id>.js 모양: export default { questions: [6문제] }
// 문제는 data/exams.js EXAM_AREAS 순서(prompt, memory, file, verify, tool, flow)이고, 모든 문제에 다음이 있다.
//   area: 부문 id, kind: EXAM_AREAS의 kind, task: 할 일(화면 글, 개조식 한두 문장),
//   question: 만점을 못 받았을 때 던질 코칭 질문 하나("~인가?", "~은?" 꼴. 답을 대신 쓰지 않는다)
// kind마다 더 있는 것
//   prompt·template
//     criteria: [{ label, item, check?, absent?, question? }] 채점 기준. 시험 중에는 숨기고 다 낸 뒤 보여 준다.
//       item은 다섯 요소 id(goal, context, constraint, format, criteria) 또는 null. check(정규식)가 없으면 item을 분석기로 본다.
//       question은 그 기준을 못 채웠을 때의 코칭 질문(없으면 요소의 기본 질문).
//     model: 모든 기준을 채우는 모범 답(테스트용, 화면에 보이지 않는다), bad: 기준을 거의 못 채우는 짧은 답(테스트용)
//     template은 {{빈칸}}을 두 개 이상 쓰라는 기준을 넣는다(BLANKS_CHECK).
//   sort·choose
//     cards: [{ id, text, answer }] answer는 칸 id. sort는 EXAM_MEMORY_BINS, choose는 EXAM_TOOL_BINS의 id다.
//   pick
//     material: { title, subtitle?, kind: "table", columns: [...], rows: [[...]] } 또는 { title, subtitle?, kind: "list", lines: [...] }
//     answerTitle: AI가 쓴 글 칸의 제목(예: "AI가 쓴 표 요약")
//     sentences: [{ text, answer: true | false, miss? }] answer가 true인 문장이 숨겨 둔 문제 문장이다.
//       miss는 놓쳤을 때 결과 화면에 보일 한 줄(예: "'재구매율 34%'는 표에 없는 숫자").
// 미션에 나온 상황은 시험에 다시 쓰지 않는다. 자료는 모두 교육용 예시다.
// data/exams.js를 직무 파일보다 먼저 읽어야 직무 파일이 BLANKS_CHECK를 어디서 가져오든 정의된 값을 본다.
import { EXAM_AREAS } from "../../../data/exams.js";
import { binsOf } from "../../examScore.js";
import cs from "./cs.js";
import dev from "./dev.js";
import marketing from "./marketing.js";
import office from "./office.js";
import sales from "./sales.js";

// {{빈칸}}이 두 개 이상인 템플릿(자동화 문제). 직무 파일은 data/exams.js에서 바로 가져온다.
export { BLANKS_CHECK } from "../../../data/exams.js";

const EXAMS = { office, marketing, cs, sales, dev };

// 아직 문제를 쓰지 않은 직무는 null이다.
export const examFor = (job) => (Object.hasOwn(EXAMS, job) && EXAMS[job]?.questions?.length ? EXAMS[job] : null);
export const readyJobs = () => Object.keys(EXAMS).filter((job) => examFor(job));

// 화면에 보낼 문제: 정답, 정규식, 채점 기준, 코칭 질문, 모범 답을 뺀다.
export function publicExam(exam) {
  return exam.questions.map((q, i) => {
    const base = { index: i, area: q.area, kind: q.kind, way: EXAM_AREAS[i].way, task: q.task };
    if (q.kind === "sort" || q.kind === "choose") {
      return { ...base, bins: binsOf(q), cards: q.cards.map(({ id, text }) => ({ id, text })) };
    }
    if (q.kind === "pick") {
      return { ...base, material: q.material, answerTitle: q.answerTitle, sentences: q.sentences.map((s) => s.text) };
    }
    return { ...base, ...(q.placeholder ? { placeholder: q.placeholder } : {}) };
  });
}
