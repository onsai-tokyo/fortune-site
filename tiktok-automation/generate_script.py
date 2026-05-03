"""
スクリプト生成モジュール
Claude API を使って TikTok 用のナレーション台本を生成する
"""

import os
from datetime import datetime
import anthropic
from dotenv import load_dotenv

load_dotenv()

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """あなたは占い・命式解析のTikTokコンテンツクリエイターです。
毎日、特定の生年月日に生まれた人の宿命的な特徴を紹介する動画のナレーション台本を作成します。

ルール：
- 30〜40秒で読める文量（日本語で約200〜260文字）
- 最初の1文でフックを作る（「○月○日生まれのあなた、これ知ってましたか？」などの呼びかけ）
- 6占術（四柱推命・算命学・宿曜・納音・数秘術・九星気学）の統計的パターンをベースにした内容
- 具体的な特徴を3つ、テンポよく紹介
- 最後に「fate-lab.com で詳しい鑑定書を無料で見られます」で締める
- 台本のみを返す（説明文・メモは不要）
- 自然な話し言葉で書く"""

CAPTION_SYSTEM_PROMPT = """あなたはTikTokのコンテンツマーケターです。
占い・宿命解析の動画に合った日本語キャプションとハッシュタグを生成します。

ルール：
- キャプション本文は2〜3文（絵文字を適度に使用）
- ハッシュタグは10〜15個
- バイラルしやすいハッシュタグを含める（#占い #四柱推命 #生年月日 など）
- フォーマット：
  キャプション本文

  #ハッシュタグ1 #ハッシュタグ2 ...
- テキストのみを返す"""


def get_today_birth_date() -> tuple[int, int]:
    """今日の月日を返す"""
    today = datetime.now()
    return today.month, today.day


def generate_narration(month: int, day: int) -> str:
    """指定した月日生まれ向けのナレーション台本を生成"""
    prompt = f"""{month}月{day}日生まれの人の宿命的な特徴を紹介する、TikTok動画のナレーション台本を作成してください。
6占術の統計パターンをベースにした、具体的で当たりそうな内容にしてください。"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    return message.content[0].text.strip()


def generate_caption(month: int, day: int, narration: str) -> str:
    """TikTok投稿用のキャプションとハッシュタグを生成"""
    prompt = f"""{month}月{day}日生まれの宿命解析動画のキャプションを作成してください。
動画内容の要約：{narration[:100]}..."""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=256,
        system=CAPTION_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    return message.content[0].text.strip()


def generate_title_text(month: int, day: int) -> list[str]:
    """動画に重ねるテキストカードのリストを生成（3枚分）"""
    prompt = f"""{month}月{day}日生まれの人の宿命的特徴を、動画テキストカード用に3つ生成してください。

フォーマット（3行で返す）：
1行目：特徴1（15文字以内）
2行目：特徴2（15文字以内）
3行目：特徴3（15文字以内）

例：
静かな強さを持つ
直感が異常に鋭い
転機が40代に来る"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=128,
        messages=[
            {"role": "user", "content": prompt}
        ],
    )

    lines = message.content[0].text.strip().split("\n")
    # 番号・記号を除去してテキストのみ抽出
    features = []
    for line in lines:
        text = line.strip()
        if text:
            # "1. " "・" などの接頭辞を削除
            for prefix in ["1.", "2.", "3.", "・", "-", "●", "◆"]:
                if text.startswith(prefix):
                    text = text[len(prefix):].strip()
            if text:
                features.append(text)
        if len(features) == 3:
            break

    # 3つ揃わない場合の補完
    while len(features) < 3:
        features.append(f"{month}/{day}生まれの特徴")

    return features


if __name__ == "__main__":
    month, day = get_today_birth_date()
    print(f"=== {month}月{day}日生まれ ===\n")

    narration = generate_narration(month, day)
    print("【ナレーション】")
    print(narration)
    print()

    caption = generate_caption(month, day, narration)
    print("【キャプション】")
    print(caption)
    print()

    features = generate_title_text(month, day)
    print("【テキストカード】")
    for i, f in enumerate(features, 1):
        print(f"  {i}. {f}")
