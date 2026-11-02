// H. もう一度、名前と一行。タブと、はじめ方（가입은 필요 없고, 모은 단어는 이 기기에 남는다）。
import { fall } from "../anim";
import { T } from "../timeline";
import { C, FONT } from "../theme";
import { Icon, type IconName } from "../ui";
import { NameMark } from "./Mark";

const TABS: [IconName, string][] = [
  ["collect", "모으기"],
  ["find", "찾기"],
  ["words", "단어"],
  ["pairs", "소리 짝"],
  ["me", "나"],
];

export function End({ frame }: { frame: number }) {
  const e = T.end;
  return (
    <>
      <NameMark frame={frame} icon={e.icon} word={e.word} lead={e.lead} size={210} top={120} wordSize={88} leadSize={40} />
      <div style={{ position: "absolute", top: 610, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 44, ...fall(frame, e.lead + 8, 10, 16) }}>
        {TABS.map(([icon, name]) => (
          <span key={name} style={{ display: "inline-flex", alignItems: "center", gap: 12, fontSize: 28, color: C.ink2, fontFamily: FONT.ko }}>
            <Icon name={icon} size={30} stroke={1.7} />
            {name}
          </span>
        ))}
      </div>
      <p style={{ position: "absolute", top: 740, left: 0, right: 0, margin: 0, textAlign: "center", fontSize: 28, color: C.muted, fontFamily: FONT.ko, ...fall(frame, e.rest, 14, 18) }}>
        가입하지 않아도 돼요. 모은 단어는 이 기기에 남아요.
      </p>
    </>
  );
}
