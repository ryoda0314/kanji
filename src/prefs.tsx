// 表示と読み上げの設定（字形・アクセントの色・読み上げの速さ）。端末の localStorage に残す。
// 消えても既定に戻るだけで、集めた語には影響しない。
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/** 字形：日本の字だけ（学）か、韓国で書く形も添える（学 學）か。 */
export type ScriptPref = "ja" | "both";
export type AccentPref = "wakaba" | "rain" | "ink" | "hydrangea" | "dusk";
export type RatePref = "slow" | "normal" | "fast";

/** 字形。韓国語を話す人のためのアプリなので、形の違う字は韓国の形も添えるのが既定。 */
export const SCRIPTS: readonly ScriptPref[] = ["both", "ja"];
/** わかば は ことのね・글씨앗・말씨앗 の色。ほかの4色は姉妹アプリ ことのあめ と同じ。 */
export const ACCENTS: readonly AccentPref[] = ["wakaba", "rain", "ink", "hydrangea", "dusk"];
export const RATES: Record<RatePref, number> = { slow: 0.7, normal: 0.9, fast: 1.1 };

const KEYS = { script: "kotonohashi.script", accent: "kotonohashi.accent", rate: "kotonohashi.rate" };

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function load<T extends string>(key: string, choices: readonly T[], fallback: T): T {
  const saved = read(key);
  return choices.includes(saved as T) ? (saved as T) : fallback;
}

/** 字形のはじめの値：選んだ字形。まだ選んでいなければ 両方。 */
export function initialScript(get: (key: string) => string | null = read): ScriptPref {
  const saved = get(KEYS.script);
  return SCRIPTS.includes(saved as ScriptPref) ? (saved as ScriptPref) : "both";
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* プライベートモードなど：残らないだけ */
  }
}

interface Prefs {
  script: ScriptPref;
  setScript: (s: ScriptPref) => void;
  accent: AccentPref;
  setAccent: (a: AccentPref) => void;
  rate: RatePref;
  setRate: (r: RatePref) => void;
}

const PrefsContext = createContext<Prefs>({
  script: "both",
  setScript: () => {},
  accent: "wakaba",
  setAccent: () => {},
  rate: "normal",
  setRate: () => {},
});

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [script, setScript] = useState<ScriptPref>(() => initialScript());
  const [accent, setAccent] = useState<AccentPref>(() => load(KEYS.accent, ACCENTS, "wakaba"));
  const [rate, setRate] = useState<RatePref>(() => load(KEYS.rate, ["slow", "normal", "fast"], "normal"));

  // 字形は選んだときだけ残す（既定を書き込むと、既定を変えたときに前の既定のままになる）。
  function chooseScript(s: ScriptPref) {
    setScript(s);
    save(KEYS.script, s);
  }
  useEffect(() => save(KEYS.rate, rate), [rate]);
  useEffect(() => {
    save(KEYS.accent, accent);
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  return (
    <PrefsContext.Provider value={{ script, setScript: chooseScript, accent, setAccent, rate, setRate }}>
      {children}
    </PrefsContext.Provider>
  );
}

export function usePrefs() {
  return useContext(PrefsContext);
}
