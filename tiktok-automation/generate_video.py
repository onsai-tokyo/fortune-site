"""
動画生成モジュール
Pillow で背景フレームを生成 → MoviePy で音声と合成して TikTok縦型動画（1080x1920）を作る
"""

import os
import math
from pathlib import Path
from datetime import datetime

import numpy as np
from typing import Optional
from PIL import Image, ImageDraw, ImageFont
from moviepy import (
    AudioFileClip,
    ImageClip,
    CompositeVideoClip,
    concatenate_videoclips,
)

# TikTok縦型サイズ
W, H = 1080, 1920

# カラーパレット（fate-labブランドカラー）
COLOR_BG_TOP    = (12, 8, 18)       # #0c0812
COLOR_BG_BOTTOM = (23, 15, 38)      # #170f26
COLOR_ACCENT    = (201, 168, 76)    # #c9a84c ゴールド
COLOR_WHITE     = (255, 255, 255)
COLOR_GRAY      = (180, 180, 200)
COLOR_DIM       = (100, 100, 130)


def _load_font(size: int) -> ImageFont.FreeTypeFont:
    """日本語フォントを読み込む（なければデフォルト）"""
    font_candidates = [
        # macOS
        "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc",
        "/System/Library/Fonts/Hiragino Sans GB.ttc",
        "/Library/Fonts/Arial Unicode.ttf",
        # プロジェクト内に置いたフォント
        str(Path(__file__).parent / "assets" / "fonts" / "NotoSansJP-Bold.ttf"),
        str(Path(__file__).parent / "assets" / "fonts" / "NotoSansJP-Regular.ttf"),
    ]
    for path in font_candidates:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def _gradient_background() -> np.ndarray:
    """グラデーション背景を生成（上：濃い紫紺 → 下：やや明るい紫）"""
    img = Image.new("RGB", (W, H))
    draw = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        r = int(COLOR_BG_TOP[0] + (COLOR_BG_BOTTOM[0] - COLOR_BG_TOP[0]) * t)
        g = int(COLOR_BG_TOP[1] + (COLOR_BG_BOTTOM[1] - COLOR_BG_TOP[1]) * t)
        b = int(COLOR_BG_TOP[2] + (COLOR_BG_BOTTOM[2] - COLOR_BG_TOP[2]) * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))
    return np.array(img)


