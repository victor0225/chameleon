"use client";

// 메인(디자인 캔버스 A1, 랜딩 후보 2): 첫 화면에서 바로 평소 하던 말을 써 보면 빠진 요소가 색 막대로 보인다.
// '진단하기'를 누르면 쓴 글을 들고 설문으로 가고, 프롬프트 써 보기 단계에서 그 글이 미리 채워진다.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo, ScaleBar } from "@/components/Anatomy";
import { useAppState } from "@/components/AppState";
import { ArrowIcon } from "@/components/Common";
import { Tour } from "@/components/Tour";
import { analyze } from "@/lib/anatomy";
import { HOME_DRAFT_KEY } from "@/lib/homeDraft";
import s from "./home.module.css";

export default function Home() {
  const router = useRouter();
  const { diagnosis } = useAppState();
  const [draft, setDraft] = useState("");
  const found = analyze(draft).found;

  function start(e) {
    e.preventDefault();
    try {
      if (draft.trim()) sessionStorage.setItem(HOME_DRAFT_KEY, draft.trim());
      else sessionStorage.removeItem(HOME_DRAFT_KEY);
    } catch {
      // 저장소를 못 쓰면 프롬프트 단계에서 다시 쓰면 된다.
    }
    router.push("/diagnosis");
  }

  return (
    <div className={`page ${s.home}`}>
      <Tour id="home" />
      <h1 className={`display ${s.title}`}>프롬프트 진단과 AI 활용 교육</h1>
      <p className={s.brand}>
        <Logo />
        카멜레온
      </p>
      <form className={`card ${s.card}`} onSubmit={start}>
        <label htmlFor="home-prompt" className={s.srOnly}>
          평소 AI에게 하던 말
        </label>
        <input
          id="home-prompt"
          className={s.input}
          value={draft}
          maxLength={2000}
          autoComplete="off"
          placeholder="평소 AI에게 하던 말 그대로 입력"
          onChange={(e) => setDraft(e.target.value)}
        />
        <ScaleBar found={found} />
        <div className={s.row}>
          <span className={s.count}>
            채운 요소 <span className="mono">{found.length}/5</span>
          </span>
          {diagnosis && (
            <Link href="/diagnosis/result" className="link">
              지난 진단 결과 보기
            </Link>
          )}
          <button type="submit" className={`btn ${s.cta}`} data-tour="home-start">
            진단하기
            <ArrowIcon />
          </button>
        </div>
      </form>
    </div>
  );
}
