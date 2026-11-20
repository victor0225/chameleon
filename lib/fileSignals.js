// 첨부 파일과 프롬프트를 함께 보는 팀 규칙. 파일을 붙였다고 요소가 채워진 것은 아니다.
// 프롬프트가 파일을 가리켜야 AI가 그 파일을 어디에 쓸지 안다.
import { countWord } from "./fileRules.js";

const MENTION =
  /첨부|붙인|붙여\s*준|올린|올려\s*준|이\s*파일|이\s*자료|이\s*문서|이\s*보고서|이\s*그림|이\s*사진|이\s*표|파일을|파일에|파일의|파일로|자료를\s*바탕|자료를\s*보고|자료를\s*읽|자료로|보고서를\s*읽|보고서를\s*보고|회의록을\s*보고|회의록을\s*읽|문서를\s*읽|PDF|pdf|엑셀|CSV|csv|스크린샷|캡처/;

export function mentionsFile(prompt) {
  return MENTION.test(String(prompt ?? ""));
}

// 진단 결과 화면에 띄울 질문 하나. 없으면 null.
// { prompt, files } → { kind: "unused" | "missing", question, detail } | null
export function fileCoaching({ prompt, files }) {
  const n = Array.isArray(files) ? files.length : 0;
  const mentions = mentionsFile(prompt);
  if (n > 0 && !mentions) {
    return {
      kind: "unused",
      question: "붙인 파일은 무엇이고, AI가 그걸로 무엇을 해야 하나요?",
      detail:
        n === 1
          ? "파일을 붙였지만 프롬프트에는 파일 이야기가 없어요. AI는 그 파일을 어디에 쓸지 짐작해야 해요."
          : `파일 ${countWord(n)}를 붙였지만 프롬프트에는 파일 이야기가 없어요. AI는 어느 파일을 어디에 쓸지 짐작해야 해요.`,
    };
  }
  if (n === 0 && mentions) {
    return {
      kind: "missing",
      question: "파일 이야기는 있는데 붙인 파일이 없어요.",
      detail: "AI는 보지 못한 파일을 짐작해서 답해요. 파일을 붙이거나, 필요한 내용을 프롬프트에 옮겨 주세요.",
    };
  }
  return null;
}
