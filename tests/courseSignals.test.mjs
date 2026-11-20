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

const FULL = diag({ found: ["goal", "context", "constraint", "format", "criteria"], missing: [] });

test("설문 3번에서 안 고른 기능의 과정을 파일·긴 대화·검색·같은 일 반복 순서로 고른다", () => {
  assert.deepEqual(courseSignals({ diagnosis: FULL, survey: { used: [] } }), [
    { course: "file", reason: "파일을 붙여 맡겨 본 적이 없다고 했어요" },
    { course: "memory", reason: "긴 대화를 이어 가 본 적이 없다고 했어요" },
    { course: "tool", reason: "검색을 켜고 써 본 적이 없다고 했어요" },
  ]);
  assert.deepEqual(courseSignals({ diagnosis: FULL, survey: { used: ["file", "search"] } }), [
    { course: "memory", reason: "긴 대화를 이어 가 본 적이 없다고 했어요" },
    { course: "flow", reason: "같은 일을 반복해서 AI에게 맡겨 본 적이 없다고 했어요" },
  ]);
  assert.deepEqual(courseSignals({ diagnosis: FULL, survey: { used: ["file", "memory", "search", "repeat"] } }), []);
  // 답하기 전 설문(used 없음)은 건너뛴다.
  assert.deepEqual(courseSignals({ diagnosis: FULL, survey: { job: "office" } }), []);
});

test("설문 신호는 진단 신호 뒤에 붙고, 같은 과정이면 진단 이유를 남기고, 3개 제한은 그대로다", () => {
  // 진단: 프롬프트 작성(빠진 요소 셋), 결과 검증. 설문: 파일·긴 대화 안 써 봄 → 파일 활용 하나만 들어간다.
  const r = courseSignals({ diagnosis: diag(), survey: { used: ["search"] } });
  assert.deepEqual(r.map((x) => x.course), ["prompt", "verify", "file"]);
  assert.equal(r[2].reason, "파일을 붙여 맡겨 본 적이 없다고 했어요");
  // 개인정보로 대화·메모리 관리가 이미 들어왔으면 설문 이유로 바꾸지 않는다.
  const pii = courseSignals({ diagnosis: { ...FULL, prompt: "김민수(010-1234-5678) 답장 써 줘" }, survey: { used: ["file", "repeat"] } });
  assert.deepEqual(pii, [
    { course: "memory", reason: "프롬프트에 전화번호가 들어 있어요" },
    { course: "tool", reason: "검색을 켜고 써 본 적이 없다고 했어요" },
  ]);
});

