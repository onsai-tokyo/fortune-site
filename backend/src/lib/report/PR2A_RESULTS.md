# PR-2a results

## Position-dependent keys

Shadow V2 now derives contradiction, distortion, and Zi Wei mutagen signals from their content rather than array position.
The legacy production Fact builder remains unchanged.

- Same-year ten-sample common Finding keys: `8 -> 1`
- Remaining common key: `independence`
- Target: at most 3 (passed)

## Untimed Moon verification

The Moon was not unconditionally marked as time-dependent.

- `1995-02-20`: the Moon crosses a sign during the local day, so both Moon placement Facts are correctly withheld without a birth time.
- `1995-02-02`: the Moon remains in one sign, so both `planet:月:*` and `vedic-planet:月:*` are retained without a birth time.

For a stable untimed date, the shadow path produced 47 Facts but only 4 existing Findings. This is not a Moon extraction failure: most additional Facts belong only to the `ephemeris` lineage, while the current consensus builder requires two independent lineages. Reaching 12 Findings therefore depends on the Trait Score / score-Finding layer in PR-2c through PR-2e; it cannot be achieved by PR-2a without weakening the existing consensus contract.

