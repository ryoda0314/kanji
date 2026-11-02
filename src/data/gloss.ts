// 語の意味の書き方。辞書の意味は韓国語（한국어기초사전 の日本語の対訳を逆に引いた語。학생、먹다）。
// 対訳の無い語は英語（JMdict）なので、英語だと分かるように lang を分ける。手で書いた意味は、そのまま。

import type { WordData } from "./types";

/** 意味の言葉（読み上げ・字形のため）。 */
export function glossLang(w: Pick<WordData, "en">): "ko" | "en" {
  return w.en ? "en" : "ko";
}

/** 見せる意味。 */
export function glossText(w: Pick<WordData, "gloss">): string {
  return w.gloss;
}
