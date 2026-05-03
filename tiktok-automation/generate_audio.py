"""
音声生成モジュール
VOICEVOX ローカルサーバー（port 50021）を使って日本語TTS音声を生成する

事前準備：
  VOICEVOX アプリを起動しておく（https://voicevox.hiroshiba.jp/）
  → 起動するだけで localhost:50021 がリッスン状態になる
"""

import os
import json
import time
import requests
from pathlib import Path


VOICEVOX_BASE_URL = os.getenv("VOICEVOX_URL", "http://localhost:50021")

# VOICEVOX スピーカーID
# 1=四国めたん(ノーマル), 3=ずんだもん(ノーマル), 8=春日部つむぎ, 13=青山龍星
# 占い系の落ち着いた声として「青山龍星」か「四国めたん」を推奨
DEFAULT_SPEAKER_ID = int(os.getenv("VOICEVOX_SPEAKER_ID", "13"))


def is_voicevox_running() -> bool:
    """VOICEVOXサーバーが起動しているか確認"""
    try:
        res = requests.get(f"{VOICEVOX_BASE_URL}/version", timeout=3)
        return res.status_code == 200
    except requests.exceptions.ConnectionError:
        return False


def synthesize_speech(text: str, output_path: str, speaker_id: int = DEFAULT_SPEAKER_ID) -> str:
    """
    テキストを音声ファイルに変換する

    Args:
        text: 読み上げるテキスト
        output_path: 出力先パス（.wav）
        speaker_id: VOICEVOXスピーカーID

    Returns:
        出力ファイルパス
    """
    if not is_voicevox_running():
        raise RuntimeError(
            "VOICEVOXが起動していません。\n"
            "VOICEVOXアプリを起動してから再実行してください。\n"
            "ダウンロード: https://voicevox.hiroshiba.jp/"
        )

    # Step 1: audio_query（読み方・アクセント情報の取得）
    query_res = requests.post(
        f"{VOICEVOX_BASE_URL}/audio_query",
        params={"text": text, "speaker": speaker_id},
        timeout=30,
    )
    query_res.raise_for_status()
    audio_query = query_res.json()

    # 速度・音量を調整（落ち着いた占い風）
    audio_query["speedScale"] = float(os.getenv("VOICEVOX_SPEED", "0.95"))
    audio_query["intonationScale"] = float(os.getenv("VOICEVOX_INTONATION", "1.1"))
    audio_query["volumeScale"] = float(os.getenv("VOICEVOX_VOLUME", "1.0"))

    # Step 2: synthesis（音声合成）
    synth_res = requests.post(
        f"{VOICEVOX_BASE_URL}/synthesis",
        params={"speaker": speaker_id},
        data=json.dumps(audio_query),
        headers={"Content-Type": "application/json"},
        timeout=60,
    )
    synth_res.raise_for_status()

    # Step 3: WAVファイル保存
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(synth_res.content)

    return output_path


def get_audio_duration(wav_path: str) -> float:
    """WAVファイルの再生時間（秒）を取得"""
    import wave
    with wave.open(wav_path, "r") as wf:
        frames = wf.getnframes()
        rate = wf.getframerate()
        return frames / float(rate)


def list_speakers() -> list[dict]:
    """利用可能なスピーカー一覧を取得"""
    if not is_voicevox_running():
        print("VOICEVOXが起動していません")
        return []

    res = requests.get(f"{VOICEVOX_BASE_URL}/speakers", timeout=10)
    res.raise_for_status()
    return res.json()


if __name__ == "__main__":
    if not is_voicevox_running():
        print("VOICEVOXが起動していません。アプリを起動してから再実行してください。")
        print("ダウンロード: https://voicevox.hiroshiba.jp/")
        exit(1)

    # テスト音声生成
    test_text = "4月19日生まれのあなた、これ知ってましたか？あなたには他の人には見えない「流れ」を読む力があります。"
    output = "output/test_audio.wav"
    path = synthesize_speech(test_text, output)
    duration = get_audio_duration(path)
    print(f"音声生成完了: {path} ({duration:.1f}秒)")
