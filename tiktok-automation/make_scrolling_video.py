"""
スクロール動画生成モジュール
fate-lab.com の結果ページのスクリーンショットを使い
スマホ画面をスクロールしながら的中！エフェクトを重ねる TikTok 動画を作る

動画の流れ：
  [1.5s] イントロカード    ← 芸能人名 + "の宿命を解析した結果..."
  [1.0s] サイトトップ表示  ← fate-lab.com がスマホで開く演出
  [scroll] 結果ページをスクロール ← ナレーション流しながら
           → 的中ポイントでスロー + ズーム + 的中SE + 深掘りテキスト
  [2.0s] CTA              ← "あなたも試してみて → fate-lab.com"
"""

import math
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
from moviepy import (
    AudioFileClip,
    ImageClip,
    CompositeVideoClip,
    concatenate_videoclips,
    CompositeAudioClip,
)

# TikTok縦型
W, H = 1080, 1920

# スマホフレームのサイズ（画面内に収めるサイズ）
PHONE_W = 840      # 動画内に表示するスマホ画面幅
PHONE_H = 1680     # 動画内に表示するスマホ画面高さ
PHONE_X = (W - PHONE_W) // 2   # 左端X座標
PHONE_Y = 120                    # 上端Y座標

# カラー
COLOR_BG      = (8, 5, 16)
COLOR_ACCENT  = (201, 168, 76)
COLOR_WHITE   = (255, 255, 255)
COLOR_GOLD    = (255, 210, 80)
COLOR_RED_BG  = (180, 20, 20)
COLOR_DARK    = (15, 10, 30)


def _load_font(size: int) -> ImageFont.FreeTypeFont:
    candidates = [
        "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc",
        "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc",
        str(Path(__file__).parent / "assets/fonts/NotoSansJP-Bold.ttf"),
    ]
    for p in candidates:
        if Path(p).exists():
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def _ease_in_out(t: float) -> float:
    """0→1 のイーズイン・アウト補間"""
    return t * t * (3 - 2 * t)


def _make_dark_bg() -> Image.Image:
    img = Image.new("RGB", (W, H), COLOR_BG)
    return img


