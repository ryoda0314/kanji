import { describe, expect, it } from "vitest";
import { DAY, dueWords, isDue, metUpdate, nextReviewAt, readUpdate, wordStage } from "./stage";

// 2026-10-01 09:00（端末の暦で日をまたがない時刻）
const T0 = new Date(2026, 9, 1, 9, 0).getTime();

describe("wordStage", () => {
  it("集めただけなら あつめた", () => {
    expect(wordStage({ addedAt: T0 })).toBe("collected");
  });

  it("別の日に文の中でまた出会うと また出会った", () => {
    expect(wordStage({ addedAt: T0, metDays: 1, lastMetAt: T0 + DAY })).toBe("met");
  });

  it("漢字から読めると 読めた、別の日にもう一度読めると 身についた", () => {
    expect(wordStage({ addedAt: T0, readDays: 1, lastReadAt: T0 })).toBe("read");
    expect(wordStage({ addedAt: T0, readDays: 2, lastReadAt: T0 + 7 * DAY })).toBe("known");
  });

  it("読めたあとで答えを見たら また出会った に戻る", () => {
    expect(wordStage({ addedAt: T0, readDays: 2, lastReadAt: T0 + DAY, missedAt: T0 + 9 * DAY })).toBe("met");
  });
});

describe("nextReviewAt / isDue / dueWords", () => {
  it("段階が進むほど間があく", () => {
    expect(nextReviewAt({ addedAt: T0 })).toBe(T0 + DAY);
    expect(nextReviewAt({ addedAt: T0, metDays: 1, lastMetAt: T0 + DAY })).toBe(T0 + 3 * DAY);
    expect(nextReviewAt({ addedAt: T0, readDays: 1, lastReadAt: T0 })).toBe(T0 + 6 * DAY);
    expect(nextReviewAt({ addedAt: T0, readDays: 2, lastReadAt: T0 })).toBe(T0 + 20 * DAY);
    expect(nextReviewAt({ addedAt: T0, readDays: 3, lastReadAt: T0 })).toBe(T0 + 40 * DAY);
    expect(nextReviewAt({ addedAt: T0, readDays: 9, lastReadAt: T0 })).toBe(T0 + 120 * DAY);
  });

  it("答えを見たら翌日", () => {
    expect(nextReviewAt({ addedAt: T0, readDays: 1, lastReadAt: T0, missedAt: T0 + 2 * DAY })).toBe(T0 + 3 * DAY);
  });

  it("ふりかえりどきの語だけを、待たせている順に", () => {
    const a = { addedAt: T0 }; // T0+1日
    const b = { addedAt: T0 - 5 * DAY }; // T0-4日
    const c = { addedAt: T0, readDays: 1, lastReadAt: T0 }; // T0+6日
    expect(isDue(a, T0)).toBe(false);
    expect(dueWords([a, b, c], T0 + 2 * DAY)).toEqual([b, a]);
  });
});

describe("metUpdate / readUpdate", () => {
  it("集めた日と、もう数えた日は数えない", () => {
    expect(metUpdate({ addedAt: T0 }, T0 + 60_000)).toBeNull();
    const first = metUpdate({ addedAt: T0 }, T0 + DAY);
    expect(first).toEqual({ metDays: 1, lastMetAt: T0 + DAY });
    expect(metUpdate({ addedAt: T0, ...first! }, T0 + DAY + 60_000)).toBeNull();
    expect(metUpdate({ addedAt: T0, ...first! }, T0 + 2 * DAY)).toEqual({ metDays: 2, lastMetAt: T0 + 2 * DAY });
  });

  it("読めた日は一日一度だけ数え、答えを見たら時を残す", () => {
    const once = readUpdate({ addedAt: T0 }, true, T0);
    expect(once).toEqual({ readDays: 1, lastReadAt: T0 });
    expect(readUpdate({ addedAt: T0, ...once }, true, T0 + 60_000)).toEqual({ readDays: 1, lastReadAt: T0 + 60_000 });
    expect(readUpdate({ addedAt: T0, ...once }, false, T0 + DAY)).toEqual({ missedAt: T0 + DAY });
  });
});
