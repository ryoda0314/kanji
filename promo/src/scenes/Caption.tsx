// 映像の言葉。アプリの画面の左に：いまどのタブか（見出し）、短い一文、その下の静かな一文。
// 時が来ると降ってきて、前のものは上がって消える。
import { fall, leave, mixColor, prog } from "../anim";
import { C, FONT } from "../theme";
import { Icon, type IconName } from "../ui";

export const CAP = { left: 120, width: 700, kickerTop: 300, mainTop: 372 };
// 見出し：いまどのタブか（アイコンと名前）。
export const KICKER = { icon: { left: CAP.left, top: 301, size: 34 }, text: { left: CAP.left + 46, top: 298, size: 30 } };

/** 一切れ：ただの字か、色や字体を変えた字（日本語のかな・漢字）。`at`：その字に色が付くコマ（無ければ一文が降りたとき）。 */
export type Part = string | { text: string; color?: string; font?: "ko" | "ja" | "hanja"; at?: number };
export type Door = "collect" | "find" | "pairs";
export const DOOR_NAME: Record<Door, string> = { collect: "모으기", find: "찾기", pairs: "소리 짝" };
const DOOR_ICON: Record<Door, IconName> = { collect: "collect", find: "find", pairs: "pairs" };
/** `subAt`：静かな一文が降る時（ふだんは本文のすぐあと）。 */
export type Cap = { from: number; door: Door; main: Part[][]; sub?: Part[][]; subAt?: number };

export function Kicker({ door, style }: { door: Door; style?: React.CSSProperties }) {
  return (
    <>
      <span style={{ position: "absolute", left: KICKER.icon.left, top: KICKER.icon.top, color: C.accent, ...style }}>
        <Icon name={DOOR_ICON[door]} size={KICKER.icon.size} stroke={1.7} />
      </span>
      <span
        style={{
          position: "absolute",
          left: KICKER.text.left,
          top: KICKER.text.top,
          fontSize: KICKER.text.size,
          lineHeight: "38px",
          fontWeight: 600,
          color: C.accent,
          fontFamily: FONT.ko,
          whiteSpace: "nowrap",
          ...style,
        }}
      >
        {DOOR_NAME[door]}
      </span>
    </>
  );
}

const FAMILY = { ko: FONT.ko, ja: FONT.ja, hanja: FONT.hanja } as const;

function Parts({ parts, frame, colorAt }: { parts: Part[]; frame: number; colorAt: number }) {
  return (
    <>
      {parts.map((part, k) => {
        if (typeof part === "string") return <span key={k}>{part}</span>;
        return (
          <span
            key={k}
            style={{
              fontFamily: part.font ? FAMILY[part.font] : undefined,
              fontWeight: part.font === "hanja" ? 500 : part.color ? 600 : undefined,
              color: part.color ? mixColor(C.ink2, part.color, prog(frame, part.at ?? colorAt, 14)) : undefined,
            }}
          >
            {part.text}
          </span>
        );
      })}
    </>
  );
}

/** 一続きの言葉。`from` コマから、次が来るまで。 */
export function Captions({ frame, caps, until }: { frame: number; caps: Cap[]; until: number }) {
  return (
    <>
      {caps.map((c, i) => {
        const next = caps[i + 1]?.from ?? until;
        if (frame < c.from || frame > next + 14) return null;
        const prevDoor = caps[i - 1]?.door;
        const nextDoor = caps[i + 1]?.door;
        // 前の一文が消えて（9 コマ）から、次が降る。二つの文が重ならないように。
        const style = frame >= next ? leave(frame, next, 9, 12) : fall(frame, c.from + 8, 16, 16);
        // 見出しは、同じタブの間は残り、タブが変わると入れ替わる。
        const kickerIn = prevDoor === c.door ? { opacity: 1 } : fall(frame, c.from + 8, 10, 12);
        const kickerOut = nextDoor === c.door || !caps[i + 1] ? null : leave(frame, next, 8, 8);
        const kick = frame >= next && kickerOut ? kickerOut : frame >= next ? { opacity: 0 } : kickerIn;
        const subAt = c.subAt ?? c.from + 16;
        return (
          <div key={c.from}>
            <Kicker door={c.door} style={kick} />
            <div style={{ position: "absolute", left: CAP.left, top: CAP.mainTop, width: CAP.width, wordBreak: "keep-all", ...style }}>
              {c.main.map((m, j) => (
                <p key={j} style={{ margin: 0, fontSize: 52, fontWeight: 600, lineHeight: 1.42, letterSpacing: "0.005em", color: C.ink, fontFamily: FONT.ui }}>
                  <Parts parts={m} frame={frame} colorAt={c.from + 8} />
                </p>
              ))}
              {c.sub ? (
                <div style={{ marginTop: 30, ...fall(frame, subAt, 10, 16) }}>
                  {c.sub.map((line, j) => (
                    <p key={j} style={{ margin: 0, fontSize: 28, lineHeight: 1.75, color: C.ink2, fontFamily: FONT.ui }}>
                      <Parts parts={line} frame={frame} colorAt={subAt + 8} />
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </>
  );
}
