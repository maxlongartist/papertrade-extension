> Historical development notes. Version-specific behavior and old install instructions below may be outdated. Use the current [README](../README.md) and [installation guide](INSTALL.md).

# Papertrade · Manual Pair & Limits v0.7.63

The new **Manual pair** card appears under Papertrade’s native ticket, above the existing limit-order controls.

1. Connect/authorize your wallet in Papertrade. Stop other trading automation and open the native Positions panel. Start with no open positions or pending requests.
2. Choose the asset, **margin per leg**, and leverage in the native ticket. The card shows the combined margin before entry.
3. Click **Open long + short** once. It submits one long and one short at available market prices and shows each leg’s native fill/position ID.
4. Click **Close pair**. It targets those two tracked position IDs. If a fill is still pending, it watches for that late fill and closes it too.

This is manual: no repeating entries and no automatic holding timer. Existing limit entries and TP/SL are still available. Manual pairs block competing extension entry watches and require a flat, fully rendered account view. Close does not use native Close All or adopt unrelated positions.

The connected wallet comes from Papertrade’s native wallet control and is checked again before each click. No private key is collected. Native market routes with standard position rows are supported; the older conditional limit/TP/SL workflow remains BTC/ETH. Use the English desktop page and keep native Positions visible. A wallet change, hidden/partial account view, or market navigation pauses observation/actions until the original account/market is available.

The two opens are separate requests, not atomic. Equal margin and leverage can leave a small quantity mismatch when fill prices differ. Prices and fills are not guaranteed, and cash break-even is not guaranteed. A submitted entry/Close is never blindly repeated after a missing response. Unknown entries without an identified fill remain unresolved rather than pretending that an empty position list proves cancellation. Check native Status if a request stays uncertain. Chrome worker/page reloads retain tracking within the same browser tab session; a full browser restart can invalidate the original tab binding. The new Restore control can reconnect previously identified native position IDs after checking the same wallet and market. It never guesses an unbound entry or sends trades while restoring.

## What’s new in v0.7.63

- Added an optional donation card above Network queue with the message “You're gonna make it, champ — don't forget your boy uwu <3” and address `0x0512559efEA81eA42F418926aFB63491f493Cd9A`.
- Copy donation address copies only that public address. Copy feedback has reserved space; unavailable clipboard access leaves the full address selectable. No wallet or transfer action is involved.

## What’s new in v0.7.62

- Live queue, price, pair status, leg and risk text use stable display areas and tabular digits. Short/long updates and readiness/error transitions no longer push adjacent controls around. Long messages remain available by scrolling inside their area; no trade checks or execution timing changed.
- Wallet readiness has reserved space, the live price sits on its own row, and queue update age no longer reflows the advisory footer. Dynamic order descriptions and health messages also have stable areas. Genuine actions such as adding orders or expanding details can still change layout.
- Optional `npm run verify:layout-stability` alternates short/long live states at normal and narrow widths, measures panel/control positions, and checks long-message scrolling with no native actions.

## What’s new in v0.7.61

- Copies of this version coordinate entry controls within each page. The first copy claims the document; an extra copy shows guidance instead of mounting another pair/limit panel. Keep your original installed copy and disable duplicates, then refresh Papertrade.
- Entry probes and native entry execution reject a conflicting page instance. Ownership is checked again after native ticket preparation, before the only submit click. Existing native Close and position-observation paths do not use this entry gate.
- Each extension identity registers one native-message listener per document. Reinjected copies do not register competing listeners, so they cannot race or close the owning listener’s asynchronous acknowledgement. Older uncoordinated controls are detected rather than silently replaced. A later duplicate legacy panel also pauses entries from this copy. The guard cannot change how older versions behave; it never transfers ownership automatically or migrates their saved records.
- Seven new regressions cover document ownership, legacy/malformed markers and both native entry checks. Optional `npm run verify:duplicate-copies` loads two actual extension contexts against an entirely simulated native page, verifies one entry panel and blocked standby entries, injects a conflict during preparation, and confirms an exact simulated Close remains available. No funded execution is involved.

## What’s new in v0.7.60

- Typed entry/SL/TP drafts redraw their chart immediately, including while status reads are unavailable. Clearing all levels with no current quote removes old handles and shows an empty draft state.
- The chart labels current, stale and unavailable position-mark data. Quote references disappear after the two-second display freshness window, invalid timestamps or a lost status connection. That display window never changes the worker’s stricter execution checks.
- Shift-drag moves the handle at the same fine-adjusted price shown in the input and slider value. Risk estimates update during the drag. Quote status reserves stable space, and chart gestures do not insert notices above the plot or dismiss prior errors until release, avoiding layout jumps under the pointer.
- Incomplete or invalid sizing yields unavailable risk estimates rather than NaN/infinity. Seven new data-model regressions cover freshness, timestamp/price validity and risk math. Optional `npm run verify:chart-drafts` checks typed updates, fine-drag geometry, stale/offline/empty states, quote recovery and keyboard focus with zero saves or native actions. The protection-draft connection regression also passes. No funded execution is involved.

## What’s new in v0.7.59

- Entry Submit and position-protection Save pause until the panel has a successful status read, and pause again on a failed read. Direct form-submit events cannot bypass that state. A dedicated connection banner clears after recovery without replacing ordinary order feedback.
- Entry edits, selected position, wallet and SL/TP drafts remain intact and editable during the failure. Cancel edit and Close editor remain local controls. A fresh read reenables saving; an older pending save cannot blindly reenable the button through its cleanup path.
- Failed state replies do not overwrite the last usable order snapshot; the order list is labelled “last known” until a fresh read succeeds. Existing saved watches are neither cancelled nor paused by this UI guard; native actions still use the worker’s established checks.
- Optional `npm run verify:panel-connection` checks both drafts, disabled/direct-submit guards, explicit save after recovery and local discard. It then crosses a simulated saved stop while panel status reads fail and verifies the native fake position still closes once. The delayed-entry editor regression also passes. No funded execution is involved.

## What’s new in v0.7.58

- Page-to-extension messages share a messenger that contains synchronous and asynchronous context-invalidation errors. If an extension reload invalidates the page connection, pair controls, limits, queue status and native-row controls receive clear “Refresh Papertrade to reconnect” guidance instead of raw Chrome errors.
- An invalidated page stops dispatching further messages through its dead context. The messenger never retries an action, never treats a missing response as proof of cancellation, and tells you to check native Positions and Status for pending actions. Ordinary transient errors remain retryable by the caller; normal worker responses pass through unchanged. The queue footer describes its advisory policy without promising that a disconnected page can execute exits.
- Six new messenger regressions cover receiver binding, no replay, missing context and transient errors. Optional `npm run verify:extension-reload` unloads and reloads the built extension in an isolated signed-out browser, checks BTC/ETH page guidance and reconnects one page through refresh. It does not touch installed user profiles or submit trades.

## What’s new in v0.7.57

- Stable pair-card text is updated only when its value changes. Selecting/copying a position ID, displayed wallet, ticket, recovery identity or status is no longer interrupted by an unchanged one-second redraw.
- Status feedback is composed before updating its live region, avoiding repeated intermediate text replacements during read errors. Actual leg-state and status changes still render normally; native actions and trading parameters are unchanged.
- Optional `npm run verify:pair-selection` checks selections on both leg summaries, wallet and status across live polls, verifies the card fits a 220-pixel width, and opens/closes one simulated pair using Enter on the focused buttons. Existing panel tests remain green; no funded execution is involved.

## What’s new in v0.7.56

- If startup tracking cannot be read, both leg summaries say “Tracking unavailable” and the main status directs you to native Positions. It does not claim “Not opened” from an unreadable record or suggest entering a new ticket.
- The v0.7.55 validation and independent-exit safeguards remain in force. Validation also rejects contradictory unsent legs carrying native IDs and Close/closed states missing an ID. A new panel regression and expanded integrity browser check cover these unknown-state labels without any native actions.

## What’s new in v0.7.55

