import assert from "node:assert/strict";
import { test } from "node:test";
import { courseSignals } from "../lib/courseSignals.js";
import { findPersonalInfo, NO_PERSONAL_INFO } from "../lib/privacy.js";

const PDF = { name: "회의록_1118.pdf", mimeType: "application/pdf" };
const diag = (over) => ({ prompt: "팀장님께 드릴 업무 보고 정리해 줘", found: ["goal", "context"], missing: ["constraint", "format", "criteria"], files: [], ...over });

test("보드의 예: 빠진 요소 셋 + 안 가리킨 파일 → 프롬프트 작성, 파일 활용, 결과 검증 순서", () => {
  assert.deepEqual(courseSignals({ diagnosis: diag({ files: [PDF, PDF] }) }), [
    { course: "prompt", reason: "빠진 요소가 세 개 있어요: 조건·형식·기준" },
    { course: "file", reason: "파일을 붙였지만 무엇을 하라는지 말하지 않았어요" },
    { course: "verify", reason: "AI가 지어낸 부분을 걸러낼 기준이 없어요" },
  ]);
});

test("개인정보가 있으면 대화·메모리 관리를 먼저, 이유에 무엇이 들어 있는지 밝힌다", () => {
  const r = courseSignals({ diagnosis: diag({ prompt: "김민수 고객(010-1234-5678) 답장 써 줘", missing: ["format"] }) });
  assert.deepEqual(r[0], { course: "memory", reason: "프롬프트에 전화번호가 들어 있어요" });
  assert.equal(r[1].course, "prompt");
  assert.match(courseSignals({ diagnosis: diag({ prompt: "a@b.com 으로 보내 줘" }) })[0].reason, /이메일 주소가/);
  assert.match(courseSignals({ diagnosis: diag({ prompt: "국민은행 계좌 123-45-678901로 입금" }) })[0].reason, /계좌번호가/);
});

test("파일 이야기는 있는데 붙인 파일이 없을 때, 같은 과정은 한 번만", () => {
  const r = courseSignals({ diagnosis: diag({ prompt: "첨부한 보고서를 요약해 줘", missing: ["format"] }) });
  assert.deepEqual(r, [
    { course: "file", reason: "파일 이야기는 있는데 붙인 파일이 없어요" },
    { course: "prompt", reason: "빠진 요소가 한 개 있어요: 형식" },
  ]);
});

test("빠진 요소 수는 우리말로 센다", () => {
  const r = courseSignals({ diagnosis: diag({ found: ["context"], missing: ["goal", "constraint", "format", "criteria"] }) });
  assert.equal(r[0].reason, "빠진 요소가 네 개 있어요: 목표·조건·형식·기준");
});

test("빠진 요소가 없고 신호도 없으면 빈 목록, 세 개까지만", () => {
  assert.deepEqual(courseSignals({ diagnosis: diag({ missing: [] }) }), []);
  assert.deepEqual(courseSignals({ diagnosis: null }), []);
  const many = courseSignals({ diagnosis: diag({ prompt: "010-1111-2222 고객에게 답장", files: [PDF] }) });
  assert.equal(many.length, 3);
  assert.deepEqual(many.map((x) => x.course), ["memory", "prompt", "file"]);
});

test("개인정보 패턴: 강의 a3 채점과 같은 목록을 쓴다", () => {
  assert.deepEqual(findPersonalInfo("주민번호 900101-1234567").map((p) => p.id), ["rrn"]);
  assert.equal(findPersonalInfo("고객A의 환불 문의를 정리해 줘").length, 0);
  assert.ok(NO_PERSONAL_INFO.test("고객A 환불 문의 요약해 줘"));
  assert.ok(!NO_PERSONAL_INFO.test("김민수(010-1234-5678) 문의 요약"));
});

test("설문 3번 답은 진단 신호보다 약하게 더하고, 같은 과정이면 진단 이유를 남긴다", () => {
  const full = diag({ found: ["goal", "context", "constraint", "format", "criteria"], missing: [] });
  assert.deepEqual(courseSignals({ diagnosis: full, survey: { uses: ["long", "search"] } }), [
    { course: "memory", reason: "긴 대화를 이어 가며 AI를 써 봤다고 했어요" },
    { course: "verify", reason: "검색을 켜고 써 봤다고 했어요. 찾아 준 내용도 출처를 확인해야 해요" },
  ]);
  // 빠진 요소 셋(프롬프트 작성 3점, 결과 검증 1.5점)이 설문보다 앞서고, 결과 검증은 진단 이유가 남는다.
  const r = courseSignals({ diagnosis: diag(), survey: { uses: ["search", "repeat"] } });
  assert.deepEqual(r.map((x) => x.course), ["prompt", "verify", "flow"]);
  assert.equal(r[1].reason, "AI가 지어낸 부분을 걸러낼 기준이 없어요");
});

test("설문에 답했는데 파일도 검색도 안 썼으면 AI 도구 활용, 답하기 전 설문은 건너뛴다", () => {
  const full = diag({ found: ["goal", "context", "constraint", "format", "criteria"], missing: [] });
  assert.deepEqual(courseSignals({ diagnosis: full, survey: { uses: [] } }), [
    { course: "tool", reason: "검색이나 파일 분석은 아직 안 써 봤다고 했어요" },
  ]);
  assert.deepEqual(courseSignals({ diagnosis: full, survey: { job: "office" } }), []);
  assert.deepEqual(courseSignals({ diagnosis: full, survey: { uses: ["file"] } }).map((x) => x.course), ["file"]);
});

