// 진단 결과 인쇄용 리포트 (/diagnosis/report). 결과 화면의 "PDF로 저장하기"가 새 탭으로 연다.
import ReportView from "./ReportView";

export const metadata = { title: "카멜레온 진단 결과" };

export default function DiagnosisReportPage() {
  return <ReportView />;
}
