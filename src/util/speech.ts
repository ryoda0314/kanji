// 端末の声で日本語を読み上げる（Web Speech API）。日本語の声が無い端末では何もしない。
import { useEffect, useState } from "react";

function japaneseVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === "undefined") return null;
  return speechSynthesis.getVoices().find((v) => v.lang.replace("_", "-").toLowerCase().startsWith("ja")) ?? null;
}

/** 日本語の声（声の一覧は後から届くことがあるので、届いたら入れ替える）。無ければ null。 */
export function useJapaneseVoice(): SpeechSynthesisVoice | null {
  const [voice, setVoice] = useState(japaneseVoice);
  useEffect(() => {
    if (typeof speechSynthesis === "undefined") return;
    const update = () => setVoice(japaneseVoice());
    update();
    speechSynthesis.addEventListener("voiceschanged", update);
    return () => speechSynthesis.removeEventListener("voiceschanged", update);
  }, []);
  return voice;
}

/** 読み上げる。終わったら（止められたら）true、声が出せなければ false。前の読み上げは止める。 */
export function speak(text: string, voice: SpeechSynthesisVoice, rate: number): Promise<boolean> {
  return new Promise((resolve) => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voice.lang;
    u.voice = voice;
    u.rate = rate;
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(ok);
    };
    u.onend = () => done(true);
    u.onerror = (e) => done(e.error === "interrupted" || e.error === "canceled");
    // 終わったと知らせない端末もある：語なら十分に終わっている長さで切り上げる。
    const timer = window.setTimeout(() => done(true), 2500 + (text.length * 500) / rate);
    speechSynthesis.speak(u);
  });
}
