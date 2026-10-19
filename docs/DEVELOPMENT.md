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
