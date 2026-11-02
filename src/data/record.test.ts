import { describe, expect, it } from "vitest";
import { mergeRecords, recordKey, reviveRecord, sameRecord, type RecordState, type RecordWord } from "./record";

const DAY = 86_400_000;
const rec = (words: RecordWord[], removed: Record<string, number> = {}): RecordState => ({ app: "kotonohashi", version: 1, words, removed });
const w = (kanji: string, kana: string, addedAt: number, more: Partial<RecordWord> = {}): RecordWord => ({
  kanji,
  kana,
  source: "seed",
  addedAt,
  ...more,
});

describe("mergeRecords", () => {
  it("keeps the words of both, in the order they were collected", () => {
    const merged = mergeRecords(rec([w("学生", "がくせい", 2 * DAY)]), rec([w("先生", "せんせい", DAY)]));
    expect(merged.words.map(recordKey)).toEqual(["先生|せんせい", "学生|がくせい"]);
  });

  it("takes the earlier collection, the larger counts and the later times of the same word", () => {
    const phone = w("学生", "がくせい", 3 * DAY, { readDays: 2, lastReadAt: 5 * DAY, metDays: 1, lastMetAt: 4 * DAY });
    const computer = w("学生", "がくせい", 2 * DAY, { readDays: 3, lastReadAt: 4 * DAY, missedAt: 6 * DAY });
    const [one] = mergeRecords(rec([phone]), rec([computer])).words;
    expect(one).toEqual({
      kanji: "学生",
      kana: "がくせい",
      source: "seed",
      addedAt: 2 * DAY,
      metDays: 1,
      readDays: 3,
      lastMetAt: 4 * DAY,
      lastReadAt: 5 * DAY,
      missedAt: 6 * DAY,
    });
  });

  it("does not bring back a word removed on another device", () => {
    const stale = rec([w("学生", "がくせい", DAY, { lastReadAt: 2 * DAY })]);
    const removedHere = rec([], { "学生|がくせい": 3 * DAY });
    expect(mergeRecords(removedHere, stale).words).toEqual([]);
    expect(mergeRecords(stale, removedHere).words).toEqual([]);
    expect(mergeRecords(stale, removedHere).removed).toEqual({ "学生|がくせい": 3 * DAY });
  });

  it("keeps a word collected again after it was removed, without the old copy", () => {
    const stale = rec([w("学生", "がくせい", DAY, { readDays: 4 })]);
    const again = rec([w("学生", "がくせい", 5 * DAY)], { "学生|がくせい": 3 * DAY });
    const [one] = mergeRecords(again, stale).words;
    expect(one.addedAt).toBe(5 * DAY);
    expect(one.readDays).toBeUndefined();
  });

  it("keeps a hand-made word's own reading and meaning, this device's first", () => {
    const here = w("渋谷", "しぶや", DAY, { source: "manual", rt: ["しぶ", "や"], gloss: "시부야" });
    const there = w("渋谷", "しぶや", DAY, { source: "manual", rt: ["しぶ", "や"], gloss: "옛 뜻" });
    expect(mergeRecords(rec([here]), rec([there])).words[0].gloss).toBe("시부야");
  });
});

describe("reviveRecord", () => {
  it("reads what the account kept, dropping what cannot be read", () => {
    const back = reviveRecord(
      {
        app: "kotonohashi",
        version: 1,
        words: [
          { kanji: "学生", kana: "がくせい", source: "seed", addedAt: DAY, readDays: 1, gloss: "x", rt: ["a"] },
          { kanji: "", kana: "x", addedAt: DAY },
          { kanji: "先生", kana: "せんせい" },
          "nope",
        ],
        removed: { "犬|いぬ": DAY, bad: "x" },
      },
      "kotonohashi"
    );
    expect(back?.words).toEqual([{ kanji: "学生", kana: "がくせい", source: "seed", addedAt: DAY, readDays: 1 }]);
    expect(back?.removed).toEqual({ "犬|いぬ": DAY });
  });

  it("is null for another app's record or no record", () => {
    expect(reviveRecord({ app: "kotonotane", words: [] }, "kotonohashi")).toBeNull();
    expect(reviveRecord(null, "kotonohashi")).toBeNull();
    expect(reviveRecord("x", "kotonohashi")).toBeNull();
  });
});

describe("sameRecord", () => {
  it("does not mind the order of keys or words", () => {
    const a = rec([w("学生", "がくせい", DAY, { readDays: 1 }), w("先生", "せんせい", 2 * DAY)]);
    const shuffled: RecordWord = { readDays: 1, addedAt: DAY, source: "seed", kana: "がくせい", kanji: "学生" };
    const b = rec([shuffled, w("先生", "せんせい", 2 * DAY)].reverse());
    expect(sameRecord(a, b)).toBe(true);
    expect(sameRecord(a, rec([w("学生", "がくせい", DAY, { readDays: 2 }), w("先生", "せんせい", 2 * DAY)]))).toBe(false);
  });
});
