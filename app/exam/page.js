// 시험 목록(작업 L, 보드 L1·L2). 어느 직무 시험의 문제가 써 있는지는 서버만 알아서(정답표가 서버에만 있다) 여기서 넘긴다.
import { readyJobs } from "@/lib/server/exams/index";
import { ExamList } from "./ExamList";

export default function ExamPage() {
  return <ExamList ready={readyJobs()} />;
}
