import { Hahmlet, IBM_Plex_Mono, IBM_Plex_Sans_KR } from "next/font/google";
import { AppStateProvider } from "@/components/AppState";
import { Header } from "@/components/Header";
import "./globals.css";

const display = Hahmlet({ weight: ["500", "700"], subsets: ["latin"], variable: "--font-hahmlet", display: "swap" });
const body = IBM_Plex_Sans_KR({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-plex-kr",
  display: "swap",
});
const mono = IBM_Plex_Mono({ weight: "500", subsets: ["latin"], variable: "--font-plex-mono", display: "swap" });

export const metadata = {
  title: "카멜레온 · 프롬프트 연습",
  description: "AI에게 일을 제대로 맡기는 법을 내 수준에 맞춰 연습하는 프롬프트 교육 서비스",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <AppStateProvider>
          <Header />
          <main>{children}</main>
          <footer className="footer">
            C팀 카멜레온 · AI 답변은 Google Gemini로 만들어요.
          </footer>
        </AppStateProvider>
      </body>
    </html>
  );
}
