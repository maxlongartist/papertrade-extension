# Papertrade · Manual Pair & Limits

**Independent beta.** Read the first-run notice before using the trading controls.

Adds **Open long + short**, **Close pair**, **limit entries**, **stop loss / take profit**, and wallet **Trade context** tools to Papertrade.

## Privacy

**We do not collect your data.** There is no developer analytics, telemetry, advertising tracking, or automatic upload of wallet details or trading history. The extension reads the Papertrade page to operate your controls and stores trading records locally in your browser. Papertrade and Hyperliquid receive the normal requests needed to provide their services; anything you voluntarily share in a support report is separate.

**Execution depends on Papertrade congestion.** A trigger reaching its price does not mean the trade has filled. Busy queues can delay entries, pair opens/closes, stop losses and take profits; prices can move or liquidation can happen before execution. The extension cannot bypass the queue or guarantee a price or execution time.

## Install it — no coding needed

1. **[Open the download page](https://github.com/maxlongartist/papertrade-extension/releases/tag/v0.7.80).**
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

## Set a limit entry, stop loss, or take profit

1. In **Limit entry**, choose **Long** or **Short**.
2. Type your entry price into **Limit price · USD**. With the default **Limit price or better**, Long waits for that price or lower; Short waits for that price or higher.
3. **Entry tolerance · USD** is the allowed worse price just before the extension clicks. The final trade price can still differ.
4. **Stop loss** asks to exit when the price moves against you; **take profit** asks to exit when it moves in your favor. Want either one? Open **TP / SL · optional** and enter your **Stop loss price** and/or **Take profit price**. These fields take the coin's price, not your desired profit or loss amount.
5. **Trigger exits early · USD** tells the extension to request the exit that many dollars before your SL/TP price. It cannot guarantee the final exit price.
6. Check the margin and leverage shown above the button. Click **Set long trigger** or **Set short trigger**.

Your saved entry appears under **Active orders**. Click **Cancel order** there to cancel an entry that is still waiting. Once a trade has been sent, cancelling a watch cannot undo it.

[![Limit entry form with optional stop loss and take profit fields](https://raw.githubusercontent.com/maxlongartist/papertrade-extension/main/docs/images/limit-entry.png)](https://github.com/maxlongartist/papertrade-extension/blob/main/docs/images/limit-entry.png)

**Already have a position?** Click **Add/Edit SL/TP** on its row in Positions. Or expand **SL / TP for an existing position**, click **Load open positions**, choose yours, enter the exit prices, and click **Arm SL / TP on selected position**. This protects that position without opening another one. A price already past your exit level may cause an immediate Close request.

*Screenshots show v0.7.63 with example settings. Click either picture to view it full-size.*

## See public wallet positions on the chart

1. Find **Public wallet levels** below the trading controls. Turn on **Watch public wallets**.
2. Open **Wallets & filters** and click **Add top wallets**, or enter a public wallet address. The period menu chooses the leaderboard used for that click. New wallets fill free slots in your list; saved wallets, custom names, watch selections and alert choices stay. The list holds up to 10 wallets—use **×** beside one to make room.
3. Turn on **Show levels on main chart**. Names are printed on the chart beside each wallet’s levels: green for long, red for short. Hover for full position details. Positions belonging to the same wallet are grouped when nearby; different wallets keep their own labels. Positions outside the visible price range appear in a named ↑/↓ list. You can also show liquidation levels or filter out small positions.
4. Click a wallet name in the list to open its public Papertrade portfolio. Uncheck a wallet to hide it, or turn watching off to stop the feeds.

The chart and **Wallet moves** log update when public snapshots or incremental position changes arrive from Papertrade. Recent opens, changes and positions no longer open also appear on the chart for 30 seconds. The log keeps up to 60 observed changes in page memory and displays recent changes for two minutes; it is not a complete trade history. Initial snapshots show existing positions without presenting them as new trades. A position disappearing does not tell us whether it was closed manually or liquidated.

Wallets use their public Papertrade name when available, otherwise a short address. You can type your own label under **Wallets & filters**. Entry lines stay at the actual entry price; they do not follow every BTC tick. Lines are added/removed when positions change. Updates show when the data was observed, not a guaranteed execution timestamp.

These are public open positions from the selected wallets, not everyone’s orders. Their private SL/TP settings are unavailable. Rankings are snapshots of Papertrade’s windowed PnL and do not predict performance. Updates pause in hidden tabs; stale or disconnected feeds are hidden from the chart. The list still works when chart mapping is unavailable. No developer collects this data.

**Want to move your own levels?** **Drag my ticket drafts on main chart** is enabled by default. You can turn it off; saved choices are preserved. Enter draft prices in Limit entry (or select your existing position’s exits), then drag Entry, SL or TP on the main chart. You can focus a handle and use ↑/↓ for $1 changes. Hold Shift while dragging for finer changes. **Dragging does not save or arm an order.** Use the ticket’s Save / Set trigger / Arm button when ready. Existing position entry prices cannot be moved.

If levels are missing, pan or zoom the native chart. The extension hides lines when it cannot verify the current price scale. Refresh Papertrade after updating the extension so the chart observer loads.

Pair controls show an execution progress path, separate native clicks from identified positions, and flag incomplete pairs or one remaining leg. Exposure and PnL remain estimates; position disappearance is not proof of settlement.

## Understand a wallet move before trading

Click a wallet name in the position list to open **Trade context**. You can also expand that section and choose a wallet.

- **Positioning:** see its net long/short exposure and how much is paired within that wallet. Hedges in other accounts are unknown.
- **Compare an entry:** see the current mark compared with the watched entry, the position’s age, and when this page first saw it. “Worse” means a higher long entry or a lower short entry. A stale price pauses the comparison.
- **Wallet closed-trade sample:** load recent records, then optionally load older ones. Results subtract the venue’s user-paid fees and keep PAPER separate. Statistics describe the loaded sample; win rate stays unavailable below 20 loaded closed trades.
- **Prepare my entry draft:** fills the entry direction/price using your own native margin and leverage, with empty exits. Review it in the ticket and use **Set trigger** to arm it. Preparing a draft submits nothing and will not overwrite an existing order/exit edit.

## Inspect a wallet from the chart

Click a wallet’s chart label to open **Trade context** for that position. Labels in **Outside price view** work too. You can also focus a label with Tab and press Enter or Space.

A grouped label opens that wallet and explains how to choose a position under **Compare an entry**. If the inspected position closes or the wallet is no longer watched, the details stay unavailable until you choose another; they do not silently substitute a different position or wallet. Clicking a label only opens details—it does not change your ticket or submit a trade. Your own draft levels remain draggable.

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
