"""
芸能人用スクリプト生成モジュール
Claude API で「芸能人の宿命解析 + 的中ポイント」ナレーションを生成する
"""

import os
import csv
import json
import random
from pathlib import Path
import anthropic
from dotenv import load_dotenv

load_dotenv()

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

NARRATION_SYSTEM = """あなたは占い・宿命解析のTikTokナレーターです。
芸能人の生年月日を6占術で解析した結果と、それが実際に的中した部分を紹介する
30〜40秒のナレーション台本を作成します。

ルール：
- 話し言葉で書く（です・ます調）
- 最初の一文でフック（「え、これ当たりすぎじゃないですか？」など）
- 鑑定結果を2〜3文で紹介
- 的中ポイントを「実際に◯◯しているんですよね」と具体的に指摘
- 「的中！」の直前でテンポを落として溜めを作る
- 最後に「あなたの鑑定書も fate-lab.com で無料で見られます」で締める
- 文字数：200〜260文字
- 台本テキストのみを返す（JSON等の余計な形式不要）"""

TEKICHU_SYSTEM = """あなたは占い鑑定の分析アシスタントです。
芸能人の生年月日と known_facts をもとに、
「宿命解析で出た特徴」と「実際の人生で的中している点」を抽出します。

必ず以下のJSON形式のみで返答してください（他のテキストは不要）：
{
  "fortune_trait": "（宿命解析で出る特徴、15文字以内）",
  "real_match": "（実際の人生での的中事実、30文字以内）",
  "tekichu_label": "（動画で大きく表示する的中テキスト、20文字以内）"
}"""


def load_celebrities(csv_path: str = "celebrities.csv") -> list[dict]:
    """芸能人DBをロード"""
    celebrities = []
    with open(csv_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            row["known_facts"] = row["known_facts"].split("|")
            celebrities.append(row)
    return celebrities


def pick_celebrity(csv_path: str = "celebrities.csv", name: str = None) -> dict:
    """芸能人を1人選ぶ（name指定がなければランダム）"""
    celebrities = load_celebrities(csv_path)
    if name:
        for c in celebrities:
            if c["name"] == name:
                return c
        raise ValueError(f"'{name}' が celebrities.csv に見つかりません")
    return random.choice(celebrities)


def generate_tekichu_point(celebrity: dict) -> dict:
    """的中ポイントを生成（JSON形式で返す）"""
    facts_text = "\n".join(f"- {f}" for f in celebrity["known_facts"])
    prompt = f"""
芸能人情報：
名前：{celebrity['name']}
生年月日：{celebrity['birth_year']}年{celebrity['birth_month']}月{celebrity['birth_day']}日
実際の人生の特徴：
{facts_text}

この人の生年月日から宿命解析で出る特徴と、実際の人生での的中点を抽出してください。"""

    res = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=256,
        system=TEKICHU_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )

    text = res.content[0].text.strip()
    # JSON部分だけ抽出
    start = text.find("{")
    end = text.rfind("}") + 1
    return json.loads(text[start:end])


def generate_narration(celebrity: dict, tekichu: dict) -> str:
    """ナレーション台本を生成"""
    facts_text = "\n".join(f"- {f}" for f in celebrity["known_facts"][:3])
    prompt = f"""
芸能人：{celebrity['name']}（{celebrity['birth_year']}年{celebrity['birth_month']}月{celebrity['birth_day']}日生まれ）

宿命解析の特徴：{tekichu['fortune_trait']}
実際の的中事実：{tekichu['real_match']}

的中ラベル：「{tekichu['tekichu_label']}」

この情報をもとに、TikTok動画のナレーション台本を作成してください。"""

    res = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system=NARRATION_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )
    return res.content[0].text.strip()


def generate_caption(celebrity: dict, tekichu: dict) -> str:
    """TikTokキャプションとハッシュタグを生成"""
    prompt = f"""{celebrity['name']}さんの宿命解析動画のTikTokキャプションを作成してください。
的中ポイント：{tekichu['tekichu_label']}

フォーマット：
- キャプション本文2〜3文（絵文字あり）
- ハッシュタグ10〜15個
- テキストのみ返す"""

    res = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=256,
        messages=[{"role": "user", "content": prompt}],
    )
    return res.content[0].text.strip()


def generate_all(celebrity: dict) -> dict:
    """1人分の全コンテンツを生成してまとめて返す"""
    print(f"  的中ポイント生成中...")
    tekichu = generate_tekichu_point(celebrity)

    print(f"  ナレーション生成中...")
    narration = generate_narration(celebrity, tekichu)

    print(f"  キャプション生成中...")
    caption = generate_caption(celebrity, tekichu)

    return {
        "celebrity": celebrity,
        "tekichu": tekichu,
        "narration": narration,
        "caption": caption,
    }


if __name__ == "__main__":
    celeb = pick_celebrity()
    print(f"=== {celeb['name']} ({celeb['birth_year']}/{celeb['birth_month']}/{celeb['birth_day']}) ===\n")

    result = generate_all(celeb)

    print("【的中ポイント】")
    print(f"  宿命特徴: {result['tekichu']['fortune_trait']}")
    print(f"  的中事実: {result['tekichu']['real_match']}")
    print(f"  的中ラベル: {result['tekichu']['tekichu_label']}")
    print()
    print("【ナレーション】")
    print(result["narration"])
    print()
    print("【キャプション】")
    print(result["caption"])
