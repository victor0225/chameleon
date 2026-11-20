// 수준(초급·중급·고급)은 과정 1에서 통과한 미션으로 정한다. 한 수준의 미션을 모두 통과하면 다음 수준이다.
// 교육 화면과 내 정보가 같은 규칙을 쓰도록 여기 한 곳에 둔다.
import { LESSONS, XP_PER_LESSON } from "../data/curriculum.js";

export const LEVELS = ["초급", "중급", "고급"];

const missionsAt = (level) => LESSONS.filter((l) => l.level === level);
const allDone = (level, done) => missionsAt(level).every((l) => done.has(l.id));

// completed: 통과한 미션 id 목록(다른 과정 미션이 섞여 있어도 된다)
export function levelOf(completed = []) {
  const done = new Set(completed);
  let i = 0;
  while (i < LEVELS.length - 1 && allDone(LEVELS[i], done)) i += 1;
  return LEVELS[i];
}

// 다음 수준까지 남은 XP: 지금 수준에서 아직 못 넘은 미션 수 × 미션 XP. 가장 높은 수준이면 null.
export function xpToNext(completed = []) {
  const level = levelOf(completed);
  if (level === LEVELS.at(-1)) return null;
  const done = new Set(completed);
  return missionsAt(level).filter((l) => !done.has(l.id)).length * XP_PER_LESSON;
}
