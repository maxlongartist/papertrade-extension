# Papertrade · Manual Pair & Limits

Adds **Open long + short**, **Close pair**, **limit entries**, and **stop loss / take profit** to Papertrade.

## Install it — no coding needed

1. **[Open the download page](https://github.com/maxlongartist/papertrade-extension/releases/latest).**
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
