// 韓国語ハングルに関する小ユーティリティ。

// 初声（19種）。가나다順グルーピングの見出しに使う。
const LEAD = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;

/**
 * 語の最初の音節から初声（ㄱ〜ㅎ）を返す。ハングル以外で始まる場合は "#"。
 */
export function leadConsonant(hangul: string): string {
  const code = hangul.codePointAt(0);
  if (code == null || code < HANGUL_BASE || code > HANGUL_END) return "#";
  const idx = Math.floor((code - HANGUL_BASE) / 588);
  return LEAD[idx] ?? "#";
}

/** 가나다順グルーピングの見出しの並び順（インデックス）。"#" は末尾。 */
export function leadOrder(lead: string): number {
  const i = LEAD.indexOf(lead);
  return i === -1 ? LEAD.length : i;
}

/** 韓国語ロケールでのハングル比較。 */
export function compareKo(a: string, b: string): number {
  return a.localeCompare(b, "ko");
}