def _draw_stars(draw: ImageDraw.Draw, seed: int = 42) -> None:
    """背景に星を描く"""
    rng = np.random.default_rng(seed)
    for _ in range(120):
        x = int(rng.integers(0, W))
        y = int(rng.integers(0, H // 2))
        r = int(rng.integers(1, 3))
        alpha = int(rng.integers(60, 180))
        draw.ellipse([x - r, y - r, x + r, y + r], fill=(alpha, alpha, alpha + 20))


def _draw_circle_deco(draw: ImageDraw.Draw) -> None:
    """装飾的な円弧を描く"""
    cx, cy = W // 2, H // 4
    for radius in [280, 320, 360]:
        draw.arc(
            [cx - radius, cy - radius, cx + radius, cy + radius],
            start=200, end=340,
            fill=(201, 168, 76, 40),
            width=1,
        )


def _wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    """テキストを指定幅で折り返す"""
    lines = []
    current = ""
    for char in text:
        test = current + char
        bbox = font.getbbox(test)
        if bbox[2] - bbox[0] > max_width and current:
            lines.append(current)
            current = char
        else:
            current = test
    if current:
        lines.append(current)
    return lines


def make_title_frame(month: int, day: int, feature: str, index: int, total: int = 3) -> np.ndarray:
    """
    特徴テキストカードのフレーム画像を生成

    Args:
        month/day: 生年月日
        feature: 特徴テキスト
        index: 特徴番号（1〜3）
        total: 全特徴数
    """
    bg = _gradient_background()
    img = Image.fromarray(bg)
    draw = ImageDraw.Draw(img, "RGBA")

    _draw_stars(draw, seed=month * 100 + day)
    _draw_circle_deco(draw)

    # --- ロゴ / サイト名（上部）---
    font_logo = _load_font(28)
    draw.text((W // 2, 120), "FATE LAB", font=font_logo,
              fill=(*COLOR_ACCENT, 180), anchor="mm")
    draw.line([(W // 2 - 120, 148), (W // 2 + 120, 148)],
              fill=(*COLOR_ACCENT, 60), width=1)

    # --- 月日バッジ ---
    badge_y = 220
    font_date_num = _load_font(96)
    font_date_label = _load_font(32)
    draw.text((W // 2, badge_y), f"{month}/{day}", font=font_date_num,
              fill=COLOR_WHITE, anchor="mm")
    draw.text((W // 2, badge_y + 80), "生まれのあなたへ", font=font_date_label,
              fill=(*COLOR_GRAY, 200), anchor="mm")

    # --- 区切り線 ---
    line_y = badge_y + 130
    draw.line([(W // 2 - 200, line_y), (W // 2 + 200, line_y)],
              fill=(*COLOR_ACCENT, 80), width=1)

    # --- 特徴ラベル ---
    font_label = _load_font(26)
    draw.text((W // 2, line_y + 50),
              f"宿命的特徴 {index} / {total}",
              font=font_label, fill=(*COLOR_ACCENT, 160), anchor="mm")

    # --- 特徴テキスト（メイン・縦中央に配置）---
    font_feature = _load_font(72)
    lines = _wrap_text(feature, font_feature, W - 120)
    # 占術タグの上限位置
    tag_top = H - 360
    # テキスト描画可能な縦範囲の中央
    text_area_top = line_y + 100
    text_area_bottom = tag_top - 40
    text_center_y = (text_area_top + text_area_bottom) // 2
    total_text_h = len(lines) * 88
    text_y = text_center_y - total_text_h // 2
    for line in lines:
        draw.text((W // 2, text_y), line, font=font_feature,
                  fill=COLOR_WHITE, anchor="mm")
        text_y += 88

    # --- 占術タグ（下部装飾）---
    tags = ["四柱推命", "算命学", "宿曜", "数秘術", "九星気学"]
    tag_font = _load_font(22)
    tag_x = 80
    tag_y = H - 340
    tag_colors = [
        (248, 113, 113), (96, 165, 250), (167, 139, 250),
        (148, 163, 184), (74, 222, 128)
    ]
    for i, (tag, color) in enumerate(zip(tags, tag_colors)):
        bbox = tag_font.getbbox(tag)
        tw = bbox[2] - bbox[0] + 20
        draw.rounded_rectangle(
            [tag_x, tag_y, tag_x + tw, tag_y + 36],
            radius=8,
            fill=(*color, 20),
            outline=(*color, 80),
        )
        draw.text((tag_x + 10, tag_y + 7), tag, font=tag_font, fill=(*color, 200))
        tag_x += tw + 12
        if tag_x > W - 200:
            tag_x = 80
            tag_y += 46

    # --- CTA（最下部）---
    font_cta = _load_font(30)
    draw.text((W // 2, H - 180),
              "詳しい鑑定書を無料で見る",
              font=font_cta, fill=(*COLOR_ACCENT, 200), anchor="mm")
    font_url = _load_font(24)
    draw.text((W // 2, H - 130),
              "fate-lab.com",
              font=font_url, fill=(*COLOR_GRAY, 160), anchor="mm")

    return np.array(img)


def make_outro_frame(month: int, day: int) -> np.ndarray:
    """アウトロフレーム（サイト誘導）"""
    bg = _gradient_background()
    img = Image.fromarray(bg)
    draw = ImageDraw.Draw(img, "RGBA")
    _draw_stars(draw, seed=999)

    font_large = _load_font(56)
    font_medium = _load_font(36)
    font_small = _load_font(28)

    draw.text((W // 2, H // 2 - 120),
              "あなたの宿命を",
              font=font_large, fill=COLOR_WHITE, anchor="mm")
    draw.text((W // 2, H // 2 - 40),
              "もっと詳しく知りたいですか？",
              font=font_medium, fill=(*COLOR_GRAY, 220), anchor="mm")

    # ボタン風装飾
    btn_y = H // 2 + 80
    draw.rounded_rectangle(
        [W // 2 - 280, btn_y, W // 2 + 280, btn_y + 80],
        radius=40,
        fill=(*COLOR_ACCENT, 220),
    )
    draw.text((W // 2, btn_y + 40),
              "無料で鑑定書を生成する",
              font=font_medium, fill=(20, 15, 30), anchor="mm")

    draw.text((W // 2, btn_y + 120),
              "fate-lab.com",
              font=font_small, fill=(*COLOR_ACCENT, 180), anchor="mm")
    draw.text((W // 2, btn_y + 160),
              "登録不要・生年月日だけ",
              font=font_small, fill=(*COLOR_DIM, 200), anchor="mm")

    return np.array(img)


def create_video(
    month: int,
    day: int,
    features: list[str],
    audio_path: str,
    output_path: str,
    bgm_path: Optional[str] = None,
) -> str:
    """
    TikTok縦型動画を生成する

    Args:
        month/day: 生年月日
        features: 特徴テキスト3つのリスト
        audio_path: ナレーション音声ファイルパス(.wav)
        output_path: 出力動画パス(.mp4)
        bgm_path: BGMファイルパス（任意）

    Returns:
        出力ファイルパス
    """
    audio = AudioFileClip(audio_path)
    total_duration = audio.duration

    # 各セクションの時間配分
    feature_duration = (total_duration * 0.75) / len(features)
    outro_duration = total_duration * 0.25

    clips = []

    # 特徴カード（3枚）
    for i, feature in enumerate(features):
        frame = make_title_frame(month, day, feature, i + 1, len(features))
        clip = ImageClip(frame, duration=feature_duration)
        clips.append(clip)

    # アウトロ
    outro_frame = make_outro_frame(month, day)
    outro_clip = ImageClip(outro_frame, duration=outro_duration)
    clips.append(outro_clip)

    # 結合
    video = concatenate_videoclips(clips, method="compose")
    video = video.with_audio(audio)

    # BGMがある場合はミックス
    if bgm_path and Path(bgm_path).exists():
        from moviepy import AudioFileClip as AFC
        bgm = AFC(bgm_path).with_effects(
            [lambda c: c.audio_loop(duration=total_duration)]
        ).multiply_volume(0.12)
        from moviepy import CompositeAudioClip
        mixed = CompositeAudioClip([audio, bgm])
        video = video.with_audio(mixed)

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    video.write_videofile(
        output_path,
        fps=30,
        codec="libx264",
        audio_codec="aac",
        temp_audiofile="output/_temp_audio.m4a",
        remove_temp=True,
        logger=None,
    )

    return output_path


if __name__ == "__main__":
    # テスト用（音声なしでフレーム確認）
    month, day = 4, 19
    features = ["静かな強さを持つ", "直感が異常に鋭い", "転機が40代に来る"]

    print("テストフレーム生成中...")
    frame = make_title_frame(month, day, features[0], 1)
    img = Image.fromarray(frame)
    out = f"output/test_frame_{month}_{day}.png"
    Path("output").mkdir(exist_ok=True)
    img.save(out)
    print(f"フレーム保存: {out}")

    outro = make_outro_frame(month, day)
    outro_img = Image.fromarray(outro)
    outro_out = f"output/test_outro_{month}_{day}.png"
    outro_img.save(outro_out)
    print(f"アウトロフレーム保存: {outro_out}")