- Saved manual-pair tracking is validated before restart recovery mutates it. Invalid root values, identity/binding/sizing fields, lifecycle states, missing leg identities, duplicate pair/native IDs and unresolved records marked closed are rejected without deleting or rewriting the saved data.
- Unreadable tracking produces a persistent message and blocks new manual/limit entries. Existing positions can be managed in native Positions; the extension does not guess missing identities. A missing storage key remains an ordinary empty history, while an explicitly saved null value is preserved as unreadable.
- Existing limit/SL/TP records use their independent engine. A compiled-worker regression proves an already-armed stop can still submit its exact native Close while manual tracking is unreadable. Background checks handle the load failure without unhandled promise rejections.
- Seven new regressions cover data preservation, valid legacy closed history, malformed records, entry blocking and independent exits. Optional `npm run verify:pair-storage-integrity` verifies persistent browser feedback, disabled manual controls, unchanged damaged fixture values and zero native actions. No funded execution is involved.

## What’s new in v0.7.54

- Action acknowledgements cannot reopen the displayed state of a pair already confirmed closed by polling. A late Open, Close or Restore acknowledgement keeps that terminal observation intact.
- For the same pair and Close intent, newer position observations also take precedence over an older acknowledgement. A newly acknowledged Close request still applies even if it carries an earlier position snapshot; a different pair can replace the prior closed one normally.
- Eight new regressions cover terminal-state ordering, newer observations, Close intent and all three panel actions. Expanded `verify:pair-response-order` checks that delayed Open acknowledgements cannot hide newer visible fills and delayed Close acknowledgements cannot undo confirmed closure, alongside the earlier request-order cases. This only selects display state; native action authority and no-replay rules are unchanged. No funded execution is involved.

## What’s new in v0.7.53

- Partial-pair PnL and exposure estimates explicitly say “visible legs only” when another leg is unconfirmed. The card adds “Pair totals unavailable” with the number of unconfirmed legs, so visible exposure cannot be mistaken for a complete pair total.
- A definitively unsent or confirmed closed leg is not counted as unconfirmed. With one confirmed closed leg, the remaining floating PnL is labelled “open legs only”; closed-leg realized PnL is not included. Scope qualifiers disappear when both legs are visible.
- Three metrics regressions cover pending/unknown/missing legs and confirmed resolutions. Expanded panel and browser workflow checks verify partial labels, their removal after both fills, and unchanged Close handling for late fills. Display-only calculations do not change entry or Close authority; no funded execution is involved.

## What’s new in v0.7.52

- A timed-out native entry or Close acknowledgement now says the outcome is unknown and directs you to native Positions and Status. It no longer describes that execution timeout as a generic page-reload problem. Read-only page timeouts keep their connection/reload guidance.
- The existing 4.5-second response bound, native click deadlines, unknown-outcome tracking and no-replay behavior are unchanged. A timeout does not prove that the venue rejected or cancelled a request.
- Two new compiled-worker regressions deterministically trigger the actual page-message timeout: a late entry acknowledgement does not replay entry, an identified late fill is closed once after Close intent, and a late Close acknowledgement does not authorize another Close or claim closure. Closure still requires complete absence observations. All native actions in these tests are mocked; no funded execution is involved.

## What’s new in v0.7.51

- Close is rechecked after an entry reservation finishes saving and before native execution. If Close arrived during that save, the still-unsent leg is marked not sent and its request time cleared; no click is dispatched for it.
- Close during the long reservation sends neither leg. Close during the short reservation skips short and continues unwinding any already-submitted long, including a late identified fill. Submitted or uncertain actions are not reclassified as unsent or replayed.
- Two controller regressions reproduce both storage windows and verify saved leg state. Optional `npm run verify:pair-reservation-close` holds those saves in the browser simulation and checks zero submissions for the first case and exactly one entry/one close for the second. No funded execution is involved.

## What’s new in v0.7.50

- When Close interrupts a pending Open or Restore, the earlier action’s delayed response cannot overwrite the newer Close state or its feedback. Late errors from that earlier action are ignored too. Polling during the pending action still exposes partial fills and permits Close.
- Disposed panels ignore late action replies, skip redraws and reject direct handler calls. Existing native/controller execution, saved Close intent and no-replay rules are unchanged.
- Seven new regressions cover delayed Open/Restore successes and errors after Close, plus disposal for all three actions. The expanded `verify:pair-response-order` browser simulation holds Open acknowledgements, closes the fake pair, and releases both old success and error responses without UI rollback; the normal partial-fill/Close workflow is also checked. No funded execution is involved.

## What’s new in v0.7.49

- Open, Close and Restore invalidate older in-flight status replies at dispatch and acknowledgement. A delayed empty snapshot cannot erase a newly opened/restored pair, and an older open snapshot cannot undo the displayed Close request.
- Obsolete status errors are ignored too. Status reads started after an action begins still show partial fills and leave Close usable; their responses cannot overwrite a later action acknowledgement. Ignoring a stale response does not submit or repeat any trade.
- Five regressions cover all three actions, late errors and partial-fill progress during Open. Optional `npm run verify:pair-response-order` captures native-simulation snapshots before Open and Close, releases them after acknowledgements and verifies two entries/two closes with no UI rollback. The transport-failure/Close browser regression also passes. No funded execution is involved.

## What’s new in v0.7.48

- During pair-state transport failures, the retained pair message is now marked amber and explicitly labelled “Last known status”. It cannot look like a current confirmation underneath the transport warning. The v0.7.47 failure/recovery safeguards remain in force.

## What’s new in v0.7.47

- A failed pair-state read now keeps its error visible across timer redraws and immediately hides PnL/exposure estimates derived from the last snapshot. The error clears only after a successful pair-state read, rather than an unrelated redraw or Close response.
- Existing pair Close remains available while a status read is failed or held. The display error does not alter saved pair data, and polling still allows only one state read in flight.
- Late failed replies after panel disposal are ignored. Two new regressions cover persistent feedback, hidden estimates, Close during a stalled read, recovery and disposal. Optional `npm run verify:pair-state-health` exercises the same behavior with two fake native legs; no funded execution is involved.

## What’s new in v0.7.46

- Manual pair readiness now returns the margin and leverage actually checked. The card only enables Open when those verified settings match the current native ticket, as well as the selected wallet.
- A delayed readiness reply for different settings shows a checking message and triggers a new read on the next poll. Missing verified sizing also leaves Open disabled; it cannot present an unchecked ticket as ready.
- Three regressions cover checked-sizing isolation, delayed replies, refresh recovery and missing sizing. The wallet/sizing browser simulation passes with the new readiness contract. The preceding packaged v0.7.45 also passed read-only current BTC/ETH page checks: injected controls, live price timestamps, congestion expiry/recovery and zero stored orders/pairs. No funded execution was tested.

## What’s new in v0.7.45

- Manual pair Open carries the margin and leverage last displayed on the card. The controller compares them with its fresh native snapshot before saving a pair or submitting either leg. A changed ticket requires checking the updated settings and clicking again.
- The selected settings are captured before the busy-state redraw, so a last-moment native input change cannot silently replace the displayed size. Existing active pairs continue using their saved size.
- Three new regressions cover stale margin/leverage, malformed selected sizing and changes between render and click. The expanded `verify:pair-wallet` browser simulation changes native margin and clicks Open in one task, verifies zero submissions, then checks normal entry and wallet-bound Close recovery. No funded execution is involved.

## What’s new in v0.7.44

- Manual pair readiness shows the verified wallet. Open carries that selected identity and rejects a wallet change before creating a pair or submitting either leg, then refreshes readiness for an explicit retry.
- Active pairs keep their tracked wallet visible. Close remains tied to that wallet; changing accounts sends no Close, and returning to the original wallet lets the retained Close request resume.
- Four new tests cover verified readiness, stale and malformed wallet selections, and missing identity in the UI. Optional `npm run verify:pair-wallet` exercises wallet switching in the simulated browser ticket: a stale Open sends nothing, a refreshed Open creates two fake legs, and Close waits for the original wallet. No funded execution is involved.

## What’s new in v0.7.43

