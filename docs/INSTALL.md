# How to install it

**You only need Chrome and the ZIP download. No coding or terminal commands.**

1. **[Click here to open the download page](https://github.com/maxlongartist/papertrade-extension/releases/tag/v0.7.84).**
2. Find **Assets**. Click it if the file list is closed.
3. Download **`papertrade-manual-pair-v….zip`**. Do not choose either “Source code” file.
4. **Unzip the download.** On a Mac, double-click the ZIP. On Windows, right-click it and choose **Extract All**.
5. Move the extracted folder into **Documents** or another place where you will keep it. Don't delete or move that folder after installing.
6. Open Chrome. Paste **`chrome://extensions`** into the address bar and press Enter.
7. Switch on **Developer mode** in the top-right corner.
8. Click **Load unpacked**.
9. Select the extracted folder. **That folder must directly contain `manifest.json`.** If you see another folder inside it, open that inner folder and check there.
10. Open **[Papertrade](https://exchange.papertrade.xyz/trade/btc)** and refresh the page. Connect your wallet on Papertrade as usual.

On your first trading-page visit, read the notice, tick the agreement box, then click **Continue to trading controls**.

**You're ready.** Look below Papertrade's normal trading controls for Network queue, Manual pair, and Limit entry. The extension does not need your private key.

**Next: [See how to use it, with screenshots](../README.md#open-and-close-a-long--short-pair).**

**Execution depends on Papertrade congestion.** A trigger reaching its price does not mean the trade has filled. Busy queues can delay entries, pair opens/closes, stop losses and take profits; prices can move or liquidation can happen before execution. The extension cannot bypass the queue or guarantee a price or execution time.

## If something goes wrong

**“Manifest file is missing or unreadable”**

You selected the wrong folder, or the ZIP is still zipped. Unzip it, then select the folder containing `manifest.json`.

**I downloaded “Source code” and can't find the right files.**

Go back to [the download page](https://github.com/maxlongartist/papertrade-extension/releases/tag/v0.7.84). Get `papertrade-manual-pair-v….zip` under Assets instead.

**Nothing appears on Papertrade.**

Check that the extension is switched on at `chrome://extensions`. Open the BTC or ETH trading page, use the English desktop interface, and refresh it.

**The Open button is grey.**

Read the orange text underneath it. Open Papertrade's **Positions** tab and keep it visible. For a new pair, you also need a connected wallet, enough money for both sides, and no existing positions or pending trades.

**It says “Refresh Papertrade to reconnect.”**

Refresh that Papertrade tab. If you just updated the extension, refresh every Papertrade tab you have open.

**It says there are extra extension controls.**

You may have two copies installed. At `chrome://extensions`, keep your original copy and switch off the extra copy. Then refresh Papertrade.

**A trade says “unconfirmed.”**

Check Papertrade's own **Positions** and **Status** tabs before trying again. A missing reply does not mean the trade was cancelled.

## How to update

1. Check your live positions and pending trades in Papertrade first. Extension monitoring pauses while you update.
2. Download and unzip the new version.
3. Copy the new files into the **same folder you installed before**. Replace the old files.
4. Open `chrome://extensions` and click **Reload** on the existing extension.
5. Refresh your Papertrade tabs. Check that your saved orders and positions are shown correctly.

**Don't install a second copy or remove the original extension.** Your saved orders belong to that original extension and Chrome profile.

## Building it yourself?

You can skip this if you downloaded the ready-to-install ZIP. Source-build commands are in the [developer notes](DEVELOPMENT.md).


## Moving from an unpacked copy to the Chrome Web Store

A Store installation is a separate copy. Your old saved orders and pair tracking will not transfer automatically. Reconcile live positions and pending actions using the original copy and Papertrade first, then disable the original copy before installing the Store copy. Explicitly set up the protection you need in the new copy. Do not run both copies together.
