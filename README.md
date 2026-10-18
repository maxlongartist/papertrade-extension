# Papertrade · Manual Pair & Limits

Chrome extension that adds manual long/short pairs, conditional entries, and stop-loss / take-profit controls to [Papertrade](https://exchange.papertrade.xyz/).

- **Manual pair:** one click requests a long and short using the native asset, margin per leg, and leverage. Close pair targets the two tracked positions, including identified late fills.
- **Conditional entries:** limit-price-or-better and near-target modes, editable tolerance, editing and cancellation.
- **Position protection:** optional SL/TP for extension entries or an existing native position; configurable early trigger.
- **Visibility:** live price references, advisory network queue, pair state, history export, and stable live-text areas.
- **Optional donations:** a public address and copy button above Network queue.

No private key is collected. Connect and authorize your wallet through Papertrade's own interface.

## Install

**Start here: [Installation, updating, and troubleshooting](docs/INSTALL.md).**

For a ready-to-load package, download `papertrade-manual-pair-vVERSION.zip` from [Releases](https://github.com/maxlongartist/papertrade-extension/releases), extract it, and select the extracted folder with **Load unpacked** at `chrome://extensions`. The selected folder must directly contain `manifest.json`.

GitHub's green **Code → Download ZIP** contains source code, not a built extension. Build that source using the developer instructions below.

## Use

1. Open a supported native market route, such as `https://exchange.papertrade.xyz/trade/btc`. Use the English desktop interface, connect your wallet, and keep native Positions visible.
2. For a manual pair, start with no open positions or pending requests. Choose margin **per leg** and leverage in Papertrade's native ticket. Check the displayed total margin and readiness reason, then click **Open long + short** once.
3. Inspect the per-leg IDs and status. Click **Close pair** to request closure of those tracked legs. There is no repetition or automatic holding timer.
4. For a conditional entry, choose side, price, behavior, and tolerance, optionally enter SL/TP, then save the trigger. Use its **Cancel order** control to cancel a waiting entry. A submitted venue action cannot be recalled by cancelling a watch.
5. To protect an existing position, use **Add/Edit SL/TP** on its native row or **SL / TP for an existing position** in the extension. Save explicitly applies the protection and may immediately request Close if a threshold is already crossed. Removing protection leaves the position open.

Manual pairs use native market routes with standard rendered position rows. Conditional entries and SL/TP currently support BTC/ETH. Saved tracking is bound to the originating wallet, market, and tab session. Restore can reconnect known position IDs after validation; it does not open a new trade.

## Execution limits

These are **browser-monitored conditional market actions**, not exchange-hosted limit or stop orders. Keep Chrome, the relevant trading tab, native Positions, and wallet authorization available. Closing the tab, stale data, wallet prompts, a changed page layout, or relayer congestion can prevent or delay execution. Tight entry tolerance and early SL/TP triggers do not guarantee a fill price.

A pair uses two separate requests rather than an atomic hedge. Different fills can leave residual exposure. Cash break-even, token rewards, profitability, and settlement timing are not guaranteed. Gross estimates exclude fees, funding, slippage, and rewards. An unknown submitted action is not automatically repeated; check native Positions and Status before intervening.

The extension stores its watches and pair tracking in local Chrome extension storage. A separately installed copy cannot read the original copy's storage. Keep the same installed folder and extension ID when updating, and refresh Papertrade after Reload. Do not run competing trading automation.

## Develop

Requires Node.js 22 or newer and npm. From this repository:

```sh
npm ci
npm test
npm run build
```

Load the generated `dist/` folder in Chrome using the installation guide. `extension/` contains source modules; it is not the unpacked build. The build requires no wallet credentials.

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

Other `verify:*` commands are listed in `package.json`. Some inspect public signed-out venue pages in temporary profiles; these are not funded execution certification. Historical implementation and verification details are in [development history](docs/DEVELOPMENT-HISTORY.md).

`npm run release` builds, runs the suite, and creates a ZIP with `manifest.json` at its root. It writes versioned packages beside the repository and in `~/Downloads`, plus a ZIP-only latest alias. Existing versioned packages are immutable; increment the version in `package.json`, `package-lock.json`, and `extension/manifest.json` before changing a released payload. It does not overwrite installed extension folders or read bot credentials.

## GitHub username changes

This repository uses `maxlongartist/papertrade-extension`. For an existing clone with an outdated URL:

```sh
git remote -v
git remote set-url origin https://github.com/maxlongartist/papertrade-extension.git
git remote -v
```

Changing a remote URL does not rewrite commit history. See [GitHub's remote-management guide](https://docs.github.com/en/get-started/git-basics/managing-remote-repositories).
