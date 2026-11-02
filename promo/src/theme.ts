import { useEffect, useState } from "react";
import { staticFile, useDelayRender } from "remotion";

// 말씨앗 の紙と墨と、アクセントの わかば（../src/index.css）。紫は、また出会ったもの（集めた語）。
export const C = {
  paper: "#fcfbf8",
  surface: "#f1f4f8",
  ink: "#172033",
  ink2: "#3b4558",
  muted: "#5c6578",
  faint: "#8c94a5",
  line: "#e4e7ec",
  line2: "#d4d9e1",
  accent: "#0f7a50",
  tint: "#e3f1e9",
  again: "#6a4fe0",
  againTint: "#efebff",
} as const;

export const FONT = {
  ui: `"PlexKR", "PlexJP", sans-serif`,
  ko: `"PlexKR", "PlexJP", sans-serif`,
  ja: `"PlexJP", "PlexKR", sans-serif`,
  /** 日本語の漢字（アプリの --font-hanja：Noto Serif JP）。 */
  hanja: `"SerifJP", serif`,
  /** 韓国の字形（學生。--font-hanja-ko：Noto Serif KR）。 */
  hanjaKo: `"SerifKR", "SerifJP", serif`,
  /** 名前の 말씨앗（--font-wordmark：고운바탕）。 */
  wordmark: `"Gowun", "SerifKR", serif`,
} as const;

// アプリの字。`npm run assets` が public/fonts に置く（映像に出てくる字だけに切る）。
const FACES: [family: string, file: string, weight: string][] = [
  ["PlexKR", "fonts/IBMPlexSansKR-Regular.ttf", "400"],
  ["PlexKR", "fonts/IBMPlexSansKR-Medium.ttf", "500"],
  ["PlexKR", "fonts/IBMPlexSansKR-SemiBold.ttf", "600"],
  ["PlexJP", "fonts/IBMPlexSansJP-Regular.ttf", "400"],
  ["PlexJP", "fonts/IBMPlexSansJP-Medium.ttf", "500"],
  ["PlexJP", "fonts/IBMPlexSansJP-SemiBold.ttf", "600"],
  ["SerifJP", "fonts/NotoSerifJP.ttf", "200 900"],
  ["SerifKR", "fonts/NotoSerifKR.ttf", "200 900"],
  ["Gowun", "fonts/GowunBatang-Bold.ttf", "700"],
];

let loading: Promise<unknown> | null = null;

/** 字が読み終わるまで、どのコマも待たせる（映像の根から呼ぶ）。 */
export function useFonts() {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    loading ??= Promise.all(
      FACES.map(([family, file, weight]) => {
        const face = new FontFace(family, `url(${staticFile(file)})`, { weight });
        document.fonts.add(face);
        return face.load();
      }),
    );
    loading.then(() => continueRender(handle), cancelRender);
  }, [handle, continueRender, cancelRender]);
}
