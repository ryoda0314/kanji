import { describe, expect, it } from "vitest";
import { initialScript } from "./prefs";

describe("initialScript", () => {
  const from = (saved: Record<string, string>) => (key: string) => saved[key] ?? null;

  it("まだ選んでいなければ 両方（形の違う字に韓国で書く形を添える）", () => {
    expect(initialScript(from({}))).toBe("both");
  });

  it("選んだ字形はそのまま", () => {
    expect(initialScript(from({ "kotonohashi.script": "ja" }))).toBe("ja");
    expect(initialScript(from({ "kotonohashi.script": "both" }))).toBe("both");
  });

  it("知らない値は既定に", () => {
    expect(initialScript(from({ "kotonohashi.script": "ko" }))).toBe("both");
  });
});
