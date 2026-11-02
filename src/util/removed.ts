// 消した語（表記|読み → 消した時刻）。アカウントの記録と合わせるとき、別の端末の記録から生き返らないように（data/record）。
// 語を消すたびに足す（db の removeWord）。端末の中だけに置き、ログインしていればアカウントの記録にも入る（util/account）。

const KEY = "kotonohashi.removed";

export function readRemoved(): Record<string, number> {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "{}") as unknown;
    if (typeof value !== "object" || value === null) return {};
    const out: Record<string, number> = {};
    for (const [k, at] of Object.entries(value)) if (typeof at === "number" && Number.isFinite(at)) out[k] = at;
    return out;
  } catch {
    return {};
  }
}

export function writeRemoved(removed: Record<string, number>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(removed));
  } catch {
    /* 残らないだけ（アカウントの記録から生き返ることがある） */
  }
}

/** 語を一つ消した。 */
export function noteRemoved(key: string, at = Date.now()): void {
  writeRemoved({ ...readRemoved(), [key]: at });
}
