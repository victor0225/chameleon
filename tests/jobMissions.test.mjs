// 작업 K: 관심 직무별 미션 내용(data/jobMissions/<직무>.js). 직무마다 미션 26개를 그 직무 상황으로 바꾸고,
// 바꾼 뒤에도 키 없는 규칙 채점·정답표 채점·예시 파일 확인이 공통 미션과 같은 약속을 지키는지 본다.
// 한 직무만 볼 때: node --test --test-name-pattern="marketing" tests/jobMissions.test.mjs
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ALL_LESSONS } from "../data/courses.js";
import { JOBS } from "../data/jobs.js";
import { FIXED, JOB_MISSIONS, lessonFor } from "../lib/jobContent.js";
import { runEvaluation } from "../lib/server/evaluate.js";
import { checkFileOutput, gradeSort, gradeSpot } from "../lib/server/practice.js";

// .pathname은 폴더 이름의 공백·한글을 %xx로 남겨 existsSync가 못 찾는다.
const PUBLIC = fileURLToPath(new URL("../public", import.meta.url));
const BANNED = [/직무\s*전환/, /새\s*직무로\s*옮기/];
const grade = (l, job, prompt) =>
  runEvaluation({
    lessonId: l.id,
    job,
    prompt,
    ...(l.kind === "file" ? { files: l.samples.map((f) => ({ name: f.name, mimeType: f.type })), sample: true } : {}),
  });
const rightAnswer = (l) => Object.fromEntries(l.cards.map((c) => [c.id, c.answer]));

test("과정 1은 11개(초급 5 · 중급 3 · 고급 3), 모두 합쳐 26개", () => {
  const prompt = ALL_LESSONS.filter((l) => l.course === "prompt");
  assert.deepEqual(
    prompt.map((l) => l.id),
    ["b1", "b2", "b3", "b4", "b5", "m2", "m4", "m5", "a3", "a4", "a5"],
  );
  assert.equal(ALL_LESSONS.length, 26);
});

test("직무가 없으면 공통 미션 그대로, 같은 미션·직무면 같은 객체", () => {
  const l = ALL_LESSONS[0];
  assert.equal(lessonFor(l, null), l);
  assert.equal(lessonFor(l, "nope"), l);
  assert.equal(lessonFor(l, "marketing"), lessonFor(l, "marketing"));
});

for (const job of JOBS) {
  test(`${job.id}: 26개 미션을 모두 이 직무 상황으로`, async (t) => {
    const over = JOB_MISSIONS[job.id];
    const ids = new Set(ALL_LESSONS.map((l) => l.id));
    for (const key of Object.keys(over)) assert.ok(ids.has(key), `모르는 미션 id: ${key}`);

    for (const base of ALL_LESSONS) {
      await t.test(base.id, async () => {
        assert.ok(Object.hasOwn(over, base.id), `${base.id} 없음`);
        const o = over[base.id];
        for (const key of Object.keys(o)) assert.ok(!FIXED.has(key), `${base.id}: 공통 칸 ${key}는 바꾸지 않는다`);
        if (o.criteria) assert.ok(o.criteria.length <= base.criteria.length, `${base.id}: 기준 수는 그대로`);
        if (job.id !== "office") {
          assert.equal(typeof o.mission, "string", `${base.id}: 할 일(mission)을 이 직무 상황으로`);
          assert.notEqual(o.mission, base.mission, `${base.id}: 할 일이 공통과 같음`);
        }
        const text = JSON.stringify(o, (k, v) => (v instanceof RegExp ? v.source : v));
        for (const re of BANNED) assert.doesNotMatch(text, re);

        const l = lessonFor(base, job.id);
        assert.equal(l.criteria.length, base.criteria.length);
        if (l.kind === "prompt" || l.kind === "file") {
          assert.equal(typeof l.model, "string");
          assert.equal(typeof l.outputs?.weak, "string");
          assert.equal(typeof l.outputs?.strong, "string");
          const ok = await grade(l, job.id, l.model);
          assert.equal(
            ok.passed,
            true,
            `${base.id}: 모범 답이 통과해야 함 → ${JSON.stringify(ok.criteria.filter((c) => !c.met))}`,
          );
          const bad = await grade(l, job.id, l.lecture.bad);
          assert.equal(bad.passed, false, `${base.id}: 배우기의 나쁜 예는 통과하면 안 됨`);
        }
        if (l.kind === "file") {
          for (const f of l.samples) assert.ok(existsSync(`${PUBLIC}${f.url}`), `${base.id}: 예시 파일 없음 ${f.url}`);
          const strong = checkFileOutput(l.check, l.outputs.strong);
          assert.deepEqual(strong.unknown, [], `${base.id}: 좋은 결과에 자료에 없는 숫자`);
          assert.equal(strong.coreOk, true, `${base.id}: 좋은 결과가 핵심을 못 담음`);
          const weak = checkFileOutput(l.check, l.outputs.weak);
          assert.ok(!weak.coreOk || weak.unknown.length > 0, `${base.id}: 약한 결과가 문제를 보여 주지 않음`);
        }
        if (l.kind === "sort" || l.kind === "choose") {
          const cardIds = l.cards.map((c) => c.id);
          assert.equal(new Set(cardIds).size, cardIds.length, `${base.id}: 카드 id 겹침`);
          const bins = new Set(l.bins.map((b) => b.id));
          for (const c of l.cards) assert.ok(bins.has(c.answer), `${base.id}: ${c.id}의 정답 칸 없음`);
          assert.ok(
            l.cards.some((c) => c.answer === l.pass.must),
            `${base.id}: 꼭 맞혀야 할 카드가 하나는 있어야 함`,
          );
          assert.ok(l.cards.length >= l.pass.min, `${base.id}: 카드 수가 통과 숫자보다 적음`);
          assert.equal(gradeSort(l, rightAnswer(l)).passed, true);
        }
        if (l.kind === "spot") {
          const picks = l.sentences.flatMap((s, index) => (s.answer ? [{ index, kind: s.answer }] : []));
          const hidden = Number(l.criteria[0].label.match(/(\d+)곳 중/)?.[1]);
          if (hidden) assert.equal(picks.length + 1, hidden, `${base.id}: 숨긴 곳 수(문장 + 빠진 내용 1)가 기준 문구와 다름`);
          const kinds = new Set(l.kinds.map((k) => k.id));
          for (const p of picks) assert.ok(kinds.has(p.kind), `${base.id}: 문제 종류 ${p.kind}`);
          const r = gradeSpot(l, { picks, missing: l.missing.words.slice(0, l.missing.min).join(" ") });
          assert.equal(r.passed, true, `${base.id}: 정답대로 고르면 통과해야 함`);
          assert.equal(r.score.falsePicks, 0);
          for (const s of l.sentences.filter((s) => s.answer)) {
            for (const k of ["question", "why", "kindNote"]) assert.equal(typeof s[k], "string", `${base.id}: 숨긴 문장의 ${k}`);
          }
        }
      });
    }
  });
}
