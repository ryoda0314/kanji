// みんなの雨（pages/Everyone）の、下に積もった語の山。語の札を横幅 width の地面に一つずつ落とす。札は落ちた所の真下で
// いちばん高い所に載るが、近くにもっと低い所があれば、そちらへ転がる（砂の山のように、なだらかな山になる）。
// 座標は地面から上へ（y は札の下の縁の高さ）。札どうしは重ならず、横にはみ出さない。

/** 転がる手間：横に 1px 動くのは、この高さ（px）だけ低くなるのと同じ。これより急な所では転がり落ちる（山の傾き）。 */
export const SLOPE = 0.7;
/** 一度に見回す左右の広さ（px）と、見る間隔。 */
const REACH = 64;
const STRIDE = 2;
/** 転がるのは、この回数まで（一回で REACH まで動く）。 */
const TURNS = 24;

export interface Spot {
  x: number;
  y: number;
}

export class Pile {
  private readonly heights: Float64Array;

  constructor(width: number) {
    this.heights = new Float64Array(Math.max(1, Math.floor(width)));
  }

  /** 左端 x から幅 w の所で、いちばん高い所。 */
  private surface(x: number, w: number): number {
    let top = 0;
    for (let c = x; c < x + w; c++) if (this.heights[c] > top) top = this.heights[c];
    return top;
  }

  /** 地面の幅。 */
  get width(): number {
    return this.heights.length;
  }

  /** 山の頂の高さ。 */
  top(): number {
    let top = 0;
    for (const h of this.heights) if (h > top) top = h;
    return top;
  }

  /**
   * 幅 w・高さ h の札を、左端が x の辺りになるよう落とし、止まった所（左端と下の縁）を返す。
   * side（-1 か 1）は、左右に同じくらい低い所があるときに転がる向き。
   */
  drop(x: number, w: number, h: number, side: number): Spot {
    const width = this.heights.length;
    const span = Math.min(Math.max(1, Math.round(w)), width);
    const max = width - span;
    let at = Math.min(max, Math.max(0, Math.round(x)));
    for (let turn = 0; turn < TURNS; turn++) {
      let best = at;
      let bestCost = this.surface(at, span);
      for (let dx = -REACH; dx <= REACH; dx += STRIDE) {
        const to = at + dx;
        if (dx === 0 || to < 0 || to > max) continue;
        const cost = this.surface(to, span) + Math.abs(dx) * SLOPE - dx * side * 1e-3;
        if (cost < bestCost - 1e-9) {
          best = to;
          bestCost = cost;
        }
      }
      if (best === at) break;
      at = best;
    }
    const y = this.surface(at, span);
    for (let c = at; c < at + span; c++) this.heights[c] = y + h;
    return { x: at, y };
  }
}
