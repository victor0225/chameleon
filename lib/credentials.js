// 가입·로그인 입력 규칙. 화면(바로 안내)과 서버(최종 검사)가 같은 규칙을 쓴다.
export const LOGIN_ID = /^[a-z0-9]{4,20}$/;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 100;
export const NAME_MAX = 20;

export const RULE = {
  loginId: "영문 소문자와 숫자로 4~20자",
  password: `${PASSWORD_MIN}자 이상`,
};

// 틀린 칸이 있으면 { field, message }, 모두 맞으면 null.
export function checkSignup({ loginId, password, passwordConfirm, name }) {
  if (typeof loginId !== "string" || !LOGIN_ID.test(loginId))
    return { field: "loginId", message: `아이디는 ${RULE.loginId}` };
  if (typeof password !== "string" || password.length < PASSWORD_MIN)
    return { field: "password", message: `비밀번호는 ${PASSWORD_MIN}자 이상` };
  if (password.length > PASSWORD_MAX)
    return { field: "password", message: `비밀번호는 ${PASSWORD_MAX}자 이하` };
  if (passwordConfirm !== password) return { field: "passwordConfirm", message: "비밀번호 확인이 위 비밀번호와 다름" };
  if (typeof name !== "string" || !name.trim()) return { field: "name", message: "이름 쓰기" };
  if (name.trim().length > NAME_MAX) return { field: "name", message: `이름은 ${NAME_MAX}자 이하` };
  return null;
}

export function checkLogin({ loginId, password }) {
  if (typeof loginId !== "string" || !loginId.trim()) return { field: "loginId", message: "아이디 쓰기" };
  if (typeof password !== "string" || !password) return { field: "password", message: "비밀번호 쓰기" };
  if (loginId.length > 40 || password.length > PASSWORD_MAX) return { field: "password", message: "아이디 또는 비밀번호가 맞지 않음" };
  return null;
}
