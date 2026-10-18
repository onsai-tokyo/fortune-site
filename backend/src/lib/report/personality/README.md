# Personality editorial engine

Local integration added 2026-09-24. The existing production default is still
`NARRATIVE_ENGINE=blocks`. Select `NARRATIVE_ENGINE=personality` explicitly in a
local/test server to exercise this path through `/api/preview/generate`.

## What is connected

- Source catalogue for 60 day pillars, 27 mansions, and received spouse material.
- Reviewed, source-linked paragraphs and 44 item recipes from three representative
  drafts. Recipes use chart features, never birth dates, names or known outcomes.
- Five internal editorial groups with 15 ordered item cards, including a calculated
  or explicitly pending spouse item. Each existing app card shows its category and
  a feature title; tapping opens the existing detail reader for that item's full text.
- Existing `StructuredReport` sections/pages, saved-reading snapshot, and reading
  generation route. This engine bypasses the AI writer and concern-based reordering.
- Separate source/material/layout/composer/calendar/input-context versions in the pipeline cache identity.

The `personality-item-cards-v2` adapter retains the existing card and detail UI.
Each card has one section, its category in `tags`/`summary`, and a title extracted
from the first interpretation sentence (or the pending/limit text when unavailable).
Sentence extraction respects quoted punctuation, preserves qualifiers, and removes
only the leading `あなたは` and final sentence punctuation. It invents no scenes.
The headline stores its paragraph ID, source references and extraction method;
the contract checks these against the unchanged full paragraph body.
Displayed evidence identifies the day pillar, mansion or calculated spouse element
in readable Japanese. Internal source IDs remain in structured traces rather than
appearing as evidence labels; raw mixed-source summaries are never displayed.

The app adapter uses `spouseCalculation.ts`, an isolated implementation of the
received 28-element convention. It never substitutes the existing center/west star.
It accepts valid dates in 1952–2100 and a recorded `HH:mm` minute in `Asia/Tokyo`.
`birthContext.ts` resolves existing Japanese prefecture selections and strictly
formatted prefecture/municipality addresses; unknown locations remain pending.
An explicit `birthTimeZone` takes precedence, including unsupported values.

The adopted convention uses a civil midnight day change and `floor(elapsed24h)+1`
from the previous solar term. The implementation explicitly converts the calendar
library's CST term instant to JST; it does not retain the received Python code's
extra eight-hour shift. Birth minutes intersecting solar-term, hidden-stem, or
table-admissibility boundaries within a 60-second safety margin remain pending.
The margin covers the observed 54.407-second maximum difference across 2,412 terms
compared with an independently implemented sxtwl reference. It is not a proof of
universal calendar accuracy. Runtime lunar-javascript versions other than the
verified 1.7.7 remain pending until revalidated and versioned.

The table's unverified repairs (all 卯 conditions and 申 on day 10), missing/invalid
input, unsupported dates/timezones and day-pillar mismatches also remain pending.
The report stores a reason and method version, without duplicating birth timestamps.
The lower-level composer still accepts precomputed star/branch selectors for
editorial reproduction; untrusted HTTP input cannot supply those selectors.

## Source and composition policy

The importer preserves the first **present** field in this order:
`effective_scope`, `gender_scope`, `scope`. An empty/unknown value fails closed; it
does not fall back to the earlier scope. Any exclusion disqualifies the paragraph.
All references must exist, match the requested selector and satisfy the paragraph's
scope. A selected gender supplement cannot make a gendered source common.

All 125 received spouse source summaries have an explicit usage review; prediction-only
SB01-002/SB05-001 remain excluded. Mixed sources have a restricted `reviewedUsage`.
New 10-star/12-branch materials retain `material_revised`, not full-composition approval.
The two approved spouse recipes retain exact wording and precedence. Their use of
日支 is explained in `termGloss`; the display checker accepts only this term in a
paragraph matching the exact approved text and source IDs. Newly revised material
uses plain language. Legacy spouse prose and legacy context extensions remain
withheld. Missing input never receives a default hidden stem, and a held spouse
calculation does not discard the other 14 personality items.

Advice is optional. Legacy advice blocks await semantic review. Revised/reviewed
advice must name retained descriptive/interpretation-limit paragraphs or explicitly
reviewed direct source premises, with a derivation note. Removing a dependency
also removes its dependent advice. Some older descriptive blocks contain advice:
field names alone cannot detect all such wording, so `legacy_unreviewed` is retained.

