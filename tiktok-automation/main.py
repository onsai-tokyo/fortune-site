"""
メインオーケストレーター

使い方：
  # 芸能人モード（おすすめ）
  python main.py --mode celebrity                  # ランダム芸能人で実行
  python main.py --mode celebrity --name 大谷翔平  # 指定芸能人で実行
  python main.py --mode celebrity --skip-post      # 動画生成のみ（投稿しない）

  # 生年月日モード
  python main.py --mode daily
  python main.py --mode daily --month 4 --day 19

  # デーモン（毎日自動実行）
  python main.py --mode celebrity --daemon
"""

import os
import argparse
import logging
from datetime import datetime, timedelta
from pathlib import Path

import schedule
import time
from dotenv import load_dotenv

load_dotenv()

Path("logs").mkdir(exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("logs/automation.log", encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)

RUN_HOUR   = int(os.getenv("RUN_HOUR", "8"))
RUN_MINUTE = int(os.getenv("RUN_MINUTE", "0"))
POST_HOUR  = int(os.getenv("POST_HOUR", "18"))
POST_MINUTE = int(os.getenv("POST_MINUTE", "0"))


# ──────────────────────────────────────────
#  芸能人モード
# ──────────────────────────────────────────
def run_celebrity_pipeline(name: str = None, skip_post: bool = False):
    """芸能人宿命解析 TikTok動画を生成・投稿予約する"""
    from generate_celebrity_script import pick_celebrity, generate_all
    from generate_audio import synthesize_speech, is_voicevox_running
    from generate_celebrity_video import create_celebrity_video
    from fetch_photo import get_or_create_photo
    from post_scheduler import BufferScheduler, save_post_log, CHANNEL_IDS

    # Step 1: 芸能人選択
    celebrity = pick_celebrity(name=name)
    log.info(f"芸能人: {celebrity['name']} ({celebrity['birth_year']}/{celebrity['birth_month']}/{celebrity['birth_day']})")

    # Step 2: スクリプト生成
    log.info("Step 1: スクリプト生成中...")
    result = generate_all(celebrity)
    tekichu  = result["tekichu"]
    narration = result["narration"]
    caption   = result["caption"]
    log.info(f"的中ラベル: {tekichu['tekichu_label']}")
    log.info(f"ナレーション: {narration[:60]}...")

    # Step 3: 音声生成
    log.info("Step 2: 音声生成中（VOICEVOX）...")
    if not is_voicevox_running():
        log.error("VOICEVOXが起動していません。アプリを起動してから再実行してください。")
        log.error("ダウンロード: https://voicevox.hiroshiba.jp/")
        return None

    ts = datetime.now().strftime("%H%M%S")
    audio_path = f"output/audio_{celebrity['name']}_{ts}.wav"
    synthesize_speech(narration, audio_path)
    log.info(f"音声生成完了: {audio_path}")

    # Step 4: 写真取得
    log.info("Step 3: 芸能人写真取得中...")
    photo_path = get_or_create_photo(celebrity)

    # Step 5: 動画生成
    log.info("Step 4: 動画生成中...")
    video_path = f"output/video_{celebrity['name']}_{ts}.mp4"
    create_celebrity_video(
        celebrity=celebrity,
        tekichu=tekichu,
        narration_text=narration,
        audio_path=audio_path,
        output_path=video_path,
        photo_path=photo_path,
        tekichu_se_path="assets/se/tekichu.wav",
    )
    log.info(f"動画生成完了: {video_path}")

    # Step 6: 投稿予約
    _schedule_post(video_path, caption, skip_post, CHANNEL_IDS)

    return video_path


# ──────────────────────────────────────────
#  生年月日モード（既存）
# ──────────────────────────────────────────
def run_daily_pipeline(month=None, day=None, skip_post: bool = False):
    """今日生まれの人の宿命解析 TikTok動画を生成・投稿予約する"""
    from generate_script import generate_narration, generate_caption, generate_title_text
    from generate_audio import synthesize_speech, is_voicevox_running
    from generate_video import create_video
    from post_scheduler import BufferScheduler, save_post_log, CHANNEL_IDS

    if month is None or day is None:
        today = datetime.now()
        month, day = today.month, today.day

    log.info(f"生年月日モード: {month}月{day}日生まれ")

    log.info("Step 1: スクリプト生成中...")
    narration = generate_narration(month, day)
    caption   = generate_caption(month, day, narration)
    features  = generate_title_text(month, day)

    log.info("Step 2: 音声生成中...")
    if not is_voicevox_running():
        log.error("VOICEVOXが起動していません")
        return None

    ts = datetime.now().strftime("%H%M%S")
    audio_path = f"output/audio_{month}_{day}_{ts}.wav"
    synthesize_speech(narration, audio_path)

    log.info("Step 3: 動画生成中...")
    video_path = f"output/video_{month}_{day}_{ts}.mp4"
    create_video(month=month, day=day, features=features,
                 audio_path=audio_path, output_path=video_path)
    log.info(f"動画生成完了: {video_path}")

    _schedule_post(video_path, caption, skip_post, CHANNEL_IDS)

    return video_path


# ──────────────────────────────────────────
#  共通：Buffer 投稿予約
# ──────────────────────────────────────────
def _schedule_post(video_path: str, caption: str, skip_post: bool, channel_ids: list):
    from post_scheduler import BufferScheduler, save_post_log

    if skip_post:
        log.info("投稿スキップ（--skip-post 指定）")
        return
    if not os.getenv("BUFFER_ACCESS_TOKEN"):
        log.warning("BUFFER_ACCESS_TOKEN 未設定 → 投稿スキップ（.env に設定してください）")
        return

    log.info("Step 5: Buffer へ予約投稿中...")
    try:
        post_time = datetime.now().replace(
            hour=POST_HOUR, minute=POST_MINUTE, second=0, microsecond=0
        )
        if post_time <= datetime.now():
            post_time += timedelta(days=1)

        BufferScheduler().schedule_post(
            video_path=video_path,
            caption=caption,
            channel_ids=channel_ids,
            scheduled_at=post_time,
        )
        save_post_log(0, 0, video_path, caption, post_time.isoformat())
        log.info(f"投稿予約完了: {post_time.strftime('%Y-%m-%d %H:%M')}")
    except Exception as e:
        log.error(f"投稿予約エラー: {e}")


# ──────────────────────────────────────────
#  エントリーポイント
# ──────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Fate Lab TikTok 自動投稿システム")
    parser.add_argument("--mode", choices=["celebrity", "daily"], default="celebrity",
                        help="celebrity=芸能人モード（推奨）, daily=生年月日モード")
    parser.add_argument("--name",  default=None, help="[celebrity] 芸能人名を指定")
    parser.add_argument("--month", type=int, default=None, help="[daily] 生成する月")
    parser.add_argument("--day",   type=int, default=None, help="[daily] 生成する日")
    parser.add_argument("--skip-post", action="store_true", help="動画生成のみ（投稿しない）")
    parser.add_argument("--daemon", action="store_true",
                        help=f"毎日 {RUN_HOUR:02d}:{RUN_MINUTE:02d} に自動実行")
    args = parser.parse_args()

    def job():
        if args.mode == "celebrity":
            run_celebrity_pipeline(name=args.name, skip_post=args.skip_post)
        else:
            run_daily_pipeline(month=args.month, day=args.day, skip_post=args.skip_post)

    if args.daemon:
        log.info(f"デーモン起動 [{args.mode}モード]: 毎日 {RUN_HOUR:02d}:{RUN_MINUTE:02d} に実行")
        schedule.every().day.at(f"{RUN_HOUR:02d}:{RUN_MINUTE:02d}").do(job)
        job()  # 初回即実行
        while True:
            schedule.run_pending()
            time.sleep(60)
    else:
        job()


if __name__ == "__main__":
    main()
