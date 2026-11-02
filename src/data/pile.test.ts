import { describe, expect, it } from "vitest";
import { Pile } from "./pile";

const H = 24;

/** 決まった並びの乱数（毎回同じ山）。 */
function sequence(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

function fill(pile: Pile, width: number, count: number, rand = sequence(7)) {
  const placed: { x: number; y: number; w: number }[] = [];
  for (let i = 0; i < count; i++) {
    const w = 28 + Math.floor(rand() * 4) * 13;
    const u = (rand() + rand()) / 2;
    const spot = pile.drop(u * (width - w), w, H, rand() < 0.5 ? -1 : 1);
    placed.push({ ...spot, w });
  }
  return placed;
}

describe("Pile", () => {
  it("何も無い所に落ちた札は、地面に載る", () => {
    expect(new Pile(300).drop(100, 40, H, 1)).toEqual({ x: 100, y: 0 });
  });

  it("同じ所に落とし続けても塔にならず、低い方へ転がって山が広がる", () => {
    const pile = new Pile(600);
    const placed = Array.from({ length: 30 }, (_, i) => pile.drop(280, 40, H, i % 2 ? 1 : -1));
    // 一列に積めば 30 × 24 = 720px の塔
    expect(pile.top()).toBeLessThan(300);
    const left = Math.min(...placed.map((p) => p.x));
    const right = Math.max(...placed.map((p) => p.x + 40));
    expect(right - left).toBeGreaterThan(200);
  });

  it("たくさん落としても、札どうしは重ならず、横にはみ出さない", () => {
    const width = 350;
    const placed = fill(new Pile(width), width, 300);
    for (const a of placed) {
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.x + a.w).toBeLessThanOrEqual(width);
      expect(a.y).toBeGreaterThanOrEqual(0);
    }
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i];
        const b = placed[j];
        const across = a.x < b.x + b.w && b.x < a.x + a.w;
        const upDown = a.y < b.y + H && b.y < a.y + H;
        expect(across && upDown).toBe(false);
      }
    }
  });

  it("真ん中に多く落とすと、なだらかな山になる（頂は端より高いが、塔ではない）", () => {
    const width = 600;
    const pile = new Pile(width);
    const placed = fill(pile, width, 120);
    const middle = placed.filter((p) => Math.abs(p.x + p.w / 2 - width / 2) < 60);
    const edges = placed.filter((p) => p.x < 60 || p.x + p.w > width - 60);
    const highest = (list: { y: number }[]) => Math.max(0, ...list.map((p) => p.y));
    expect(highest(middle)).toBeGreaterThan(highest(edges));
    // 札を一列に積んだ高さ（塔）よりずっと低い
    expect(pile.top()).toBeLessThan((120 * H) / 6);
  });

  it("同じ順に落とせば、同じ山になる", () => {
    const a = fill(new Pile(350), 350, 80, sequence(3));
    const b = fill(new Pile(350), 350, 80, sequence(3));
    expect(a).toEqual(b);
  });
});
