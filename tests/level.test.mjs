import assert from "node:assert/strict";
import { test } from "node:test";
import { LESSONS, XP_PER_LESSON } from "../data/curriculum.js";
import { LEVELS, levelOf, xpToNext } from "../lib/level.js";

const idsAt = (level) => LESSONS.filter((l) => l.level === level).map((l) => l.id);

test("수준: 한 수준의 미션을 모두 통과해야 다음 수준", () => {
  assert.deepEqual(LEVELS, ["초급", "중급", "고급"]);
  assert.equal(levelOf([]), "초급");
  assert.equal(levelOf(), "초급");
  assert.equal(levelOf(idsAt("초급").slice(1)), "초급", "하나라도 남으면 그대로");
  assert.equal(levelOf(idsAt("초급")), "중급");
  assert.equal(levelOf([...idsAt("초급"), ...idsAt("중급")]), "고급");
  assert.equal(levelOf([...idsAt("초급"), ...idsAt("중급"), ...idsAt("고급")]), "고급");
  // 위 수준 미션만 먼저 끝내도 아래 수준을 다 끝내기 전에는 오르지 않는다.
  assert.equal(levelOf(idsAt("중급")), "초급");
  // 다른 과정 미션이나 모르는 id는 세지 않는다.
  assert.equal(levelOf(["mem1", "ver1", "zz"]), "초급");
});

test("다음 수준까지 XP: 지금 수준에서 남은 미션 × 미션 XP, 가장 높은 수준이면 null", () => {
  assert.equal(xpToNext([]), idsAt("초급").length * XP_PER_LESSON);
  assert.equal(xpToNext(idsAt("초급").slice(0, 2)), (idsAt("초급").length - 2) * XP_PER_LESSON);
  assert.equal(xpToNext(idsAt("초급")), idsAt("중급").length * XP_PER_LESSON);
  assert.equal(xpToNext([...idsAt("초급"), idsAt("중급")[0]]), (idsAt("중급").length - 1) * XP_PER_LESSON);
  assert.equal(xpToNext([...idsAt("초급"), ...idsAt("중급")]), null);
});
