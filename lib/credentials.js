// 가입·로그인 입력 규칙. 화면(바로 안내)과 서버(최종 검사)가 같은 규칙을 쓴다.
import { JOB } from "../data/jobs.js";

export const LOGIN_ID = /^[a-z0-9]{4,20}$/;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 100;
export const NAME_MAX = 20;

export const RULE = {
  loginId: "영문 소문자와 숫자로 4~20자",
  password: `${PASSWORD_MIN}자 이상`,
};

export const isJob = (job) => typeof job === "string" && Object.hasOwn(JOB, job);

function checkPassword(password, field, what = "비밀번호") {
  if (typeof password !== "string" || password.length < PASSWORD_MIN) return { field, message: `${what}는 ${PASSWORD_MIN}자 이상` };
  if (password.length > PASSWORD_MAX) return { field, message: `${what}는 ${PASSWORD_MAX}자 이하` };
  return null;
}

// 가입과 내 정보의 이름 바꾸기가 같이 쓴다.
export function checkName(name) {
  if (typeof name !== "string" || !name.trim()) return { field: "name", message: "이름 쓰기" };
  if (name.trim().length > NAME_MAX) return { field: "name", message: `이름은 ${NAME_MAX}자 이하` };
  return null;
}

// 틀린 칸이 있으면 { field, message }, 모두 맞으면 null. 화면의 칸 순서대로 먼저 틀린 칸 하나를 알려 준다.
export function checkSignup({ loginId, password, passwordConfirm, name, job }) {
  if (typeof loginId !== "string" || !LOGIN_ID.test(loginId))
    return { field: "loginId", message: `아이디는 ${RULE.loginId}` };
  const badPassword = checkPassword(password, "password");
  if (badPassword) return badPassword;
  if (passwordConfirm !== password) return { field: "passwordConfirm", message: "비밀번호 확인이 위 비밀번호와 다름" };
  const badName = checkName(name);
  if (badName) return badName;
  if (!isJob(job)) return { field: "job", message: "관심 직무를 하나 고르기" };
  return null;
}

// 내 정보의 비밀번호 바꾸기 { current, next, confirm }. 지금 비밀번호가 맞는지는 서버가 DB로 본다.
export function checkPasswordChange({ current, next, confirm }) {
  if (typeof current !== "string" || !current) return { field: "current", message: "지금 비밀번호 쓰기" };
  if (current.length > PASSWORD_MAX) return { field: "current", message: "지금 비밀번호가 맞지 않음" };
  const badNext = checkPassword(next, "next", "새 비밀번호");
  if (badNext) return badNext;
  if (confirm !== next) return { field: "confirm", message: "비밀번호 확인이 새 비밀번호와 다름" };
  if (next === current) return { field: "next", message: "지금과 다른 비밀번호 쓰기" };
  return null;
}

export function checkLogin({ loginId, password }) {
  if (typeof loginId !== "string" || !loginId.trim()) return { field: "loginId", message: "아이디 쓰기" };
  if (typeof password !== "string" || !password) return { field: "password", message: "비밀번호 쓰기" };
  if (loginId.length > 40 || password.length > PASSWORD_MAX) return { field: "password", message: "아이디 또는 비밀번호가 맞지 않음" };
  return null;
}
