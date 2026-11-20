// 결과 비교 화면이 결과물 글을 나누고 세는 데 쓰는 함수들. 서버를 거치지 않는 팀 규칙이라 node --test로 바로 시험한다.

// 결과물이 몇 문장인지. 해시태그만 있는 조각은 문장으로 치지 않는다.
export function countSentences(text) {
  return String(text ?? "")
    .split(/\n+|(?<=[.!?。…])\s+/)
    .map((part) => part.replace(/#\S+/g, ""))
    .filter((part) => /[가-힣A-Za-z0-9]/.test(part)).length;
}

// {{가격}} 같은 빈칸을 따로 떼어 낸다. [{ text, blank }]
export function splitBlanks(text) {
  const parts = [];
  const re = /\{\{[^{}\n]{1,30}\}\}/g;
  let at = 0;
  for (const m of String(text ?? "").matchAll(re)) {
    if (m.index > at) parts.push({ text: text.slice(at, m.index), blank: false });
    parts.push({ text: m[0], blank: true });
    at = m.index + m[0].length;
  }
  if (at < String(text ?? "").length) parts.push({ text: text.slice(at), blank: false });
  return parts;
}

// output 안에서 marks의 quote가 처음 나오는 자리를 찾아 [{ text, mark? }] 조각으로 나눈다.
// 앞에서 잡은 자리와 겹치면 뒤에 다시 나오는 자리를 찾고, 없으면 칠하지 않는다. quote가 빈 것은 건너뛴다.
export function markRanges(output, marks) {
  const text = String(output ?? "");
  const ranges = [];
  for (const mark of marks ?? []) {
    if (!mark?.quote) continue;
    for (let from = 0; ; ) {
      const start = text.indexOf(mark.quote, from);
      if (start < 0) break;
      const end = start + mark.quote.length;
      if (ranges.every((r) => end <= r.start || start >= r.end)) {
        ranges.push({ start, end, mark });
        break;
      }
      from = start + 1;
    }
  }
  ranges.sort((a, b) => a.start - b.start);
  const parts = [];
  let at = 0;
  for (const r of ranges) {
    if (r.start > at) parts.push({ text: text.slice(at, r.start) });
    parts.push({ text: text.slice(r.start, r.end), mark: r.mark });
    at = r.end;
  }
  if (at < text.length) parts.push({ text: text.slice(at) });
  return parts;
}
