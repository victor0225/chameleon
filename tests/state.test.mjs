import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanState } from "../lib/server/state.js";
import { mergeRecords, mergeStates } from "../lib/syncState.js";

const diagnosis = (at, extra = {}) => ({
  at,
  job: "marketing",
  experience: "none",
  level: "초급",
  prompt: "신제품 SNS 글 써 줘",
  found: ["goal"],
  missing: ["context", "constraint", "format", "criteria"],
  segments: [{ text: "신제품 SNS 글 써 줘", items: ["goal"] }],
  ...extra,
});

test("저장 전 검사: 모르는 직무·강의·요소는 버리고 숫자는 범위 안으로 둔다", () => {
  const { value } = cleanState({
    profile: { job: "marketing", experience: "none", level: "중급" },
    survey: { job: "toString" },
    diagnosis: diagnosis("2026-11-20T10:00:00.000Z", { found: ["goal", "mood"] }),
    record: {
      xp: -5,
      completed: ["b1", "b1", "zz", "mem1"],
      tries: { b1: 2, zz: 9, m2: "a" },
      mastery: { goal: 140, format: 30, mood: 50 },
      history: [{ lessonId: "b1", title: "x", passed: true, tries: 1, xp: 30, extra: "drop" }],
      levelUpSeen: ["초급", "최고급"],
    },
  });
  assert.deepEqual(value.profile, { job: "marketing", experience: "none", level: "중급" });
  assert.equal(value.survey, null);
  assert.deepEqual(value.diagnosis.found, ["goal"]);
  assert.deepEqual(value.diagnosis.detail.segments, [{ text: "신제품 SNS 글 써 줘", items: ["goal"] }]);
  // 과정 2~4 강의 id도 남는다.
  assert.deepEqual(value.record.completed, ["b1", "mem1"]);
  assert.deepEqual(value.record.tries, { b1: 2, m2: 0 });
  assert.equal(value.record.xp, 0);
  assert.deepEqual(value.record.mastery, { goal: 0, context: 0, constraint: 0, format: 30, criteria: 0 });
  assert.deepEqual(value.record.history, [{ lessonId: "b1", title: "x", passed: true, tries: 1, xp: 30 }]);
  assert.deepEqual(value.record.levelUpSeen, ["초급"]);
  assert.match(cleanState(null).error, /형식/);
});

test("저장 전 검사: 날짜나 프롬프트가 없는 진단은 넣지 않고, 너무 큰 비교 결과는 뺀다", () => {
  assert.equal(cleanState({ diagnosis: diagnosis("어제") }).value.diagnosis, null);
  assert.equal(cleanState({ diagnosis: diagnosis("2026-11-20T10:00:00.000Z", { prompt: " " }) }).value.diagnosis, null);
  const big = cleanState({ diagnosis: diagnosis("2026-11-20T10:00:00.000Z", { compare: { run: { output: "가".repeat(70000) } } }) });
  assert.equal(big.value.diagnosis.detail.compare, undefined);
  assert.ok(big.value.diagnosis.detail.segments);
});

test("기록 합치기: 어느 쪽에서 끝낸 강의도 잃지 않는다", () => {
  const local = { xp: 30, completed: ["b1"], tries: { b1: 1 }, mastery: { goal: 20, format: 0 }, history: [{ title: "a" }], levelUpSeen: [] };
  const server = { xp: 60, completed: ["b2", "b3"], tries: { b1: 3, b2: 1 }, mastery: { goal: 0, format: 40 }, history: [{ title: "b" }, { title: "a" }], levelUpSeen: ["초급"] };
  const merged = mergeRecords(local, server);
  assert.deepEqual(merged.completed, ["b1", "b2", "b3"]);
  assert.equal(merged.xp, 90);
  assert.deepEqual(merged.tries, { b1: 3, b2: 1 });
  assert.deepEqual(merged.mastery, { goal: 20, format: 40 });
  assert.deepEqual(merged.history, [{ title: "a" }, { title: "b" }]);
  // DB에서 키 순서가 바뀌어 돌아와도 같은 기록은 한 번만 남는다.
  const twice = mergeRecords(
    { ...local, history: [{ lessonId: "b2", title: "x", passed: false, tries: 1, xp: 0 }] },
    { ...server, history: [{ xp: 0, tries: 1, title: "x", passed: false, lessonId: "b2" }] },
  );
  assert.equal(twice.history.length, 1);
  assert.deepEqual(merged.levelUpSeen, ["초급"]);
});

test("상태 합치기: 더 최근 진단을 쓰고, 프로필도 그 진단을 한 쪽을 따른다", () => {
  const local = { profile: { level: "고급" }, survey: null, diagnosis: diagnosis("2026-11-20T12:00:00.000Z"), record: null };
  const server = { profile: { level: "초급" }, survey: { job: "office" }, diagnosis: diagnosis("2026-11-19T12:00:00.000Z"), record: null };
  const a = mergeStates(local, server);
  assert.equal(a.diagnosis.at, "2026-11-20T12:00:00.000Z");
  assert.equal(a.profile.level, "고급");
  assert.deepEqual(a.survey, { job: "office" });
  const b = mergeStates({ ...local, diagnosis: null, profile: null }, server);
  assert.equal(b.profile.level, "초급");
  assert.equal(mergeStates(local, null), local);
});

