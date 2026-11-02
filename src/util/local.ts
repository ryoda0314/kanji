// 端末にだけ残す小さな好み（文で出会う の「漢字を添える」「訳を隠す」など）。localStorage が使えなければ既定のまま。
import { useCallback, useState } from "react";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* プライベートモードなど：残らないだけ */
  }
}

/** オン・オフの好み。 */
export function usePref(name: string, fallback: boolean): [boolean, (on: boolean) => void] {
  const key = `kotonohashi.${name}`;
  const [value, setValue] = useState(() => {
    const saved = read(key);
    return saved === null ? fallback : saved === "1";
  });
  const set = useCallback(
    (on: boolean) => {
      setValue(on);
      write(key, on ? "1" : "0");
    },
    [key]
  );
  return [value, set];
}

/** 出した文の番号（同じ文ばかりにならないよう）。新しい順に max 件まで。 */
export function readSeen(name: string): Set<number> {
  try {
    const list = JSON.parse(read(`kotonohashi.${name}`) ?? "[]");
    return new Set(Array.isArray(list) ? list.filter((n) => Number.isInteger(n)) : []);
  } catch {
    return new Set();
  }
}

export function addSeen(name: string, ids: number[], max = 800) {
  const list = [...readSeen(name)].filter((n) => !ids.includes(n));
  write(`kotonohashi.${name}`, JSON.stringify([...list, ...ids].slice(-max)));
}
