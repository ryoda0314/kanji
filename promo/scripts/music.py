"""映像の音楽と小さな音。ここで作るので、映像の中の音はだれのものでもない（ことのは の映像と同じ作り方）。

    node scripts/marks.mjs | python scripts/music.py public/sound        (npm run music)

映像の区切り（秒）を標準入力から読む：名前、本編、数日後、終わりのカード、全体。音楽はゆっくり静かに：やわらかな和音、
名前から入るフェルトのピアノのような分散和音、数日後の小さな鐘、終わりのカードで主和音に帰る。小節の線が終わりのカードに
落ちるよう速さを決めるので、和音はどれも区切りに合う。種を決めてあるので、同じ区切りからは同じ音ができる。numpy だけ使う。
"""

import json
import sys
import wave
from pathlib import Path

import numpy as np

SR = 48000
rng = np.random.default_rng(20261023)


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def write(path, x):
    """x: (n, 2) float in -1..1, written as 16-bit stereo."""
    x = np.clip(x, -1, 1)
    data = (x * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


def lowpass(x, cutoff, order=2):
    """A gentle Butterworth-shaped low-pass applied in the frequency domain (axis 0)."""
    n = x.shape[0]
    spec = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(n, 1 / SR)
    gain = 1 / np.sqrt(1 + (f / cutoff) ** (2 * order))
    return np.fft.irfft(spec * (gain[:, None] if x.ndim == 2 else gain), n=n, axis=0)


def highpass(x, cutoff, order=2):
    n = x.shape[0]
    spec = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(n, 1 / SR)
    with np.errstate(divide="ignore"):
        gain = 1 / np.sqrt(1 + (cutoff / np.maximum(f, 1e-6)) ** (2 * order))
    return np.fft.irfft(spec * (gain[:, None] if x.ndim == 2 else gain), n=n, axis=0)


def reverb(x, seconds=2.6, decay=0.75, wet=0.3, predelay=0.02, tone=5500):
    """Convolution with decaying noise, different in each ear so the room is wide."""
    n_ir = int(seconds * SR)
    t = np.arange(n_ir) / SR
    ir = rng.standard_normal((n_ir, 2)) * np.exp(-t / decay)[:, None]
    ir = lowpass(ir, tone)
    ir[: int(predelay * SR)] = 0
    ir /= np.sqrt((ir**2).sum(axis=0, keepdims=True))
    n = x.shape[0] + n_ir
    size = 1 << (n - 1).bit_length()
    out = np.fft.irfft(np.fft.rfft(x, size, axis=0) * np.fft.rfft(ir, size, axis=0), size, axis=0)[:n]
    dry = np.zeros_like(out)
    dry[: x.shape[0]] = x
    return dry * (1 - wet) + out * wet * 2.2


def pan(mono, p):
    """p in -1 (left) .. 1 (right), equal power."""
    a = (p + 1) * np.pi / 4
    return np.stack([mono * np.cos(a), mono * np.sin(a)], axis=1)


def add(buf, at, sig):
    i = int(round(at * SR))
    if i >= buf.shape[0]:
        return
    j = min(buf.shape[0], i + sig.shape[0])
    buf[i:j] += sig[: j - i]


# ---- voices of the music ---------------------------------------------------------------------------------------------


def pad_note(m, dur, amp):
    """A soft chord tone: a few partials, two voices a hair apart, slow in and slow out."""
    rel = 2.2
    n = int((dur + rel) * SR)
    t = np.arange(n) / SR
    f = midi_hz(m)
    env = np.minimum(1, t / 1.3) ** 1.6
    env *= np.where(t < dur, 1.0, np.exp(-(t - dur) / (rel / 3.5)))
    env *= 1 + 0.08 * np.sin(2 * np.pi * 0.18 * t + rng.uniform(0, 6))
    out = np.zeros((n, 2))
    for cents, side in ((-5, -0.45), (5, 0.45)):
        ff = f * 2 ** (cents / 1200)
        ph = rng.uniform(0, 2 * np.pi)
        sig = sum(a * np.sin(2 * np.pi * k * ff * t + ph * k) for k, a in ((1, 1.0), (2, 0.28), (3, 0.09), (4, 0.03)))
        out += pan(sig * env, side)
    return out * amp


def pluck(m, amp, side=0.0, length=2.4):
    """A felt-piano-like note: quick to sound, its upper partials fading first, a touch out of tune upward."""
    n = int(length * SR)
    t = np.arange(n) / SR
    f = midi_hz(m)
    tau = 1.05 * (440 / f) ** 0.25
    sig = np.zeros(n)
    for k, a in ((1, 1.0), (2, 0.42), (3, 0.16), (4, 0.07), (5, 0.03)):
        fk = k * f * (1 + 0.00035 * k * k)
        sig += a * np.sin(2 * np.pi * fk * t) * np.exp(-t / (tau / k**0.8))
    sig *= np.minimum(1, t / 0.006)
    # The hammer's felt: a breath of noise at the start.
    noise = rng.standard_normal(n) * np.exp(-t / 0.008) * 0.05
    sig = sig + lowpass(noise, 2500)
    return pan(sig, side) * amp


def bass_note(m, dur, amp):
    n = int((dur + 1.2) * SR)
    t = np.arange(n) / SR
    f = midi_hz(m)
    env = np.minimum(1, t / 0.25) * np.exp(-t / (dur * 0.9))
    sig = (np.sin(2 * np.pi * f * t) + 0.18 * np.sin(4 * np.pi * f * t)) * env
    return pan(sig, 0) * amp


def bell(m, amp, side=0.0, length=3.0):
    n = int(length * SR)
    t = np.arange(n) / SR
    f = midi_hz(m)
    sig = np.zeros(n)
    for r, a, d in ((1, 1.0, 1.7), (2.0, 0.22, 0.9), (3.01, 0.1, 0.55), (4.17, 0.05, 0.3)):
        sig += a * np.sin(2 * np.pi * r * f * t) * np.exp(-t / d)
    sig *= np.minimum(1, t / 0.003)
    return pan(sig, side) * amp


# ---- the piece ---------------------------------------------------------------------------------------------------------

CHORDS = {
    #          bass  pad                     arpeggio (low → high)
    "Fmaj9": (41, [57, 60, 64, 67], [65, 69, 72, 76, 79]),
    "Am7": (45, [55, 60, 64, 69], [64, 69, 72, 76, 79]),
    "Dm9": (38, [53, 57, 60, 64], [62, 65, 69, 72, 76]),
    "Bbmaj9": (46, [57, 60, 62, 65], [62, 65, 69, 72, 77]),
    "Gm9": (43, [53, 58, 62, 69], [62, 65, 69, 70, 74]),
    "C9sus4": (48, [53, 58, 62, 67], [65, 67, 70, 72, 74]),
}
CYCLE = ["Fmaj9", "Am7", "Dm9", "Bbmaj9"]
SPARSE = [0, None, 2, None, 1, None, 3, None]
FLOW = [[0, 2, 4, 2, 3, None, 1, None], [1, 3, 4, None, 2, 3, 0, None]]
# 数日後：鐘が答える。少しずつ高く。
BELL = [(0, 0, 81), (0, 2, 84), (1, 0, 76), (1, 2.5, 79), (2, 0, 81), (2, 2, 77), (3, 0, 79), (3, 2, 74)]


def music(marks):
    total, end = marks["total"], marks["end"]
    bars = max(8, round(end / 3.2))
    bar = end / bars
    beat = bar / 4
    buf = np.zeros((int((total + 3.5) * SR), 2))
    names = [CYCLE[i % 4] for i in range(bars - 2)] + ["Gm9", "C9sus4"]

    for i, name in enumerate(names):
        at = i * bar
        bass, pad, arp = CHORDS[name]
        section = "intro" if at < marks["title"] - 0.5 else "title" if at < marks["story"] else "story" if at < marks["later"] else "later"
        quiet = {"intro": 0.7, "title": 0.85, "story": 1.0, "later": 1.0}[section]
        for m in pad:
            add(buf, at, pad_note(m, bar, 0.085 * quiet))
        if i >= 1:
            add(buf, at, bass_note(bass, bar, 0.12 * quiet))
        if section == "intro":
            continue
        pattern = SPARSE if section == "title" else FLOW[i % 2]
        for slot, idx in enumerate(pattern):
            if idx is None:
                continue
            m = arp[idx] + (12 if section == "later" and idx >= 3 else 0)
            vel = 0.13 * rng.uniform(0.75, 1.0) * (1.0 if slot % 4 == 0 else 0.82)
            add(buf, at + slot * beat / 2 + rng.uniform(-0.006, 0.006), pluck(m, vel, side=0.32 if slot % 2 else -0.32))
        if section == "later":
            k = i - next(j for j, n in enumerate(names) if j * bar >= marks["later"])
            for b, pos, m in BELL:
                if b == k:
                    add(buf, at + pos * beat, bell(m, 0.05, side=0.15))

    # The end card: home, rising once, then left to ring.
    bass, pad, arp = CHORDS["Fmaj9"]
    tail = total - end + 2.5
    for m in pad + [69]:
        add(buf, end, pad_note(m, tail - 1.5, 0.09))
    add(buf, end, bass_note(bass, tail, 0.13))
    add(buf, end, bass_note(bass + 12, tail, 0.05))
    for k, m in enumerate([65, 69, 72, 76, 79, 84]):
        add(buf, end + 0.12 + k * beat / 2, pluck(m, 0.12 * (1 - k * 0.06), side=-0.3 + k * 0.12, length=3.2))
    add(buf, end + 0.12 + 6 * beat / 2 + beat, bell(88, 0.035, side=0.2, length=3.5))

    out = reverb(lowpass(buf, 7000), seconds=3.2, decay=0.95, wet=0.32)
    out = out[: int(total * SR)]
    fade = int(0.8 * SR)
    out[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2
    return out / np.abs(out).max() * 0.9


# ---- small sounds ------------------------------------------------------------------------------------------------------


def drop(f0):
    """A raindrop on paper: a short rising tone, as a drop's ring does."""
    n = int(0.7 * SR)
    t = np.arange(n) / SR
    f = f0 * (1 + 0.55 * (1 - np.exp(-t / 0.014)))
    ph = 2 * np.pi * np.cumsum(f) / SR
    sig = np.sin(ph) * np.exp(-t / 0.065) + 0.12 * np.sin(2.1 * ph) * np.exp(-t / 0.03)
    sig *= np.minimum(1, t / 0.0015)
    return reverb(pan(sig, 0), seconds=0.8, decay=0.22, wet=0.22)


def tap():
    n = int(0.18 * SR)
    t = np.arange(n) / SR
    sig = 0.5 * np.sin(2 * np.pi * 1750 * t) * np.exp(-t / 0.005) + 0.8 * np.sin(2 * np.pi * 360 * t) * np.exp(-t / 0.018)
    sig *= np.minimum(1, t / 0.001)
    return pan(lowpass(sig, 6000), 0)


def send():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 560 + 420 * np.minimum(1, t / 0.09)
    sig = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(1, t / 0.01) * np.exp(-t / 0.085)
    air = highpass(lowpass(rng.standard_normal(n), 3200), 900) * np.minimum(1, t / 0.04) * np.exp(-t / 0.07) * 0.18
    return reverb(pan(sig * 0.8 + air, 0), seconds=0.6, decay=0.15, wet=0.2)


def typing(seconds=8.0):
    """Soft keys at an uneven pace, about thirteen a second, now and then the space bar."""
    n = int(seconds * SR)
    out = np.zeros(n)
    at = 0.02
    k = 0
    while at < seconds - 0.1:
        m = int(0.05 * SR)
        t = np.arange(m) / SR
        space = k % 6 == 5
        click = highpass(rng.standard_normal(m), 2200) * np.exp(-t / 0.0011)
        body = np.sin(2 * np.pi * rng.uniform(150, 230) * (0.8 if space else 1) * t) * np.exp(-t / (0.012 if space else 0.007))
        key = (click * 0.35 + body * 0.6) * rng.uniform(0.55, 1.0)
        i = int(at * SR)
        out[i : i + m] += key[: n - i]
        at += rng.gamma(4.0, 0.075 / 4.0) + (0.05 if space else 0)
        k += 1
    out = lowpass(out, 8000)
    return pan(out / np.abs(out).max() * 0.6, 0)


def chime():
    n = int(2.8 * SR)
    buf = np.zeros((n, 2))
    add(buf, 0.0, bell(81, 0.5, side=-0.15, length=2.6))
    add(buf, 0.11, bell(88, 0.38, side=0.2, length=2.6))
    return reverb(buf, seconds=1.8, decay=0.5, wet=0.35)


def normal(x, peak):
    return x / np.abs(x).max() * peak


def main():
    args = sys.argv[1:]
    name = "music.wav"
    if "--music" in args:
        i = args.index("--music")
        name = args[i + 1]
        del args[i : i + 2]
    out = Path(args[0] if args else "public/sound")
    out.mkdir(parents=True, exist_ok=True)
    marks = json.loads(sys.stdin.read())
    write(out / name, music(marks))
    for i, f0 in enumerate((1050, 1250, 1450), start=1):
        write(out / f"drop{i}.wav", normal(drop(f0), 0.7))
    write(out / "tap.wav", normal(tap(), 0.6))
    write(out / "send.wav", normal(send(), 0.6))
    write(out / "typing.wav", typing())
    write(out / "chime.wav", normal(chime(), 0.7))
    print(f"wrote {out}: {name} {marks['total']:.1f}s and the small sounds")


if __name__ == "__main__":
    main()