- Position SL / TP read/save errors now remain beside the editor across live updates. Draft changes, refresh/reopen, a new request or Close editor clear the old feedback; a rejected save retains its draft.
- The editor receives the wallet verified by its native position read, shows that selected wallet and uses it when choosing an existing watch. Native row controls also scope protection to the connected wallet.
- UI requests to arm new protection carry the selected wallet and are rejected if it differs from the fresh native snapshot. A wallet change cannot silently transfer a stale selection to an identical position ID in another wallet.
- Three new backend tests cover identity reporting, stale selections and malformed/matching expected identity. Optional `npm run verify:position-wallet` simulates two wallets sharing a position ID and verifies separate stops, persistent rejection feedback and refresh recovery. Expanded conflict/editor checks verify read errors remain visible and a closed editor still leaves its stop operating.

## What’s new in v0.7.42

- SL / TP entry conflicts now follow actual fill identity: wallet, asset, direction, leverage and overlapping margin-match windows. Opposite directions and distinguishable tickets can carry independent brackets, replacing the former blanket one-bracket-per-asset rule.
- Create and Edit enforce the same constraint when either matching pending entry has SL / TP, including a matching plain entry awaiting fill identification. Older saved conflicts pause before submission until resolved; no fill is guessed.
- Fill-ID exclusion and duplicate-protection checks are scoped to the verified wallet and asset. A record in another wallet or market cannot incorrectly claim the same position ID.
- Entry-request errors stay beside the form across live updates, without replacing the draft. They clear on draft changes or a new request so a rejection reason remains readable.
- Fourteen new regressions cover ambiguity, independent brackets, rounding-window overlap, cancellation/retry, saved triggers and account-scoped position IDs. Optional `npm run verify:bracket-conflicts` verifies the Create/Edit workflow, persistent rejection text and successful retry after cancelling the conflict. Existing-position editor/stop simulation also passes. No funded execution is involved.

## What’s new in v0.7.41

- Entry Edit mode now labels the saved watch’s margin and leverage as fixed. Changing Papertrade’s native ticket no longer makes the editor appear to resize an existing watch.
- The chart’s draft-risk estimate and edit request use those same saved values. Leaving Edit mode restores the native ticket as the source for a new-entry draft; the extension does not overwrite the native inputs.
- Optional `npm run verify:entry-edit-size` changes native sizing around an existing watch, verifies its label, risk, request and saved size stay consistent, then confirms Cancel edit returns to current native sizing. The delayed-save and Cancel edit browser regressions also pass; no native trades are submitted.

## What’s new in v0.7.40

- The existing-position SL / TP section now has Close editor. It discards the local draft, collapses the form and leaves saved protection running; it sends no native Close or protection update.
- Closing during a position read invalidates that read so a late reply cannot reopen the editor. Reopening reads the saved settings afresh. The control stays disabled during a submitted save, including direct handler calls.
- The expanded localhost position-editor verifier checks draft discard, late-read suppression and the pending-save guard. It then closes the editor, crosses a simulated stop and verifies exactly the protected position closes while the other fake position remains open. No funded execution is involved.

## What’s new in v0.7.39

- Manual-pair Open and limit arming/submission now reserve their entry mode before asynchronous checks. A concurrent request cannot pass an earlier empty-state check while the other mode is still preparing.
- Competing entry requests receive a clear in-progress message and send no native entry. Reservations release on success or error, while existing durable watch/pair checks remain in force. Multiple ordinary limit watches remain supported.
- Close intent, existing-position protection, exit dispatch and read-only state do not use the entry gate. The reservation does not serialize them behind a slow Open.
- Six compiled-worker regressions reproduce both overlapping-preflight races, check release after failures and verify Close interruption plus stop dispatch while pair Open is waiting. All order actions in these tests use a mocked Chrome page.

## What’s new in v0.7.38

- Execution history now retains its existing DOM while the displayed history is unchanged. Price-only updates no longer rebuild those rows and clear selected text.
- Live prices continue updating normally, and real order-state changes still refresh history. The change affects rendering only; it does not change execution or storage.
- Optional `npm run verify:history-stability` reproduces the prior row replacement, selects history text, updates a simulated quote and verifies row identity and selection survive. It then cancels the waiting order and checks that the new history state renders, with zero native trades.

## What’s new in v0.7.37

- Long/Short controls now remain fixed while editing an existing entry, matching the saved watch’s immutable direction. They can no longer silently leave Edit mode and turn the next save into a new order.
- The click handlers enforce the same rule even if invoked directly. Edit mode explains the fixed direction and points to Cancel edit, which restores the previous new-entry draft and re-enables direction selection.
- The expanded localhost cancel-edit verifier reproduces the old mode switch, verifies it is blocked, and checks that cancelling restores direction selection without changing saved orders. Delayed-save and conflicting-edit browser checks remain included in validation.

## What’s new in v0.7.36

- Entry Edit mode now has a Cancel edit button. It restores the new-entry draft that existed before editing, including side, target, entry behavior, tolerance, SL / TP, early lead and the optional-exits disclosure state.
- Switching between saved orders while editing preserves that same original draft. Cancel edit changes only local form state; it sends no order edit, cancellation or native trade.
- The control is unavailable while an entry request is pending. A submitted save must finish before the editor can be abandoned, so the UI never implies that Cancel edit recalls it.
- Optional `npm run verify:entry-cancel-edit` checks draft restoration across two saved watches, unchanged saved targets, successful use of the restored new draft and a programmatic cancellation attempt during a held save. The existing delayed-entry-editor verifier also passes. All native interactions are simulated.

## What’s new in v0.7.35

- Invalid-expiry entries that are disabled before submission now offer Cancel disabled entry. This explicitly retires the watch into Execution history; it sends no native order or Close.
- The action is unavailable when the record has a position binding, trigger/submission/click evidence, a captured position snapshot or another attention reason. Submitted or uncertain venue actions remain tracked.
- Prior-release invalid-expiry recovery messages are recognized during loading and acquire the same guarded cleanup action. A failed cleanup write keeps the entry disabled and allows retry.
- Six tests cover eligibility, native-action exclusions, persistence, restart and prior-release records. The localhost expiry verifier now tests cleanup failure/retry, cancellation into history and continued operation of the independently re-armed watch with zero native submissions.

## What’s new in v0.7.34

- Saved pending entries with a missing, nonnumeric or out-of-range deadline now require explicit re-arming. They are persisted as Attention before any entry can run, instead of retaining an unlimited waiting state.
- Valid future watches still resume; valid elapsed deadlines still expire normally. Existing position exits do not depend on an entry deadline and remain armed.
- If saving the recovery state fails, initialization blocks execution. One invalid entry does not prevent independently valid watches from operating after successful recovery persistence.
- Six regression tests cover malformed saved values, valid watch recovery, existing protection and persistence failure. The expanded localhost expiry verifier checks that a marketable invalid saved entry sends no order, displays the re-arm message and allows an explicit new waiting watch.

## What’s new in v0.7.33

- Entry expiry is checked again after native preflight and after the submission reservation is saved. A watch that expires during either wait becomes Expired without invoking native entry execution.
- Native dispatch deadlines are capped strictly before the saved watch expiry. The normal 750 ms allowance is preserved for watches with more time remaining, and is never extended by this change.
- Four regression tests cover held preflight, held reservation storage, deadline capping and the unchanged normal allowance. They reproduce the late-submission race with a still-fresh quote and no intervening pulse.
- The expanded localhost `verify:entry-expiry` holds an entry preflight past its deadline with quotes paused, then verifies the watch expires without a fresh quote or native submission. Existing countdown and original-deadline editing checks remain included.

## What’s new in v0.7.32

- Waiting entry cards now show their remaining lifetime, with the final five minutes highlighted and the exact local deadline in a tooltip. Countdown updates use the saved deadline; editing preserves it.
- A passed deadline is labelled awaiting worker confirmation until the engine changes the watch state. Missing legacy deadlines show unavailable instead of inventing an expiry. Armed position exits do not show an entry countdown.
- The display is read-only and does not renew, expire or submit orders. The footer explicitly notes that edits keep the original entry deadline.
- Five focused tests cover countdown boundaries, overdue/invalid deadlines and exit exclusions. Optional `npm run verify:entry-expiry` uses a ten-second localhost watch to verify live countdown, unchanged expiry after editing, normal engine expiration and zero native submissions.

