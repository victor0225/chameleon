export function josa(word, pair) {
  const code = word.trim().charCodeAt(word.trim().length - 1) - 0xac00;
  const hasFinalConsonant = code >= 0 && code <= 11171 && code % 28 !== 0;
  return word.trim() + (hasFinalConsonant ? pair[0] : pair[1]);
}
