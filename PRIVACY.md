# Privacy policy — Papertrade Manual Pair & Limits

Effective date: October 19, 2026

This independent extension adds manual pair controls and conditional trading tools to Papertrade. It is not an official Papertrade or Hyperliquid product. The developer is the GitHub account [maxlongartist](https://github.com/maxlongartist). Questions and privacy requests can be made through [the project's support page](https://github.com/maxlongartist/papertrade-extension/issues). Do not post private keys, seed phrases, account screenshots, or sensitive trading details in a public issue.

## No developer data collection

**We do not collect your data.** We have no usage analytics or developer telemetry and do not automatically receive your wallet details, balances, positions, order watches or trading history. There is no developer-operated data collection server. Trading records stay locally in your Chrome profile unless you choose to export and share them.

## Information used locally by the extension

On Papertrade trading pages, the extension reads the public wallet address shown by Papertrade; available balance; native trade settings; rendered positions, their IDs, margin, leverage, entry/mark prices and displayed status; and public price/queue information. It uses these values to bind actions to the intended wallet, market, position and tab, show estimates, and request the actions you configure.

Optional public-wallet watching requests the public addresses you select from Papertrade’s public account leaderboard and position event streams. The extension keeps the selected public addresses, display names, filters and overlay preferences locally. Public position snapshots are held in page memory and discarded when watching stops; unrelated balances, session-key records and operations from public responses are not retained. Watching is off by default and requires its own opt-in.

The optional main-chart overlay reads numeric axis labels drawn by Papertrade’s chart canvas. A bundled page-world observer captures chart geometry only while an overlay is enabled. The geometry channel is display-only and cannot request trades. Dragging your own levels edits local ticket drafts; Save or Arm is still required.

It keeps local order watches, pair tracking/history, execution observations, and a first-run acknowledgement. Tab IDs and random session bindings identify the managing Papertrade tab; the extension does not keep a general browsing history. It does not read wallet private keys, seed phrases, or wallet passwords.

## Storage and encryption

Trading-record values are encrypted using AES-256-GCM before writing them to Chrome local extension storage. A nonextractable Web Crypto key is retained in the extension's IndexedDB within that same browser profile. The key is profile-bound, not derived from a password. This is not a password-protected vault and does not protect against someone controlling the browser, operating system, or a running extension context. Nonfinancial settings such as the notice acknowledgement and temporary tab bindings use Chrome local/session storage without this additional encryption.

Older plaintext trading records are migrated to the encrypted format before they are returned to the extension. Failed migration or decryption preserves the stored records and reports an error instead of resetting them. Keep the original extension identity and Chrome profile; a separate Store installation cannot read another unpacked extension's storage/key.

Records remain in that profile until changed or removed through normal use or removal of extension storage. Browser-session bindings may expire when the browser restarts. History exported by you is a separate plaintext JSON file: financial details and position IDs may remain in that file even when wallet/routing identifiers are omitted. Review it before sharing and delete exported files separately when no longer needed.

## Network connections and sharing

The extension connects to Papertrade (`exchange.papertrade.xyz`, `stream.papertrade.xyz`) and Hyperliquid (`api.hyperliquid.xyz`) for public market/venue/queue data and, if enabled, public leaderboard and wallet-position data. Requested public wallet addresses are sent to Papertrade to obtain those positions. These services receive normal network connection information, including the connecting IP address and requested market subscriptions. Their own policies govern their services.

When you configure a trading action, the extension operates Papertrade's native page controls. Papertrade and your wallet handle the resulting authorization and trading requests and receive the information needed for those requests. The extension does not provide a separate withdrawal or payment flow. The donation button only copies a public address.

There is no developer-operated telemetry, analytics, advertising tracker, or trading-history upload endpoint in this build. The developer does not automatically receive your wallet address, balance, positions, saved watches, or execution history. Opening GitHub help/privacy/support links connects to GitHub. A report or file you voluntarily submit there is handled by GitHub and may be public.

The extension does not sell or use user data for advertising, creditworthiness, lending, or unrelated purposes. User data is used only for the disclosed Papertrade controls and related safety/reliability functions, consistent with the Chrome Web Store Limited Use restrictions.

## Consent, control and removal

First-run setup explains data handling and execution limitations and asks for affirmative agreement before showing the trading controls. New entry creation and native entry dispatch are blocked until that acknowledgement is saved. On an upgrade, previously saved exit/tracking paths remain available so the notice does not silently disable existing protection; reconcile existing positions in Papertrade while reviewing setup.

You control which entries and protections you arm. Cancel waiting entries or remove exit watches using the extension's controls; removing a watch does not close a position or recall a submitted trade. To stop all further extension processing, first manage live positions and pending requests in Papertrade, then disable/remove the extension in `chrome://extensions`. Removing or clearing extension storage can remove tracking required for protection. Exported files are not removed automatically.

Policy updates will be published here. A material change in data handling will require an updated in-product notice and acknowledgement before new entries. Contact the project through the support page for questions; do not include sensitive data in a public report.