## What’s new in v0.7.31

- Manual-pair storage errors are now distinguished from failed Positions reads. If a complete, verified read succeeds but saving its result fails, the live observation remains valid and its timing continuity is preserved.
- Failed Close reservations still report their storage error and keep Close intent. They no longer falsely label a successful native read as Positions unavailable.
- Real account, position-detail or read failures still invalidate observations and timing samples. Submitted/unconfirmed Close requests remain protected against duplicate clicks.
- Four tests verify successful-read/save-failure separation, valid native close timing, wallet failures and changed bound details. The localhost pair-storage verifier now checks that Positions health stays accurate during the injected reservation-storage outage and normal closure resumes afterward.

## What’s new in v0.7.30

- Failed pair Close reservation writes now restore only the legs whose native Close adapters have not been called. They remain available for closing when storage recovers, instead of getting stuck labelled Sending.
- Close intent stays active. Submitted and unconfirmed sibling closes retain their state and are never replayed by this recovery path. Per-leg errors explicitly say Close was not submitted.
- A Close error notice is associated with its pair and clears when that same pair is confirmed closed. A recovered Close can therefore show its final confirmation instead of remaining covered by an obsolete error.
- Four tests cover failed batches, persistent storage outages and preservation of submitted/unconfirmed siblings. The expanded localhost pair-storage verifier confirms zero Close calls during the fault, automatic continuation of the requested Close after recovery, exactly one Close per leg and final visible closure confirmation.

## What’s new in v0.7.29

- Failed storage reservations before a manual-pair entry now leave that leg explicitly Not sent, without a misleading sending timestamp. The adapter is never called for the rejected reservation.
- Failure before the long entry marks the no-trade attempt closed and permits an explicit new Open. Failure before the short retains the submitted long as an incomplete pair for observation and Close; it never automatically opens the missing short.
- A corrective snapshot is attempted after the rejected reservation. A continued storage outage still leaves the known-unsent leg classified correctly in memory. Failures after an actual native entry remain tracked and block another Open.
- Four regression tests cover both leg reservations, persistent storage failure and a failed post-click acknowledgement save. The expanded `verify:pair-storage` browser simulation verifies first-leg retry and closing the lone long after second-leg reservation failure.

## What’s new in v0.7.28

- A failed initial manual-pair save now restores the previous tracking state and history. It sends no entries and leaves no uncommitted active pair blocking an explicit retry.
- If Close was requested while that initial write was pending, the failed attempt becomes terminal before removal. Its queued Close cannot observe or trade an orphan pair; subsequent persistence reflects the restored tracking state.
- Tests cover retry, history preservation and Close during a failed initial write. Optional `npm run verify:pair-storage` injects the failure in the localhost UI, verifies zero entries and an available Open button, then opens/closes exactly one pair on explicit retry.
- This rollback applies only to the first pair record save, before any entry reservation or native click. Later uncertain requests retain tracking and are never treated as safe to replay.

## What’s new in v0.7.27

- New entry watches and existing-position SL / TP protection now become active only after storage confirms them. Failed initial saves leave no ghost watch that can trigger on a later quote.
- Manually attaching inactive exits to a selected position follows the same rule. A failed attachment preserves the prior watch and its recovery controls, and retry remains available.
- History retention is staged with the new watch instead of modifying live history before persistence. A failed save preserves existing watches and the full previous history.
- Four regression tests cover failed initial arming, failed attachment, subsequent quotes, worker restart, retry and history preservation. The expanded localhost `verify:watch-storage` covers these UI paths alongside edit/cancel failures and verifies one explicit attachment retry closes the selected fake position.

## What’s new in v0.7.26

- The manual pair Close button now distinguishes sending, pending confirmation and needs-attention states. An unconfirmed response names the affected side and highlights the need to check native Positions and Status; it does not imply ongoing submission.
- Submitted closes that remain visibly open for over 30 seconds receive a needs-attention message only while the position observation is fresh. Closed legs no longer contribute obsolete uncertainty warnings.
- This is a display-only summary. It never retries a submitted or unconfirmed Close, changes pair tracking or enables another Open while a pair remains unresolved.
- Optional `npm run verify:pair-close-status` injects a lost short Close response in the local simulated ticket, verifies the amber warning and absence of repeat Close requests, then resolves the fake position through native Close and verifies the warning clears after confirmation.

## What’s new in v0.7.25

- An entry preflight is now bound to the watch revision it checked. Editing the entry or its exits while that read is pending discards the superseded result and checks the saved revision again before submission.
- A failed read from an obsolete tab cannot mark the newer watch failed. If the edited target is no longer marketable, it remains watching until its own threshold is reached. No submitted or uncertain native click is replayed by this change.
- Post-click exit tracking uses the reserved settings actually sent to the native adapter, including SL / TP added or removed during a pending preflight.
- Regression tests cover added/removed exits, obsolete preflight failures, destination-tab changes and changed entry thresholds. Optional `npm run verify:preflight-edits` verifies both edit paths through the simulated native ticket, including fill binding and stop closure, with no real funds.

## What’s new in v0.7.24

- Entry edits, SL / TP edits and cancellations now become active only after Chrome storage confirms the updated snapshot. A failed write leaves the previous live watch intact, including its revision, history and trigger tracking.
- Storage errors explicitly say the change was not saved and the previous settings remain active. Unsaved edit drafts stay visible; retrying does not require resetting a falsely advanced revision.
- Regression tests cover all four failed-write paths, saved/live consistency, worker restart, retry and continued operation of the original entry or stop after a failed cancellation.
- Optional `npm run verify:watch-storage` injects a storage failure in the localhost fixture, verifies retained drafts and active cards, then retries edits and cancellations successfully with zero native entries or closes.

## What’s new in v0.7.23

- Entry and SL / TP editors now send the revision they loaded. If another editor has saved newer settings, a stale save is rejected without overwriting them or clearing the unsaved draft. Reopen Edit to load the latest values.
- Revisions persist across worker restarts. Saved watches from older releases start at revision zero. Delayed native probes cannot let an older save overwrite a newer edit; status changes during a save still prevent the edit.
- Successful saves advance the editor revision so repeated edits work, including drafts changed while an acknowledgement was pending.
- `npm run verify:edit-conflicts` simulates another editor changing an entry or SL / TP watch, verifies the rejected draft remains visible, then reopens and saves the current settings. No native entry or Close is sent.

## What’s new in v0.7.22

- Editing a waiting entry verifies the original wallet on the destination tab before changing its price or tab binding. A caller-supplied owner cannot transfer a watch to another wallet.
- An unavailable, outdated or mismatched native adapter rejects the edit and preserves the original watch. Same-wallet edits can still move a watch between tabs.
- Read-only edit probes run outside the execution queue. A slow edit does not delay an entry, and its result cannot overwrite an order that has already submitted.
- Regression tests cover wrong-wallet preservation, verified same-wallet rebinding, unavailable adapters and submission during a delayed edit.

## What’s new in v0.7.21

- Tab/session registration now exposes a new binding only after its complete map is acknowledged by session storage. Same-tab requests share the pending registration; different new tabs serialize their writes so later snapshots include prior committed keys.
- A failed session write leaves no usable in-memory candidate. An explicit retry persists a fresh binding before dispatching the request.
- Already registered tabs bypass the new-registration write queue. A held write for another tab cannot delay an existing tab’s Close request. Saved binding validation, original-tab routing, browser-restart invalidation and wallet checks remain enforced.
- The compiled-worker regression tests cover held writes, failed-write retry and responsive known-tab closing. The read-only Chrome verifier checks two native asset tabs receive distinct persisted bindings; it sends no funded order.

## What’s new in v0.7.20

