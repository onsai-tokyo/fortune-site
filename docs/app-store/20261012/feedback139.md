# Build 139 — membership purchase and partner registration feedback

## Source

Eight new TestFlight items received 2026-10-12 around 18:52–18:59 JST. Six were from build136; two were from build138. Build138's screenshot still showed unknown purchase status before explicit recovery, so this was not treated as an already-resolved display request.

- Two direct subscription choices, monthly and annual.
- Show Japanese yen prices and refine the plan UI.
- Show extra book purchases only for members who exhausted their monthly allowance.
- Replace confusing verification/restore controls in checkout with purchase actions.
- Remove the separate “会員プランを見る” control from partner selection; route an over-limit registration attempt to membership instead.

## Changes

- Plan cards lead with Japan catalogue prices: ¥1,980/month with 3 books/month; ¥12,000/year with 5 books/month and ¥1,000/month equivalent. Each has its own purchase button. For a non-JPY StoreKit account, actual Apple charge/currency remains explicitly disclosed in secondary text. The app does not convert or change Apple's checkout currency.
- Settings also leads with the Japanese subscription prices. Extra book purchase leads with ¥980 (Japan price), with actual StoreKit price alongside.
- Unknown purchase state no longer replaces both purchase choices with a verification-only block. Pressing a plan action first reconciles an existing/uncertain purchase. A successful existing membership resumes the draft without charging again; only a verified nonmember state proceeds to new checkout. Failed/uncertain reconciliation stays blocked rather than assuming payment failed.
- Explicit restoration also retries this account's pending expired subscription transactions. Those are not in StoreKit currentEntitlements and previously could block fresh checkout indefinitely. The build138 Sandbox-only authorization/operation-ID fix remains in force.
- Additional book purchase requires active membership and zero remaining credits both in UI and immediately before invoking StoreKit, with an account check. A refresh that finds usable credits resumes creation instead of purchasing. Purchase serialization begins before the last server request.
- The redundant membership control in partner selection is removed. Existing free-one/member-ten routing remains. The membership sheet stays open after cancellation/failure and resumes partner registration only when the refreshed server limit permits another profile.

## Validation

- 19 targeted native tests passed: purchase delivery, draft continuation, checkout recovery, membership/credit gating.
- Checkout tests cover known nonmember -> one purchase, recovered expired payment -> one purchase, unknown state -> no purchase, already-delivered membership -> no second purchase.
- Simulator visual check uses the same MembershipOfferCard as production; preview callbacks are no-ops and do not purchase or grant access. Image: outputs/feedback139/membership139.png.
- Actual Apple checkout and purchase-to-book continuation require the user's TestFlight device check.
- No backend changes or production account mutations.

## Delivery

Release archive succeeded. App Store Connect upload succeeded at 2026-10-12 19:13 JST; Apple processing follows upload. Logs: outputs/build139-archive.log and outputs/build139-upload.log.