def _draw_phone_frame(draw: ImageDraw.Draw, x: int, y: int, w: int, h: int):
    """スマホフレームの枠線を描く"""
    r = 36
    draw.rounded_rectangle(
        [x - 4, y - 4, x + w + 4, y + h + 4],
        radius=r + 4,
        fill=(30, 25, 45),
        outline=(60, 50, 80),
        width=2,
    )
    # ノッチ（上部中央の切り欠き）
    notch_w, notch_h = 100, 20
    draw.rounded_rectangle(
        [x + w // 2 - notch_w // 2, y - 10,
         x + w // 2 + notch_w // 2, y + notch_h],
        radius=10,
        fill=(30, 25, 45),
    )


def _paste_site_frame(
    canvas: Image.Image,
    site_img: Image.Image,
    scroll_y: int,
    zoom: float = 1.0,
    zoom_center_y: Optional[int] = None,
) -> Image.Image:
    """
    サイトのスクリーンショットをスマホ画面エリアに貼り付ける

    Args:
        canvas: ベース画像
        site_img: サイトのフルスクリーンショット（PHONE_W幅にスケール済み）
        scroll_y: スクロール量（サイト画像内のピクセル）
        zoom: ズーム倍率（1.0=通常, 1.5=ズームイン）
        zoom_center_y: ズームの中心Y（サイト画像内のピクセル）
    """
    canvas = canvas.copy()

    if zoom > 1.0 and zoom_center_y is not None:
        # ズーム：中心を基準に拡大してクロップ
        crop_h = int(PHONE_H / zoom)
        crop_w = int(PHONE_W / zoom)
        cy = zoom_center_y - scroll_y
        cy = max(crop_h // 2, min(site_img.height - crop_h // 2, cy + scroll_y))

        crop_top  = max(0, cy - crop_h // 2)
        crop_left = max(0, (PHONE_W - crop_w) // 2)
        crop_box  = (crop_left, crop_top,
                     min(PHONE_W, crop_left + crop_w),
                     min(site_img.height, crop_top + crop_h))
        cropped = site_img.crop(crop_box).resize((PHONE_W, PHONE_H), Image.LANCZOS)
    else:
        # 通常スクロール
        crop_top = scroll_y
        crop_box = (0, crop_top, PHONE_W, min(site_img.height, crop_top + PHONE_H))
        cropped = site_img.crop(crop_box)
        # 高さが足りない場合は下端を埋める
        if cropped.height < PHONE_H:
            padded = Image.new("RGB", (PHONE_W, PHONE_H), (12, 8, 18))
            padded.paste(cropped, (0, 0))
            cropped = padded
        else:
            cropped = cropped.resize((PHONE_W, PHONE_H), Image.LANCZOS)

    # スマホ画面エリアに貼り付け（角丸クリップ）
    screen_mask = Image.new("L", (PHONE_W, PHONE_H), 0)
    mask_draw = ImageDraw.Draw(screen_mask)
    mask_draw.rounded_rectangle([0, 0, PHONE_W, PHONE_H], radius=32, fill=255)
    canvas.paste(cropped, (PHONE_X, PHONE_Y), screen_mask)

    # スマホフレーム描画
    draw = ImageDraw.Draw(canvas, "RGBA")
    _draw_phone_frame(draw, PHONE_X, PHONE_Y, PHONE_W, PHONE_H)

    return canvas


def _overlay_tekichu(
    canvas: Image.Image,
    label: str,
    real_match: str,
    intensity: float,
) -> Image.Image:
    """的中！オーバーレイを描く（intensity 0.0〜1.0）"""
    canvas = canvas.copy()
    draw = ImageDraw.Draw(canvas, "RGBA")

    # 半透明の赤バーを画面下部に重ねる
    bar_h = 280
    bar_alpha = int(220 * min(intensity * 2, 1.0))
    draw.rectangle([0, H - bar_h, W, H], fill=(*COLOR_RED_BG, bar_alpha))

    # 的中！テキスト
    font_size = int(110 * (0.7 + 0.3 * min(intensity * 2, 1.0)))
    font_big = _load_font(font_size)
    text_alpha = int(255 * min(intensity * 3, 1.0))

    # グロー
    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.text((W // 2, H - bar_h + 80), "的中！", font=font_big,
            fill=(*COLOR_GOLD, 100), anchor="mm")
    glow = glow.filter(ImageFilter.GaussianBlur(10))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), glow).convert("RGB")
    draw = ImageDraw.Draw(canvas, "RGBA")

    draw.text((W // 2, H - bar_h + 80), "的中！", font=font_big,
              fill=(*COLOR_GOLD, text_alpha), anchor="mm")

    # ラベル（的中ポイントの説明）
    font_label = _load_font(38)
    label_alpha = int(255 * max(0, (intensity - 0.3) * 2))
    draw.text((W // 2, H - bar_h + 170), label, font=font_label,
              fill=(*COLOR_WHITE, label_alpha), anchor="mm")

    # 実際の的中事実
    font_fact = _load_font(30)
    fact_alpha = int(255 * max(0, (intensity - 0.5) * 2))
    draw.text((W // 2, H - bar_h + 230), f"→ {real_match}", font=font_fact,
              fill=(*COLOR_GOLD, fact_alpha), anchor="mm")

    return canvas


def _make_intro_frame(celebrity: dict, photo_path: str = "") -> np.ndarray:
    """イントロカード"""
    from generate_celebrity_video import _make_intro_frame as orig
    return orig(celebrity, photo_path)


def _make_cta_frame(celebrity: dict) -> np.ndarray:
    """CTAフレーム"""
    from generate_celebrity_video import _make_cta_frame as orig
    return orig(celebrity)


def _make_site_opening_frame(canvas_base: Image.Image) -> Image.Image:
    """サイトが開く演出フレーム（URLバー付き）"""
    canvas = canvas_base.copy()
    draw = ImageDraw.Draw(canvas, "RGBA")

    # URLバー
    bar_y = PHONE_Y - 50
    draw.rounded_rectangle(
        [PHONE_X + 20, bar_y, PHONE_X + PHONE_W - 20, bar_y + 36],
        radius=18,
        fill=(40, 35, 55, 220),
    )
    font_url = _load_font(22)
    draw.text((PHONE_X + PHONE_W // 2, bar_y + 18), "fate-lab.com",
              font=font_url, fill=(*COLOR_ACCENT, 200), anchor="mm")

    return canvas


def create_scrolling_video(
    celebrity: dict,
    tekichu: dict,
    narration_text: str,
    audio_path: str,
    site_screenshot_path: str,
    output_path: str,
    photo_path: str = "",
    tekichu_se_path: str = "assets/se/tekichu.wav",
    tekichu_y_ratio: float = 0.45,
) -> str:
    """
    スクロール動画を生成する

    Args:
        celebrity: 芸能人情報
        tekichu: 的中ポイント情報
        narration_text: ナレーション文字列
        audio_path: ナレーション音声パス
        site_screenshot_path: サイトのフルスクリーンショット
        output_path: 出力動画パス
        photo_path: 芸能人写真パス
        tekichu_se_path: 的中SEパス
        tekichu_y_ratio: 的中ポイントのページ内位置（0.0〜1.0）
    """
    FPS = 30
    narration_audio = AudioFileClip(audio_path)
    narration_dur = narration_audio.duration

    # サイトのスクリーンショットをスマホ幅にリサイズ
    site_orig = Image.open(site_screenshot_path)
    # device_scale_factor=2 で撮った場合は半分に
    actual_w = site_orig.width
    if actual_w > 500:
        scale = PHONE_W / actual_w
        new_h = int(site_orig.height * scale)
        site_img = site_orig.resize((PHONE_W, new_h), Image.LANCZOS)
    else:
        site_img = site_orig.resize((PHONE_W, int(site_orig.height * PHONE_W / actual_w)), Image.LANCZOS)

    site_h = site_img.height
    tekichu_abs_y = int(site_h * tekichu_y_ratio)

    # ── タイムライン設計 ──────────────────────────────────────
    t_intro   = 1.8    # イントロカード
    t_open    = 0.8    # サイトが開く演出
    t_scroll  = narration_dur * 0.6   # スクロールしながらナレーション
    t_tekichu = narration_dur * 0.25  # 的中ポイントで停止
    t_resume  = narration_dur * 0.15  # 再スクロール〜終わり
    t_cta     = 2.5    # CTA

    total_dur = t_intro + t_open + t_scroll + t_tekichu + t_resume + t_cta

    # 最大スクロール量（的中ポイントを中心に表示するため）
    scroll_target = max(0, tekichu_abs_y - PHONE_H // 2)
    scroll_max = max(0, site_h - PHONE_H)

    # ── フレーム生成 ──────────────────────────────────────────
    all_frames = []

    # 1) イントロカード
    intro_arr = _make_intro_frame(celebrity, photo_path)
    n_intro = int(t_intro * FPS)
    for _ in range(n_intro):
        all_frames.append(intro_arr)

    # 2) サイトが開く演出（フェードイン）
    bg_base = _make_dark_bg()
    n_open = int(t_open * FPS)
    for i in range(n_open):
        t = i / n_open
        canvas = bg_base.copy()
        # URLバー表示
        canvas = _make_site_opening_frame(canvas)
        # サイト画面フェードイン
        frame = _paste_site_frame(canvas, site_img, scroll_y=0)
        alpha_frame = Image.fromarray(intro_arr)
        blended = Image.blend(alpha_frame, frame, min(t * 2, 1.0))
        all_frames.append(np.array(blended))

    # 3) スクロールしながらナレーション（的中ポイントまで）
    n_scroll = int(t_scroll * FPS)
    for i in range(n_scroll):
        t = _ease_in_out(i / n_scroll)
        scroll_y = int(scroll_target * t)
        canvas = bg_base.copy()
        canvas = _make_site_opening_frame(canvas)
        frame = _paste_site_frame(canvas, site_img, scroll_y=scroll_y)
        all_frames.append(np.array(frame))

    # 4) 的中ポイントで停止 + ズームイン + オーバーレイ
    n_tekichu = int(t_tekichu * FPS)
    for i in range(n_tekichu):
        t = i / n_tekichu
        # 0〜0.3: ズームイン
        # 0.3〜0.7: 的中SE + オーバーレイ表示
        # 0.7〜1.0: 保持
        zoom = 1.0 + 0.4 * min(t / 0.3, 1.0)
        overlay_intensity = max(0.0, (t - 0.25) / 0.4)

        canvas = bg_base.copy()
        canvas = _make_site_opening_frame(canvas)
        frame = _paste_site_frame(
            canvas, site_img,
            scroll_y=scroll_target,
            zoom=zoom,
            zoom_center_y=tekichu_abs_y,
        )

        if overlay_intensity > 0:
            frame = _overlay_tekichu(
                frame,
                label=tekichu["tekichu_label"],
                real_match=tekichu["real_match"],
                intensity=overlay_intensity,
            )

        all_frames.append(np.array(frame))

    # 5) 再スクロール（的中後、少し下まで流す）
    n_resume = int(t_resume * FPS)
    scroll_end = min(scroll_max, scroll_target + 400)
    for i in range(n_resume):
        t = _ease_in_out(i / n_resume)
        scroll_y = int(scroll_target + (scroll_end - scroll_target) * t)
        canvas = bg_base.copy()
        canvas = _make_site_opening_frame(canvas)
        frame = _paste_site_frame(canvas, site_img, scroll_y=scroll_y)
        # 的中オーバーレイをフェードアウト
        fade = max(0.0, 1.0 - t * 3)
        if fade > 0:
            frame = _overlay_tekichu(frame, tekichu["tekichu_label"],
                                     tekichu["real_match"], fade * 0.6)
        all_frames.append(np.array(frame))

    # 6) CTA
    cta_arr = _make_cta_frame(celebrity)
    n_cta = int(t_cta * FPS)
    for i in range(n_cta):
        t = i / n_cta
        # CTAへのクロスフェード
        if t < 0.3:
            resume_frame = all_frames[-1]
            blended = Image.blend(
                Image.fromarray(resume_frame),
                Image.fromarray(cta_arr),
                t / 0.3
            )
            all_frames.append(np.array(blended))
        else:
            all_frames.append(cta_arr)

    # ── MoviePy で動画合成 ────────────────────────────────────
    print(f"  フレーム数: {len(all_frames)} ({len(all_frames)/FPS:.1f}秒)")

    clips = []
    # フレームを1枚1枚ImageClipにするのは重いので、
    # セクションごとにまとめてVideoClip化する
    video_arr = np.array(all_frames)

    from moviepy import VideoClip

    def make_frame(t):
        idx = min(int(t * FPS), len(all_frames) - 1)
        return all_frames[idx]

    video = VideoClip(make_frame, duration=len(all_frames) / FPS)

    # 音声：イントロ＋オープニング後にナレーション開始
    narration_offset = t_intro + t_open
    narration_with_start = narration_audio.with_start(narration_offset)
    audio_clips = [narration_with_start]

    # 的中SE：スクロールセクション終わりに
    tekichu_se_start = narration_offset + t_scroll + 0.1
    if Path(tekichu_se_path).exists():
        se = AudioFileClip(tekichu_se_path).with_start(tekichu_se_start)
        audio_clips.append(se)

    mixed = CompositeAudioClip(audio_clips)
    video = video.with_audio(mixed)

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    video.write_videofile(
        output_path,
        fps=FPS,
        codec="libx264",
        audio_codec="aac",
        temp_audiofile="output/_temp_audio.m4a",
        remove_temp=True,
        logger=None,
    )
    return output_path


if __name__ == "__main__":
    # フレーム確認テスト
    import sys
    from pathlib import Path

    test_celeb = {
        "name": "大谷翔平",
        "birth_year": "1994",
        "birth_month": "7",
        "birth_day": "5",
    }
    test_tekichu = {
        "tekichu_label": "二刀流の宿命が的中",
        "real_match": "投打二刀流で世界最高選手に",
    }

    # サイトスクリーンショットが必要
    screenshot = "output/captures/大谷翔平_result.png"
    if not Path(screenshot).exists():
        print(f"スクリーンショットがありません: {screenshot}")
        print("先に capture_website.py を実行してください")
        sys.exit(1)

    site = Image.open(screenshot)
    scale = PHONE_W / site.width if site.width > 500 else PHONE_W / site.width
    site_resized = site.resize((PHONE_W, int(site.height * scale)), Image.LANCZOS)

    # テスト：的中フレームを保存
    from PIL import Image as PILImage
    bg = _make_dark_bg()
    bg = _make_site_opening_frame(bg)
    frame = _paste_site_frame(bg, site_resized, scroll_y=int(site_resized.height * 0.3),
                               zoom=1.3, zoom_center_y=int(site_resized.height * 0.45))
    frame = _overlay_tekichu(frame, test_tekichu["tekichu_label"],
                              test_tekichu["real_match"], intensity=0.8)
    Path("output").mkdir(exist_ok=True)
    PILImage.fromarray(np.array(frame)).save("output/scroll_tekichu_test.png")
    print("テストフレーム保存: output/scroll_tekichu_test.png")
