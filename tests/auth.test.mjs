import assert from "node:assert/strict";
import { test } from "node:test";
import { checkLogin, checkName, checkPasswordChange, checkSignup } from "../lib/credentials.js";
import { safeNext } from "../lib/safeNext.js";
import { hashPassword, verifyPassword } from "../lib/server/password.js";
import { hasSessionSecret, readSession, signSession } from "../lib/server/sessionToken.js";

// DB 없이 가입·로그인 판단 로직을 검사한다.
const ok = { loginId: "chameleon01", password: "12345678", passwordConfirm: "12345678", name: "카멜레온", job: "marketing" };

test("가입 규칙: 아이디는 영문 소문자·숫자 4~20자, 비밀번호는 8자 이상이고 다른 조건은 없다", () => {
  assert.equal(checkSignup(ok), null);
  assert.equal(checkSignup({ ...ok, password: "aaaaaaaa", passwordConfirm: "aaaaaaaa" }), null);
  for (const loginId of ["abc", "a".repeat(21), "Chameleon", "cha_meleon", "카멜레온12", "cha meleon", ""]) {
    assert.equal(checkSignup({ ...ok, loginId })?.field, "loginId", loginId);
  }
  assert.equal(checkSignup({ ...ok, password: "1234567", passwordConfirm: "1234567" })?.field, "password");
  assert.equal(checkSignup({ ...ok, passwordConfirm: "12345679" })?.field, "passwordConfirm");
  assert.equal(checkSignup({ ...ok, name: "   " })?.field, "name");
  assert.equal(checkSignup({ ...ok, name: "가".repeat(21) })?.field, "name");
  assert.equal(checkSignup({})?.field, "loginId");
});

test("가입 규칙: 관심 직무는 다섯 직무 중 하나를 꼭 고르고, 다른 칸이 먼저 틀리면 그 칸부터 알린다", () => {
  for (const job of ["office", "marketing", "cs", "sales", "dev"]) assert.equal(checkSignup({ ...ok, job }), null, job);
  for (const job of [undefined, null, "", "pilot", "toString", 3]) {
    assert.deepEqual(checkSignup({ ...ok, job }), { field: "job", message: "관심 직무를 하나 고르기" }, String(job));
  }
  assert.equal(checkSignup({ ...ok, job: null, name: "" })?.field, "name");
});

test("이름 바꾸기: 가입과 같은 규칙(빈 이름, 20자 넘는 이름은 막음)", () => {
  assert.equal(checkName("김하늘"), null);
  assert.equal(checkName(" 김하늘 "), null);
  assert.equal(checkName("  ")?.field, "name");
  assert.equal(checkName("가".repeat(21))?.field, "name");
  assert.equal(checkName(undefined)?.field, "name");
});

test("비밀번호 바꾸기: 지금 비밀번호, 새 비밀번호 8자 이상, 확인 일치, 지금과 다른 비밀번호", () => {
  const change = { current: "12345678", next: "abcdefgh", confirm: "abcdefgh" };
  assert.equal(checkPasswordChange(change), null);
  assert.equal(checkPasswordChange({ ...change, current: "" })?.field, "current");
  assert.equal(checkPasswordChange({ ...change, next: "abc", confirm: "abc" })?.field, "next");
  assert.equal(checkPasswordChange({ ...change, next: "a".repeat(101), confirm: "a".repeat(101) })?.field, "next");
  assert.equal(checkPasswordChange({ ...change, confirm: "abcdefgx" })?.field, "confirm");
  assert.equal(checkPasswordChange({ ...change, next: "12345678", confirm: "12345678" })?.field, "next");
  assert.equal(checkPasswordChange({})?.field, "current");
});

test("로그인 규칙: 빈 칸만 막고, 맞는지는 서버가 DB로 본다", () => {
  assert.equal(checkLogin({ loginId: "chameleon01", password: "x" }), null);
  assert.equal(checkLogin({ loginId: " ", password: "x" })?.field, "loginId");
  assert.equal(checkLogin({ loginId: "chameleon01", password: "" })?.field, "password");
});

test("비밀번호: 원문을 남기지 않고, 같은 비밀번호도 매번 다르게 해시하며, 맞는 것만 통과한다", async () => {
  const a = await hashPassword("12345678");
  const b = await hashPassword("12345678");
  assert.match(a, /^scrypt\$16384\$8\$1\$/);
  assert.ok(!a.includes("12345678"));
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("12345678", a), true);
  assert.equal(await verifyPassword("12345679", a), false);
  assert.equal(await verifyPassword("12345678", "엉뚱한 값"), false);
  // 한글은 조합형(NFD)으로 들어와도 같은 비밀번호로 본다.
  const korean = await hashPassword("카멜레온비밀번호");
  assert.equal(await verifyPassword("카멜레온비밀번호".normalize("NFD"), korean), true);
});

test("돌아갈 주소는 이 사이트 안의 경로만 받는다", () => {
  assert.equal(safeNext("/learn"), "/learn");
  assert.equal(safeNext("/diagnosis/result?x=1#a"), "/diagnosis/result?x=1#a");
  const sneaky = ["/\t/evil.com", "/\n/evil.com", "/\r\\evil.com", "/\u0000/evil.com"];
  for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "learn", null, undefined, `/${"a".repeat(300)}`, ...sneaky]) {
    assert.equal(safeNext(bad), "/", String(bad));
  }
});

test("세션 토큰: 같은 키로만 열리고, 키가 짧으면 로그인을 끈다", async () => {
  process.env.SESSION_SECRET = "s".repeat(40);
  const token = await signSession("session-1");
  assert.deepEqual(await readSession(token), { sid: "session-1" });
  assert.equal(await readSession(`${token.slice(0, -2)}xx`), null);
  assert.equal(await readSession("not-a-token"), null);
  process.env.SESSION_SECRET = "t".repeat(40);
  assert.equal(await readSession(token), null);
  process.env.SESSION_SECRET = "short";
  assert.equal(hasSessionSecret(), false);
  assert.equal(await readSession(token), null);
});
