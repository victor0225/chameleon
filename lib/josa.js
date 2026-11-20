// 앞말 받침에 맞는 조사를 붙인다. pair: [받침 있을 때, 없을 때] 예: ["이", "가"], ["으로", "로"]
// '으로/로'는 받침이 ㄹ이어도 '로'다(파일로, 회의록으로).
export function josa(word, pair) {
  const code = word.trim().charCodeAt(word.trim().length - 1) - 0xac00;
  const final = code >= 0 && code <= 11171 ? code % 28 : 0;
  const rieul = final === 8 && pair[1] === "로";
  return word.trim() + (final !== 0 && !rieul ? pair[0] : pair[1]);
}
