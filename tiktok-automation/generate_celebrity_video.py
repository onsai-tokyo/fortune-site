"""
芸能人宿命解析 TikTok動画生成モジュール
構成：イントロ → 鑑定読み上げ → 的中！エフェクト → CTA
"""

import math
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from moviepy import (
    AudioFileClip,
    ImageClip,
    CompositeVideoClip,
    concatenate_videoclips,
    CompositeAudioClip,
)

W, H = 1080, 1920

# カラーパレット
COLOR_BG_TOP    = (10, 6, 20)
COLOR_BG_BOTTOM = (20, 12, 40)
COLOR_ACCENT    = (201, 168, 76)
COLOR_RED       = (220, 60, 60)
COLOR_WHITE     = (255, 255, 255)
COLOR_GRAY      = (180, 180, 200)
COLOR_DIM       = (100, 100, 130)
COLOR_GOLD_GLOW = (255, 210, 80)


def _load_font(size: int) -> ImageFont.FreeTypeFont:
    candidates = [
        "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc",
        "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc",
        "/Library/Fonts/Arial Unicode.ttf",
        str(Path(__file__).parent / "assets/fonts/NotoSansJP-Bold.ttf"),
    ]
    for p in candidates:
        if Path(p).exists():
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def _gradient_bg(alpha_top=(10,6,20), alpha_bottom=(20,12,40)) -> np.ndarray:
    img = Image.new("RGB", (W, H))
    draw = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        r = int(alpha_top[0] + (alpha_bottom[0]-alpha_top[0])*t)
        g = int(alpha_top[1] + (alpha_bottom[1]-alpha_top[1])*t)
        b = int(alpha_top[2] + (alpha_bottom[2]-alpha_top[2])*t)
        draw.line([(0,y),(W,y)], fill=(r,g,b))
    return np.array(img)


