const NUMBER_WORD = "(한|두|세|네|다섯|여섯|일곱|여덟|아홉|열)";
const UNIT = "(자|줄|문장|개|건|단어|쪽|분|문단|항목|가지)";
const PATTERNS = {
  format:
    /(표로|표 형식|표를|목록|리스트|불릿|글머리|JSON|json|마크다운|항목별|번호를|번호 매겨|제목과|섹션|이메일 형식|형식으로|형태로|단계별로|예시\s*:|예시처럼|예시대로|예시와 같은)/,
  constraint: new RegExp(
    `(\\d+\\s*${UNIT}|${NUMBER_WORD}\\s?${UNIT}|이내|이하|넘지|제외|빼고|빼 ?줘|포함해|포함하|어조|말투|존댓말|반말|격식|친근|간결|짧게|쉽게)`,
  ),
  criteria:
    /(확인해|검토해|기준|빠짐없이|정확하게|정확히|모르면|모를 때|확실하지|추측|지어내|질문해|가정|근거|출처|검증)/,
  context:
    /(위해|위한|때문|목적|용도|대상|독자|팀장|고객|상사|동료|신입|읽을|읽는|보고용|발표|회의|저는|제가|우리 회사|우리 팀|상황|배경|받는 사람|받는 분)/,
  goal: /(작성|써 ?줘|써 ?주|요약|정리|분석|만들어|번역|추천|비교|알려 ?줘|짜 ?줘|계획|초안|답장)/,
};
// 한 구절에 여러 요소가 있으면 더 구체적인 요소의 색으로 칠한다.
const PRIORITY = ["format", "constraint", "criteria", "context", "goal"];
export function analyze(prompt) {
  const sentences = prompt.match(/[^.!?\n]+[.!?]*[ \t]*|\n+/g) ?? [];
  const pieces = sentences.flatMap((s) => (s.length > 40 && s.includes(",") ? s.split(/(?<=,)/) : [s]));
  const segments = pieces.map((text) => ({ text, items: PRIORITY.filter((id) => PATTERNS[id].test(text)) }));
  const found = PRIORITY.filter((id) => segments.some((s) => s.items.includes(id)));
  return { segments, found };
}
