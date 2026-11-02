import { useLayoutEffect, useRef, type ReactNode } from "react";
import { mix } from "./anim";
import { CLIP_Y } from "./ui";

export type Focus = { anchor: string; w: number; margin?: number };

/**
 * 伸びていく中身をのぞく窓。ふだんは頭（"start"）か新しいところ（"end"）を見せ、`focus` があれば印（data-anchor）の
 * 付いた所が上に来るよう、その `w`（0 → 1）だけ寄っていく。位置は毎コマ測るので、中身は自由に変わってよい。
 */
export function Scroll({
  children,
  focus = [],
  from = "start",
  short = "top",
  style,
}: {
  children: ReactNode;
  focus?: Focus[];
  from?: "end" | "start";
  /** 中身が窓より短いとき、上に寄せるか真ん中に置くか。 */
  short?: "top" | "center";
  style?: React.CSSProperties;
}) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = inner.current;
    const frame = box.current;
    if (!el || !frame) return;
    const view = frame.clientHeight;
    const height = el.offsetHeight;
    const bottom = Math.max(0, height - view);
    let y = height < view && short === "center" ? -(view - height) / 2 : from === "start" ? 0 : bottom;
    for (const fx of focus) {
      if (fx.w <= 0) continue;
      const target: HTMLElement | null = el.querySelector(`[data-anchor="${fx.anchor}"]`);
      if (!target) continue;
      let top = 0;
      for (let n: HTMLElement | null = target; n && n !== el; n = n.offsetParent as HTMLElement | null) top += n.offsetTop;
      const wanted = Math.max(0, Math.min(bottom, top - (fx.margin ?? 12)));
      y = mix(y, wanted, fx.w);
    }
    el.style.transform = `translateY(${-y}px)`;
  });

  return (
    <div ref={box} style={{ position: "absolute", ...CLIP_Y, ...style }}>
      <div ref={inner} style={{ position: "relative" }}>
        {children}
      </div>
    </div>
  );
}