def _draw_stars(draw: ImageDraw.Draw, seed: int = 0):
    rng = np.random.default_rng(seed)
    for _ in range(100):
        x = int(rng.integers(0, W))
        y = int(rng.integers(0, H*2//3))
        r = int(rng.integers(1, 3))
        a = int(rng.integers(50, 160))
        draw.ellipse([x-r, y-r, x+r, y+r], fill=(a, a, a+20))


def _wrap_text(text: str, font, max_w: int) -> list:
    lines, cur = [], ""
    for ch in text:
        test = cur + ch
        if font.getbbox(test)[2] > max_w and cur:
            lines.append(cur)
            cur = ch
        else:
            cur = test
    if cur:
        lines.append(cur)
    return lines


def _circle_crop(img: Image.Image, size: int) -> Image.Image:
    """画像を円形にクロップ"""
    img = img.convert("RGBA").resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse([0, 0, size, size], fill=255)
    result = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    result.paste(img, mask=mask)
    return result


def _make_intro_frame(celebrity: dict, photo_path: str) -> np.ndarray:
    """シーン1：芸能人イントロフレーム"""
    bg_arr = _gradient_bg()
    img = Image.fromarray(bg_arr)
    draw = ImageDraw.Draw(img, "RGBA")
    _draw_stars(draw, seed=42)

    # ロゴ
    font_logo = _load_font(26)
    draw.text((W//2, 100), "FATE LAB × 宿命解析", font=font_logo,
              fill=(*COLOR_ACCENT, 160), anchor="mm")
    draw.line([(W//2-140, 124),(W//2+140, 124)], fill=(*COLOR_ACCENT, 40), width=1)

    # 芸能人写真（あれば）
    photo_size = 360
    photo_y = 280

    if photo_path and Path(photo_path).exists():
        try:
            photo = Image.open(photo_path)
            circle = _circle_crop(photo, photo_size)
            # グローリング
            ring_img = Image.new("RGBA", (photo_size+20, photo_size+20), (0,0,0,0))
            ring_draw = ImageDraw.Draw(ring_img)
            ring_draw.ellipse([0,0,photo_size+20,photo_size+20],
                              outline=(*COLOR_ACCENT, 120), width=3)
            img.paste(ring_img, (W//2-photo_size//2-10, photo_y-10), ring_img)
            img.paste(circle, (W//2-photo_size//2, photo_y), circle)
        except Exception:
            _draw_name_placeholder(draw, celebrity["name"], photo_y, photo_size)
    else:
        _draw_name_placeholder(draw, celebrity["name"], photo_y, photo_size)

    # 名前
    font_name = _load_font(72)
    name_y = photo_y + photo_size + 60
    draw.text((W//2, name_y), celebrity["name"], font=font_name,
              fill=COLOR_WHITE, anchor="mm")

    # 生年月日
    font_date = _load_font(34)
    bdate = f"{celebrity['birth_year']}年{celebrity['birth_month']}月{celebrity['birth_day']}日生まれ"
    draw.text((W//2, name_y+90), bdate, font=font_date,
              fill=(*COLOR_GRAY, 200), anchor="mm")

    # サブタイトル
    font_sub = _load_font(38)
    draw.text((W//2, name_y+160), "の宿命を解析しました", font=font_sub,
              fill=(*COLOR_ACCENT, 220), anchor="mm")

    # 占術タグ
    tags = [("四柱推命","#f87171"),("算命学","#60a5fa"),("宿曜","#a78bfa"),
            ("数秘術","#94a3b8"),("九星気学","#4ade80")]
    tag_font = _load_font(22)
    total_w = sum(tag_font.getbbox(t[0])[2]+24 for t in tags) + 8*(len(tags)-1)
    tx = (W - total_w) // 2
    ty = H - 260
    for tag, hex_c in tags:
        r,g,b = int(hex_c[1:3],16), int(hex_c[3:5],16), int(hex_c[5:7],16)
        bw = tag_font.getbbox(tag)[2] + 24
        draw.rounded_rectangle([tx,ty,tx+bw,ty+36], radius=8,
                                fill=(r,g,b,20), outline=(r,g,b,80))
        draw.text((tx+12, ty+7), tag, font=tag_font, fill=(r,g,b,200))
        tx += bw + 8

    return np.array(img)


def _draw_name_placeholder(draw, name: str, y: int, size: int):
    cx, cy = W//2, y + size//2
    draw.ellipse([cx-size//2, y, cx+size//2, y+size],
                 fill=(*COLOR_ACCENT, 20), outline=(*COLOR_ACCENT, 60), width=2)
    font = _load_font(80)
    draw.text((cx, cy), name[0], font=font, fill=(*COLOR_ACCENT, 200), anchor="mm")


def _make_reading_frame(celebrity: dict, narration_text: str) -> np.ndarray:
    """シーン2：鑑定読み上げフレーム"""
    bg_arr = _gradient_bg()
    img = Image.fromarray(bg_arr)
    draw = ImageDraw.Draw(img, "RGBA")
    _draw_stars(draw, seed=99)

    font_title = _load_font(30)
    draw.text((W//2, 120), f"{celebrity['name']}の宿命解析", font=font_title,
              fill=(*COLOR_ACCENT, 160), anchor="mm")
    draw.line([(W//2-180, 148),(W//2+180, 148)], fill=(*COLOR_ACCENT, 40), width=1)

    # 鑑定書風の枠
    box_top, box_bottom = 200, H-200
    draw.rounded_rectangle([60, box_top, W-60, box_bottom], radius=20,
                            fill=(255,255,255,5), outline=(*COLOR_ACCENT, 30), width=1)

    # ナレーションテキスト（全文表示）
    font_text = _load_font(38)
    lines = _wrap_text(narration_text, font_text, W-180)
    text_y = box_top + 60
    for line in lines:
        draw.text((W//2, text_y), line, font=font_text,
                  fill=(*COLOR_WHITE, 220), anchor="mm")
        text_y += 54
        if text_y > box_bottom - 80:
            break

    # 下部装飾
    font_bottom = _load_font(26)
    draw.text((W//2, H-120), "6占術統合解析", font=font_bottom,
              fill=(*COLOR_ACCENT, 100), anchor="mm")

    return np.array(img)


def _make_tekichu_frames(celebrity: dict, tekichu: dict,
                          n_frames: int = 12) -> list[np.ndarray]:
    """
    シーン3：的中エフェクトフレーム（アニメーション風に複数枚生成）
    pulse 効果を出すために n_frames 枚作る
    """
    frames = []
    label = tekichu["tekichu_label"]
    real_match = tekichu["real_match"]

    for fi in range(n_frames):
        t = fi / (n_frames - 1)  # 0.0 → 1.0

        # 背景（赤みがかったグラデーション）
        bg_arr = _gradient_bg(alpha_top=(20,4,4), alpha_bottom=(35,8,8))
        img = Image.fromarray(bg_arr)
        draw = ImageDraw.Draw(img, "RGBA")
        _draw_stars(draw, seed=77)

        # パルス円（広がるリング）
        pulse_r = int(200 + 300 * t)
        alpha = int(120 * (1.0 - t))
        draw.ellipse([W//2-pulse_r, H//2-pulse_r, W//2+pulse_r, H//2+pulse_r],
                     outline=(*COLOR_GOLD_GLOW, alpha), width=3)
        if t < 0.5:
            pulse_r2 = int(100 + 200 * t * 2)
            alpha2 = int(80 * (1.0 - t * 2))
            draw.ellipse([W//2-pulse_r2, H//2-pulse_r2, W//2+pulse_r2, H//2+pulse_r2],
                         outline=(*COLOR_ACCENT, alpha2), width=2)

        # 的中ラベルテキスト
        font_label = _load_font(44)
        draw.text((W//2, H//2-260), label, font=font_label,
                  fill=(*COLOR_GOLD_GLOW, 200), anchor="mm")

        # 「的中！」大テキスト（スケールアニメ）
        scale = 0.6 + 0.4 * min(t * 3, 1.0)
        font_size = int(160 * scale)
        font_tekichu = _load_font(font_size)

        # グロー効果（後ろにぼかし文字を重ねる）
        glow_img = Image.new("RGBA", (W, H), (0,0,0,0))
        glow_draw = ImageDraw.Draw(glow_img)
        glow_draw.text((W//2, H//2), "的中！", font=font_tekichu,
                       fill=(*COLOR_GOLD_GLOW, 80), anchor="mm")
        glow_img = glow_img.filter(ImageFilter.GaussianBlur(radius=12))
        img.paste(Image.fromarray(np.array(img)), (0,0))
        img = Image.alpha_composite(img.convert("RGBA"), glow_img).convert("RGB")
        draw = ImageDraw.Draw(img, "RGBA")

        # メイン的中テキスト
        draw.text((W//2, H//2), "的中！", font=font_tekichu,
                  fill=COLOR_GOLD_GLOW, anchor="mm")

        # 実際の的中事実
        font_fact = _load_font(36)
        fact_alpha = int(255 * min(t * 4, 1.0))
        lines = _wrap_text(real_match, font_fact, W-160)
        fact_y = H//2 + font_size//2 + 40
        for line in lines:
            draw.text((W//2, fact_y), line, font=font_fact,
                      fill=(*COLOR_WHITE, fact_alpha), anchor="mm")
            fact_y += 50

        frames.append(np.array(img))

    return frames


def _make_cta_frame(celebrity: dict) -> np.ndarray:
    """シーン4：CTA フレーム"""
    bg_arr = _gradient_bg()
    img = Image.fromarray(bg_arr)
    draw = ImageDraw.Draw(img, "RGBA")
    _draw_stars(draw, seed=123)

    font_q = _load_font(52)
    draw.text((W//2, H//2-200), "あなたの宿命も", font=font_q,
              fill=COLOR_WHITE, anchor="mm")
    draw.text((W//2, H//2-130), "解析してみませんか？", font=font_q,
              fill=COLOR_WHITE, anchor="mm")

    font_sub = _load_font(34)
    draw.text((W//2, H//2-40), f"{celebrity['name']}さんと同じ6占術で", font=font_sub,
              fill=(*COLOR_GRAY, 200), anchor="mm")

    # ボタン
    btn_y = H//2+50
    draw.rounded_rectangle([W//2-300, btn_y, W//2+300, btn_y+90],
                            radius=45, fill=(*COLOR_ACCENT, 230))
    font_btn = _load_font(38)
    draw.text((W//2, btn_y+45), "無料で鑑定書を生成する", font=font_btn,
              fill=(15,10,25), anchor="mm")

    font_url = _load_font(30)
    draw.text((W//2, btn_y+130), "fate-lab.com", font=font_url,
              fill=(*COLOR_ACCENT, 200), anchor="mm")
    font_note = _load_font(24)
    draw.text((W//2, btn_y+175), "登録不要 · 生年月日だけ", font=font_note,
              fill=(*COLOR_DIM, 200), anchor="mm")

    return np.array(img)


def create_celebrity_video(
    celebrity: dict,
    tekichu: dict,
    narration_text: str,
    audio_path: str,
    output_path: str,
    photo_path: str = "",
    tekichu_se_path: str = "assets/se/tekichu.wav",
) -> str:
    """
    芸能人宿命解析TikTok動画を生成

    Args:
        celebrity: 芸能人情報dict
        tekichu: 的中ポイントdict
        narration_text: ナレーションテキスト
        audio_path: ナレーション音声パス(.wav)
        output_path: 出力動画パス(.mp4)
        photo_path: 芸能人写真パス
        tekichu_se_path: 的中SEパス

    Returns:
        出力ファイルパス
    """
    narration_audio = AudioFileClip(audio_path)
    narration_duration = narration_audio.duration

    # 時間配分
    intro_dur   = 2.5
    reading_dur = narration_duration
    tekichu_dur = 2.5
    cta_dur     = 3.0

    clips = []

    # シーン1：イントロ
    intro_frame = _make_intro_frame(celebrity, photo_path)
    clips.append(ImageClip(intro_frame, duration=intro_dur))

    # シーン2：鑑定読み上げ
    reading_frame = _make_reading_frame(celebrity, narration_text)
    clips.append(ImageClip(reading_frame, duration=reading_dur))

    # シーン3：的中アニメーション
    tekichu_frames = _make_tekichu_frames(celebrity, tekichu, n_frames=15)
    frame_dur = tekichu_dur / len(tekichu_frames)
    for frame in tekichu_frames:
        clips.append(ImageClip(frame, duration=frame_dur))

    # シーン4：CTA
    cta_frame = _make_cta_frame(celebrity)
    clips.append(ImageClip(cta_frame, duration=cta_dur))

    video = concatenate_videoclips(clips, method="compose")

    # 音声合成：ナレーション（イントロ終わりから）+ 的中SE
    narration_with_start = narration_audio.with_start(intro_dur)
    audio_clips = [narration_with_start]

    tekichu_start = intro_dur + reading_dur
    if Path(tekichu_se_path).exists():
        se = AudioFileClip(tekichu_se_path).with_start(tekichu_start)
        audio_clips.append(se)

    mixed_audio = CompositeAudioClip(audio_clips)
    video = video.with_audio(mixed_audio)

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
    # フレーム確認テスト（音声なし）
    from PIL import Image as PILImage

    test_celeb = {
        "name": "大谷翔平",
        "birth_year": "1994",
        "birth_month": "7",
        "birth_day": "5",
    }
    test_tekichu = {
        "fortune_trait": "二刀流の宿命",
        "real_match": "投打二刀流で世界最高選手に",
        "tekichu_label": "二刀流の宿命、的中",
    }

    Path("output").mkdir(exist_ok=True)

    frame = _make_intro_frame(test_celeb, "")
    PILImage.fromarray(frame).save("output/celebrity_intro_test.png")
    print("イントロフレーム保存: output/celebrity_intro_test.png")

    frame2 = _make_reading_frame(test_celeb, "大谷翔平さんの宿命を6占術で解析しました。四柱推命が示すのは、2つの才能が1つに融合する宿命。これが投打二刀流として世界に証明されました。")
    PILImage.fromarray(frame2).save("output/celebrity_reading_test.png")
    print("鑑定フレーム保存: output/celebrity_reading_test.png")

    frames = _make_tekichu_frames(test_celeb, test_tekichu, n_frames=3)
    for i, f in enumerate(frames):
        PILImage.fromarray(f).save(f"output/celebrity_tekichu_{i}.png")
    print("的中フレーム保存: output/celebrity_tekichu_*.png")

    frame4 = _make_cta_frame(test_celeb)
    PILImage.fromarray(frame4).save("output/celebrity_cta_test.png")
    print("CTAフレーム保存: output/celebrity_cta_test.png")
