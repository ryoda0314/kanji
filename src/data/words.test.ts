// 辞書の語の扱い（字の音・読める語・引き方・読みの手がかり）。辞書は curated-*.json（辞書の生成で書き出す小さな一部）。
import { describe, expect, it } from "vitest";
import { discoverWords, nearWords, unlockedBy, unlockers, wordKey, wordsWrittenWith } from "./combine";
import { kanjiToWords } from "./dataset";
import { readingNotes, rubyParts, usualReading } from "./reading";
import {
  guessKanji,
  inputKind,
  resolveByKana,
  resolveByKanji,
  resolveByKorean,
  resolveManual,
  resolveNear,
  resolveStem,
} from "./resolver";
import { markStatus } from "./sentences";
import { alignReading, composable, wordSounds } from "./sounds";
import type { WordData } from "./types";

const word = (kanji: string, kana: string): WordData => kanjiToWords.get(kanji)!.find((w) => w.kana === kana)!;
const sounds = (...words: WordData[]) => new Set(words.flatMap(wordSounds));

describe("字の音", () => {
  it("語を集めると、字とふだんの読みの組が手に入る（学校 の 学 は がっ と読むが、がく として数える）", () => {
    expect(wordSounds(word("学生", "がくせい"))).toEqual(["学|がく", "生|せい"]);
    expect(wordSounds(word("学校", "がっこう"))).toEqual(["学|がく", "校|こう"]);
    expect(wordSounds(word("人々", "ひとびと"))).toEqual(["人|ひと"]);
  });

  it("熟字訓（今日 きょう）は字に分けられないので、字の音は手に入らない", () => {
    expect(wordSounds(word("今日", "きょう"))).toEqual([]);
    expect(composable(word("今日", "きょう"))).toBe(false);
  });

  it("1字の語は字そのものなので、読める語には数えない", () => {
    expect(composable(word("山", "やま"))).toBe(false);
    expect(composable(word("学生", "がくせい"))).toBe(true);
  });
});

describe("読める語", () => {
  const owned = new Set<string>();

  it("学生 と 大学 を集めると、大学生 が読める", () => {
    const got = discoverWords(sounds(word("学生", "がくせい"), word("大学", "だいがく")), owned, true).map((w) => w.kanji);
    expect(got).toContain("大学生");
  });

  it("字が同じでも読みが違えば読めない（学生 の 生 は せい。一生 の 生 は しょう）", () => {
    const s = sounds(word("学生", "がくせい"), word("一人", "ひとり"));
    expect(discoverWords(s, owned).map((w) => w.kanji)).not.toContain("一生");
  });

  it("あと1音で読める語と、その足りない音", () => {
    const near = nearWords(sounds(word("学生", "がくせい")), owned);
    const daigakusei = near.find((n) => n.word.kanji === "大学生");
    expect(daigakusei?.missing).toBe("大|だい");
    expect(unlockers(near).some((u) => u.sound === "大|だい")).toBe(true);
  });

  it("あつめると新しく読めるようになる語（あつめる語そのものと、持っている語は入れない）", () => {
    const have = sounds(word("学生", "がくせい"));
    const opened = unlockedBy(word("大学", "だいがく"), have, new Set([wordKey(word("学生", "がくせい"))])).map((w) => w.kanji);
    expect(opened).toContain("大学生");
    expect(opened).not.toContain("大学");
  });
});

describe("この字で書く言葉", () => {
  it("読みの一覧ではなく、言葉のまとまり：音読みは音と語、訓読みは言葉（その字だけで書く語）が先", () => {
    const groups = wordsWrittenWith("生");
    const sei = groups.find((g) => g.kind === "on" && g.reading === "せい");
    expect(sei?.words.map((w) => w.kanji)).toEqual(expect.arrayContaining(["学生", "先生", "生活"]));
    expect(groups.find((g) => g.kind === "on" && g.reading === "しょう")?.words.map((w) => w.kanji)).toContain("一生");
    // 音読みが先、熟字訓は最後
    expect(groups.findIndex((g) => g.kind === "on")).toBe(0);
    const learn = wordsWrittenWith("学").find((g) => g.kind === "kun");
    expect(learn?.words[0].kanji).toBe("学ぶ");
    expect(wordsWrittenWith("日").at(-1)?.kind).toBe("whole");
  });
});

