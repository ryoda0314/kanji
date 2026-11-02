// 써 보기 の札と升。辞書は curated-*.json（小さな一部）なので、札の数と中身の決まりだけを見る。
import { describe, expect, it } from "vitest";
import { kanjiToWords } from "./dataset";
import { checkSlots, slotChars, tilesFor, writeParts } from "./write";

const word = (kanji: string, kana: string) => kanjiToWords.get(kanji)!.find((w) => w.kana === kana)!;

describe("升", () => {
  it("漢字は升、送り仮名と 々 ははじめから見えている", () => {
    expect(writeParts("食べ物")).toEqual([{ text: "食", slot: 0 }, { text: "べ" }, { text: "物", slot: 1 }]);
    expect(writeParts("人々")).toEqual([{ text: "人", slot: 0 }, { text: "々" }]);
    expect(slotChars("会社員")).toEqual(["会", "社", "員"]);
  });

  it("升ごとに合っているか", () => {
    expect(checkSlots(["会", "社"], ["会", "回"])).toEqual([true, false]);
    expect(checkSlots(["会", "社"], ["会", null])).toEqual([true, false]);
  });
});

describe("札", () => {
  it("語の字をみな含み、まぎらわしい字を足して6〜8枚", () => {
    for (const [kanji, kana] of [["会社", "かいしゃ"], ["大学生", "だいがくせい"], ["食べ物", "たべもの"]] as const) {
      const tiles = tilesFor(word(kanji, kana), new Set(), () => 0.5);
      const chars = tiles.map((t) => t.char);
      for (const c of slotChars(kanji)) expect(chars).toContain(c);
      expect(tiles.length).toBeGreaterThanOrEqual(6);
      expect(tiles.length).toBeLessThanOrEqual(8);
      expect(new Set(tiles.map((t) => t.id)).size).toBe(tiles.length);
    }
  });
});
