# Chrome Web Store draft — beta

This is prepared copy, not a claim that the extension has been submitted or approved.

**Name:** Papertrade · Manual Pair & Limits

**Short description:** Manual long/short pairs, conditional entries and optional SL/TP on Papertrade. Keep the trading tab open.

**Category:** Select the available category that best matches trading/productivity; verify the actual dashboard choices.

**Single purpose:** Add user-configured manual pair and conditional trading controls to Papertrade's trading pages, with the status information needed to operate those controls.

## Detailed description

Independent beta trading controls for Papertrade:

• Open one long and one short using the native market, margin per leg and leverage.
• Request Close for the two tracked pair positions, including identified late fills.
• Set conditional BTC/ETH entries and optional stop loss / take profit, including protection for existing positions.
• Inspect position IDs, execution observations, history and advisory network queue data.

We do not collect your data: no usage analytics, developer telemetry, or automatic upload of wallet details or trading history. Saved trading records are encrypted locally in your Chrome profile. The extension does not read private keys. Connect and authorize your wallet through Papertrade.

Execution depends on Papertrade congestion. A trigger reaching its price does not mean the trade has filled. Busy queues can delay entries, pair opens/closes, stop losses and take profits; prices can move or liquidation can happen before execution. The extension cannot bypass the queue or guarantee a price or execution time.

Keep Chrome and the trading tab open, native Positions visible, and your wallet authorized. Triggers request market actions, not exchange-hosted limit/stop orders. Prices, timing, fills, profits and protection are not guaranteed. A long/short pair uses separate requests and can still lose money. If a submission is unconfirmed, check native Positions and Status before trying again.

This beta has automated and simulated browser tests. It is not a funded-execution certification. It is an independent project, not affiliated with or endorsed by Papertrade or Hyperliquid.

Already using an unpacked copy? A Store install has a separate extension identity and cannot import that copy's saved tracking automatically. Reconcile positions and watches in the old copy, disable that copy, then install and explicitly configure the Store copy. Do not run both together.

## Links

- Homepage / guide: https://github.com/maxlongartist/papertrade-extension
- Support: https://github.com/maxlongartist/papertrade-extension/issues
- Privacy: https://github.com/maxlongartist/papertrade-extension/blob/main/PRIVACY.md

## Permission explanations

- `storage`: Persist user-configured watches, pair tracking, encryption-key-backed records, and first-run acknowledgement in the local Chrome profile. Temporary tab bindings use session storage. The nonextractable record key is in extension-origin IndexedDB.
- `alarms`: Wake the worker to refresh public venue information and check existing tracking. This does not guarantee continuous execution when the browser/tab is unavailable.
- `https://exchange.papertrade.xyz/*`: Read the native Papertrade ticket/account/positions and public venue metadata; operate exact native trade controls for user-configured actions and bind them to their managing tab.
- `https://api.hyperliquid.xyz/*`: Subscribe to public BTC/ETH market data used by conditional triggers and display.
- `https://stream.papertrade.xyz/*`: Read public network/queue information for advisory status display.

**Remote code:** No. All executable extension code is bundled. Connections above carry market/venue/queue data, not downloaded executable code.

## Privacy practices draft

Disclose the local handling of financial/payment information, public wallet identifiers, Papertrade website content and trade form data. Explain that there is no developer-server collection and that public data services receive ordinary connection metadata. Match the available checkbox labels in the live dashboard; do not select “no user data handled.”

Do not certify the final dashboard statements blindly. Verify them against PRIVACY.md, the upload, and Google's current policies. Publisher identity/contact/trader declarations must be supplied or confirmed by the account owner. No names, addresses or contact emails should be inferred from a signed-in account screenshot.

## Distribution and review

Start with an unlisted beta or a restricted tester group, depending on available dashboard controls. Unlisted is not access control: a recipient may forward the link. Leave submission and public availability pending owner review.

Reviewer steps: open a BTC/ETH Papertrade page, read/agree to setup, inspect the data/Positions status, and open the toolbar overview. Wallet authorization and funded position execution require a reviewer-controlled account; no private key or funded test credential is supplied. Simulated tests and a manual validation checklist are in this repository.

The optional liquidation heatmap uses Hyperliquid node snapshots indexed by LiqFlow, a separate third-party data provider. Its source and snapshot age are displayed; provider buckets are preserved, and the map never substitutes Papertrade positions. It requires access to node.liqflow.app and supports a user-supplied read-only provider data key stored locally. Provider errors and stale data hide the map. No developer analytics or telemetry is added.
