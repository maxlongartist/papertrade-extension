# Developer notes

For installing and using the extension, start with the [README](../README.md).

## Develop

Requires Node.js 22 or newer and npm. From this repository:

```sh
git clone https://github.com/maxlongartist/papertrade-extension.git
cd papertrade-extension
npm ci
npm test
npm run build
```

Load the generated `dist/` folder in Chrome using the installation guide. `extension/` contains source modules; it is not the unpacked build. The build requires no wallet credentials.

For later source updates, run `git pull --ff-only`, `npm ci`, and `npm run build` from the same clone, then Reload the existing Chrome extension and refresh Papertrade. Keep the same installed folder/identity.

For the local simulated UI:

```sh
npm run preview
```

Open `http://127.0.0.1:4320/trade/btc?scenario=pair`. This fixture uses simulated native positions/actions. Some public market/queue reads may use the network.

Optional browser checks require a local Playwright installation and Chrome for Testing:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
BROWSER_EXECUTABLE=/absolute/path/to/chrome \
npm run verify:layout-stability
```

Other `verify:*` commands are listed in `package.json`. Some inspect public signed-out venue pages in temporary profiles; these are not funded execution certification. Historical implementation and verification details are in [development history](https://github.com/maxlongartist/papertrade-extension/blob/main/docs/DEVELOPMENT-HISTORY.md).

`npm run release` builds, runs the suite, and creates a ZIP with `manifest.json` at its root. It writes versioned packages beside the repository and in `~/Downloads`, plus a ZIP-only latest alias. Existing versioned packages are immutable; increment the version in `package.json`, `package-lock.json`, and `extension/manifest.json` before changing a released payload. It does not overwrite installed extension folders or read bot credentials.

## GitHub username changes

This repository uses `maxlongartist/papertrade-extension`. For an existing clone with an outdated URL:

```sh
git remote -v
git remote set-url origin https://github.com/maxlongartist/papertrade-extension.git
git remote -v
```

Changing a remote URL does not rewrite commit history. See [GitHub's remote-management guide](https://docs.github.com/en/get-started/git-basics/managing-remote-repositories).

## Public wallet overlay

`wallet-data.js` validates and projects public account SSE snapshots using `/state/trading` instrument scales; `wallet-feed.js` handles bounded streaming parsing, disconnects and Retry-After backoff. `wallet-panel.js` keeps opt-in selections locally and aborts streams on disable, hidden tabs, route changes or disposal. No trading messages are accepted from these feeds.

`chart-bridge.js` is bundled local code running in MAIN world at document start. Its `fillText` observer preserves native drawing, is inactive until an overlay is enabled, and captures only numeric native chart axis coordinates. It uses no network or extension messaging. The isolated `native-overlay.js` validates the display-only geometry, requires a multi-label scale consensus, and hides stale/ambiguous scales. The shared DOM geometry cannot authorize trading. Draft drag events call the existing ticket draft setter; explicit Save / Arm remains required. No remotely downloaded code or extra host permission is used. A full Papertrade refresh is required after upgrading.

`npm run verify:wallet-overlay` checks synthetic stream data, name escaping, high-DPI alignment, chart movement, draft dragging, filters and stale hiding on the localhost fixture. `npm run verify:public-wallets` checks a real unpacked extension against public signed-out Papertrade data and native chart zoom/pan in a temporary profile; its hidden-tab transition is simulated because headless Chrome keeps tabs visible. These are read-only checks and do not certify funded execution.

The wallet decoder must handle both full `openPositions` snapshots and `baseAccountRevision` patches (`addedPositions`, `removedPositionIds`, partial `state`). A patch is accepted only against its exact account revision; gaps trigger a reconnect for a new full snapshot. Account revisions belong to the current stream baseline, so a new connection’s snapshot reinitializes that baseline. Unrelated wallet fields are discarded. Initial snapshots are not announced as freshly opened trades. Later position-set changes produce observed activity, including after reconnection, without guessing whether a removal was a manual close or liquidation. Wallet names and local aliases remain plain text in HTML/SVG; offscreen badges are explicitly marked as outside the native price viewport.

## Trade context and private journal

`trade-context-data.js` provides deterministic, side-aware entry comparisons, unit-based wallet exposure netting, bounded public-history parsing, exact BigInt fee subtraction, loaded-sample statistics and selective alert gating. It never returns an instruction to trade. Win-rate display requires 20 loaded closed trades; drawdown is closed-trade drawdown within the loaded sample.

`trade-context-panel.js` keeps public history in page memory and exposes explicit draft preparation, history pagination, alert context and the own-wallet journal. Draft preparation is guarded against existing edits and only changes the existing ticket fields. Wallet names/notes are rendered as text. Alert baselines use the feed publication kind: only incremental updates notify; snapshot/reconnect data remains informational. Sounds are local Web Audio, require a gesture and cannot interrupt the feed if audio fails.

`journal.js` runs in the worker. Requests require the native own-wallet trading tab and expected-owner matching; identity is rechecked across asynchronous reads/imports. Imports use canonical `/query/accounts/<owner>/trades?filter=all&limit=75` requests and validate units, ordering, IDs and cursors. Venue net results use `adjustedPnlRaw - userPaidFeeRaw`, matching the native history view; PAPER is separate. Entry targets require an exact owner/market/side/position match and recorded entry click, with ambiguous matches excluded. Notes/attribution are user-entered. `tradeJournalV1` is encrypted by private-storage.js, mutations are serialized, corrupted data is preserved, and the 1000-record limit never evicts notes silently. Clearing is per owner.

`npm run verify:trade-context` uses only a localhost fake venue: paired exposure, stale comparisons, draft-only preparation and edit guards, sample pagination, alerts/cooldowns/mutes/audio failure, journal fee/PAPER math, notes, export, two-step clear and late-response wallet switching. `verify:public-wallets` additionally loads real public closed-trade history from an unpacked signed-out extension. None of these checks place funded trades.

Wallet activity baselines reset on reconnect/retry/watch restart. Full snapshots are not observed trade events; only incremental changes against the current baseline produce moves. Alert receipt time is not a venue execution timestamp.

Leaderboard discovery merges into a maximum-ten personal watchlist instead of replacing it. Existing selected/alerts/alias values are authoritative; incoming public names may refresh. When only metadata changes, existing subscriptions continue. Run `npm run verify:watchlist` with the same Playwright environment as the other isolated browser verifiers.

`watchedExposure` derives current-asset base quantities from selected wallet projections and rejects unavailable/negative-age/30-second-stale feeds. A partial sample always exposes coverage. Chart minimum-size filters are intentionally excluded from this calculation to retain opposite legs. Direction counts reuse the per-wallet 10% gross imbalance threshold; concentration measures gross quantity, not directional conviction. The watchlist UI verifier also covers these invariants.

The native overlay receives an optional read-only `onSelectWallet` callback. Label activation forwards a wallet and only forwards a position ID when the label represents exactly one position. Wallet context validates current watch membership, keeps requested identity across reconnects, and leaves missing positions/wallets unselected. Neither activation nor focus restoration calls setDraft or native trading messages. Overlay keyboard focus is restored only for the same still-present label key.

Public wallet feeds share a page-local retry coordinator owned by the content module, retained across watch restarts and panel remounts within that document. Only 429 responses extend its deadline; healthy streams continue. New/reconnecting streams recheck remaining cooldown before fetching. Retries use upward jitter capped at 1 second, exponential backoff until 30 seconds of valid-stream health, a five-second floor for 429s, and the existing one-hour Retry-After cap. Initial-snapshot and transport-idle watchdogs are independent. All scheduling clocks/random/timers are injectable for deterministic lifecycle tests. This coordinator is not imported by trading execution.

`isFreshWalletState` is shared by public chart levels, observed moves, context, exposure and feed-health rendering: a validated live projection must have an array of positions and a receive age in [0, 30000) ms. Health rows are keyed by address and update text in place; receive-age changes are not live-announced. Unavailable draft controls expose an aria-describedby explanation. Wallet-panel focus/disabled styles do not change box dimensions.
