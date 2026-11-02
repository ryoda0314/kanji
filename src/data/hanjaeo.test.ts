// 말씨앗：韓国語の漢字語から日本語の語へ。辞書は curated-*.json（小さな一部）。
import { describe, expect, it } from "vitest";
import { discoverWords, sameHanjaeo } from "./combine";
import { kanjiToWords } from "./dataset";
import { resolveKoreanGroups } from "./resolver";
import { wordSounds } from "./sounds";

const word = (kanji: string, kana: string) => kanjiToWords.get(kanji)!.find((w) => w.kana === kana)!;

describe("韓国語の漢字語から引く", () => {
  it("同じ漢字・同じ意味の語（학생 → 学生）", () => {
    expect(resolveKoreanGroups("학생").same.map((w) => w.kanji)).toEqual(["学生"]);
    expect(resolveKoreanGroups("회사").same.map((w) => w.kanji)).toContain("会社");
  });

  it("日本語では別の漢字で言う語と、同じ漢字で意味を確かめたい語（공부 → 勉強・工夫）", () => {
    const g = resolveKoreanGroups("공부");
    expect(g.same).toEqual([]);
    expect(g.meaning.map((w) => w.kanji)).toContain("勉強");
    expect(g.kanji.map((w) => w.kanji)).toContain("工夫");
  });

  it("하다 の付いた形でも", () => {
    expect(resolveKoreanGroups("공부하다").meaning.map((w) => w.kanji)).toContain("勉強");
  });
});

describe("言える語は、同じ漢字語だけ", () => {
  it("意味の違う語（工夫）や、韓国語に同じ漢字語の無い語（勉強）は数えない", () => {
    expect(sameHanjaeo(word("学生", "がくせい"))).toBe(true);
    expect(sameHanjaeo(word("工夫", "くふう"))).toBe(false);
    expect(sameHanjaeo(word("勉強", "べんきょう"))).toBe(false);
  });

  it("학생 と 대학 の 소리 짝 で、대학생 を日本語で言える", () => {
    const sounds = new Set([...wordSounds(word("学生", "がくせい")), ...wordSounds(word("大学", "だいがく"))]);
    const got = discoverWords(sounds, new Set(), true);
    expect(got.map((w) => w.kanji)).toContain("大学生");
    expect(got.every((w) => sameHanjaeo(w))).toBe(true);
  });
});
