import assert from "node:assert/strict";
import { test } from "node:test";
import { LESSONS } from "../data/curriculum.js";
import { ITEMS } from "../lib/items.js";
import { ruleEvaluation, runEvaluation } from "../lib/server/evaluate.js";

// 강의 데이터가 화면과 채점이 기대하는 모양인지, check 정규식이 키 없는 채점에 쓰이는지 검사한다.
const IDS = ITEMS.map((item) => item.id);
const LEVELS = ["초급", "중급", "고급"];

test("모든 강의에 필수 필드가 있고 id가 겹치지 않는다", () => {
  for (const l of LESSONS) {
    for (const key of ["id", "level", "focus", "title", "summary", "mission", "model"]) {
      assert.ok(typeof l[key] === "string" && l[key].trim(), `${l.id}.${key}`);
    }
    for (const key of ["point", "bad", "good"]) assert.ok(l.lecture?.[key]?.trim(), `${l.id}.lecture.${key}`);
    for (const key of ["weak", "strong"]) assert.ok(l.outputs?.[key]?.trim(), `${l.id}.outputs.${key}`);
    assert.ok(l.criteria.length >= 1 && l.criteria.length <= 3, `${l.id} 통과 기준 개수`);
    for (const c of l.criteria) assert.ok(c.label?.trim(), `${l.id} 기준 label`);
  }
  assert.equal(new Set(LESSONS.map((l) => l.id)).size, LESSONS.length);
});

test("focus와 item은 다섯 요소 id다", () => {
  for (const l of LESSONS) {
    assert.ok(IDS.includes(l.focus), `${l.id}.focus=${l.focus}`);
    for (const c of l.criteria) assert.ok(IDS.includes(c.item), `${l.id} item=${c.item}`);
  }
});

test("단계마다 다섯 강의: 초급 5개, 중급 5개, 고급 5개", () => {
  assert.ok(LESSONS.every((l) => LEVELS.includes(l.level)));
  for (const level of LEVELS) assert.equal(LESSONS.filter((l) => l.level === level).length, 5, level);
});

test("check는 상태 없는 정규식이고, question은 문장이다", () => {
  for (const l of LESSONS) {
    for (const c of l.criteria) {
      if ("check" in c) {
        assert.ok(c.check instanceof RegExp, `${l.id} ${c.label}`);
        assert.ok(!c.check.global && !c.check.sticky, `${l.id} ${c.label}: g·y 플래그는 test 결과를 바꾼다`);
      }
      if ("question" in c) assert.ok(typeof c.question === "string" && c.question.trim());
      if ("hint" in c) assert.ok(c.question && typeof c.hint === "string" && c.hint.trim(), `${l.id} hint는 question과 함께`);
    }
  }
});

test("check가 있는 기준은 키 없는 채점에서 그 정규식으로 판정된다", () => {
  for (const l of LESSONS) {
    const samples = [l.model, l.lecture.bad, l.lecture.good, "정리해 줘"];
    for (const prompt of samples) {
      const r = ruleEvaluation(l, prompt);
      l.criteria.forEach((c, i) => {
        if (c.check) assert.equal(r.criteria[i].met, c.check.test(prompt), `${l.id} "${c.label}" ← ${prompt}`);
      });
    }
  }
});

test("check가 다섯 요소 분석기보다 먼저다: 요소가 있어도 정규식이 안 맞으면 미충족", () => {
  const m2 = LESSONS.find((l) => l.id === "m2");
  const i = m2.criteria.findIndex((c) => c.check);
  // '표로'가 있어 분석기는 형식(format)을 찾지만, 예시가 없으니 예시 기준은 미충족이다.
  const r = ruleEvaluation(m2, "텀블러 홍보 문구 다섯 개를 표로 써 줘");
  assert.ok(r.found.includes(m2.criteria[i].item));
  assert.equal(r.criteria[i].met, false);
  assert.equal(r.passed, false);
  assert.equal(r.coaching.question, m2.criteria[i].question);
});

