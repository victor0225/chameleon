// 진단 변화(작업 I-3). 팀 규칙이고 LLM을 쓰지 않는다.
// 진단 기록은 브라우저가 보내 저장한 값이라 개인화에만 쓰고 랭킹 점수에는 쓰지 않는다.
import { ITEMS } from "./items.js";

const IDS = ITEMS.map((i) => i.id);
const RECENT = 3; // 계속 빠지는지 볼 최근 진단 수
const REPEAT_MIN = 2; // 최근 RECENT번 중 이만큼 빠지면 "계속 빠지는 요소"

const filled = (d) => IDS.filter((id) => (d.found ?? []).includes(id)).length;

// diagnoses: [{ at, found, missing }] 순서는 상관없다(at으로 정렬한다).
// → { growth, from, to, repeatMissing: [{ id, times, of }] }
//   growth: 첫 진단보다 최근 진단에서 더 채운 요소 수(1/5 → 3/5면 2), from·to는 그때 채운 요소 수
//   repeatMissing: 최근 3번(진단이 그보다 적으면 있는 만큼) 중 2번 이상 빠진 요소. times번 빠졌고 of번 중이다.
//   진단이 2번보다 적으면 growth는 null, repeatMissing은 빈 배열이다.
export function diagnosisTrend(diagnoses) {
  const list = [...(diagnoses ?? [])].filter((d) => d?.at).sort((a, b) => new Date(a.at) - new Date(b.at));
  if (list.length < 2) return { growth: null, from: null, to: null, repeatMissing: [] };
  const first = list[0];
  const last = list.at(-1);
  const recent = list.slice(-RECENT);
  const repeatMissing = IDS.map((id) => ({ id, times: recent.filter((d) => (d.missing ?? []).includes(id)).length, of: recent.length })).filter(
    (r) => r.times >= REPEAT_MIN,
  );
  return { growth: filled(last) - filled(first), from: filled(first), to: filled(last), repeatMissing };
}
