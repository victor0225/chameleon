/**
 * 기능 1 클라이언트 호출 도우미. 팀원의 Next.js 프론트엔드에서 가져다 쓸 수 있습니다.
 * 기존 공통 계약을 유지하며, 결과에는 prompt와 segments가 있습니다.
 */
async function callPrompt(body) {
  const response = await fetch("/api/prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || "프롬프트 처리에 실패했습니다.");
  }
  return data;
}

export function generatePrompt({ level, job, userInput }) {
  return callPrompt({ mode: "generate", level, job, userInput });
}

export function revisePrompt({ level, job, userInput, previousPrompt, revisionRequest }) {
  return callPrompt({
    mode: "revise", level, job, userInput, previousPrompt, revisionRequest,
  });
}
