// 名前：アプリのアイコンと、고운바탕 の 말씨앗。一字ずつ降ってくる。下に一行。
import { Img, staticFile } from "remotion";
import { fall, prog } from "../anim";
import { C, FONT } from "../theme";

export const TAGLINE = "아는 한자어가, 그대로 일본어가 된다.";

export function NameMark({
  frame,
  icon,
  word,
  lead,
  size,
  top,
  wordSize,
  leadSize,
}: {
  frame: number;
  icon: number;
  word: number;
  lead: number;
  size: number;
  top: number;
  wordSize: number;
  leadSize: number;
}) {
  const shown = prog(frame, icon, 15);
  return (
    <>
      <div style={{ position: "absolute", left: 960 - size / 2, top, width: size, height: size, opacity: shown, transform: `scale(${0.96 + 0.04 * shown})` }}>
        <Img src={staticFile("app/icon.png")} style={{ width: size, height: size }} />
      </div>
      <p
        style={{
          position: "absolute",
          top: top + size + wordSize * 0.38,
          left: 0,
          right: 0,
          margin: 0,
          textAlign: "center",
          fontFamily: FONT.wordmark,
          fontWeight: 700,
          fontSize: wordSize,
          letterSpacing: "0.06em",
          lineHeight: 1.2,
          color: C.ink,
        }}
      >
        {[..."말씨앗"].map((ch, i) => (
          <span key={i} style={{ display: "inline-block", ...fall(frame, word + i * 3, wordSize * 0.18, 16) }}>
            {ch}
          </span>
        ))}
      </p>
      <p
        style={{
          position: "absolute",
          top: top + size + wordSize * 1.95,
          left: 0,
          right: 0,
          margin: 0,
          textAlign: "center",
          fontFamily: FONT.ko,
          fontWeight: 600,
          fontSize: leadSize,
          lineHeight: 1.45,
          color: C.ink,
          ...fall(frame, lead, 14, 18),
        }}
      >
        {TAGLINE}
      </p>
    </>
  );
}
