import { afterEach, describe, expect, it, vi } from "vitest";
import { parseBackup } from "../db";
import { carryParams, decodeCarry, encodeCarry } from "./carry";

const backup = JSON.stringify({
  app: "kotonohashi",
  version: 1,
  words: [{ kanji: "学生", kana: "がくせい", source: "seed", addedAt: 1, readDays: 2, lastReadAt: 3 }],
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("encodeCarry・decodeCarry", () => {
  it("縮めてリンクに入る文字にし、戻すと同じ中身（かな・漢字も）", async () => {
    const d = await encodeCarry(backup);
    expect(d).toMatch(/^z[A-Za-z0-9_-]+$/);
    expect(await decodeCarry(d)).toBe(backup);
    expect(parseBackup((await decodeCarry(d))!)?.[0]).toMatchObject({ kanji: "学生", kana: "がくせい", readDays: 2 });
  });

  it("縮められない端末で作ったリンク（j）も読める", async () => {
    vi.stubGlobal("CompressionStream", undefined);
    const d = await encodeCarry(backup);
    vi.unstubAllGlobals();
    expect(d[0]).toBe("j");
    expect(await decodeCarry(d)).toBe(backup);
  });

  it("途中で切れたリンクや空は null", async () => {
    const d = await encodeCarry(backup);
    expect(await decodeCarry(d.slice(0, Math.floor(d.length / 2)))).toBeNull();
    expect(await decodeCarry("")).toBeNull();
    expect(await decodeCarry("x123")).toBeNull();
  });
});

describe("carryParams", () => {
  it("貼られた文の前後に言葉があっても、リンクの中身を取り出す", () => {
    const p = carryParams("これ → https://kotonone.example/#/carry?d=zABC&i=0f8fad5b-d9cb-469f-a165-70867728950e 開いてね");
    expect(p?.get("d")).toBe("zABC");
    expect(p?.get("i")).toBe("0f8fad5b-d9cb-469f-a165-70867728950e");
  });

  it("アドレスの # だけでも読める", () => {
    expect(carryParams("#/carry?d=zABC")?.get("d")).toBe("zABC");
  });

  it("引き継ぎのリンクでなければ null", () => {
    expect(carryParams("https://kotonone.example/#/words")).toBeNull();
    expect(carryParams("#/carry?i=0f8fad5b-d9cb-469f-a165-70867728950e")).toBeNull();
  });
});
