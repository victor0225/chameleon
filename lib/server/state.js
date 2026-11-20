// 화면이 보내는 상태({ profile, survey, diagnosis, record })를 DB에 넣기 전에 검사하고 다듬는다.
// 모르는 값은 버리고, 너무 큰 값은 자른다. 형식이 크게 틀리면 { error }를 돌려준다.
import { LESSONS } from "../../data/curriculum.js";
import { EXPERIENCE, JOB } from "../../data/jobs.js";
import { ITEMS } from "../items.js";

export const LEVELS = ["초급", "중급", "고급"];
const IDS = ITEMS.map((item) => item.id);
const LESSON_IDS = new Set(LESSONS.map((l) => l.id));
const MAX_DETAIL = 60000;

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const int = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : 0);
const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : undefined);
const job = (v) => (typeof v === "string" && Object.hasOwn(JOB, v) ? v : null);
const exp = (v) => (typeof v === "string" && Object.hasOwn(EXPERIENCE, v) ? v : null);
const items = (v) => (Array.isArray(v) ? [...new Set(v.filter((id) => IDS.includes(id)))] : []);

function cleanProfile(p) {
  if (!isObj(p) || !job(p.job) || !LEVELS.includes(p.level)) return null;
  return { job: p.job, experience: exp(p.experience), level: p.level };
}

function cleanSurvey(s) {
  return isObj(s) && job(s.job) ? { job: s.job, experience: exp(s.experience) } : null;
}

export function cleanRecord(r) {
  const record = isObj(r) ? r : {};
  const completed = Array.isArray(record.completed)
    ? [...new Set(record.completed.filter((id) => LESSON_IDS.has(id)))]
    : [];
  const tries = {};
  if (isObj(record.tries)) for (const [id, n] of Object.entries(record.tries)) if (LESSON_IDS.has(id)) tries[id] = int(n, 1000);
  const mastery = Object.fromEntries(IDS.map((id) => [id, int(record.mastery?.[id], 100)]));
  const history = (Array.isArray(record.history) ? record.history : [])
    .filter(isObj)
    .slice(0, 6)
    .map((h) => ({
      ...(h.kind === "levelup" ? { kind: "levelup" } : {}),
      ...(LESSON_IDS.has(h.lessonId) ? { lessonId: h.lessonId } : {}),
      title: str(h.title, 80) ?? "",
      ...(typeof h.passed === "boolean" ? { passed: h.passed } : {}),
      ...(h.tries !== undefined ? { tries: int(h.tries, 1000) } : {}),
      ...(h.xp !== undefined ? { xp: int(h.xp, 1000) } : {}),
    }));
  const levelUpSeen = Array.isArray(record.levelUpSeen) ? [...new Set(record.levelUpSeen.filter((lv) => LEVELS.includes(lv)))] : [];
  return { xp: int(record.xp, 100000), completed, tries, mastery, history, levelUpSeen };
}

// 진단의 핵심 칸은 열로, 나머지(segments, comment, guess, compare 등)는 detail JSON으로 둔다.
export function cleanDiagnosis(d) {
  if (!isObj(d)) return null;
  const at = typeof d.at === "string" && !Number.isNaN(Date.parse(d.at)) ? new Date(d.at).toISOString() : null;
  const prompt = typeof d.prompt === "string" && d.prompt.trim() ? d.prompt.slice(0, 3000) : null;
  if (!at || !prompt || !job(d.job) || !LEVELS.includes(d.level)) return null;
  const rest = { ...d };
  for (const k of ["at", "prompt", "job", "experience", "level", "found", "missing"]) delete rest[k];
  let detail = rest;
  // 결과 비교·추측 결과가 너무 크면 그것만 빼고 저장한다.
  if (JSON.stringify(detail).length > MAX_DETAIL) {
    delete detail.compare;
    delete detail.compareBefore;
    delete detail.guess;
    if (isObj(detail.before)) detail.before = { ...detail.before, guess: null };
    if (JSON.stringify(detail).length > MAX_DETAIL) detail = {};
  }
  return { at, prompt, job: d.job, experience: exp(d.experience), level: d.level, found: items(d.found), missing: items(d.missing), detail };
}

export function cleanState(body) {
  if (!isObj(body)) return { error: "요청 형식이 올바르지 않아요." };
  return {
    value: {
      profile: cleanProfile(body.profile),
      survey: cleanSurvey(body.survey),
      diagnosis: cleanDiagnosis(body.diagnosis),
      record: cleanRecord(body.record),
    },
  };
}