test("설문 3번 답(used)은 아는 것만 한 번씩 남기고, 없으면 넣지 않는다", () => {
  const { value } = cleanState({ survey: { job: "office", experience: "often", used: ["file", "file", "hack", 3, "memory"] } });
  assert.deepEqual(value.survey, { job: "office", experience: "often", used: ["file", "memory"] });
  assert.deepEqual(cleanState({ survey: { job: "office", experience: "often" } }).value.survey, { job: "office", experience: "often" });
});


test("관심 직무: 진단 전이라 수준 없이 직무만 있어도 받고, 모르는 직무·수준은 null로 둔다", () => {
  assert.deepEqual(cleanState({ profile: { job: "dev" } }).value.profile, { job: "dev", experience: null, level: null });
  assert.deepEqual(cleanState({ profile: { job: "pilot", level: "중급" } }).value.profile, { job: null, experience: null, level: "중급" });
  assert.deepEqual(cleanState({ profile: { job: "dev", level: "최고급" } }).value.profile, { job: "dev", experience: null, level: null });
  assert.equal(cleanState({ profile: { job: "pilot" } }).value.profile, null);
  assert.equal(cleanState({ profile: { job: "toString", level: "만렙" } }).value.profile, null);
  assert.equal(cleanState({ profile: "dev" }).value.profile, null);
});

test("로그인할 때 관심 직무: 계정에 있으면 계정 것, 없으면 손님 때 고른 것", () => {
  const record = null;
  const guest = { profile: { job: "dev" }, survey: null, diagnosis: null, record };
  // 계정 직무가 이긴다. 다른 프로필 칸은 원래 규칙(최근 진단 쪽)을 따른다.
  const account = { profile: { job: "marketing", experience: null, level: null }, survey: null, diagnosis: null, record };
  assert.equal(mergeStates(guest, account).profile.job, "marketing");
  const diagnosed = { ...guest, profile: { job: "dev", experience: "none", level: "중급" }, diagnosis: diagnosis("2026-11-20T12:00:00.000Z") };
  assert.deepEqual(mergeStates(diagnosed, account).profile, { job: "marketing", experience: "none", level: "중급" });
  // 계정에 직무가 없으면 손님 직무를 남긴다.
  assert.deepEqual(mergeStates(guest, { ...account, profile: null }).profile, { job: "dev" });
  assert.deepEqual(mergeStates(guest, { ...account, profile: { job: null, experience: null, level: "고급" } }).profile, {
    job: "dev",
    experience: null,
    level: "고급",
  });
  // 둘 다 없으면 프로필도 없다.
  assert.equal(mergeStates({ ...guest, profile: null }, { ...account, profile: null }).profile, null);
});

// 작업 Q: 손님은 관심 직무 없이 진단할 수 있다. 가입하며 합칠 때 그 진단을 버리면 진단 추천이 사라진다.
test("직무 없는 손님 진단: 같은 요청의 관심 직무, 없으면 계정 직무로 채워 저장하고, 둘 다 없으면 버린다", () => {
  const guest = diagnosis("2026-11-21T09:00:00.000Z", { job: null });
  const withProfile = cleanState({ profile: { job: "sales" }, diagnosis: guest }).value.diagnosis;
  assert.equal(withProfile.job, "sales");
  assert.equal(withProfile.prompt, guest.prompt);
  assert.equal(cleanState({ diagnosis: guest }, { accountJob: "dev" }).value.diagnosis.job, "dev");
  assert.equal(cleanState({ profile: { job: "cs" }, diagnosis: guest }, { accountJob: "dev" }).value.diagnosis.job, "cs");
  assert.equal(cleanState({ diagnosis: guest }).value.diagnosis, null);
  assert.equal(cleanState({ diagnosis: guest }, { accountJob: "nope" }).value.diagnosis, null);
  // 진단에 직무가 있으면 그대로 쓴다.
  assert.equal(cleanState({ profile: { job: "sales" }, diagnosis: diagnosis("2026-11-21T09:00:00.000Z") }).value.diagnosis.job, "marketing");
});

test("가입 직후 합치기: 손님 진단이 계정 직무와 함께 서버로 가서 저장된다", () => {
  const local = { profile: null, survey: null, diagnosis: diagnosis("2026-11-21T09:00:00.000Z", { job: null }), record: undefined };
  const server = { profile: { job: "marketing", experience: null, level: null }, survey: null, diagnosis: null, record: undefined };
  const merged = mergeStates(local, server);
  assert.equal(merged.diagnosis.at, local.diagnosis.at);
  const saved = cleanState(merged).value;
  assert.equal(saved.profile.job, "marketing");
  assert.equal(saved.diagnosis.job, "marketing");
});
