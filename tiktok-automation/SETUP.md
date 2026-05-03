# Fate Lab TikTok 自動化システム セットアップガイド

## 全体の流れ

```
毎朝 8:00 自動起動
    ↓
Claude API → 今日の生年月日のスクリプト生成（ナレーション・特徴・キャプション）
    ↓
VOICEVOX → 日本語ナレーション音声を生成
    ↓
MoviePy + Pillow → TikTok縦型動画（1080x1920）を生成
    ↓
Buffer API → TikTok・Instagram Reelsに18:00投稿を予約
```

---

## セットアップ手順

### 1. 依存パッケージのインストール

```bash
cd tiktok-automation
pip3 install -r requirements.txt
```

### 2. VOICEVOX のインストール・起動

1. https://voicevox.hiroshiba.jp/ からダウンロード
2. アプリを起動（起動するだけで localhost:50021 がリッスン状態になる）
3. 動画生成を実行するたびに起動しておく必要あり

### 3. Buffer アカウント作成・API設定

1. https://buffer.com でアカウント作成（無料プランで始められる）
2. TikTok・Instagramを Buffer に接続
3. https://buffer.com/developers/api でアクセストークンを取得
4. `python3 post_scheduler.py` を実行してチャンネルIDを確認

### 4. .env ファイルの設定

```bash
cp .env.example .env
```

`.env` を編集して以下を設定：

```
ANTHROPIC_API_KEY=（バックエンドの .env からコピー済み）
BUFFER_ACCESS_TOKEN=（Bufferから取得したトークン）
BUFFER_CHANNEL_IDS=（TikTokのチャンネルID,InstagramのチャンネルID）
```

---

## 使い方

### 一回だけ実行（今日の日付）

```bash
python3 main.py
```

### 日付を指定して実行

```bash
python3 main.py --month 4 --day 19
```

### フレーム画像だけ確認（投稿なし・音声なし）

```bash
python3 main.py --preview-only
```

### 動画生成のみ（Buffer投稿スキップ）

```bash
python3 main.py --skip-post
```

### デーモンモード（毎日自動実行）

```bash
python3 main.py --daemon
```

毎朝 8:00 に実行 → 18:00 の投稿を予約。
ターミナルを閉じると停止するので、本番運用では `nohup` か launchd を使う。

#### macOS launchd で常駐させる（推奨）

```bash
# plist ファイルを作成
cat > ~/Library/LaunchAgents/com.fatelab.tiktok.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.fatelab.tiktok</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>/Users/yamazaki_manami/projects/fortune-site/tiktok-automation/main.py</string>
        <string>--daemon</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/yamazaki_manami/projects/fortune-site/tiktok-automation/logs/launchd.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/yamazaki_manami/projects/fortune-site/tiktok-automation/logs/launchd_err.log</string>
</dict>
</plist>
EOF

# 登録
launchctl load ~/Library/LaunchAgents/com.fatelab.tiktok.plist

# 停止したい場合
launchctl unload ~/Library/LaunchAgents/com.fatelab.tiktok.plist
```

---

## BGMを追加したい場合

著作権フリーのBGMを `assets/bgm/` に置いて `.env` に設定：

```
BGM_PATH=assets/bgm/your_bgm.mp3
```

おすすめフリーBGMサイト：
- https://pixabay.com/music/ （占い・瞑想・神秘系を検索）
- https://freemusicarchive.org/

---

## ログの確認

```bash
tail -f logs/automation.log    # リアルタイムログ
cat logs/post_log.jsonl        # 投稿履歴
```

---

## トラブルシューティング

| エラー | 対処 |
|---|---|
| `VOICEVOXが起動していません` | VOICEVOXアプリを起動してから再実行 |
| `BUFFER_ACCESS_TOKEN が未設定` | .env に Buffer トークンを設定 |
| `ANTHROPIC_API_KEY` エラー | バックエンド .env からキーをコピー |
| 動画生成が遅い | 初回のみ ffmpeg バイナリのキャッシュで遅い、2回目以降は速い |