- Fixed a reproduced delayed-entry-save bug: an older acknowledgement could clear another selected order’s Edit mode and turn its next save into Create. The form now captures the submitted ID/side and tracks later draft changes; older replies preserve the newer draft and edit target.
- New input or chart edits for the same order are preserved too. A pending request has an explicit submission guard, including programmatic/keyboard submit paths. Draft preparation, cancellations and existing-position controls remain independent.
- Optional `npm run verify:entry-editor` uses the localhost fixture with two waiting orders and an artificially delayed edit reply. It verifies the selected order and same-order drafts survive, a pending request cannot submit twice, subsequent saves target the correct IDs, and exactly two watches remain with zero simulated native entries.

## What’s new in v0.7.19

- Fixed a reproduced position-editor mismatch: reloading open positions could select the first ID while retaining another position’s SL/TP values and save mode. Refresh now preserves a loaded selection, and each position’s values and edit target are loaded together from the current position list/watch state.
- Newer selections supersede older asynchronous reads. Saving is blocked while that selection loads; missing IDs are refused rather than falling back to another position. Editing fields/selection are locked during a save, and newly armed watches switch to Save mode.
- Position chart drafts cannot alter a loading/saving position editor. Loading an editor sends read-only requests; the existing engine still validates native identity and position details when saving.
- Optional `npm run verify:position-editor` uses two local simulated positions with different stops, artificially delays an older editor response, verifies the latest choice survives, blocks an attempted loading-time submit, and proves each save updates only its chosen watch. The simulation enters and closes no positions.

## What’s new in v0.7.18

- Fixed a reproduced editing bug: a live/stale price refresh could replace the entire order list and detach a recovery selector while you chose a native position. Order cards now keep their identity and patch display/action slots, preserving unchanged buttons, selectors, values and focus.
- Recovery controls are removed when the record leaves a state that permits attachment. Attachment still validates the current wallet, position ID and native snapshot before arming exits.
- Optional `npm run verify:recovery-selection` uses the localhost simulation with two matching positions. It selects the second position, forces stale/live refreshes, checks focus and selected-node identity, then verifies that arming targets only that ID and leaves the other position present. The original renderer failed this exact check. No funded execution is involved.

## What’s new in v0.7.17

- Armed SL/TP watches now perform periodic read-only native position checks, independent of fill/Close confirmation. Missing positions, unavailable/wrong-wallet views and stale checks are labelled explicitly in the order card, native-row controls and toolbar overview.
- A warning **retains the watch for its original ID**. It never silently disarms protection, declares settlement/closure, changes trigger prices or delays a price-triggered exit. Each actual native click still performs its existing wallet, ID and deadline checks.
- Read-only page requests remain outside the mutation queue, so a stalled health read cannot block a stop. Late responses cannot rearm removed exits or reactivate a submitted close. Health timestamps reset on worker restart.
- Unchanged health checks update memory without writing to storage on every poll. The card does not use the volatile check timestamp as a DOM replacement key.
- Optional `npm run verify:position-health` uses the localhost simulation to test missing/partial/recovered visibility and a subsequent single simulated stop Close. It uses the same Playwright environment variables and blocks remote browser requests. It does not verify funded execution.

## What’s new in v0.7.16

- Inside Pair history & details, **Saved closed BTC history** (or the selected asset) loads retained closed pairs for the connected wallet across browser tabs/sessions. It verifies the wallet and asset from the native page without requiring the Positions panel. No position is adopted and no Open, Close or Restore is sent.
- The list clearly labels the abbreviated wallet and snapshot time. Export downloads the currently selected history scope; **Back to this tab** returns to the existing live tab history. Ordinary polling does not overwrite a selected historical snapshot.
- Only closed records matching the verified wallet and asset are returned. Caller-supplied wallets are ignored. Unavailable identity or a mismatched response leaves the current controls/history intact. Reading history does not wait behind an entry acknowledgement.
- This exposes records already retained by the extension; it cannot recover another extension installation’s storage or pairs beyond the existing retention bound (up to 30 saved closed matches).

## What’s new in v0.7.15

- The Network queue card on the venue and in the toolbar shows the **loaded bundle version**. Source previews say Development preview. Replacing files on disk cannot make an already loaded older panel claim the new version.
- `npm run release` builds and runs all tests, checks matching manifest/package versions and stamped bundle versions, and verifies every ZIP byte against an explicit six-file payload with the manifest at the root. No bot data or keys enter the package.
- Release output includes versioned folders/ZIPs in outputs and Downloads plus `~/Downloads/papertrade-manual-pair-latest.zip`. Versioned destinations are verified on reruns and refused if their payload differs. Only the latest ZIP alias is replaced atomically; the script never modifies an existing unpacked release or a Chrome profile.
- Keep using the same installed extension folder/identity when updating, then Reload in Chrome and refresh Papertrade. The version badge confirms which panel build is actually running.

## What’s new in v0.7.14

- Pair history/details now records the cached public queue context before entry and at the first Close request for that intent: congestion level, pending count, nominal clearing estimate, sample time and sample age at request. Repeated Close clicks do not overwrite that context.
- Details and JSON exports retain those historical values after the live queue changes. Missing or invalid/stale readings are recorded as unavailable; older pairs without evidence say Not recorded. These are network-wide nominal estimates, not an individual order’s ETA or proof that congestion caused a delay.
- Captures use only validated cached page/direct-feed/Status readings. They do not open connections, wait for a network response, gate actions or change trading parameters. A failed or accidental asynchronous evidence provider cannot block entry/Close.
- Queue records are whitelisted public fields. Wallets, browser routing identifiers, raw messages and errors are excluded from exported queue evidence. The worker ignores caller-supplied evidence in pair requests.

## What’s new in v0.7.13

- A fresh observation with only one visible leg now shows an amber **Only one leg visible · pair incomplete** warning immediately, including while the other fill is pending. While unwinding, it says one leg remains visible. Close pair stays available and the warning clears once both legs are visible.
- Saved/restored IDs without a current visibility observation say **awaiting position check**, rather than displaying the recorded fill as if newly observed. Observation timestamps more than one second in the future cannot make gross PnL or exposure estimates appear current.
- No trading behavior, sizing, timing or automated repair was added. The interface still has the same Open and Close buttons.
- Optional `npm run verify:pair-ui` uses the local preview server (`npm run preview` in another terminal) and the same Playwright environment variables as the Chrome verifier. It blocks remote browser requests and tests simulated partial-fill closing, late-fill handling and warning clearance. It sends no funded orders.

## What’s new in v0.7.12

- A throwing native entry/Close click now reports an uncertain outcome (`clicked: null`), rather than escaping into the page handler’s definite no-click response. A click attempt may already have produced side effects. Manual pairs stop the unsent entry side and do not replay uncertain closes; ordinary watches remain in Attention after an unacknowledged action.
- Failed click attempts carry `clickAttemptedAt` in the adapter response and never receive a confirmed `clickedAt`. Successful clicks retain their existing timestamps and observation flow.
- The final Close deadline check now runs after wallet verification, immediately before the click. An action that expires during that check is refused before clicking.

## What’s new in v0.7.11

- BTC and ETH price streams are monitored independently. If either stops delivering advancing valid quotes for ten seconds, the stalled socket is retired and reconnected with bounded 2-to-30-second backoff. A hung initial handshake, constructor failure, socket error or failed subscription/ping also recovers without overlapping connections.
- Opening a socket now reports Waiting for BTC / ETH quotes. Live appears after valid data arrives for both. Malformed, stale, future, unsupported-symbol, out-of-order and repeated-timestamp traffic cannot keep a stalled connection alive. Retired-socket messages are ignored.
- Entry/exit freshness and price checks remain unchanged. Reconnecting does not replay native actions, alter watches, widen entry tolerances or relax protective checks.
- The optional Chrome verifier also requires multiple advancing BTC and ETH timestamps, a Live price-feed state and current quotes. Financial execution remains unverified by this read-only check.

## What’s new in v0.7.10