test("모범 프롬프트는 통과하고, 강의의 나쁜 예는 통과하지 못한다", async () => {
  for (const l of LESSONS) {
    const good = await runEvaluation({ lessonId: l.id, prompt: l.model });
    assert.equal(good.passed, true, `${l.id} 모범 프롬프트: ${JSON.stringify(good.criteria)}`);
    const bad = await runEvaluation({ lessonId: l.id, prompt: l.lecture.bad });
    assert.equal(bad.passed, false, `${l.id} 나쁜 예`);
    assert.ok(bad.coaching?.question, `${l.id} 코칭 질문`);
  }
});

const byId = (id) => LESSONS.find((l) => l.id === id);

test("중급·고급 제목과 요약은 디자인 보드 문안 그대로다", () => {
  const board = {
    m1: ["업무 자료를 붙여 넣는 법", "지시와 자료를 나눠서 건네기"],
    m2: ["예시로 원하는 결과 보여 주기", "말로 설명하기보다 한 줄 보여 주기"],
    m3: ["긴 업무를 단계로 나누기", "한 번에 말고 순서대로"],
    m4: ["‘적당히’ 대신 숫자로", "모호한 말과 부딪치는 지시 없애기"],
    m5: ["쓸모 있는 역할 주기", "‘너는 천재야’ 말고 일에 맞는 관점"],
    a1: ["반복 업무를 프롬프트 하나로", "바뀌는 부분만 {{빈칸}}으로"],
    a2: ["AI가 스스로 결과를 검토하게 하기", "보내기 전에 한 번 더 확인하게"],
    a3: ["개인정보 빼고 맡기기", "이름과 연락처는 가려서"],
    a4: ["군더더기 덜어내기", "핵심 요청이 묻히지 않게"],
    a5: ["종합 미션: 업무 하나를 처음부터 끝까지", "배운 것을 한 프롬프트에 모두"],
  };
  for (const [id, [title, summary]] of Object.entries(board)) {
    assert.equal(byId(id).title, title, id);
    assert.equal(byId(id).summary, summary, id);
  }
});

test("강의 예시의 밑줄 표시를 이어 붙이면 예시 문장과 같고, 요소 id만 쓴다", () => {
  for (const l of LESSONS) {
    for (const [key, text] of [
      ["badMarks", l.lecture.bad],
      ["goodMarks", l.lecture.good],
    ]) {
      const marks = l.lecture[key];
      if (!marks) continue;
      assert.equal(marks.map(([t]) => t).join(""), text, `${l.id}.${key}`);
      for (const [, item] of marks) assert.ok(item === null || IDS.includes(item), `${l.id}.${key} ${item}`);
    }
  }
});

test("2-E: m2에 예시와 분량 없이 쓰면 3개 중 1개 충족, 예시 코칭 질문이 나온다", () => {
  const m2 = byId("m2");
  const r = ruleEvaluation(m2, "새 텀블러 인스타그램 홍보 문구 써 줘");
  assert.deepEqual(
    r.criteria.map((c) => c.met),
    [true, false, false],
  );
  assert.equal(r.coaching.question, "원하는 결과를 한 줄만 직접 보여 준다면 어떤 문장일까요?");
  assert.equal(r.output, m2.outputs.weak);
});

test("2-F: a1 보드의 템플릿은 빈칸만 채우고 메일 모양과 확인 기준이 빠졌다", () => {
  const a1 = byId("a1");
  const draft =
    "매주 금요일에 보내는 주간 납품 현황 메일을 써 줘. 받는 사람은 {{거래처명}} 담당자야. 이번 주 납품 내역은 {{납품 내역}}이야. 정중한 말투로 다섯 줄 이내로 써 줘.";
  const r = ruleEvaluation(a1, draft);
  assert.deepEqual(
    r.criteria.map((c) => c.met),
    [true, false, false],
  );
  assert.equal(r.coaching.question, a1.criteria[1].question);
  const fixed = `${draft}\n제목, 인사, 납품 목록 순서로 쓰고, 보내기 전에 수량과 날짜가 맞는지 확인해 줘.`;
  assert.equal(ruleEvaluation(a1, fixed).passed, true);
});
