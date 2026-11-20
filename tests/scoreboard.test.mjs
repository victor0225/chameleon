import assert from "node:assert/strict";
import { test } from "node:test";
import { findAnyLesson } from "../data/courses.js";
import { gradeSort, gradeSpot } from "../lib/server/practice.js";
import { areaScores, lessonPoints, nicknameError, rankRows } from "../lib/scoreboard.js";

const lesson = (id) => findAnyLesson(id);
const met = (...flags) => ({ criteria: flags.map((m) => ({ label: "", item: null, met: m })) });

test("prompt·file 강의: 채운 기준 수 ÷ 전체 기준 수, 정수로 반올림", () => {
  assert.equal(lessonPoints(lesson("b1"), met(true, true, false)), 67);
  assert.equal(lessonPoints(lesson("file1"), { ...met(true, true, true, false), check: { unknown: ["3.5", "30"] } }), 75);
  assert.equal(lessonPoints(lesson("mem2"), met(false, false)), 0);
});

test("sort·choose 강의: 맞힌 카드 수 ÷ 전체 카드 수", () => {
  const mem1 = lesson("mem1");
  const answer = Object.fromEntries(mem1.cards.map((c, i) => [c.id, i === 0 ? "nowhere" : c.answer]));
  assert.equal(lessonPoints(mem1, gradeSort(mem1, answer)), Math.round((7 / 8) * 100));
  assert.equal(lessonPoints(lesson("tool1"), { score: { right: 5, total: 6 } }), 83);
});

test("spot 강의: 맞는 문장을 틀렸다고 고른 만큼 빼고, 0 아래로는 내려가지 않는다", () => {
  const ver1 = lesson("ver1");
  const all = { picks: ver1.sentences.map((s, index) => ({ index, kind: ver1.kinds[0].id })), missing: "" };
  const hidden = ver1.sentences.filter((s) => s.answer).length + 1;
  const wrongOk = ver1.sentences.length - (hidden - 1);
  // 문장을 전부 고르면 숨긴 문장은 다 찾지만, 맞는 문장을 고른 만큼 빠진다.
  assert.equal(lessonPoints(ver1, gradeSpot(ver1, all)), Math.round((Math.max(0, hidden - 1 - wrongOk) / hidden) * 100));
  assert.equal(lessonPoints(ver1, { score: { found: 3, total: 4, falsePicks: 1 } }), 50);
  assert.equal(lessonPoints(ver1, { score: { found: 1, total: 4, falsePicks: 3 } }), 0);
});

test("부문 점수: 푼 강의들의 평균, 안 푼 부문은 0점, 같이 보면 좋은 강의는 원래 과정에만 센다", () => {
  const r = areaScores({ b1: 100, m3: 50, mem1: 88, ver1: 75, nope: 100 });
  const score = Object.fromEntries(r.areas.map((a) => [a.course, a.score]));
  // m3는 과정 6의 같이 보면 좋은 강의지만 과정 1(prompt)에만 들어간다.
  assert.deepEqual(score, { prompt: 75, memory: 88, file: 0, verify: 75, tool: 0, flow: null });
  assert.equal(r.total, 75 + 88 + 75);
  assert.equal(r.done, 4, "모르는 강의 id는 세지 않는다");
});

test("준비 중 과정은 합계와 만점에서 빼고, 만점은 열린 과정 수 × 100", () => {
  const empty = areaScores({});
  assert.equal(empty.total, 0);
  assert.equal(empty.max, 500);
  assert.deepEqual(
    empty.areas.find((a) => a.course === "flow"),
    { course: "flow", score: null, done: 0 },
  );
});

test("순위: 합계가 높은 순, 같으면 푼 강의가 많은 순, 그래도 같으면 같은 순위", () => {
  const rows = rankRows([
    { id: "a", total: 300, done: 4 },
    { id: "b", total: 320, done: 2 },
    { id: "c", total: 300, done: 6 },
    { id: "d", total: 300, done: 4 },
    { id: "e", total: 0, done: 0 },
  ]);
  assert.deepEqual(
    rows.map((r) => `${r.id}${r.rank}`),
    ["b1", "c2", "a3", "d3", "e5"],
  );
});

test("별명: 2~12자, 한글·영문·숫자·띄어쓰기만", () => {
  assert.equal(nicknameError("프롬프트 장인 7"), null);
  assert.equal(nicknameError("  ab  "), null);
  assert.match(nicknameError("가"), /2~12자/);
  assert.match(nicknameError("열세글자가넘는아주긴별명이에요"), /2~12자/);
  assert.match(nicknameError("<script>"), /한글, 영문, 숫자/);
  assert.match(nicknameError(42), /2~12자/);
});