- Fixed an actual Chrome connectivity gap: the public WebSocket server returns 403 to extension-origin connections while accepting its native Papertrade page origin. A visible Papertrade trading tab now subscribes to the same anonymous public stream in the extension’s isolated content world and relays validated publications to the worker. No page-message bridge, wallet data, private key or additional permission is used.
- The worker validates each raw publication again, rejects invalid/stale/out-of-order data and accepts relays only from this extension on the native venue. Readings expire after five seconds. Hidden/navigated pages stop their relay and clear their own cached reading; another tab cannot clear the current source’s reading. The direct worker feed is stopped while a fresh page relay is available. Native Status remains a fallback.
- Both page and toolbar indicators label this transport **Page feed updated**. Keep a Papertrade trading tab visible for live readings. Network estimates remain advisory and cannot submit or gate a trade.
- `scripts/verify-browser.mjs` provides optional live verification using an installed Playwright module (`PLAYWRIGHT_MODULE`) and Chrome for Testing (`BROWSER_EXECUTABLE`). It loads production `dist/` in a fresh temporary profile, opens a signed-out venue page and the actual toolbar popup, verifies advancing public readings and freshness recovery, checks that no orders/pairs exist, saves evidence, then closes the browser and removes the profile. Run `npm run verify:browser` from this project after building; optional `BROWSER_VERIFY_OUTPUT` selects the report directory. It does not use your Chrome profile or wallet.

## What’s new in v0.7.9

- The public queue feed now reconnects when no advancing valid snapshot arrives for ten seconds, including a hung initial connection. Queue readings still expire after five seconds; ping traffic cannot make stale data look fresh.
- Connection errors and constructor failures enter bounded exponential backoff (2 to 30 seconds) rather than retrying on every panel refresh. Old-socket messages are ignored, interrupted trends are discarded, and idle shutdown clears reconnect/watchdog timers.
- The queue indicator remains advisory. These connection repairs do not submit trades or change entry/exit conditions.

## What’s new in v0.7.8

- SL/TP Close confirmation now resets saved absence counts when Chrome’s worker reloads. Submitted closes retain their position binding and wait for two new complete observations; no Close is replayed.
- Explicit recovery cannot attach another exit watch to a position whose Close has already been submitted. Another available position can still be selected. Concurrent recovery requests reserve only one exit watch for the selected position.

## What’s new in v0.7.7

- A Chrome worker restart now clears old visibility/mark readings and resets incomplete close-absence counts. Known positions require two new complete absence observations after the restart before Closed can be confirmed.
- Pending entry/close observations are marked interrupted, so worker downtime cannot become an apparent execution-latency sample. Completed timing evidence and closed history remain intact.
- Saved position IDs and submission states are preserved. Recovery does not replay entries or submitted/uncertain closes; an existing user Close intent continues monitoring the identified legs.

## What’s new in v0.7.6

- Pending pair entries and closes show time since their request, so a slow operation is visibly waiting instead of looking frozen. Preparing an entry is distinguished from an acknowledged native click. No timeout triggers a duplicate trade.
- The native adapter now records entry click time independently of when the extension receives its acknowledgement. Pair records preserve request, native click, acknowledgement, fill observation and close-absence observation times separately. Ordinary entry history also distinguishes native clicks from acknowledgements.
- The pair card shows **observed entry** and **close absence** durations per leg. History/details includes per-market median observed confirmation durations from up to 20 recent valid legs and the sample counts. These include page polling delays and are not a fill-time prediction or settlement-finality measurement.
- Unrecorded/legacy click times, invalid timestamp order and interrupted observation periods produce unavailable timing estimates and are excluded from medians. Restore does not erase interruptions or replay trades. JSON history preserves timing source and interruption flags while omitting wallet/browser identifiers.

## What’s new in v0.7.5

A **Network queue** card appears above the trading controls and in the toolbar popup. It shows Low/Medium/High pressure, public pending transaction count, average transactions per recent block, projected backlog, estimated clearing time, sample age and recent queue trend.

The public anonymous `pressure:current` stream at `wss://stream.papertrade.xyz/connection/websocket` supplies the same snapshots used by native Status. The extension opens one shared connection on demand, backs off on reconnects and closes it after inactivity. It sends no wallet, key, order or account data. This adds access to `https://stream.papertrade.xyz/*` to the host permissions.

The model mirrors Papertrade’s current frontend: `ceil((totalSubmittedGas + totalQueuedGas) / blockGasLimit)` projected blocks; at most one block is Low, up to five is Medium, above five is High. The displayed clear estimate is `max(3, projected blocks)` seconds when pending transactions exist, otherwise zero. This is the native nominal estimate, not a prediction of your order’s exact fill time. Average transactions per block is descriptive; the estimate uses gas capacity rather than transaction count. The trend compares recent gas-backlog samples and needs at least five seconds of history.

If the public stream is unavailable, leave a separate native **Status** tab open using the card’s Status link. The extension can relay its visible congestion metrics to the other trading tabs. The source is labelled **Status read**, and native placeholders/invalid readings are rejected. This fallback does not invent a projected-block count or trend that Status does not expose. Keep native Positions visible in the tab executing your orders.

Readings older than five seconds, malformed snapshots, unavailable chain state or a disconnected feed become **Unknown** and hide numeric estimates. This feature is advisory only: it never changes margin/leverage, submits a trade, gates an entry or blocks an exit. High pressure suggests waiting before new entries; Low does not guarantee speed, fill price, break-even or safety.

Source verified 2026-10-17: native `trade._coin-CIExBQ17.js`, `useChainPressure-DLXnGnFf.js` and the public stream schema from `app-Do4B_DcV.js`. No private account endpoints are used.

## What’s new in v0.7.4

**Upgrade action:** older limit/SL/TP watches without a recorded wallet are moved to Attention. Recreate entry watches and explicitly re-arm protection on the intended native positions after updating. Existing submitted venue actions are not cancelled by this migration. Manual pairs already had wallet bindings and keep them.

- Every new limit entry records the account read from Papertrade’s connected-wallet control, ignoring caller-supplied owner values. Existing-position protection records the account from the complete native position snapshot.
- Entry probes and the final native entry/Close click verify the original wallet and market, including after ticket preparation. Other-wallet read-only views are refused. Switching wallets cannot retarget a watch.
- Fill identification, protection edits/attachment and close-absence confirmation verify the snapshot’s account. An empty list from another wallet cannot claim that a position closed. Unavailable/wrong-account snapshots reset close-absence counts.
- Order cards show the abbreviated bound wallet. History exports preserve execution evidence while omitting wallet and browser routing identifiers. Diagnostics read the installed extension version instead of an outdated constant.

## What’s new in v0.7.3

- The toolbar popup now lists active manual pairs, entries, SL/TP watches and unresolved attention states. It shows native position IDs and warns about closed/changed managing tabs, expired sessions, stale position observations, uncertain requests and aging/missing BTC/ETH quotes. It lists extension tracking, not the wallet’s complete positions.
- **Manage on page** focuses the original tab (returning it to the saved market if needed) or opens the market when the original binding is unavailable. It sends no trade and never automatically restores or re-arms anything. The service worker resolves the target from a currently active saved record; caller-supplied tab IDs and URLs are ignored.
- Popup status refreshes every two seconds with no overlapping reads. An error or a snapshot older than six seconds disables stale Manage controls; a successful read restores them. Quote ages are hidden when status is unavailable.
- The popup receives a limited status summary without wallet addresses or browser session keys. Existing site/toolbar origin checks remain enforced; no extension permissions were added.

## What’s new in v0.7.2

- **Restore tracking here** appears when this wallet has a saved active pair whose original tab is closed or whose browser-session binding expired. It shows the original asset, margin, leverage and native position IDs before you restore. If the original tab is still available, the extension directs you back there instead.
- Restore rechecks the wallet, market, complete native account view, pending requests and saved position details. It refuses entries without an identified native position ID, duplicated IDs, mismatched positions and inconsistent saved state. Unrelated positions are never adopted or closed.
- Restore is tracking only: it sends no entry or Close. Any old Close intent is paused; press **Close pair** again when ready. Previously submitted/uncertain Close requests are not replayed—check native Status if they remain unresolved. Missing known positions still need two fresh complete absence observations before Closed.
- **Pair history & details** now includes per-leg entry/Close states and recorded click times, plus the recovery time. JSON exports also include the recovery time without wallet/browser identifiers.
- Keep the same unpacked-extension folder/identity during upgrades so Chrome retains saved pairs. A separately installed extension cannot read another extension’s storage.

