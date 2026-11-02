// 引き継ぎのリンク。iPhone では X などのアプリの中のブラウザ・Safari・ホーム画面のアプリで、集めた語のしまい場所が別々で、
// 互いに見えない（ホーム画面に追加しても、Safari で集めた語は入らない）。集めた語を書き出しと同じ形でリンクの # の後ろに詰め、
// 移った先で開くか貼ると、そこへ足す。# の後ろは公開先へ送られないので、語は端末の外へ出ない。
// 端末の番号（util/usage）も添えて、移った先でも同じ1台に数える。数を送る・みんなの雨に降らせるのを止めていれば、移った先でも止める。
import { db, exportBackup, parseBackup, restoreWords } from "../db";
import { shareAllowed, stopSharing } from "./falls";
import { adoptCarriedUsage, usageForCarry } from "./usage";

const MARK = "#/carry?";

function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function through(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  return new Uint8Array(await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream)).arrayBuffer());
}

/** 書き出しの JSON をリンクに入る文字にする。縮められる端末では gzip して z、できなければそのまま j を頭に付ける。 */
export async function encodeCarry(json: string): Promise<string> {
  const bytes = new TextEncoder().encode(json);
  if (typeof CompressionStream === "undefined") return `j${toBase64Url(bytes)}`;
  return `z${toBase64Url(await through(bytes, new CompressionStream("gzip")))}`;
}

/** encodeCarry の逆。読めなければ null。 */
export async function decodeCarry(d: string): Promise<string | null> {
  try {
    const bytes = fromBase64Url(d.slice(1));
    if (d[0] === "j") return new TextDecoder().decode(bytes);
    if (d[0] === "z" && typeof DecompressionStream !== "undefined") {
      return new TextDecoder().decode(await through(bytes, new DecompressionStream("gzip")));
    }
  } catch {
    /* 途中で切れたリンクなど */
  }
  return null;
}

/** リンク（または、リンクを含む貼られた文）から引き継ぎの中身を取り出す。引き継ぎのリンクでなければ null。 */
export function carryParams(text: string): URLSearchParams | null {
  const at = text.indexOf(MARK);
  if (at < 0) return null;
  const params = new URLSearchParams(text.slice(at + MARK.length).split(/\s/)[0]);
  return params.get("d") ? params : null;
}

/** いま集めている語を詰めた、引き継ぎのリンク。 */
export async function carryLink(): Promise<string> {
  const params = new URLSearchParams({
    d: await encodeCarry(await exportBackup(false)),
    ...usageForCarry(),
    ...(shareAllowed() ? {} : { w: "0" }),
  });
  return `${location.origin}${location.pathname}${MARK}${params}`;
}

/**
 * 引き継ぎの中身を、この端末に足す（持っている語はそのまま）。読めなければ null。
 * まだ語の無いところへ移ったときは、前のところの番号も引き継ぐ。
 */
export async function receiveCarry(params: URLSearchParams): Promise<{ added: number; skipped: number } | null> {
  const json = await decodeCarry(params.get("d") ?? "");
  const words = json === null ? null : parseBackup(json);
  if (!words) return null;
  const fresh = (await db.words.count()) === 0;
  const result = await restoreWords(words);
  adoptCarriedUsage(params, fresh);
  if (params.get("w") === "0") stopSharing();
  return result;
}
