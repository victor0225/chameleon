// 로그인할 때 이 브라우저의 기록과 계정(DB)의 기록을 합친다. 어느 쪽에서 한 학습도 잃지 않는 것이 원칙이다.
import { XP_PER_LESSON } from "../data/curriculum.js";

const newer = (a, b) => (!a ? b : !b ? a : Date.parse(a.at) >= Date.parse(b.at) ? a : b);
const union = (a = [], b = []) => [...new Set([...a, ...b])];
const maxEach = (a = {}, b = {}) =>
  Object.fromEntries(union(Object.keys(a), Object.keys(b)).map((k) => [k, Math.max(a[k] ?? 0, b[k] ?? 0)]));

export function mergeRecords(local, server) {
  if (!server) return local;
  if (!local) return server;
  const completed = union(local.completed, server.completed);
  const seen = new Set();
  const history = [...(local.history ?? []), ...(server.history ?? [])].filter((h) => {
    // DB(jsonb)는 객체 키 순서를 바꿔 저장하니, 키를 정렬해서 같은 기록인지 본다.
    const key = JSON.stringify(h, Object.keys(h).sort());
    return seen.has(key) ? false : seen.add(key);
  });
  return {
    xp: Math.max(local.xp ?? 0, server.xp ?? 0, completed.length * XP_PER_LESSON),
    completed,
    tries: maxEach(local.tries, server.tries),
    mastery: maxEach(local.mastery, server.mastery),
    history: history.slice(0, 6),
    levelUpSeen: union(local.levelUpSeen, server.levelUpSeen),
  };
}

// 관심 직무는 계정에 있으면 계정 것을, 없으면 이 브라우저(손님 때 고른) 것을 쓴다. 나머지 프로필 칸은 그대로 둔다.
function withJob(profile, local, server) {
  const job = server?.profile?.job ?? local?.profile?.job ?? null;
  if (!profile) return job ? { job } : null;
  return (profile.job ?? null) === job ? profile : { ...profile, job };
}

// 진단은 더 최근 것을 쓰고, 프로필과 설문도 그 진단을 한 쪽을 따른다. 관심 직무만 withJob 규칙을 따른다.
export function mergeStates(local, server) {
  if (!server) return local;
  const localWins = newer(local.diagnosis, server.diagnosis) === local.diagnosis && Boolean(local.diagnosis);
  const pick = (key) => (localWins ? (local[key] ?? server[key]) : (server[key] ?? local[key]));
  return {
    profile: withJob(pick("profile"), local, server),
    survey: pick("survey"),
    diagnosis: newer(local.diagnosis, server.diagnosis) ?? null,
    record: mergeRecords(local.record, server.record),
  };
}