## What’s new in v0.7.1

- Open stays disabled until a read-only preflight verifies the wallet, native ticket, complete flat account, collateral for both legs, fresh venue metadata and venue constraints. The reason appears directly under the buttons and rechecks as you change the ticket. Open independently revalidates everything before submission.
- Active pairs show elapsed time, visible leg count, combined gross mark-to-entry PnL estimate and residual net USD exposure estimate. These estimates exclude fees, funding, slippage and PAPER rewards; they are hidden when position observations are unavailable, older than five seconds, invalid, or closed. They do not prove price freshness or realized profitability.
- Per-leg errors remain visible, successful subsequent actions clear resolved errors, and a disappearing leg is reported as incomplete instead of saying both legs are visible.
- Position-observation age and connection failures are visible without hiding Close. A slow entry does not block the state request needed to make Close available.
- Expand **Pair history & details** for the latest 30 tracked pairs in this tab session. Export saves native position IDs, observed entry prices, entry/close click times and visibility confirmation. It omits wallet/browser identifiers and raw errors; it does not invent settlement prices or realized PnL.

## Install/update

The ZIP has **manifest.json at its root**. Extract it before loading an unpacked extension.

For an existing unpacked install, copy the new unpacked files into its existing folder, click **Reload** at chrome://extensions, then reload Papertrade. Keeping the same folder preserves the extension identity and saved watches. If loading v0.7.6 as a separate extension, disable the older version first so two copies cannot submit actions. Do not delete an old extension with active protective watches without reconciling those positions first.

## Verification of v0.7.6

**356 tests pass; production build succeeds.** Tests cover paired opens/closes, origin-tab binding, wallet identity, native venue limits, duplicate clicks, durable reservation before submission, partial/rejected entries, late fills after Close, uncertain entry/Close responses, worker restart, ambiguous matching, storage failure, and preservation of the existing limit/TP/SL behavior.

The rendered browser fixture verified: two simulated entries from one click; Close submitting both closes; two complete absent observations before Closed; rejected-short recovery closing only the filled long; Close during delayed fills closing the later short. Recovery was additionally checked in the browser fixture: lose original binding, restore the same native IDs with no new trades, then explicitly Close both legs. No funded manual-pair orders were placed, and the updated extension has not been certified in the user’s installed Chrome profile. The fixture uses the production pair controller, panel, and native adapters; its native ticket/account are simulated.

The toolbar overview fixture also verified active records, navigation-only Manage, unavailable-worker controls and reconnection. A wallet-switch fixture additionally verified a pending entry bound to wallet A submitting zero orders after switching to wallet B and crossing its trigger. The queue model, stream handshake/backoff/freshness, native fallback, non-blocking advisory behavior and stale widget display have focused tests. The live local preview uses the production feed through its Node preview server because the local browser origin could not connect directly to the stream. Production extension-origin connectivity and installed-profile behavior remain unverified; the native Status fallback is available. Run `npm test`, `npm run build`, and `npm run preview`. Open http://127.0.0.1:4320/trade/btc?scenario=pair for the pair fixture. Add `&reject=short` or `&delay=1` for failure and delayed-fill scenarios. Use `?scenario=overview` for the simulated toolbar popup.

---

# Papertrade order tools · v0.6.4

Limit entries, early SL/TP, position-row editing, protection status, an interactive order-level chart, and execution history.

## Install/update

The ZIP has `manifest.json` at its root. Replace the files of your existing unpacked extension with this release, reload it in `chrome://extensions`, then reload Papertrade. Do not run two versions together. The extracted folder is `papertrade-limit-orders-v0.6.4`. If loading a fresh extension, select that folder directly. New watches execute in the tab where they were armed; keep that tab open, native Positions visible, and your wallet authorized. Legacy watches without a tab binding should be re-armed from the intended tab.

## Price feed and entry precision

The extension calls Hyperliquid's public BBO WebSocket directly. Papertrade's current frontend calculates its displayed price as `(bid * askSize + ask * bidSize) / (bidSize + askSize)`, falling back to midpoint for zero total size. New watches use this same formula, rather than separate buy-ask/sell-bid triggers. This aligns the displayed-price calculation; it does not prove the venue's eventual settlement price uses the same formula.

Entry tolerance defaults to $2 and is editable. Reference quote source and receipt ages must be within 500 ms before entry; the native displayed price is checked immediately before the click. Missing/stale quotes or prices outside the window defer without clicking. A prepared native ticket skips redundant preparation. These are synthetic market triggers, not exchange-enforced limit prices. Wallet/relayer/settlement delay can cause a fill outside the window. Old watches retain their pricing rule until edited or recreated.

## Position controls and exits

Each rendered native position gets an Add/Edit SL/TP button and protection badge. Use these to arm or update exits without opening a new trade. You can also use the existing-position form in the panel. Save explicitly applies edits and may immediately attempt Close if the threshold is already crossed. Cancel exits leaves the position open. Duplicate active watches are rejected.

New exits default to a $2 early lead, adjustable to $1 or zero. Long SL triggers at SL + lead; long TP at TP - lead. Short SL triggers at SL - lead; short TP at TP + lead. Requested and effective levels appear in the order summary. Legacy watches keep their previous lead/rule. Close execution is still at market and cannot guarantee a price.

Armed, disconnected/data-delayed, native-Close-unavailable, close-pending, and needs-attention states appear beside the position. These controls monitor rendered native DOM and fresh quotes. They cannot maintain protection with the tab/browser closed, a stale account view, or a wallet prompt requiring your interaction.

## Close observations and history

A Close click becomes **Close pending**, never immediately success. The same position must be absent in two complete native Positions observations before the label becomes **Closed in Positions**. Partial/unavailable observations reset the absence count. A position still present after 30 seconds shows needs attention; uncertain closes never automatically replay.

This confirms observed removal from the displayed position list, not a transaction receipt, settlement price, or realized PnL. Account/view changes can affect what is rendered; verify the same wallet and native venue history. Settlement fields remain explicitly unverified.

Entry fill observations identify a new matching native position when a complete pre-entry snapshot exists, record its displayed fill price and deviation from target, and preserve quote/click timestamps. Ambiguous fills need attention. If Positions was incomplete before entry, no guessed fill is recorded. Execution history is expandable and exportable as local JSON. Exit settlement price/PnL is not fabricated.

## Chart editing

The order-level chart has its own labeled price scale in the extension panel. It does not guess the native canvas's zoom or coordinate mapping. It shows the current position mark and entry/SL/TP draft levels. Drag SL/TP or entry handles (entry is fixed for existing positions); Shift-drag gives finer movement. Arrow keys adjust $1, and numeric fields allow exact values. Changes remain drafts until Save/Arm/Set trigger. Risk estimates use margin × leverage × relative price move and exclude fees, early lead, slippage, and liquidation effects.

## Verification

69 automated tests pass. The prior v0.5.0 browser fixture verified native-row add/edit controls, draft keyboard/drag changes, zero entries while attaching exits, one simulated Close, close-pending → two absence observations → Closed in Positions, execution history, and stale-feed protection warning. Direct live Hyperliquid BTC BBO returned with 296 ms source age during development.

The fixture uses the production engine, panel, position controls and native adapter with simulated positions. No funded orders were placed; updated extension installation and funded execution/settlement remain unverified.

The toolbar overview fixture also verified active records, navigation-only Manage, unavailable-worker controls and reconnection. Run `npm test`, `npm run build`, and `npm run preview`. The fixture is at `http://127.0.0.1:4320/trade/btc?scenario=manual`.

## v0.6.0 · Execution timing

Position reads and Close acknowledgements run outside the short state-mutation queue. Entries perform native preflight and execution outside that queue too; every submit/Close is still reserved and saved before action. An unresolved observation, entry preparation, or another position's Close acknowledgement cannot hold up an unrelated armed exit. Quote work is coalesced, while fresh stop/TP crossings are latched for up to 750 ms so a brief crossing is not overwritten by the next quote. New exit actions require a source quote no older than 750 ms; native execution deadlines are 750 ms. A stale cross waits for a current quote instead of submitting against obsolete data. These checks do not enforce a final execution price.

