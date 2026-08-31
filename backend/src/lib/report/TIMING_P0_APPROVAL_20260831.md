# Timing V2 P0 approval record

Date: 2026-08-31 JST

## Decision

- P0 safety foundation: **GO**
- Remaining 15 scores, shadow-only implementation: **GO after canonical A-D review**
- Threshold calibration: **NO-GO**
- Timing V2 production connection: **NO-GO**

## Approved boundary

P0 is an architecture/CI guard against accidental production connection from trusted repository code. It is not an adversarial JavaScript sandbox. The scope and limitations are defined in `TIMING_PRODUCTION_ISOLATION_THREAT_MODEL.md`.

## Preconditions for the remaining 15 scores

1. Review the canonical `Phase2設計書_A-D.md` and `Phase2設計表_18スコア_v2b.md` before implementation.
2. Do not implement from the superseded `Phase2設計表_18スコア.md`.
3. Add every newly created experimental Timing module to `experimentalModules` in `timingProductionIsolation.test.ts`.
4. Keep `ziwei` independent from `stem_branch`.
5. Do not calibrate thresholds and do not connect Timing V2 to production.

## Verification at approval

- build: PASS
- production safety: 27/27 PASS
- Timing V2: 104/104 PASS
- backend: 462/462 PASS
- production graph: Timing V2 disconnected
