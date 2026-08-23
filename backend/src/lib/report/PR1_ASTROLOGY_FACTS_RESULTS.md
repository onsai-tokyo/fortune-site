# PR-1 astrology Fact results

## Runtime format dump

Input: `1995-02-20 03:02 愛知県 女性`

- Planet names: `太陽, 月, 水星, 金星, 火星, 木星, 土星, 天王星, 海王星, 冥王星`
- Sign format: Japanese kanji names such as `魚座`, `天秤座`, `水瓶座`
- Aspect format example: `太陽と冥王星のスクエア（オーブ0.1°）`
- Vedic planets: present, with the same Japanese planet/sign fields
- Without a birth time, the existing calculator returns `available: false`; the shadow extractor therefore uses the existing calculator at noon only for time-independent planetary placements. ASC/MC/houses remain disabled.

## 100-sample distribution

| Metric | Before | After | Target |
|---|---:|---:|---:|
| Fact median | 74 | 112 | +25 or more (`+38`) |
| ephemeris Fact median | 17 | 55 | 15 or more |
| canonicalSourceId median | 16 | 51 | 20 or more |
| Finding median | 13 | 19 | 12 or more |
| Consensus Finding median | 3 | 8 | 5 or more |
| Finding-zero samples | 0 | 0 | 0 |
| Assignable chapters median | 5 | 7 | 7 or more |
| Duplicate Finding-key-set pairs | 1 | 0 | 5 or fewer |

All PR-1 distribution targets passed with zero AI calls.

## Generation-bias check

- PR-1-attributable Finding keys shared by all ten same-year samples: `0`
- Outer-planet share of primary Facts: `0%` to `10%` (target: at most `20%`)
- Eight pre-existing Finding keys were common to all ten samples. They come from legacy Zi Wei mutagen and metadata signature keys, not the PR-1 astrology Facts, and are retained as a diagnostic for later PRs.

## Birth-time comparison

- With time: 118 Facts / 19 Findings
- Without time: 50 Facts / 6 Findings
- The untimed result contains no `requiresBirthTime: true` Fact and no house Fact.

