// 시험 하나(작업 L, 보드 L3~L8): /exam/<직무 id>. 응시 전·보는 중·결과·응시 후를 주소를 바꾸지 않고 한 화면에서 보여 준다.
// 직무는 다섯 개로 정해져 있어 미리 만들어 둔다. 모르는 직무는 404, 문제를 아직 안 쓴 시험은 화면이 '준비 중'.
import { notFound } from "next/navigation";
import { JOB, JOBS } from "@/data/jobs";
import { examFor } from "@/lib/server/exams/index";
import { ExamScreen } from "./ExamScreen";

export function generateStaticParams() {
  return JOBS.map((job) => ({ job: job.id }));
}

export default async function ExamJobPage({ params }) {
  const { job } = await params;
  if (!Object.hasOwn(JOB, job)) notFound();
  return <ExamScreen job={job} ready={Boolean(examFor(job))} />;
}
