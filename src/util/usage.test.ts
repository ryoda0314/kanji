import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 送り先は本物でない番地にして、fetch も差し替える（テストから本番に数えが飛ばないように）。
const SITE = "https://kotonone.example/";
let fetchMock: ReturnType<typeof vi.fn>;
let store: Map<string, string>;

async function load(prod: boolean, origin: string) {
  vi.stubEnv("PROD", prod);
  vi.stubEnv("VITE_SITE_URL", SITE);
  vi.stubEnv("VITE_SUPABASE_URL", "https://supabase.example");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
  vi.stubGlobal("location", { origin });
  vi.resetModules();
  return import("./usage");
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

describe("countUsage", () => {
  it("公開先で開いたときは kh_ping に送る", async () => {
    const { countUsage } = await load(true, "https://kotonone.example");
    countUsage("open");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://supabase.example/rest/v1/rpc/kh_ping");
    expect(JSON.parse(init.body as string)).toMatchObject({ p_kind: "open", p_standalone: false });
  });

  it("同じ端末は同じ番号で送る", async () => {
    const { countUsage } = await load(true, "https://kotonone.example");
    countUsage("open");
    countUsage("collect");
    const [a, b] = fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string).p_device);
    expect(a).toBe(b);
  });

  it("ほかの場所（手元の preview・Vercel の試しの公開）では送らない", async () => {
    const { countUsage } = await load(true, "http://localhost:4173");
    countUsage("open");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("npm run dev（本番のビルドでない）では送らない", async () => {
    const { countUsage } = await load(false, "https://kotonone.example");
    countUsage("open");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("自分 で止めたら送らない", async () => {
    const { countUsage, SEND_PREF } = await load(true, "https://kotonone.example");
    store.set(`kotonohashi.${SEND_PREF}`, "0");
    countUsage("open");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("引き継ぎのリンクで移ったとき", () => {
  const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
  const sent = () => JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string).p_device;

  it("番号の無いところへは、前のところの番号を引き継いで数える", async () => {
    const { adoptCarriedUsage, countUsage } = await load(true, "https://kotonone.example");
    adoptCarriedUsage(new URLSearchParams({ i: ID }), false);
    countUsage("open");
    expect(sent()).toBe(ID);
  });

  it("もう番号があれば、replace のときだけ替える", async () => {
    const { adoptCarriedUsage } = await load(true, "https://kotonone.example");
    store.set("kotonohashi.device", "11111111-1111-4111-8111-111111111111");
    adoptCarriedUsage(new URLSearchParams({ i: ID }), false);
    expect(store.get("kotonohashi.device")).not.toBe(ID);
    adoptCarriedUsage(new URLSearchParams({ i: ID }), true);
    expect(store.get("kotonohashi.device")).toBe(ID);
  });

  it("番号の形でなければ引き継がない", async () => {
    const { adoptCarriedUsage } = await load(true, "https://kotonone.example");
    adoptCarriedUsage(new URLSearchParams({ i: "not-a-device" }), true);
    expect(store.has("kotonohashi.device")).toBe(false);
  });

  it("前のところで送るのを止めていたら、ここでも止める", async () => {
    const { adoptCarriedUsage, countUsage, usageForCarry, SEND_PREF } = await load(true, "https://kotonone.example");
    adoptCarriedUsage(new URLSearchParams({ u: "0" }), false);
    countUsage("open");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.get(`kotonohashi.${SEND_PREF}`)).toBe("0");
    expect(usageForCarry()).toEqual({ u: "0" });
  });

  it("リンクに添えるのは、この端末の番号", async () => {
    const { countUsage, usageForCarry } = await load(true, "https://kotonone.example");
    countUsage("open");
    expect(usageForCarry()).toEqual({ i: sent() });
  });
});
