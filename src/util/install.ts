// ホーム画面への追加（PWA のインストール）。ブラウザで開いたままの記録は、しばらく開かないと消えることがある
// （iOS の Safari など）。ホーム画面に追加したアプリは、その対象にならない。
import { useSyncExternalStore } from "react";

/** Chrome などが出す「インストールできます」の合図。早めに来るので、読み込んだときから待っておく。 */
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

/** いまインストールの画面を出せるか（出せる間だけ値がある）。 */
export function useInstallPrompt(): InstallPrompt | null {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    () => deferred,
    () => null
  );
}

/** インストールの画面を出す。追加されたら true。 */
export async function promptInstall(): Promise<boolean> {
  const p = deferred;
  if (!p) return false;
  await p.prompt();
  const { outcome } = await p.userChoice;
  if (outcome === "accepted") {
    deferred = null;
    notify();
  }
  return outcome === "accepted";
}

/** ホーム画面から開いているか。 */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

/** iPhone・iPad（iPadOS は Mac と名乗るので、触れる画面かどうかで見分ける）。 */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}
