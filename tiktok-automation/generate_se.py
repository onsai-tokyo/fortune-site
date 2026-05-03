"""
SE（効果音）生成モジュール
的中！用のゴールドディーン音をプログラムで生成する
"""

import wave
import struct
import math
from pathlib import Path


def generate_tekichu_se(output_path: str = "assets/se/tekichu.wav") -> str:
    """
    的中！SE音声を生成（ゴールドディーン＋ドラム系の爽快音）
    外部ファイル不要・numpy不要でwaveモジュールだけで生成
    """
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    sample_rate = 44100
    duration = 1.0  # 秒

    frames = []
    for i in range(int(sample_rate * duration)):
        t = i / sample_rate

        # エンベロープ（素早いアタック → ゆっくり減衰）
        attack = 0.008
        if t < attack:
            env = t / attack
        else:
            env = math.exp(-4.5 * (t - attack))

        # 和音（A5 + C#6 + E6 = Aメジャーコード）
        f1, f2, f3 = 880.0, 1108.73, 1318.51
        wave_val = (
            0.50 * math.sin(2 * math.pi * f1 * t) +
            0.30 * math.sin(2 * math.pi * f2 * t) +
            0.20 * math.sin(2 * math.pi * f3 * t)
        )

        # 倍音を少し足してリッチに
        wave_val += 0.08 * math.sin(2 * math.pi * f1 * 2 * t) * math.exp(-8 * t)

        sample = int(wave_val * env * 28000)
        sample = max(-32767, min(32767, sample))
        frames.append(struct.pack("<h", sample))

    with wave.open(output_path, "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(b"".join(frames))

    return output_path


def generate_whoosh_se(output_path: str = "assets/se/whoosh.wav") -> str:
    """
    ズームイン時のウィッシュ音を生成
    """
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    sample_rate = 44100
    duration = 0.35

    frames = []
    for i in range(int(sample_rate * duration)):
        t = i / sample_rate
        progress = t / duration

        # 周波数を上昇させる（200Hz → 1200Hz）
        freq = 200 + 1000 * progress
        env = math.sin(math.pi * progress) * 0.6

        noise = (hash(i * 7 + 13) % 1000 - 500) / 500.0 * 0.3
        wave_val = math.sin(2 * math.pi * freq * t) * env + noise * (1 - progress)

        sample = int(wave_val * 20000)
        sample = max(-32767, min(32767, sample))
        frames.append(struct.pack("<h", sample))

    with wave.open(output_path, "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(b"".join(frames))

    return output_path


if __name__ == "__main__":
    p1 = generate_tekichu_se()
    print(f"的中SE生成: {p1}")
    p2 = generate_whoosh_se()
    print(f"ウィッシュSE生成: {p2}")
