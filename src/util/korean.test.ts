import { describe, expect, it } from "vitest";
import { compareKo, leadConsonant, leadOrder } from "./korean";

describe("leadConsonant", () => {
  it("最初の音節から初声を返す", () => {
    expect(leadConsonant("학생")).toBe("ㅎ");
    expect(leadConsonant("경제")).toBe("ㄱ");
    expect(leadConsonant("사회")).toBe("ㅅ");
    expect(leadConsonant("대학")).toBe("ㄷ");
  });

  it("濃音の初声も判定する", () => {
    expect(leadConsonant("까치")).toBe("ㄲ");
  });

  it("ハングル以外は #", () => {
    expect(leadConsonant("A형")).toBe("#");
  });
});

describe("leadOrder", () => {
  it("ㄱ < ㅎ の順序", () => {
    expect(leadOrder("ㄱ")).toBeLessThan(leadOrder("ㅎ"));
  });
  it("# は末尾", () => {
    expect(leadOrder("#")).toBeGreaterThan(leadOrder("ㅎ"));
  });
});

describe("compareKo", () => {
  it("가나다順に並ぶ", () => {
    const arr = ["학생", "경제", "사회"].sort(compareKo);
    expect(arr).toEqual(["경제", "사회", "학생"]);
  });
});
