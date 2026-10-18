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
