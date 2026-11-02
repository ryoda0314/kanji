import { describe, expect, it } from "vitest";
import { changesOf, findBase, kunStem, normalizeReading, romajiToKana, toHiragana } from "./kana";

describe("romajiToKana", () => {
  it("ヘボン式も訓令式も、ひらがなに", () => {
    expect(romajiToKana("gakusei")).toBe("がくせい");
    expect(romajiToKana("shinbun")).toBe("しんぶん");
    expect(romajiToKana("sinbun")).toBe("しんぶん");
    expect(romajiToKana("jisho")).toBe("じしょ");
    expect(romajiToKana("tsukue")).toBe("つくえ");
  });

  it("子音の重なりは っ、ん は n'・nn・子音の前の n", () => {
    expect(romajiToKana("gakkou")).toBe("がっこう");
    expect(romajiToKana("matcha")).toBe("まっちゃ");
    expect(romajiToKana("konnichiha")).toBe("こんにちは");
    expect(romajiToKana("kon'nichiha")).toBe("こんにちは");
    expect(romajiToKana("hon'ya")).toBe("ほんや");
    expect(romajiToKana("kanji")).toBe("かんじ");
    expect(romajiToKana("hann")).toBe("はん");
  });

  it("打っている途中（partial）は、終わりのまだ決まらない字を残す", () => {
    expect(romajiToKana("gakus", true)).toBe("がくs");
    expect(romajiToKana("kon", true)).toBe("こn");
    expect(romajiToKana("kon")).toBe("こん");
  });

  it("ローマ字でない字はそのまま（ハングルで韓国語を探せる）", () => {
    expect(romajiToKana("학생")).toBe("학생");
    expect(romajiToKana("がくseい")).toBe("がくせい");
  });
});

describe("読みをそろえる", () => {
  it("カタカナはひらがなに、空白は外す", () => {
    expect(toHiragana("ガク")).toBe("がく");
    expect(normalizeReading("けし ゴム")).toBe("けしごむ");
  });

  it("訓読みは字の受け持つ部分", () => {
    expect(kunStem("た.べる")).toBe("た");
    expect(kunStem("なま-")).toBe("なま");
    expect(kunStem("-がた")).toBe("がた");
  });
});

describe("changesOf", () => {
  it("促音：終わりの く・き・つ・ち が っ に（学 がく → 学校 の がっ）", () => {
    expect(changesOf("がく", "がっ")).toEqual(["sokuon"]);
    expect(changesOf("いち", "いっ")).toEqual(["sokuon"]);
  });

  it("連濁・半濁音（会社 しゃ → 株式会社 の がいしゃ、表 ひょう → 発表 の ぴょう）", () => {
    expect(changesOf("こう", "ごう")).toEqual(["rendaku"]);
    expect(changesOf("ひと", "びと")).toEqual(["rendaku"]);
    expect(changesOf("ちゅう", "じゅう")).toEqual(["rendaku"]);
    expect(changesOf("ひょう", "ぴょう")).toEqual(["handaku"]);
    expect(changesOf("はつ", "ぱっ")).toEqual(["handaku", "sokuon"]);
  });

  it("転音（雨 あめ → 雨戸 の あま）", () => {
    expect(changesOf("あめ", "あま")).toEqual(["vowel"]);
    expect(changesOf("き", "こ")).toEqual(["vowel"]);
  });

  it("同じなら []、別の読みなら null（生 の せい と しょう は別の読み）", () => {
    expect(changesOf("せい", "せい")).toEqual([]);
    expect(changesOf("せい", "しょう")).toBeNull();
  });
});

describe("findBase", () => {
  it("そのままの読みを先に、なければ変わり方の少ない読み", () => {
    expect(findBase(["がく", "かく"], "がっ")).toEqual({ base: "がく", changes: ["sokuon"] });
    expect(findBase(["せい", "しょう"], "しょう")).toEqual({ base: "しょう", changes: [] });
    expect(findBase(["せい"], "なま")).toBeNull();
  });
});
