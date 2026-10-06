# Startup recovery — build 105

User reported indefinite loading on launch. Initial simulator attempt reached a generic error after loading the saved reading; a later cold launch succeeded against the production API. Root cause of the intermittent failure is not yet established. Health endpoint and authentication host were responsive when checked; this does not prove authenticated reading requests were healthy.

## Changes
- Enforce the existing 45-second API request budget while receiving a response, not just between retry attempts. Cancel the URLSession request when the deadline expires.
- Present request timeouts as a recoverable network error rather than a generic system error.
- Offer access to the bookshelf during prolonged saved-reading loading, instead of launching duplicate requests from the loading screen.
- Log only error type/domain/code and decoding field path for reading failures, never tokens or response contents.

## Validation
- Added an incomplete-response transport test and timeout presentation test.
- Final test / distribution status tracked in RELEASE_STATUS_105.txt next to the repository.
- No reading data, calculation, pricing, or access-control changes.
