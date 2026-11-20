// 작업 J: 처음 열 때 화면 안내를 띄울지 정하는 순수 함수와 /api/tour 본문 검사
import assert from "node:assert/strict";
import { test } from "node:test";
import { TOURS } from "../data/tours.js";
import { cleanSeen, cleanTourView, mergeSeen, shouldShow, toUpload, visibleSteps } from "../lib/tour.js";

test("안내 데이터: 화면 열 곳에 2~4단계, 단계마다 짚을 곳·제목·설명이 있다", () => {
  assert.deepEqual(Object.keys(TOURS), ["home", "diagnosis", "result", "compare", "helper", "learn", "mission", "feedback", "ranking", "mypage"]);
  for (const [id, tour] of Object.entries(TOURS)) {
    assert.ok(tour.steps.length >= 2 && tour.steps.length <= 4, id);
    for (const step of tour.steps) assert.ok(step.target && step.title && step.body, `${id} ${step.target}`);
  }
  assert.match(TOURS.mission.steps.at(-1).body, /처음 푼 점수가 부문 점수와 랭킹에 들어가요/);
});

test("shouldShow: 본 적 없는 안내만 띄우고, 건너뛴 것도 본 것으로 친다", () => {
  assert.equal(shouldShow("mission", {}), true);
  assert.equal(shouldShow("mission", null), true);
  assert.equal(shouldShow("mission", { mission: "done" }), false);
  assert.equal(shouldShow("mission", { mission: "skipped" }), false);
  assert.equal(shouldShow("nope", {}), false, "모르는 안내는 띄우지 않는다");
});

test("visibleSteps: 화면에 짚을 곳이 있는 단계만 남긴다", () => {
  const steps = TOURS.feedback.steps;
  assert.deepEqual(visibleSteps(steps, ["feedback-score", "feedback-coach"]), steps);
  // 통과해서 코칭 질문이 없으면 점수 단계만
  assert.deepEqual(
    visibleSteps(steps, ["feedback-score", "mission-steps"]).map((st) => st.target),
    ["feedback-score"],
  );
  assert.deepEqual(visibleSteps(steps, []), []);
});

test("mergeSeen·toUpload: 같은 안내면 서버 것을 쓰고, 서버에 없는 브라우저 기록만 올린다", () => {
  const local = { home: "done", mission: "skipped", junk: "done", learn: "maybe" };
  const server = { mission: "done", ranking: "skipped" };
  assert.deepEqual(cleanSeen(local), { home: "done", mission: "skipped" });
  assert.deepEqual(mergeSeen(local, server), { home: "done", mission: "done", ranking: "skipped" });
  assert.deepEqual(toUpload(local, server), [["home", "done"]]);
  assert.deepEqual(cleanSeen("깨진 값"), {});
});

test("POST /api/tour 본문: data/tours.js에 없는 안내와 모르는 상태는 막는다", () => {
  assert.deepEqual(cleanTourView({ tourId: "mission", status: "skipped", step: 1 }), {
    value: { tourId: "mission", status: "skipped", step: 1, merge: false },
  });
  assert.deepEqual(cleanTourView({ tourId: "home", status: "done", step: 3, merge: true }).value.merge, true);
  assert.equal(cleanTourView({ tourId: "admin", status: "done", step: 0 }).error, "모르는 화면 안내예요.");
  assert.equal(cleanTourView({ tourId: "__proto__", status: "done" }).error, "모르는 화면 안내예요.");
  assert.ok(cleanTourView({ tourId: "home", status: "seen" }).error);
  assert.equal(cleanTourView({ tourId: "home", status: "done", step: 999 }).value.step, 0, "이상한 단계 번호는 0으로");
  assert.ok(cleanTourView(null).error);
});
