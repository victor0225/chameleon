// 프롬프트에 들어가면 안 되는 개인정보 패턴. 고급 a3 강의 채점과 진단의 과정 추천(lib/courseSignals.js)이 같이 쓴다.
// 앞에 있는 것부터 본다. 계좌번호는 전화번호와 모양이 비슷해서 "계좌", "은행"이 함께 있을 때만 계좌로 본다.
export const PERSONAL_INFO = [
  { id: "account", name: "계좌번호", re: /(계좌|은행)[^\n]{0,12}\d{2,6}-\d{2,6}-\d{2,8}/ },
  { id: "rrn", name: "주민등록번호", re: /\d{6}[-\s]?[1-4]\d{6}/ },
  { id: "card", name: "카드 번호", re: /\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}/ },
  { id: "phone", name: "전화번호", re: /01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}|\d{2,3}-\d{3,4}-\d{4}/ },
  { id: "email", name: "이메일 주소", re: /[\w.+-]+@[\w-]+\.[\w.]+/ },
  { id: "password", name: "비밀번호", re: /비밀번호\s*[:=]\s*\S+/ },
];

export const findPersonalInfo = (text) => PERSONAL_INFO.filter((p) => p.re.test(String(text ?? "")));

// 개인정보가 하나도 없을 때만 맞는 정규식(강의 채점 check용)
export const NO_PERSONAL_INFO = new RegExp(`^(?![\\s\\S]*(${PERSONAL_INFO.map((p) => p.re.source).join("|")}))`);
