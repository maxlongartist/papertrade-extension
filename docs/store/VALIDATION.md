# Beta validation record

Automated tests and local fake-native browser tests establish implementation behavior, not funded settlement reliability. Run and record the exact release version before uploading. No live trades are authorized by this checklist.

## Required automated checks

- Unit/worker suite; production build; explicit payload/manifest/icon validation.
- Fresh-profile first-run checkbox, saved acknowledgement, no native entry before agreement, recovery from failed acknowledgement storage.
- Existing native Close available during setup; no action replay after uncertainty.
- Actual Chrome IndexedDB encryption/key reuse after extension reload; encrypted records survive restart and decrypt correctly.
- Legacy plaintext migration, failed save/missing key/tampering retain records and fail closed.
- Stable layout at narrow and wide ticket widths; connection/price/account/Positions status accurate.
- Existing pair, entry, exit and wallet-binding regressions.

## Owner-operated funded checks before wider distribution

Use an account and amounts chosen by the owner. The owner performs wallet approvals and consequential trade actions. Record market, extension version, requested levels, native position IDs, observed fill/close outcomes, delays and fees privately.

1. One limit entry with no exits, then cancel a separate waiting entry.
2. Long and short SL/TP paths independently, with requested/effective early levels recorded.
3. Add/edit/remove protection for a position opened outside the extension.
4. One manual pair: both identified fills, then both exact native closes confirmed.
5. A delayed fill/response and a wallet prompt: no duplicate submission and a clear unresolved state.
6. Stale feed, hidden Positions, wrong wallet, page refresh and extension reload: visible guidance and no cross-wallet or guessed action.
7. Move from an unpacked copy to the Store identity only after reconciling tracking; no assumption that records migrate.

If a path fails or is inconclusive, keep distribution restricted and document the limitation. Do not claim guaranteed SL/TP, simultaneous hedging, exact fills, profitability or continuous unattended operation.
