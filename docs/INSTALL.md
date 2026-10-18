# Install Papertrade · Manual Pair & Limits

## First installation from a release

1. Open this repository's [Releases page](https://github.com/maxlongartist/papertrade-extension/releases) and download the versioned `papertrade-manual-pair-vVERSION.zip` asset. Use that asset rather than GitHub's automatically generated **Source code (zip)**.
2. Extract the ZIP. Move the extracted files into a permanent folder, for example `Documents/Papertrade Extension`. Keep that folder in place while the extension is installed.
3. Open `chrome://extensions` in Chrome. Enable **Developer mode** in the upper-right corner.
4. Click **Load unpacked** and select the folder that directly contains `manifest.json`, `content.js`, `worker.js`, `popup.html`, and `popup.js`. Do not select the ZIP or a parent folder containing another nested folder.
5. Open or refresh `https://exchange.papertrade.xyz/trade/btc`. The extension controls appear beneath the native trading ticket, with the donation card above Network queue. The queue footer shows the installed version.
6. Connect/authorize your wallet using Papertrade's native interface. The extension does not ask for a private key. Keep native Positions visible. Review the readiness reason before requesting a trade; loading the extension alone does not start a farming loop.

Chrome may display its standard developer-mode warnings for unpacked extensions. This project is loaded locally; it is not installed from the Chrome Web Store.

## Update an existing installation

Preserve the **same installed folder and extension ID** so the existing Chrome storage remains accessible.

1. Check native Positions and Status and export relevant execution history before maintenance. Browser monitoring is interrupted while reloading. Reconcile pending submissions and manage any live positions in the native interface during that interruption.
2. Extract the new release into a temporary folder.
3. Copy the new package's files into the folder already used by the installed extension, replacing the old package files. Do not install the new release as an additional extension.
4. In `chrome://extensions`, click **Reload** on the existing Papertrade extension card.
5. Refresh every Papertrade tab. An old tab may otherwise show **Refresh Papertrade to reconnect**.
6. Confirm the version in the queue footer and check saved watches, pair tracking, native Positions, and Status. Restoring an identified pair may be required after losing its original tab session. Restore validates the original wallet/market/IDs and sends no trade.

Do not delete the original extension, switch Chrome profiles, or clear its storage to resolve an update issue while relying on its saved protection. Separate extension identities cannot share their saved records.

## Install or update from source

Clone the repository and build it with Node.js 22+:

```sh
git clone https://github.com/maxlongartist/papertrade-extension.git
cd papertrade-extension
npm ci
npm test
npm run build
```

For a first installation, **Load unpacked** the generated `dist/` folder. For subsequent source updates in that same clone:

```sh
git pull --ff-only
npm ci
npm test
npm run build
```

Then Reload the existing extension and refresh Papertrade. If your existing installation points elsewhere, copy the generated `dist/` files into that existing folder instead of creating a second installation. The source `extension/` directory is not bundled and must not be loaded directly.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| “Manifest file is missing or unreadable” | Extract the ZIP and select the directory that directly contains `manifest.json`. For source builds, select `dist/`. |
| No extension controls | Enable the extension, refresh a `/trade/btc` or `/trade/eth` page, use the English desktop interface, and verify the queue-footer version. |
| “Extra Papertrade extension controls detected” | Keep the original installed copy, disable additional copies, and refresh Papertrade. The current version cannot stop an older extension from acting independently. |
| “Refresh Papertrade to reconnect” | Reload the extension if needed, then refresh the affected Papertrade tab. Check native Positions and Status for pending actions. |
| Open is disabled | Read the readiness reason. Confirm wallet authorization, native margin/leverage settings, enough collateral for both legs, no competing watches, and a complete flat account view with no pending requests. |
| Price/queue is stale or unavailable | Keep the trading tab visible and check connectivity. Queue data is advisory and is not an individual order ETA. |
| Entry or Close stays unconfirmed | Inspect native Positions and Status. A missing response does not prove cancellation; do not assume an uncertain submission is safe to repeat. |
| Saved records seem missing after updating | Check that this is the same Chrome profile, installed folder, and extension ID. Do not remove the original copy; a new copy cannot read its storage. |
| No clipboard access for the donation address | Select the full public address shown in the donation card and copy it manually. The button only copies text and never opens a wallet transaction. |

## While using conditional entries or exits

Keep Chrome and the relevant tab open, Positions visible, and your wallet authorized. The extension watches browser data and requests market actions; it cannot host orders at the exchange or guarantee execution while offline. Early triggers and narrow tolerance do not guarantee the final fill price. Manual long and short requests are separate, so a pair is not an atomic hedge. Read the current [README](../README.md) before funded use.
