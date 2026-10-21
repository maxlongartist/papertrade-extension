# Papertrade · Manual Pair & Limits

**Independent beta.** Read the first-run notice before using the trading controls.

Adds **Open long + short**, **Close pair**, **limit entries**, **stop loss / take profit**, **live trade tape**, and wallet **Trade context** tools to Papertrade.

## Privacy

**We do not collect your data.** There is no developer analytics, telemetry, advertising tracking, or automatic upload of wallet details or trading history. The extension reads the Papertrade page to operate your controls and stores trading records locally in your browser. Papertrade, Hyperliquid and the LiqFlow heatmap provider receive the requests needed to provide their services; anything you voluntarily share in a support report is separate.

**Execution depends on Papertrade congestion.** A trigger reaching its price does not mean the trade has filled. Busy queues can delay entries, pair opens/closes, stop losses and take profits; prices can move or liquidation can happen before execution. The extension cannot bypass the queue or guarantee a price or execution time.

## Install it — no coding needed

1. **[Open the download page](https://github.com/maxlongartist/papertrade-extension/releases/tag/v0.7.92).**
2. Under **Assets**, download the file named **`papertrade-manual-pair-v….zip`**. Skip the files called “Source code.”
3. **Unzip it.** Move the extracted folder somewhere you can keep it, such as Documents.
4. Open Chrome. Type **`chrome://extensions`** into the address bar and press Enter.
5. Turn on **Developer mode** in the top-right corner.
6. Click **Load unpacked**. Choose the extracted folder. It should have a file called **`manifest.json`** directly inside it.
7. Open **[Papertrade](https://exchange.papertrade.xyz/trade/btc)** and refresh the page. Connect your wallet on Papertrade as usual.

**Done.** The new controls appear below Papertrade's normal trading controls. You do not need to enter a private key.

Stuck? See the short [installation help](https://github.com/maxlongartist/papertrade-extension/blob/main/docs/INSTALL.md).

## Open and close a long + short pair

1. On Papertrade, choose your coin, margin, and leverage as usual.
2. Open Papertrade's **Positions** tab and leave it visible. Start with no open positions or pending trades.
3. In **Manual pair**, check the amount. **“Per leg” means per side:** $10 per leg uses $20 total.
4. Click **Open long + short** once. Wait for both the Long and Short boxes to show position IDs.
5. When you want to exit, click **Close pair**. Check Positions to confirm both have closed.

**Button greyed out?** Read the orange message underneath it. In the screenshot below, you need to open Papertrade's **Positions** tab.

[![Network queue and Manual pair controls on Papertrade](https://raw.githubusercontent.com/maxlongartist/papertrade-extension/main/docs/images/manual-pair.png)](https://github.com/maxlongartist/papertrade-extension/blob/main/docs/images/manual-pair.png)

The **Network queue** box estimates how busy Papertrade is. It does not tell you exactly when your trade will finish. A pair opens only when you click; it does not automatically repeat.

## Keep the chart comfortable

On desktop, the chart now sizes to the window instead of stretching to fit every tool. The sidebar scrolls on its own, so opening settings, loading wallet data or reading the tape keeps the chart and Positions in place. Native chart pan, zoom and resize handles still work.

The small bar at the top of the sidebar has **Trade**, **Indicators**, and **Wallets** shortcuts. They scroll the tools without scrolling the chart. **Fit layout** restores the automatic chart height and sidebar width after manual resizing. It does not reset chart prices, indicator settings or orders.

On narrow mobile screens, Papertrade's full-width chart and normal page scrolling are preserved. **Hide tools** still hides the extension panels and overlays without stopping existing order monitoring.

## EMA, VWAP and the liquidation heatmap

Find **Chart indicators** below the trading ticket. All three overlays start enabled for BTC and ETH. Use the checkboxes to hide any of them.

- **EMA:** purple line, 20 candles by default. Change the period (2–200) in **Indicator settings & sources**.
- **VWAP:** gold line, calculated from Hyperliquid candle typical prices and base volume, resetting at **midnight UTC**. The current candle is provisional. The interval selector (1m, 5m, 15m, 1h) applies to both indicators independently of the native chart.
- **Liquidation map:** green bands for open longs and red bands for open shorts, with bars at the right of the chart showing USDC notional relative to the largest visible bucket. These are **Hyperliquid liquidation buckets indexed by [LiqFlow’s node service](https://liqflow.app/docs)**. No Papertrade liquidation data is used or substituted. **Auto** adapts the displayed range to the visible price scale; a fixed range is also available. Provider buckets can be coarse (for example, hundreds of dollars wide for BTC); their original resolution is preserved rather than inventing precise levels.

The map polls every **5 minutes**, matching the provider’s approximate snapshot cadence; candles refresh every 15 seconds using incremental history requests after the initial load. The panel shows the actual snapshot age. Snapshots older than 15 minutes, malformed responses, denied access and failed map requests hide the map. Hidden tabs/tools pause these public requests; failed requests back off. Stale source data or unverified axes hide the affected overlays.

**Data key:** Open **Indicator settings & sources → LiqFlow data API key** to save a free read-only data key from [LiqFlow](https://liqflow.app/developers). This is separate from any wallet key. It stays in local browser storage and is sent only to `node.liqflow.app` in an API header. The provider begins requiring keys on **October 27, 2026**, with unauthenticated requests always refused from **November 1**. Without access, the heatmap shows an error; it never substitutes Papertrade data.

**Press the native LIVE / RESET button to align indicator lines.** Lines require three matching time ticks in a live view narrower than a day; historical panned views, date-only ticks and ambiguous time axes hide the curves. The liquidation map follows the verified price scale even when the time view is panned. A line outside the native price range is reported in the panel; choose a wider native timeframe and return to LIVE to see it. Missing candles break EMA lines, and incomplete session volume hides VWAP.

The heatmap is a **current snapshot projected across the chart**, not a history of liquidation changes, resting orders or a prediction. Positions outside the requested range are not drawn. Public data can be delayed. These overlays are read only and do not place trades or change your orders.

## Use the tape and trading ticket

The **Trade tape** sits directly above the compact **Trade** ticket. Both stay visible in the same sidebar space; the tape has its own scroll area.

1. Set **Margin · USDC** and **Leverage · ×** in the ticket. These prepare Papertrade’s native inputs without placing a trade. The notional estimate shows margin × leverage.
2. Choose an order type:
   - **Limit:** Long waits for your price or lower; Short waits for your price or higher.
   - **Market:** click to request an entry now using a fresh quote. Requests that cannot submit expire after 10 seconds and are discarded after a worker restart. A submitted trade may still be queued by Papertrade.
   - **Trigger:** Long waits for your price or higher; Short waits for your price or lower. Trigger entries must also pass the configured pre-click tolerance.
3. Enter the limit/trigger price. **Mid** copies the current mark. Market shows a live reference price instead.
4. Open **TP / SL · optional** to add absolute exit prices. **Trigger exits early · USD** requests exits that many dollars early; it does not guarantee the final fill.
5. Check the **Long / Short liquidation estimates** and sizing, then click **Buy / Long** or **Sell / Short** once.

**Execution settings** contains the price tolerance and legacy near-target option. These are pre-click checks; final fills still depend on Papertrade’s queue. Cross margin, reduce-only and GTC controls are not displayed because this ticket does not implement them.

Your saved entry appears under **Active orders**. Click **Cancel order** there to cancel an entry that is still waiting. Once a trade has been sent, cancelling a watch cannot undo it.

[![Limit entry with draggable Entry, SL and TP levels on the main chart](https://raw.githubusercontent.com/maxlongartist/papertrade-extension/main/docs/images/limit-entry.png)](https://github.com/maxlongartist/papertrade-extension/blob/main/docs/images/limit-entry.png)

**Already have a position?** Click **Add/Edit SL/TP** on its row in Positions. Or expand **SL / TP for an existing position**, click **Load open positions**, choose yours, enter the exit prices, and click **Arm SL / TP on selected position**. This protects that position without opening another one. A price already past your exit level may cause an immediate Close request.

*Screenshots show example settings. Click either picture to view it full-size.*

**Hide the extension:** click **Hide tools** on the fixed button at the sidebar edge. It hides the extension panels and chart overlays; active order monitoring keeps running. The button changes to **Show tools** so you can bring everything back. Your choice is remembered across refreshes.

## See who is trading

The **Trade tape** above the trading ticket shows Papertrade’s public opens, closes and liquidations as they arrive. It has a fixed-height scroll area, so the trading ticket stays directly beneath it. It works without connecting a wallet.

- Choose the current coin or **All markets**, then filter by trade type and minimum notional size.
- Each row shows side, action, size, price, leverage, reported trade PnL and wallet. Wallet names load when available; click a wallet for its full address and position ID. Narrow sidebars put price, leverage and PnL on a second line.
- **Pause** freezes the display while new events continue buffering. **Resume** shows the latest rows. **Live feed** disconnects or reconnects the tape. Hidden tabs stop receiving events.
- Last-minute long/short totals follow your filters. They include exits when those are selected; they are not a buy/sell signal. Initial coverage and connection gaps are labeled partial. There is no history backfill.

The tape keeps recent events in page memory, shows up to 200 rows and saves only your display preferences locally. It cannot place or copy a trade.

## See public wallet positions on the chart

1. Find **Public wallet levels** below the trading controls. Turn on **Watch public wallets**.
2. Open **Wallets & filters** and click **Add top wallets**, or enter a public wallet address. The period menu chooses the leaderboard used for that click. New wallets fill free slots in your list; saved wallets, custom names, watch selections and alert choices stay. The list holds up to 10 wallets—use **×** beside one to make room.
3. Turn on **Show levels on main chart**. Names are printed on the chart beside each wallet’s levels: green for long, red for short. Hover for full position details. Positions belonging to the same wallet are grouped when nearby; different wallets keep their own labels. Positions outside the visible price range appear in a named ↑/↓ list. You can also show liquidation levels or filter out small positions.
4. Click a wallet name in the list to open its public Papertrade portfolio. Uncheck a wallet to hide it, or turn watching off to stop the feeds.

The chart and **Wallet moves** log update when public snapshots or incremental position changes arrive from Papertrade. Recent opens, changes and positions no longer open also appear on the chart for 30 seconds. The log keeps up to 60 observed changes in page memory and displays recent changes for two minutes; it is not a complete trade history. Initial snapshots show existing positions without presenting them as new trades. A position disappearing does not tell us whether it was closed manually or liquidated.

Wallets use their public Papertrade name when available, otherwise a short address. You can type your own label under **Wallets & filters**. Entry lines stay at the actual entry price; they do not follow every BTC tick. Lines are added/removed when positions change. Updates show when the data was observed, not a guaranteed execution timestamp.

These are public open positions from the selected wallets, not everyone’s orders. Their private SL/TP settings are unavailable. Rankings are snapshots of Papertrade’s windowed PnL and do not predict performance. Updates pause in hidden tabs; stale or disconnected feeds are hidden from the chart. The list still works when chart mapping is unavailable. No developer collects this data.

**Want to move your own levels?** **Drag my ticket drafts on main chart** is enabled by default. You can turn it off; saved choices are preserved. Enter draft prices in Limit entry (or select your existing position’s exits), then drag Entry, SL or TP on the main chart. You can focus a handle and use ↑/↓ for $1 changes. Hold Shift while dragging for finer changes. **Dragging does not save or arm an order.** Use the ticket’s Save / Set trigger / Arm button when ready. Existing position entry prices cannot be moved. The TP line also shows estimated gross profit at that exact target, updated as you drag or change size, leverage or direction. This excludes fees, early exit lead and slippage; actual profit can differ. Missing size information shows an unavailable estimate.

If levels are missing, pan or zoom the native chart. The extension hides lines when it cannot verify the current price scale. Refresh Papertrade after updating the extension so the chart observer loads.

Pair controls show an execution progress path, separate native clicks from identified positions, and flag incomplete pairs or one remaining leg. Exposure and PnL remain estimates; position disappearance is not proof of settlement.

## Understand a wallet move before trading

Click a wallet name in the position list to open **Trade context**. You can also expand that section and choose a wallet.

- **Positioning:** see its net long/short exposure and how much is paired within that wallet. Hedges in other accounts are unknown.
- **Compare an entry:** see the current mark compared with the watched entry, the position’s age, and when this page first saw it. “Worse” means a higher long entry or a lower short entry. A stale price pauses the comparison.
- **Wallet closed-trade sample:** load recent records, then optionally load older ones. Results subtract the venue’s user-paid fees and keep PAPER separate. Statistics describe the loaded sample; win rate stays unavailable below 20 loaded closed trades.
- **Prepare my entry draft:** fills the entry direction/price using your own native margin and leverage, with empty exits. Review it in the ticket and use **Set trigger** to arm it. Preparing a draft submits nothing and will not overwrite an existing order/exit edit.

## Move your wallet list to another installation

1. Open **Wallets & filters → Back up / import wallet list** and click **Download wallet list**.
2. In the other installation, open the same section and choose that JSON file.
3. Review the wallet names, addresses and choices, then click **Add wallets from this backup**.

The import adds wallets without replacing settings for addresses already saved. It restores names, custom labels, watch selections and per-wallet alert choices for new addresses. If the combined list would exceed 10 wallets, remove some saved wallets first; the import does not add a partial list. To restore a backup’s settings for an existing address, remove that address before importing.

Importing does not change the main watching switch. If watching is already on, selected additions start public feeds; a fresh installation stays off until you enable watching. Backups contain public wallet addresses and your labels, so review before sharing. They contain no keys, orders or journal entries. Files are read locally and are never uploaded by this extension.

## When wallet feeds disconnect or get rate limited

Wallet feeds reconnect automatically with increasing, staggered delays. A connection has to remain healthy for 30 seconds before its retry backoff resets. If a feed receives HTTP 429, other wallet-feed reconnects on the same page wait for the shared cooldown. Turning watching off and on, or rebuilding the panel on the same page, keeps that cooldown. Existing healthy streams continue running.

Open **Wallet feed health** to see each wallet’s live, connecting, stale, paused, not-watched or retrying state. A retry countdown and reason identify exactly which wallet is unavailable. The status line shows the retry reason and next attempt time. Missing feeds are excluded from **Watched exposure** until fresh snapshots arrive. A connection that sends only heartbeats without an initial snapshot times out after 30 seconds. These delays apply to optional public wallet feeds; they do not delay limit/SL/TP checks or native trading actions. Separate tabs have separate cooldowns.

## Inspect a wallet from the chart

Click a wallet’s chart label to open **Trade context** for that position. Labels in **Outside price view** work too. You can also focus a label with Tab and press Enter or Space.

A grouped label opens that wallet and explains how to choose a position under **Compare an entry**. If the inspected position closes or the wallet is no longer watched, the details stay unavailable until you choose another; they do not silently substitute a different position or wallet. Clicking a label only opens details—it does not change your ticket or submit a trade. If **Prepare my entry draft** is disabled, the text beneath it explains why. Your own draft levels remain draggable.

## See the watched-wallet overview

With public wallet watching enabled, **Watched exposure** shows long/short quantities, net quantity, how many wallets lean each way, and the largest wallet’s share of gross exposure. The colored bar compares long and short quantities for the current asset.

The feed count tells you how much of your selected list is current. Missing or stale feeds are excluded and labeled as a partial sample. A wallet with no current positions on this asset counts as flat. Near-balanced means its net quantity is under 10% of its gross quantity. The chart’s minimum-size filter does not apply here, so small opposite legs remain included. These totals describe your watched sample; they are not a market-wide indicator or a prediction.

## Choose wallet alerts

Open **Wallet alerts** and enable in-page alerts. Choose event types, a minimum changed notional and a cooldown. Under **Wallets & filters**, each wallet has its own **Alerts** checkbox.

Alerts can cover new positions, positions no longer open, increases in gross exposure, and net direction reversals. Alerts show the asset, direction, position IDs and time received. Initial/reconnect snapshots reset the observation baseline; changes made during a gap are not presented as fresh live moves or alerted. A removal does not tell us whether a position was manually closed or liquidated. Sounds are optional and require a click in the panel after refreshing. Keep the tab visible; these are browser alerts, not a background notification service.

## Review your own results

1. Connect your own wallet on Papertrade and expand **My local journal**.
2. Click **Refresh venue history** to save recent closed trades locally. Use **Load older trades** for more history.
3. Select a closed trade, optionally tag the wallet you followed, add notes, and click **Save note / attribution**.
4. Review net trading results, user-paid venue fees, entry/exit prices and results grouped by your own tags. Entry deviation is shown only when an exact, unambiguous saved entry record can be matched to that position. A tag records your attribution; it does not establish that a wallet caused your result.
5. **Export journal** downloads your saved records and notes. Review the file before sharing. **Clear saved journal for this wallet** requires a second click and removes only that wallet’s local journal.

The journal uses the same profile encryption as trading records. It holds up to 1000 closed trades; imports stop at the limit rather than silently deleting notes. Net results cover the reported trade PnL and user-paid venue fee, excluding gas/transfer or unreported costs. Venue-reported PnL may include queued proceeds and is not proof of spendable balance. PAPER rewards are shown separately. Public data, sample statistics and wallet activity do not establish a profitable strategy.

## Keep this in mind

- **Keep Chrome and the Papertrade tab open, your wallet authorized, and Positions visible.** The extension cannot watch prices or request trades with the browser closed.
- **These triggers send market orders.** The final price may differ from your target. Long and short are separate requests; a pair can still lose money.
- **“Unconfirmed” means check Papertrade's Positions and Status.** Do not assume a missing reply means no trade was sent.
- Limit entries and SL/TP currently support BTC and ETH. Do not run multiple copies of the extension or other trading bots alongside it.

## Updating later

Download and unzip the new version. Copy its files into the **same folder you already installed**, replacing the old files. Then click **Reload** on the extension at `chrome://extensions` and refresh Papertrade.

**Keep that original folder and extension.** Installing another copy will not bring over your saved orders. Manage live positions in Papertrade while updating, because extension monitoring pauses during Reload.

---

Want to build from source? See [developer notes](https://github.com/maxlongartist/papertrade-extension/blob/main/docs/DEVELOPMENT.md).


[Privacy policy](https://github.com/maxlongartist/papertrade-extension/blob/main/PRIVACY.md) · [Report a problem](https://github.com/maxlongartist/papertrade-extension/issues/new/choose)
