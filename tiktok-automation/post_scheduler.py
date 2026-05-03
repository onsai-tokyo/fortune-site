"""
投稿スケジューラーモジュール
Buffer API を使って TikTok・Instagram Reels への予約投稿を行う

事前準備：
  1. https://buffer.com でアカウント作成（無料プランあり）
  2. https://buffer.com/developers/api でアクセストークン取得
  3. .env に BUFFER_ACCESS_TOKEN と BUFFER_CHANNEL_IDS を設定
"""

import os
import json
from pathlib import Path
from datetime import datetime, timedelta
import requests
from dotenv import load_dotenv

load_dotenv()

BUFFER_API_BASE = "https://api.bufferapp.com/1"
ACCESS_TOKEN = os.getenv("BUFFER_ACCESS_TOKEN", "")

# Buffer のチャンネルID（カンマ区切りで複数指定可）
# 例: "tiktok_channel_id,instagram_channel_id"
CHANNEL_IDS_RAW = os.getenv("BUFFER_CHANNEL_IDS", "")
CHANNEL_IDS = [c.strip() for c in CHANNEL_IDS_RAW.split(",") if c.strip()]


class BufferScheduler:
    def __init__(self, access_token: str = ACCESS_TOKEN):
        if not access_token:
            raise ValueError(
                "BUFFER_ACCESS_TOKEN が未設定です。\n"
                ".env に BUFFER_ACCESS_TOKEN=your_token を追加してください。\n"
                "取得先: https://buffer.com/developers/api"
            )
        self.token = access_token

    def get_profiles(self) -> list[dict]:
        """接続済みの SNS プロフィール一覧を取得"""
        res = requests.get(
            f"{BUFFER_API_BASE}/profiles.json",
            params={"access_token": self.token},
            timeout=10,
        )
        res.raise_for_status()
        return res.json()

    def upload_media(self, file_path: str) -> str:
        """
        動画ファイルをアップロードして media_id を取得する
        ※ Buffer の Media Upload API を利用
        """
        with open(file_path, "rb") as f:
            res = requests.post(
                f"{BUFFER_API_BASE}/media/upload.json",
                params={"access_token": self.token},
                files={"file": (Path(file_path).name, f, "video/mp4")},
                timeout=120,
            )
        res.raise_for_status()
        data = res.json()
        return data.get("media_id") or data.get("id")

    def schedule_post(
        self,
        video_path: str,
        caption: str,
        channel_ids: list[str],
        scheduled_at=None,
    ) -> dict:
        """
        動画投稿をスケジュール登録する

        Args:
            video_path: 動画ファイルパス
            caption: キャプション（ハッシュタグ含む）
            channel_ids: 投稿先チャンネルIDリスト
            scheduled_at: 投稿予定時刻（Noneなら翌日18:00）

        Returns:
            APIレスポンス
        """
        if not channel_ids:
            raise ValueError(
                "投稿先チャンネルIDが未設定です。\n"
                ".env に BUFFER_CHANNEL_IDS=your_channel_id を設定してください。\n"
                "チャンネルIDは get_profiles() で確認できます。"
            )

        # デフォルト投稿時間：翌日 18:00（TikTokのゴールデンタイム）
        if scheduled_at is None:
            tomorrow = datetime.now().replace(hour=18, minute=0, second=0, microsecond=0)
            if tomorrow < datetime.now():
                tomorrow += timedelta(days=1)
            scheduled_at = tomorrow

        # 動画アップロード
        print(f"動画アップロード中: {video_path}")
        media_id = self.upload_media(video_path)
        print(f"アップロード完了 (media_id: {media_id})")

        # 各チャンネルに投稿
        results = []
        for channel_id in channel_ids:
            payload = {
                "access_token": self.token,
                "profile_ids[]": channel_id,
                "text": caption,
                "media[video]": media_id,
                "scheduled_at": scheduled_at.isoformat(),
                "now": "false",
            }
            res = requests.post(
                f"{BUFFER_API_BASE}/updates/create.json",
                data=payload,
                timeout=30,
            )
            res.raise_for_status()
            result = res.json()
            results.append(result)
            print(f"スケジュール登録完了 (channel: {channel_id})")

        return results

    def get_pending_posts(self, channel_id: str) -> list[dict]:
        """予約済みの投稿一覧を取得"""
        res = requests.get(
            f"{BUFFER_API_BASE}/profiles/{channel_id}/updates/pending.json",
            params={"access_token": self.token},
            timeout=10,
        )
        res.raise_for_status()
        return res.json().get("updates", [])


def save_post_log(
    month: int,
    day: int,
    video_path: str,
    caption: str,
    scheduled_at: str,
    log_path: str = "logs/post_log.jsonl",
) -> None:
    """投稿ログをJSONLファイルに記録"""
    Path(log_path).parent.mkdir(parents=True, exist_ok=True)
    entry = {
        "date": datetime.now().isoformat(),
        "birth_date": f"{month}/{day}",
        "video_path": video_path,
        "caption_preview": caption[:80],
        "scheduled_at": scheduled_at,
    }
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    # 設定確認
    if not ACCESS_TOKEN:
        print("BUFFER_ACCESS_TOKEN が未設定です。")
        print(".env に BUFFER_ACCESS_TOKEN=your_token を設定してください。")
        exit(1)

    scheduler = BufferScheduler()
    profiles = scheduler.get_profiles()
    print("接続済みチャンネル:")
    for p in profiles:
        print(f"  - {p.get('service')} / {p.get('formatted_username')} (id: {p.get('id')})")
