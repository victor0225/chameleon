// 로그인 뒤 돌아갈 주소. 다른 사이트로 보내지 않게 이 사이트 안의 경로만 받는다.
// URL 해석기는 탭·줄바꿈을 지우므로("/\t/evil.com" → "//evil.com") 제어 문자를 막고, 해석한 결과의 출처도 확인한다.
export function safeNext(value) {
  if (typeof value !== "string" || value.length > 200) return "/";
  if (/[\u0000-\u001f\u007f]/.test(value) || !/^\/(?![/\\])/.test(value)) return "/";
  const base = "http://same-origin.invalid";
  const url = new URL(value, base);
  return url.origin === base ? url.pathname + url.search + url.hash : "/";
}
