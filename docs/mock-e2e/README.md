# 仮データ版の画面テスト（Playwright / Python）

`/demo` があるビルド（`npm run build && npx vite preview --port 4173`）に対して動かす。
本番接続後の体験の期待値の参考として残している。

```
pip install playwright   # ブラウザは環境に合わせて用意
python3 journey.py   # 初回入力 → 書いてから払う → 自動作成 → 本棚
python3 guest.py     # 匿名 → 相手の入れ替え → 購入 → メール登録 → 別端末で引き継ぎ
python3 logic.py     # iOS・サーバーと同じルール（テーマ、文字数、禁止語、関係17種、出会った年 など）
python3 bugs.py      # 過去に直したバグの再発確認
python3 probe3.py    # 端端のケース（利用をやめた後、直接開いたURL など）
python3 crawl.py     # 6つの状態で全リンクをたどり、エラー・画像切れ・はみ出しを確認
```

`OK` / `FAIL` が1行ずつ出る。最後に `pageerrors []` なら画面のエラーなし。

既存プレビューを止めずに別ポートで確認する場合、全6本で
`MOCK_E2E_BASE_URL=https://localhost:4175 python3 guest.py` のように指定できる。
自己署名証明書を許容するのはローカル画面テストのブラウザだけで、本番設定には使わない。
これらのスクリプトはFAIL表示があっても終了コード0になることがあるため、終了コードだけで合格とせず、出力のFAIL・pageerrors・crawlerのissuesを確認する。

crawlは相手が登録済みの4プリセットに限り `/couple` → `/couple/p-misaki` を仕様どおりの遷移として別集計する。それ以外の問題はissuesとして残し、終了コード1にする。

## REMOTEの決済制御（ローカルfixture専用・追加テスト）

`payments_remote.py` は全APIを合成応答で代替する。実Supabase/Render/Anthropicへは接続しない。
架空の `VITE_SUPABASE_URL=https://mock.invalid`、`VITE_SUPABASE_ANON_KEY=mock-anon-key` と
`VITE_PAYMENTS_ENABLED=false` で別outDirへビルドし、別ポートでpreviewする。
`MOCK_E2E_BASE_URL=https://localhost:4176 python3 payments_remote.py` で購入オフと付与済みの作成・質問を検証する。
trueビルドでは `MOCK_PAYMENTS_ENABLED=true` を付け、REMOTE仮付与が無効のままか検証する。
上記の架空の値はテスト専用で、デプロイ用環境変数へ保存しない。
