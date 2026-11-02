import { describe, expect, it } from "vitest";
import { KEEP_MS, readReturn } from "./connect";

const pending = { state: "Ab3_-xY9Ab3_-xY9Ab3_-xY9Ab3_", at: 1_000_000 };

describe("readReturn", () => {
  it("is null when no token came back", () => {
    expect(readReturn("", pending, pending.at)).toBeNull();
    expect(readReturn("#/me", pending, pending.at)).toBeNull();
  });

  it("takes the token when it comes back to the つなぐ started here", () => {
    expect(readReturn(`#kotonoame=tok123&state=${pending.state}`, pending, pending.at + 60_000)).toEqual({ token: "tok123" });
  });

  it("refuses a token for a つなぐ not started here, or started too long ago", () => {
    expect(readReturn(`#kotonoame=tok123&state=${pending.state}`, null, pending.at)).toEqual({ error: "stale" });
    expect(readReturn("#kotonoame=tok123&state=someoneelse", pending, pending.at)).toEqual({ error: "stale" });
    expect(readReturn("#kotonoame=tok123", pending, pending.at)).toEqual({ error: "stale" });
    expect(readReturn(`#kotonoame=tok123&state=${pending.state}`, pending, pending.at + KEEP_MS + 1)).toEqual({ error: "stale" });
    expect(readReturn(`#kotonoame=tok123&state=${pending.state}`, { ...pending, at: Number.NaN }, pending.at)).toEqual({ error: "stale" });
  });
});