Pending fill polling is 100 ms when quotes arrive, supplemented by a 25 ms debounced native Positions mutation signal. Transient observation failures keep retrying while exits are explicitly inactive; ambiguous fills still require user selection. Late responses cannot reactivate cancelled watches. The heartbeat/pulse remains a fallback; this is not a guarantee of 100 ms detection when Chrome suspends the tab or worker.

Hyperliquid BBO is supplemented with uncompressed top-of-book prices from l2Book snapshots, using server timestamps and real quantities. Because BBO publications occur only on a change, snapshots avoid treating an unchanged price as a newly fabricated quote. Both sources produce the same weighted-price calculation. Older frames cannot regress the engine's quote.

Execution history now records source age, trigger-to-native-click time, and the native pre-click price for closes. Entry tolerance remains a pre-click check; no final market-fill cap is added. Existing early-exit lead remains configurable and uncertain submissions never automatically replay.

Validation: 50 automated tests and build pass. Controlled Node benchmark with a 150 ms blocked position read: v0.5.0 median local Close dispatch 151 ms; v0.6.0 0–1 ms at millisecond clock resolution, with all five current runs dispatching before the blocked read returned. This excludes browser IPC, wallet, relayer and settlement latency. See the accompanying trigger benchmark JSON.

Current v0.6.0 browser validation was blocked by this session's security restrictions (local server bind denied and local-file browser URL denied). Prior browser screenshots apply to v0.5.0, not this release. No funded execution or real fill-within-tolerance claim is made. Actual price accuracy must be verified from user-observed fills after updating the extension and reloading Papertrade.

The v0.6.0 browser restriction was resolved after permissions were restored. Current v0.6.1 deliverables are staged in outputs and copied to Downloads.

## v0.6.1 · Tab routing and final TP checks

A real read-only browser inspection found two BTC tabs open. Previous routing refused every entry/Close whenever multiple matching tabs existed. New watches persist the originating tab ID and a browser-session binding. They use that exact tab even when another market tab is open. A closed/changed tab never falls back to a different tab. Browser-session changes mark saved bindings as needing attention; re-arm from the intended tab. Worker restarts within the same browser session retain the binding. Explicitly editing or reattaching an old watch binds it to the tab where you perform that action.

A final TP check reads the native Papertrade displayed price immediately before clicking Close. Long TP must still be at or above requested TP minus early lead; short TP must still be at or below requested TP plus early lead (allowing only display rounding). If price has reversed beyond that allowance, no click is sent; both SL and TP return to armed observation. SL still closes on an adverse move; it is not suppressed by a price cap that could leave the loss running. These are pre-click checks, not final venue-price guarantees.

History distinguishes a no-click price check from an actual Close dispatch. The native price, source age, and trigger/check/click timing are recorded separately. A no-click TP deferral has no clickedAt timestamp.

Current browser fixture verification: target entry $83,000 skips native $83,015; native $83,001 submits once, binds the resulting position, and reports $1 entry deviation. SL $83,020 with $2 lead clicks Close at native $83,018 and confirms two complete absent-position observations. TP $82,760 with $2 lead crosses $82,762 then reverses to $82,770; the adapter sends no Close and preserves SL. Returning to $82,762 submits exactly one Close. These are simulated orders using production engine/native adapter code, not funded executions. Multi-tab routing, tab closure/market change, and browser-session invalidation are verified by the bundled worker tests. Total: 56 tests pass.

A current public Hyperliquid capture decoded 25 BTC BBO/l2Book frames with no decoder errors; source ages ranged 374–869 ms. This verifies live decoding only. Older frames can be ineligible under the configured freshness requirements. Current Papertrade field selectors and empty Positions view were checked read-only. The extension was not mounted in the inspected live tab, and no live orders or reloads were performed. Actual funded entry/exit price accuracy remains unverified. Inspect execution history after your next ordinary trade to compare targets, native click prices and actual fills; do not infer settlement from a button click.


## v0.6.2 · Position mark alignment

Current deployed frontend inspection on October 15 found separate prices: the chart/header uses a size-weighted BBO price, while the native position mark uses the instrument-scaled midpoint. BTC uses scale 10 and ETH scale 100; midpoint integer division floors half increments. The decoder now reproduces that mark rounding. The panel displays both prices, and its level chart shows the mark.

New or explicitly edited/re-armed SL/TP watches follow the position mark. Existing stored watches retain their prior basis until explicitly changed; their basis appears in the summary. TP's final native check reads the bound position row's mark. History records both that mark check and header price. SL preserves the adverse-move close behavior.

New entries require both the weighted chart reference and midpoint mark inside the entry tolerance. If the chart matches but the mark is outside the window, the panel explains why it is waiting. The final native header check and freshness checks remain required.

60 automated tests and build pass. The production browser fixture verified a short TP at $82,990 with a $2 early lead closes once at mark $82,992 even with header $83,000. An entry targeting $83,000 stays unsubmitted with that $82,992 mark, then submits once at $83,001 when both prices enter the window. These are simulated executions, not funded fills.

The current signed OpenPosition and Close types include no limit price or slippage bound. Therefore the extension cannot enforce the final fill price. Actual funded fill accuracy remains unverified. Current public frontend source URLs and hashes are in the accompanying pricing-evidence JSON.


## v0.6.3 · Correct limit direction and explicit entry behavior

New entry forms default to **Limit price or better**: longs accept lower prices and shorts accept higher prices. Entry tolerance is an adverse pre-click allowance: long prices must be no higher than target + tolerance, and short prices no lower than target - tolerance. The chart/reference must first reach the limit; native price, mark, freshness and reference agreement are checked before submit. This cannot cap a final market fill.

**Near target only** retains the symmetric ± tolerance window. Existing saved watches retain that previous behavior until you explicitly edit, select Limit price or better, and save. Saving may execute immediately if conditions are already met. Reloading alone never converts saved watches. The edit form now correctly restores and saves tolerance as well as mode.

In limit mode, entries wait if the current mark or final native price has already crossed an attached effective SL or TP, including the configured early lead. This prevents opening a trade that would immediately demand an exit. It keeps watching, and can execute if price returns to a valid entry range before expiry. Edit or cancel to change that behavior.

The reported long target $82,201 with stop $82,150 and early lead $2 stays unsubmitted at mark $81,975.50 because the effective stop is $82,152. The panel explains that condition. At $82,180 it can submit at a better price while the stop remains valid. Without an already-crossed exit, better prices are accepted.

Verification: 65 tests pass and build succeeds. Browser fixture reproduced the crossed-stop wait, then exactly one simulated long at $82,180 with SL/TP bound to the resulting position. Automated tests cover both directions, adverse boundaries, quote freshness, legacy preservation, edited-mode/tolerance persistence, and final native checks. No funded order or settlement accuracy was verified. A screenshot cannot establish whether a prior eligible crossing was observed; exported execution history is still needed for that diagnosis.


## v0.6.4 · Visible cancellation controls

Active orders now appear directly below the live-price header, above the entry form and chart. Each waiting entry has a full-width **Cancel order** button. Cancellation removes it from Active orders, confirms that no entry will be sent, and retains it in Execution history with a cancellation event. Cancelling also leaves entry edit mode so Save cannot accidentally target the cancelled watch.

Armed exits and entries awaiting a fill show **Remove SL / TP**. This disables the extension's exit watch; it does not close the position or recall an entry already sent. Submitted/submitting entry and Close actions explicitly say they cannot be cancelled here and direct you to native Positions / Status. Completed/cancelled watches remain in history instead of crowding the active controls.

69 automated tests pass and build succeeds. Tests verify cancellation during a slow native preflight prevents eventual submission, cancelled state survives worker restart, submitted actions never falsely report cancellation, and disabled exits remain off after restart. Browser fixture verified Cancel order then a crossed target produced zero entry clicks, and Remove SL / TP then a crossed old stop left the simulated native position open with zero Close clicks. No funded cancellation or trade was performed.
