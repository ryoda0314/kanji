import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 辞書の番号は、全データを読まずに決め打ちする（学生 = 42 番）。
vi.mock("../data/dataset", () => ({
  wordNumber: (kanji: string, kana: string) => (kanji === "学生" && kana === "がくせい" ? 42 : undefined),
  wordByNumber: (n: number) => (n === 42 ? { kanji: "学生", kana: "がくせい", gloss: "학생" } : undefined),
  wordsVersion: () => "v-test",
}));

// 送り先は本物でない番地にして、fetch も差し替える（テストから本番に降らないように）。
const SITE = "https://kotonohashi.example/";
let fetchMock: ReturnType<typeof vi.fn>;
let store: Map<string, string>;

async function load(origin = "https://kotonohashi.example") {
  vi.stubEnv("PROD", true);
  vi.stubEnv("VITE_SITE_URL", SITE);
  vi.stubEnv("VITE_SUPABASE_URL", "https://supabase.example");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
  vi.stubGlobal("location", { origin });
  vi.resetModules();
  return import("./falls");
}

beforeEach(() => {
  store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
  fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const body = (i = 0) => JSON.parse((fetchMock.mock.calls[i][1] as RequestInit).body as string);

describe("shareWord", () => {
  it("辞書の語は、番号と辞書の版だけを kh_fall に送る（語そのものや端末の番号は送らない）", async () => {
    const { shareWord } = await load();
    shareWord({ kanji: "学生", kana: "がくせい", source: "seed" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://supabase.example/rest/v1/rpc/kh_fall");
    expect(body()).toEqual({ p_ver: "v-test", p_word: 42 });
  });

  it("手で登録した語・辞書に無い語は送らない", async () => {
    const { shareWord } = await load();
    shareWord({ kanji: "学生", kana: "がくせい", source: "manual" });
    shareWord({ kanji: "無語", kana: "むご", source: "seed" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("自分 で止めたら送らない", async () => {
    const { shareWord, SHARE_PREF } = await load();
    store.set(`kotonohashi.${SHARE_PREF}`, "0");
    shareWord({ kanji: "学生", kana: "がくせい", source: "seed" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("公開先でなければ送らない", async () => {
    const { shareWord } = await load("http://localhost:4173");
    shareWord({ kanji: "学生", kana: "がくせい", source: "seed" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("readFalls", () => {
  it("番号を語に戻し、いまの辞書に無い番号は除く", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        Response.json({
          total: 3,
          falls: [
            { id: 9, word: 42, at: "2026-11-01T10:00:00+00:00" },
            { id: 8, word: 99999, at: "2026-11-01T09:59:00+00:00" },
          ],
        })
      )
    );
    const { readFalls } = await load("http://localhost:4173");
    const result = await readFalls(5);
    expect(body()).toEqual({ p_ver: "v-test", p_after: 5 });
    expect(result).toEqual({ total: 3, falls: [{ id: 9, word: expect.objectContaining({ kanji: "学生" }), at: Date.parse("2026-11-01T10:00:00Z") }] });
  });

  it("読めなければ null", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response("no", { status: 404 })));
    const { readFalls } = await load();
    expect(await readFalls()).toBeNull();
  });
});

describe("readFallsTotal", () => {
  it("語は読まずに、この1時間に降った数だけ", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(Response.json({ total: 12, falls: [] })));
    const { readFallsTotal } = await load();
    expect(await readFallsTotal()).toBe(12);
    expect(body()).toEqual({ p_ver: "v-test", p_after: Number.MAX_SAFE_INTEGER });
  });

  it("読めなければ null", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error("offline")));
    const { readFallsTotal } = await load();
    expect(await readFallsTotal()).toBeNull();
  });
});
