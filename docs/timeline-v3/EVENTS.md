# 年表入力の読み解き 実装仕様（Codex向け）

利用者が過去の出来事を入れると、その年を命式の言葉で読み解き、この先で同じ分野が動きやすい年を示す機能です。判定は時系列 v3 と同じもの（`signals.ts`）を使います。参照実装：`backend/src/lib/report/timelineV3/events.ts`、原稿：`data/eventParts.json`。

## 1. 守ること

- **読み解きであって、的中の判定ではない。** 「当たりました」「的中」は書かない（テストで確認）。重なっていない年は、そのことを正直に書く。
- **入力された出来事で、判定・出生時刻・ルールを変えない。** 過去の出来事に合わせて時刻を推定する「レクティフィケーション」はしない。
- **自由記述は受け付けない。** 出来事は種類・年・月だけ。健康・生死に関わる種類は用意しない。
- **検証データへの利用は、別の明示的な同意がある人だけ。**

## 2. 出来事の種類

| kind | 表示 | 分野 | 読み解きの方向 |
| --- | --- | --- | --- |
| encounter | 出会い | 関係 | 始まり |
| start | 交際の始まり | 関係 | 始まり |
| reunion | 復縁 | 関係 | 始まり |
| marriage | 結婚・入籍 | 関係 | 結婚 |
| breakup | 別れ | 関係 | 区切り |
| divorce | 離婚 | 関係 | 区切り |
| job | 仕事の変化（就職・転職など） | 仕事 | 仕事 |
| study | 進学・卒業 | 仕事 | 仕事 |
| move | 引っ越し | 住まい | 住まい |
| other | 大切な出来事 | その他 | その年の色のみ |

入力の検証は `parseLifeEvent()`。年は生年〜今年、月は任意（1〜12）。

## 3. 読み解きの組み立て（`readLifeEvent`）

| セクション | 内容 |
| --- | --- |
| あなたの出来事 | 「{年}年{月}月に、{出来事}がありました。」。1月は「四柱推命では前の年の流れとして読む」、2月は「立春より前なら前の年」の注記 |
| 命式から見たこの年 | 時系列の判定と重なる年は「重なっています」＋当てはまる判定の平易な説明。重ならない年は「判定では入っていませんでした。判定に出ない年にも起こります」＋（あれば）「一方で、次のような動きもありました」。前後1年に章の切り替えがあればその一文。最後に「的中を示すものではない」の注記 |
| この出来事の読み解き | その年の十神 × 出来事の方向の文（10×5＝50文）。「その他」は十神の良い面を過去形で |
| これから | 今年より後15年で、同じ分野が動きやすいと読む年を最大2つ。なければ「穏やかに積み重ねていける流れ」 |

- 四柱推命の年：1月の出来事は前年の干支で読む（`meta.baziYear`）。
- 木星（男性は金星）の期間は、月が分かっていればその月の15日で判定し、分からなければ年単位の判定（90日以上の重なり）を使う。

## 3b. 時系列への反映（v2.13）

入力された出来事は、本人の時系列の文にも入る（`lifeline.ts`、原稿 `eventParts.json` の `timeline`）。**判定は変えない**（出来事あり・なしで判定が同じことをテストで確認）。
- 入力：`TimelineV3Input.lifeEvents`（`{year, month?, kind}[]`）。`timelineContext()` が検証・重複除去・並べ替えをする（`eventKinds.ts` の `canonicalLifeEvents`）。表示する年より後の出来事は使わない。
- **出来事のあった年**：「あなたの年表では、この年（の◯月）に◯◯がありました。」＋その年の十神×出来事の方向の読み解き（`readings` の2文目）。詳細版は「あなたの年表から」の節。1段落版はリードの直後。
  - 関係の出来事がある年は、1段落版で「〜形で表れることがあります」を出さない。仕事の出来事がある仕事の転機の年は、節目の文を出さない。
  - 過去の年の問いは、その出来事についての問いに置き換える（`timeline.reflection`）。
- **出来事のない年**：直近の関係の出来事からの年数を1文入れる（「2024年の交際の始まりから、2年がたつ年です。」）。
  - 始まり・結婚：関係がテーマの年（関係・信頼・兆し）か、1・3・5・10・15…年目。
  - 別れ・離婚：関係がテーマの年で3年以内だけ。
  - 仕事の変化：仕事の転機の年で3年以内だけ（関係の文が優先）。
- 1段落が280字を超えるときは、出来事のある年は10年の流れの1文を先に外す。
- 配線：時系列を作るとき、プロフィールと一緒に `life_events` の行を `lifeEvents` として渡す。保存済みの鑑定書は `refreshSavedTimelineV3Cards(cards, snapshot, nowYear, lifeEvents, partnerSince)`（IMPLEMENTATION.md §8-5）で今の年表を反映する。

ふたりの時系列での使い方は COUPLE.md §3d。

**v2.16 の変更**：年表の交際の始まり・結婚の年は「人生の時期」の窓（交際1〜3年、結婚3〜7年）として判定にも使う（IMPLEMENTATION.md §6-0）。それ以外の出来事は、これまで通り文章だけに使う。

## 4. API

`POST /api/timeline/events/read`（認証必須）

```json
// request
{ "events": [{ "year": 2023, "month": 5, "kind": "breakup" }] }
// response
{ "readings": [ /* EventReading（events.ts の型） */ ] }
```

- 出生情報は、ログイン中のプロフィール（生年月日・時刻・出生地・性別・今の状況・働き方）から作る。`readLifeEvents(input, events, 今年)`。
- 出来事の保存：`POST /api/timeline/events`（一覧の置き換え）、`GET /api/timeline/events`。
- 読み解き結果は保存しない（毎回計算。1件あたり数十ミリ秒）。

## 5. DB

```sql
create table life_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year int not null, month int null check (month between 1 and 12),
  kind text not null check (kind in ('encounter','start','reunion','marriage','breakup','divorce','job','study','move','other')),
  created_at timestamptz not null default now()
);
alter table life_events enable row level security;
create policy "own events" on life_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table validation_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  consented_at timestamptz not null, withdrawn_at timestamptz null
);
```

- アカウント削除で出来事も消える（既存の削除処理に `life_events` を追加）。
- 検証用の匿名データは、同意中の利用者だけを `toValidationRecord()` で書き出す（生年月日・時刻・都道府県・性別・出来事の種類と年月のみ。アカウントID・自由記述なし）。書き出しは運営の手動作業とし、アプリからは送らない。

## 6. iOS

- 置き場所：「あなた」タブの時系列の上に「あなたの年表」ボタン。
- 入力画面：年（ピッカー）・月（任意）・種類（上表の10種）。複数登録・削除可。説明文「入力した出来事は、あなたの読み解きにだけ使います。」
- 表示：時系列の各年カードの下に、その年の出来事の読み解きを並べる（`readings` を `year` で紐づけ）。1月の出来事は `year` のカードに表示し、本文の注記で前年の流れとして読んでいることを伝える。
- 同意：設定に「読み解きの精度向上に協力する（匿名）」のスイッチ。初期値オフ。

## 7. 完了条件

- [ ] v3 テスト32件が成功（出来事の読み解きを含む）
- [ ] 出来事の登録・削除・読み解き表示ができる
- [ ] 1月の出来事で前年の流れとして読む注記が出る
- [ ] 時刻不明のプロフィールで、木星の期間の文が出ない
- [ ] 同意オフの利用者は検証データに含まれない
- [ ] アカウント削除で出来事が消える
