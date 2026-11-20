import { analyze } from "@/lib/anatomy";
import { ITEM, ITEMS } from "@/lib/items";
export const segVar = (color) => ({ "--seg": color });
// delayOffset: 여러 줄을 따로 그릴 때 앞 줄의 조각 수만큼 늦춰서 밑줄이 줄을 넘어 차례로 그려지게 한다.
// segments: 진단 API가 문장마다 고른 요소 [{ text, items }]. 없으면 규칙 기반 분석기로 칠한다.
export function AnatomyText({ text, segments: given, animate = false, className = "", delayOffset = 0 }) {
  const segments = given ?? analyze(text).segments;
  return (
    <p className={`anatomy ${className}`}>
      {segments.map((s, i) => {
        const delay = animate ? { "--d": `${(i + delayOffset) * 0.14}s` } : undefined;
        if (s.items.length === 0) {
          return (
            <span key={i} className={animate ? "plain draw" : undefined} style={delay}>
              {s.text}
            </span>
          );
        }
        return (
          <span
            key={i}
            className={animate ? "seg draw" : "seg"}
            style={{ ...segVar(ITEM[s.items[0]].color), ...delay }}
            title={s.items.map((id) => ITEM[id].name).join(" · ")}
          >
            {s.text}
          </span>
        );
      })}
    </p>
  );
}
export function ScaleBar({ found }) {
  return (
    <ul className="scale" aria-label={`다섯 요소 중 ${found.length}개 포함`}>
      {ITEMS.map((item) => (
        <li key={item.id} className={found.includes(item.id) ? "on" : undefined} style={segVar(item.color)}>
          <span className="scale-chip" aria-hidden="true" />
          <span className="scale-label">{item.name}</span>
        </li>
      ))}
    </ul>
  );
}
export function Logo() {
  return (
    <span className="logo" aria-hidden="true">
      {ITEMS.map((item) => (
        <span key={item.id} style={segVar(item.color)} />
      ))}
    </span>
  );
}
export function Output({ text }) {
  const lines = text.split("\n").filter((line) => line.trim());
  if (lines.length > 1 && lines.every((line) => line.includes("|"))) {
    const [head, ...rows] = lines.map((line) => line.split("|").map((cell) => cell.trim()));
    return (
      <div className="output">
        <table>
          <thead>
            <tr>
              {head.map((cell) => (
                <th key={cell}>{cell}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return <div className="output">{text}</div>;
}