describe("引き方", () => {
  it("打ったものの種類（ローマ字はかなとして）", () => {
    expect(inputKind("がくせい")).toBe("kana");
    expect(inputKind("gakusei")).toBe("kana");
    expect(inputKind("学生")).toBe("kanji");
    expect(inputKind("食べる")).toBe("kanji");
    expect(inputKind("학생")).toBe("korean");
  });

  it("読み・ローマ字・カタカナで引く", () => {
    expect(resolveByKana("がくせい")[0].kanji).toBe("学生");
    expect(resolveByKana("gakkou")[0].kanji).toBe("学校");
    expect(resolveByKana("ガクセイ")[0].kanji).toBe("学生");
  });

  it("漢字で引く。韓国で書く形（學生・會社）でも", () => {
    expect(resolveByKanji("學生")[0].kanji).toBe("学生");
    expect(resolveByKanji("會社")[0].kanji).toBe("会社");
  });

  it("韓国語の語で引く（학생 → 学生、공부하다 → 勉強）", () => {
    expect(resolveByKorean("학생").map((w) => w.kanji)).toContain("学生");
    expect(resolveByKorean("공부하다").map((w) => w.kanji)).toContain("勉強");
  });

  it("します・助詞を外すと辞書の語になる（べんきょうします → べんきょう）", () => {
    expect(resolveStem("べんきょうします")?.stem).toBe("べんきょう");
    expect(resolveStem("がっこうに")?.words[0].kanji).toBe("学校");
  });

  it("長音・促音の打ち違いを直した候補（はつぴょう → 発表、がこう → 学校、べんきょ → 勉強）", () => {
    expect(resolveNear("はつぴょう").map((w) => w.kanji)).toContain("発表");
    expect(resolveNear("hatsupyou").map((w) => w.kanji)).toContain("発表");
    expect(resolveNear("がこう").map((w) => w.kanji)).toContain("学校");
    expect(resolveNear("べんきょ").map((w) => w.kanji)).toContain("勉強");
    expect(resolveNear("がくせい")).toEqual([]);
  });

  it("辞書に無い語の漢字を、集めた字の音から組み立てる", () => {
    expect(guessKanji("だいがく", ["大|だい", "学|がく"])).toEqual(["大学"]);
    expect(guessKanji("だいがく", ["学|がく"])).toEqual([]);
  });

  it("手で登録する語も、読みを字ごとに分ける（分けられなければ字に分けない語）", () => {
    expect(alignReading("大学", "だいがく")).toEqual({ rt: ["だい", "がく"], base: ["だい", "がく"] });
    const w = resolveManual("学生", "gakusei", "");
    expect(w.kana).toBe("がくせい");
    expect(w.rt).toEqual(["がく", "せい"]);
    expect(resolveManual("今日", "きょう", "").rt).toBeUndefined();
  });
});

describe("読みの手がかり", () => {
  it("字のふだんの読みと違う読みと、そのわけ", () => {
    expect(readingNotes(word("学校", "がっこう"))).toEqual([{ char: "学", usual: "がく", here: "がっ", changes: ["sokuon"] }]);
    expect(readingNotes(word("出発", "しゅっぱつ")).map((n) => n.changes)).toEqual([["sokuon"], ["handaku"]]);
    expect(readingNotes(word("学生", "がくせい"))).toEqual([]);
  });

  it("字のふだんの読みをつなげた読み（学校 なら がくこう）", () => {
    expect(usualReading(word("学校", "がっこう"))).toBe("がくこう");
    expect(usualReading(word("食べ物", "たべもの"))).toBe("たべもの");
  });

  it("ふりがなは字ごとに。送り仮名はそのまま、熟字訓は漢字のひと続きに", () => {
    expect(rubyParts(word("食べ物", "たべもの"))).toEqual([{ text: "食", rt: "た" }, { text: "べ" }, { text: "物", rt: "もの" }]);
    expect(rubyParts(word("今日", "きょう"))).toEqual([{ text: "今日", rt: "きょう" }]);
    // 文の中の形（食べた の 食べ）
    expect(rubyParts(word("食べる", "たべる"), "食べ")).toEqual([{ text: "食", rt: "た" }, { text: "べ" }]);
  });
});

describe("文の中の語の印", () => {
  it("集めた語・集めた字の音で読める語・まだの語", () => {
    const owned = new Set([wordKey(word("学生", "がくせい"))]);
    const s = sounds(word("学生", "がくせい"), word("大学", "だいがく"));
    expect(markStatus({ kanji: "学生", kana: "がくせい" }, s, owned)).toBe("owned");
    expect(markStatus({ kanji: "大学生", kana: "だいがくせい" }, s, owned)).toBe("readable");
    expect(markStatus({ kanji: "今日", kana: "きょう" }, s, owned)).toBe("new");
  });
});
