import { describe, expect, it } from "vitest";
import { parseBackup, soundsOf, staleGlosses, tallyChars } from "./db";

describe("tallyChars", () => {
  it("字ごとに、その字が入った語の数と最初・最後の日時をまとめる", () => {
    const list = tallyChars([
      { chars: ["学", "生"], addedAt: 200 },
      { chars: ["大", "学"], addedAt: 100 },
      { chars: ["大", "学", "生"], addedAt: 300 },
    ]);
    expect(list.find((c) => c.char === "学")).toEqual({ char: "学", count: 3, firstAddedAt: 100, lastAddedAt: 300 });
    expect(list.find((c) => c.char === "生")?.count).toBe(2);
  });

  it("1語に同じ字が2回あっても1回と数える", () => {
    expect(tallyChars([{ chars: ["人", "人"], addedAt: 1 }])[0].count).toBe(1);
  });
});

describe("soundsOf", () => {
  it("集めた語の字の音を一つにまとめる", () => {
    const sounds = soundsOf([{ sounds: ["学|がく", "生|せい"] }, { sounds: ["大|だい", "学|がく"] }]);
    expect([...sounds].sort()).toEqual(["大|だい", "学|がく", "生|せい"].sort());
  });
});

describe("parseBackup", () => {
  it("辞書の語は、いまの辞書から読みの分け方と意味を付け直す", () => {
    const text = JSON.stringify({ app: "kotonohashi", version: 1, words: [{ kanji: "学校", kana: "がっこう", source: "seed", addedAt: 5 }] });
    const [w] = parseBackup(text)!;
    expect(w).toMatchObject({ kanji: "学校", kana: "がっこう", rt: ["がっ", "こう"], base: ["がく", "こう"], source: "seed", addedAt: 5 });
    expect(w.gloss).toContain("학교");
  });

  it("辞書に無い語は、手で登録した語として書いてあるまま", () => {
    const text = JSON.stringify({ app: "kotonohashi", words: [{ kanji: "無語", kana: "むご", rt: ["む", "ご"], gloss: "x" }] });
    const [w] = parseBackup(text)!;
    expect(w).toMatchObject({ kanji: "無語", kana: "むご", rt: ["む", "ご"], gloss: "x", source: "manual" });
    expect(typeof w.addedAt).toBe("number");
  });

  it("覚え具合の出来事も読む（数でないものは捨てる）", () => {
    const text = JSON.stringify({
      app: "kotonohashi",
      words: [{ kanji: "学生", kana: "がくせい", addedAt: 5, readDays: 2, lastReadAt: 9, metDays: "x" }],
    });
    const [w] = parseBackup(text)!;
    expect(w.readDays).toBe(2);
    expect(w.lastReadAt).toBe(9);
    expect(w.metDays).toBeUndefined();
  });

  it("ほかのファイルや壊れた中身は null", () => {
    expect(parseBackup("not json")).toBeNull();
    expect(parseBackup(JSON.stringify({ app: "kotonone", words: [] }))).toBeNull();
    expect(parseBackup(JSON.stringify({ app: "kotonohashi", words: [{ kanji: "", kana: "がく" }] }))).toBeNull();
  });
});

describe("staleGlosses", () => {
  it("辞書から集めた語の意味だけ、いまの辞書にそろえる（手で登録した語・辞書に無い語はそのまま）", () => {
    const words = [
      { id: 1, kanji: "学生", kana: "がくせい", gloss: "student", source: "seed" as const },
      { id: 2, kanji: "学校", kana: "がっこう", gloss: "학교", source: "seed" as const },
      { id: 3, kanji: "自作", kana: "じさく", gloss: "직접 만듦", source: "manual" as const },
      { id: 4, kanji: "無無", kana: "むむ", gloss: "x", source: "seed" as const },
    ];
    const dict = new Map([
      ["学生|がくせい", { gloss: "학생" }],
      ["学校|がっこう", { gloss: "학교" }],
      ["自作|じさく", { gloss: "자작" }],
    ]);
    expect(staleGlosses(words, (w) => dict.get(`${w.kanji}|${w.kana}`))).toEqual([{ id: 1, gloss: "학생", en: undefined }]);
  });
});

describe("versionOf", () => {
  it("同じ中身なら同じ名前、1字でも違えば別の名前（みんなの雨の辞書の版）", async () => {
    const { versionOf } = await import("./data/dataset");
    expect(versionOf('[{"kanji":"学生"}]')).toBe(versionOf('[{"kanji":"学生"}]'));
    expect(versionOf('[{"kanji":"学生"}]')).not.toBe(versionOf('[{"kanji":"学正"}]'));
    expect(versionOf("x".repeat(3_000_000)).length).toBeLessThanOrEqual(16);
  });
});
