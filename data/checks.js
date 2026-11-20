// 여러 미션이 같이 쓰는 규칙 채점 정규식(키가 없을 때 쓴다). 미션 데이터는 data/courses.js, data/moreMissions.js.

// 받을 모양을 정했다(file1, file2 등)
export const FORMAT_CHECK = /목록|번호|표로|표 형식|불릿|항목|한 줄|\d+\s*줄|(한|두|세)\s*(줄|문장)|이내/;

// 자료에 없는 내용은 지어내지 말라고 했다(file1, file3 등)
export const NO_MADE_UP_CHECK =
  /없는\s*(내용|숫자|정보)|지어내|추측|모르(면|는)|확인\s*필요|확실하지|있는\s*(내용|숫자)만|나온\s*(내용|숫자)만|근거/;

// 두 정규식 중 하나라도 맞으면 맞는 정규식
export const either = (a, b) => new RegExp(`${a.source}|${b.source}`, a.flags);
