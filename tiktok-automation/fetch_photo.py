"""
芸能人写真取得モジュール
Wikipedia REST API から写真を自動ダウンロードする
"""

import os
import requests
from pathlib import Path


def fetch_wikipedia_photo(wikipedia_name: str, save_path: str) -> bool:
    """
    Wikipedia から人物の写真をダウンロードする

    Args:
        wikipedia_name: Wikipedia の記事名（日本語）
        save_path: 保存先パス

    Returns:
        成功したら True
    """
    try:
        encoded = requests.utils.quote(wikipedia_name)
        url = f"https://ja.wikipedia.org/api/rest_v1/page/summary/{encoded}"
        res = requests.get(url, timeout=10,
                           headers={"User-Agent": "FateLab-TikTok/1.0"})

        if res.status_code != 200:
            return False

        data = res.json()
        if "thumbnail" not in data:
            return False

        img_url = data["thumbnail"]["source"]
        # 高解像度版に差し替え（300px → 400px）
        img_url = img_url.replace("/300px-", "/400px-")

        img_res = requests.get(img_url, timeout=15,
                               headers={"User-Agent": "FateLab-TikTok/1.0"})
        if img_res.status_code != 200:
            return False

        Path(save_path).parent.mkdir(parents=True, exist_ok=True)
        with open(save_path, "wb") as f:
            f.write(img_res.content)
        return True

    except Exception as e:
        print(f"  写真取得エラー ({wikipedia_name}): {e}")
        return False


def get_or_create_photo(celebrity: dict, photos_dir: str = "assets/photos") -> str:
    """
    写真を取得。既存ファイルがあればそれを使い、なければWikipediaから取得。
    取得できない場合はプレースホルダーパスを返す（動画側でテキスト表示にフォールバック）

    Returns:
        写真ファイルパス（存在しない場合は空文字）
    """
    name = celebrity["name"]
    save_path = f"{photos_dir}/{name}.jpg"

    if Path(save_path).exists():
        return save_path

    print(f"  写真取得中: {name}")
    success = fetch_wikipedia_photo(celebrity.get("wikipedia_name", name), save_path)

    if success:
        print(f"  写真取得完了: {save_path}")
        return save_path
    else:
        print(f"  写真取得失敗 → テキストプレースホルダーを使用")
        return ""


if __name__ == "__main__":
    test_celebrities = [
        {"name": "大谷翔平", "wikipedia_name": "大谷翔平"},
        {"name": "羽生結弦", "wikipedia_name": "羽生結弦"},
        {"name": "新垣結衣", "wikipedia_name": "新垣結衣"},
    ]
    for c in test_celebrities:
        path = get_or_create_photo(c)
        print(f"  → {path or '取得失敗'}")