Duplicate removal requires identical paragraph text, references, kind and scope
within the same item. Similarity, opposite-word tags, sentence polarity changes and
automatic intensification are not used. Differing sources are not reconciled using
invented ages, contexts, inner/outer personalities or causal claims.

The bounded 2026-09-24 material review covers the 161 previously emitted common
paragraphs in 56 cells for 甲子, 丁卯, 角宿 and 房宿. It rewrites text or references
in 66 paragraphs and removes 23 paragraphs from selection while retaining their
withheld history. The remaining 138 paragraphs carry `material_reviewed` and an
explicit `reviewId`, also retained in the app's stored structured report.
This status means comparison with the received source summaries; it is neither
verification against the original websites nor full-composition approval. Review
snapshots and patches are exact-match import prerequisites. Unread gender blocks,
excluded sources and previously held material are not released by this review.

The four new combinations are presented for editorial inspection. Five common
items now have bounded pair-specific revisions in `compositionRevisions.json`:
丁卯 × 角宿 items 02/05/09 and 丁卯 × 房宿 items 05/09. The importer verifies
their exact prior paragraphs and source summaries before adding these recipes.
They merge repeated work-absorption prose without boosting its intensity. Conflicting
decision-speed and relationship-effort readings are presented together in explicit
interpretation-limit paragraphs; no invented context selects a winner. The titles
for thinking and relationships now lead with observable behavior from the sources.
`composition_revised` records this limited editing, not final user approval. It does
not promote unread gender supplements or other items. The shared materials, original
sources and three approved representative readings remain unchanged. Composer version
4 carries the new review status through the existing structured report.

## Rebuild and validation

From the repository root, with the original received/editorial artifacts available
under the parent workspace's `outputs/` directory:

```sh
python3 scripts/importPersonalityCatalog.py
```

The import asserts every patch's original text, records input hashes, generates a
typed static catalogue, and changes its content version whenever the material changes.
The generated catalogue is part of the code; a built server does not need the source
archives, Python, or runtime JSON-copy steps.

From `backend/`:

```sh
npm run test:personality
npm run audit:personality
npm run audit:personality-spouse
npm run build
```

The personality audit covers all 1,620 chart combinations and all three supplement selections
(4,860 conditions). This verifies source eligibility, dependencies, coverage and
display shape. It does not verify the meaning/readability of all compositions, or
the empirical accuracy of astrology. Only the three representative readings have
complete editorial review; other compositions retain their incomplete review status.
The spouse audit checks 600 day-pillar/star selector conditions and presents 120
star/branch material combinations. Those are editorial selector checks, not a claim
that all combinations are produced by real birth inputs. Independent calendar
fixtures cover 170 synthetic valid/invalid inputs, including boundaries.

## Local iOS reader preview

Generate the two synthetic editorial-selector fixtures from the current backend:

```sh
# From backend/
node --import tsx ../scripts/generatePersonalityIOSFixture.ts
```

Open `ios/FateLab.xcodeproj` and choose the shared `FateLab-PersonalityPreview`
scheme. The DEBUG-only entry accepts `--personality-preview koshi-kaku` or
`--personality-preview teibo-bo`, optional `--personality-card 01` through `15`
and zero-based `--personality-item` (currently `0`, one section per card).
It renders the actual `InsightHubView` / `FocusReadingView` with no birth inputs.
Session, purchase and authentication services are not initialized in this entry;
the question action shows a local notice. The fixture is compiled only in DEBUG.

`PersonalityReaderTests` checks the decoded 15-card/15-item contract, the category
and feature title rendered on the real card, all 30 item headings rendered by the
real reader at a 390 × 844 point viewport, horizontal overflow, the pending spouse
message and the reader's footer at enlarged type.
OCR checks and screenshot attachments complement manual screenshot review;
they do not prove every line or every supported device size is correct.

## Remaining before changing the default

1. Review the remaining material and composed readings, including repeated meanings,
   contradictory sources and advice embedded in descriptive blocks.
2. Verify the unresolved table repairs against suitable sources and review unsupported input policies.
3. Extend simulator checks to physical devices and the authenticated saved-report flow.

Timing calculations and the older research-only personality foundation are separate
from this engine and have not been promoted, replaced or recalibrated here.
