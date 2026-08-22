# PR-3 shadow baseline

Measured on 2026-08-23 with 100 deterministic inputs. Twenty inputs omitted birth time. No AI API was called.

| Metric | Result |
|---|---:|
| Samples | 100 |
| Average Fact count | 68.24 |
| Average Finding count | 12.87 |
| Average consensus count | 2.94 |
| Users with zero Findings | 0 |
| Average assignable chapters | 5.22 / 8 |
| Minimum assignable chapters | 3 / 8 |
| Median consensus independence | 1.00 |

## Decision

Do not switch the production report to Fact/Finding V2 yet. Finding availability is sufficient, but the current strict chapter contracts can fill only 5.22 of 8 chapters on average. Keep `SHADOW_METRICS=1`, leave the user-visible legacy path unchanged, and proceed to PR-4 selection/validation infrastructure and supplement planning before any production cutover.

The executable baseline is `shadowDistribution.test.ts` and can be rerun with `npm run test:shadow-distribution`.
