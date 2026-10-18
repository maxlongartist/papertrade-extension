import {readStoredPairs} from './manual-storage.js';
import {validOwner} from './account.js';
import {captureQueue} from './congestion-evidence.js';
import {nativeClick} from './execution-timing.js';
class PairStorageError extends Error {}
const active = (p) => p && p.status !== "closed";
const matches = (position, pair, side) =>
  position.market === pair.market &&
  position.side === side &&
  position.leverage === pair.leverage &&
  Math.abs(position.margin - pair.margin) <= 0.006;
export function createManualPairs({
  load,
  save,
  snapshot,
  identify = snapshot,
  execute,
  close,
  queue = () => null,
  validate = async () => {},
  originAvailable = async () => true,
  now = () => Date.now(),
  id = () => crypto.randomUUID(),
}) {
  let pairs = [],
    serial = Promise.resolve(),
    writes = Promise.resolve(),
    pulseJob,loadError=null;
  const ready = Promise.resolve()
    .then(load)
    .then((stored) => {
      pairs = readStoredPairs(stored);
      for (const pair of pairs) {
        for (const leg of pair.legs ?? []) {
          if (leg.entry === "sending") leg.entry = "uncertain";
          if (leg.close === "sending") leg.close = "uncertain";
        }
        if (!active(pair)) continue;
        // A worker restart breaks consecutive page observations, even when the
        // same tab/session binding survives. Retain intent and IDs, not freshness.
        observationGap(pair);
        pair.observedAt = null;
        pair.observationError = true;
        pair.message = "Tracking resumed. Waiting for a fresh native account observation.";
        for (const leg of pair.legs) {
          leg.visible = null;
          leg.markPrice = null;
        }
      }
    }).catch(error=>{loadError=error;throw error;});
  // Public requests still reject; observe the shared startup promise immediately.
  void ready.catch(()=>{});
  const queued = (fn) => {
    const job = serial.then(() => ready).then(fn);
    serial = job.catch(() => {});
    return job;
  };
  const persist = () => {
    const value = structuredClone(pairs);
    const job = writes.then(() => save(value)).catch(error=>{throw new PairStorageError(error.message,{cause:error});});
    writes = job.catch(() => {});
    return job;
  };
  const bound = (p, m) =>
    p.targetTabId === m.targetTabId && p.targetTabKey === m.targetTabKey;
  const current = (m) =>
    pairs.find((p) => bound(p, m) && active(p)) ??
    pairs.find((p) => bound(p, m) && p.market === m.market);
  function check(s, p) {
    if (!s?.ok) throw Error(s?.error ?? "Native account unavailable.");
    if (s.owner !== p.owner)
      throw Error(
        "Wallet changed. Return to the wallet that opened this pair.",
      );
    if (s.market !== p.market)
      throw Error("Return to " + p.market + " to manage this pair.");
  }
  function observationGap(pair) {
    for(const leg of pair.legs){
      leg.absent=0;
      if(!leg.positionId&&leg.entry!=="not_sent")leg.entryObservationInterrupted=true;
      if(!leg.closed&&["sending","submitted","uncertain"].includes(leg.close))leg.closeObservationInterrupted=true;
    }
  }
  async function observe(pair) {
    if (!active(pair)) return;
    let s;
    try {
      s = await snapshot(pair);
      check(s, pair);
    } catch (error) {
      pair.message = error.message;
      pair.observationError = true;
      observationGap(pair);
      await persist();
      return;
    }
    pair.observationError = false;
    pair.observedAt = now();
    pair.pending = s.pending;
    for (const leg of pair.legs) {
      if (!leg.positionId && leg.entry !== "not_sent") {
        const candidates = s.positions.filter(
          (p) =>
            matches(p, pair, leg.side) &&
            !pair.beforePositionIds.includes(p.positionId) &&
            !pair.legs.some((l) => l.positionId === p.positionId),
        );
        if (candidates.length > 1) {
          pair.status = "attention";
          pair.message =
            "Multiple matching " +
            leg.side +
            " fills. Use native Positions; no guessed close.";
          await persist();
          return;
        }
        if (candidates.length === 1) {
          Object.assign(leg, {
            positionId: candidates[0].positionId,
            fillPrice: candidates[0].entryPrice,
            entry: "filled",
            filledAt: now(),
            error: null,
          });
        }
      }
      if (leg.positionId) {
        const present = s.positions.find(
          (p) => p.positionId === leg.positionId,
        );
        if (present && !matches(present, pair, leg.side))
          throw Error("Bound position details changed. Nothing closed.");
        leg.absent = present ? 0 : (leg.absent ?? 0) + 1;
        leg.visible = Boolean(present);
        leg.markPrice = present && Number.isFinite(present.markPrice) && present.markPrice > 0 ? present.markPrice : null;
        if (leg.absent >= 2 && s.pending === 0 && !leg.closed) {leg.closed = true;leg.closedObservedAt=now();}
      }
    }
    const resolved = pair.legs.every((l) => l.entry === "not_sent" || l.closed);
    if (resolved && s.pending === 0) {
      pair.status = "closed";
      pair.closedAt = now();
      pair.message =
        "Pair closed in two complete native position observations.";
      await persist();
      return;
    }
    if (pair.closeRequested) {
      pair.status = "closing";
      pair.message =
        "Closing this pair. Any late matching fill will also be closed.";
      const closing = [],priorClose=new Map();
      for (const leg of pair.legs) {
        if (
          !leg.visible ||
          leg.closed ||
          ["sending", "submitted", "uncertain"].includes(leg.close) ||
          now() - (leg.lastCloseTry ?? 0) < 1000
        )
          continue;
        priorClose.set(leg,{close:leg.close,lastCloseTry:leg.lastCloseTry,closeRequestedAt:leg.closeRequestedAt});
        leg.close = "sending";
        leg.lastCloseTry = now();
        leg.closeRequestedAt=now();
        closing.push(leg);
      }
      if (closing.length) {
        try {await persist();}
        catch(error) {
          // No close adapter has been called for this batch. Restore only these
          // reservations; submitted or uncertain siblings must never be replayed.
          for(const leg of closing){
            for(const [key,value] of Object.entries(priorClose.get(leg)))if(value===undefined)delete leg[key];else leg[key]=value;
            leg.error="Close not submitted: "+error.message;
          }
          pair.status="attention";
          pair.message="Close reservation was not saved. Close remains requested; unsent legs will retry after storage recovers. "+error.message;
          try {await persist();} catch {}
          throw new PairStorageError(pair.message,{cause:error});
        }
      }
      await Promise.all(
        closing.map(async (leg) => {
          try {
            const result = await close({
              ...pair,
              side: leg.side,
              positionId: leg.positionId,
              manualPairId: pair.id,
              exitReason: "manual pair",
              deadline: now() + 2000,
            });
            if (result?.clicked === true) {
              leg.close = "submitted";
              leg.closeAcknowledgedAt=now();
              const clicked=nativeClick(result.clickedAt??result.executionCheck?.clickedAt,leg.closeRequestedAt,now());
              leg.closeClickedAt=clicked??now();leg.closeTimeSource=clicked==null?'acknowledgement':'native';
              leg.error = null;
            }
            else if (result?.clicked === false) {
              leg.close = "available";
              leg.error =
                result.error ??
                result.message ??
                "Native Close is not ready yet.";
            } else {
              leg.close = "uncertain";
              leg.error =
                result?.error ??
                "Close response unavailable. No duplicate click.";
            }
          } catch (error) {
            leg.close = "uncertain";
            leg.error = error.message;
          }
        }),
      );
      if (pair.legs.some((l) => l.close === "uncertain"))
        pair.message =
          "Close response uncertain. Check native Status; no duplicate Close is sent. Late matching fills are still monitored.";
    } else if (pair.legs.every((l) => l.entry === "filled" && !l.closed && l.visible)) {
      pair.status = "open";
      pair.message = "Both legs visible. Close pair whenever you’re ready.";
      const quantities = pair.legs.map(
        (l) => (pair.margin * pair.leverage) / l.fillPrice,
      );
      pair.delta = quantities[0] - quantities[1];
    } else {
      const elapsed = now() - pair.createdAt;
      pair.status =
        elapsed > 60000 ||
        pair.legs.some((l) => l.entry === "not_sent" || l.closed || (l.positionId && !l.visible))
          ? "attention"
          : "opening";
      pair.message =
        pair.status === "attention"
          ? "Pair incomplete or entry outcome uncertain. Close pair unwinds identified fills; native Status may need attention."
          : "Waiting for both native fills. No entry will be submitted twice.";
    }
    await persist();
  }
  // Recovery moves tracking only. It never replays an entry or close.
  async function recoveryFor(s, m) {
    if (!s?.ok || !/^0x[0-9a-f]{40}$/.test(s.owner ?? "")) return null;
    const candidates = pairs.filter(p => active(p) && p.owner === s.owner && !bound(p, m));
    if (candidates.length !== 1) return null;
    const p = candidates[0];
    let reason = "", canRestore = false;
    if (p.market !== m.market) reason = "Open " + p.market + " to restore this pair.";
    else if (await originAvailable(p)) reason = "This pair is managed in its original tab. Return there.";
    else if (p.legs.length !== 2 || new Set(p.legs.map(l=>l.side)).size !== 2 || !p.legs.every(l=>["long","short"].includes(l.side)) || new Set(p.legs.filter(l=>l.positionId).map(l=>l.positionId)).size !== p.legs.filter(l=>l.positionId).length)
      reason = "Saved pair is inconsistent. Check native Positions; nothing restored.";
    else if (s.pending) reason = "Wait for native pending requests to resolve before restoring.";
    else if (p.legs.some(l => l.entry !== "not_sent" && !l.positionId))
      reason = "An entry has no confirmed position ID. Check native Status; recovery cannot guess a fill.";
    else if (p.legs.some(l => l.closed && s.positions.some(pos=>pos.positionId===l.positionId)))
      reason = "A previously closed position is visible again. Check native Positions; nothing restored.";
    else if (p.legs.some(l => l.positionId && s.positions.some(pos => pos.positionId === l.positionId && !matches(pos, p, l.side))))
      reason = "Saved position details do not match native Positions. Nothing restored.";
    else { canRestore = true; reason = "Original tab unavailable. Restore tracking here; then press Close pair when ready. No trade is sent by Restore."; }
    return { id:p.id, market:p.market, margin:p.margin, leverage:p.leverage, canRestore, reason,
      legs:p.legs.map(l=>({side:l.side,positionId:l.positionId??null,entry:l.entry})) };
  }
  async function restorePair(m) {
    if (active(current(m))) throw Error("This tab already manages an active pair.");
    const s = await snapshot(m);
    if (!s?.ok) throw Error(s?.error ?? "Open native Positions first.");
    const offer = await recoveryFor(s, m);
    if (!offer || offer.id !== m.id) throw Error("Recoverable pair not found for this wallet.");
    if (!offer.canRestore) throw Error(offer.reason);
    const pair = pairs.find(p => p.id === offer.id);
    const before = structuredClone(pair);
    Object.assign(pair, {targetTabId:m.targetTabId,targetTabKey:m.targetTabKey,
      restoredAt:now(),status:"attention",observationError:false,observedAt:null,
      previousCloseRequested:pair.closeRequested===true,closeRequested:false,
      message:"Tracking restored. No trades sent. Press Close pair to close the identified legs."});
    for (const leg of pair.legs) {leg.absent=0;leg.visible=null;leg.markPrice=null;if(!leg.closed&&["sending","submitted","uncertain"].includes(leg.close))leg.closeObservationInterrupted=true;}
    try {await persist();} catch (error) {for(const key of Object.keys(pair))delete pair[key];Object.assign(pair,before);throw error;}
    // Do not observe here: even a pending Close intent must await a fresh user Close.
    return {pair:structuredClone(pair)};
  }
  async function preflight(s, m) {
    if (!s?.ok) throw Error(s?.error ?? "Open native Positions first.");
    if (!/^0x[0-9a-f]{40}$/.test(s.owner ?? "") || s.market !== m.market)
      throw Error("Connected wallet or market cannot be verified.");
    if(m.expectedOwner!=null&&(!validOwner(m.expectedOwner)||m.expectedOwner!==s.owner))
      throw Error("Wallet changed since readiness check. Refresh readiness before opening a pair.");
    if (pairs.some((p) => p.owner === s.owner && active(p)))
      throw Error(
        "This wallet already has a tracked pair. Return to its original tab.",
      );
    if (s.positions.length || s.pending)
      throw Error(
        "Close existing positions and wait for pending requests first. Stop the farming bot before using manual pairs.",
      );
    const ticket = s.ticket;
    if (!ticket?.ok || !ticket.ready)
      throw Error(
        ticket?.error ?? "Connect/authorize the native ticket first.",
      );
    if (
      !Number.isFinite(ticket.margin) ||
      ticket.margin <= 0 ||
      !Number.isInteger(ticket.leverage) ||
      ticket.leverage < 1
    )
      throw Error("Set a valid margin and leverage in the native ticket.");
    if(m.expectedTicket!=null&&(!Number.isFinite(m.expectedTicket.margin)||!Number.isInteger(m.expectedTicket.leverage)||m.expectedTicket.margin!==ticket.margin||m.expectedTicket.leverage!==ticket.leverage))
      throw Error("Margin or leverage changed since the displayed ticket. Check the updated ticket before opening a pair.");
    if (!Number.isFinite(s.available) || s.available < 2 * ticket.margin)
      throw Error("Available USDC must cover both margins.");
    await validate(s);
  }
  async function openPair(m) {
    if (active(current(m)))
      throw Error(
        "A pair is already being tracked. Close it before opening another.",
      );
    if (!/^[A-Z][A-Z0-9]{0,15}$/.test(m.market ?? ""))
      throw Error("Unsupported market.");
    const s = await snapshot(m);
    await preflight(s, m);
    const ticket = s.ticket;
    const pair = {
      id: id(),
      owner: s.owner,
      market: m.market,
      targetTabId: m.targetTabId,
      targetTabKey: m.targetTabKey,
      margin: ticket.margin,
      leverage: ticket.leverage,
      referencePrice: s.price,
      entryQueue: captureQueue(queue,now()),
      createdAt: now(),
      status: "opening",
      beforePositionIds: s.positions.map((p) => p.positionId),
      legs: ["long", "short"].map((side) => ({
        side,
        entry: "not_sent",
        close: "available",
      })),
      message: "Submitting the two native market entries.",
    };
    const previousPairs=pairs;
    pairs = [pair,...pairs].filter((p, i) => active(p) || i < 30);
    try {await persist();}
    catch(error) {
      // A concurrent Close may hold this object. Make it terminal before removing
      // the uncommitted attempt, so that queued observation cannot trade it.
      pair.status="closed";pair.closedAt=now();
      pair.message="Pair was not opened. No entries submitted.";
      pairs=previousPairs;
      throw Error(pair.message+" "+error.message);
    }
    for (const leg of pair.legs) {
      if (pair.closeRequested) break;
      // Recheck wallet, market and ticket before each leg. Parameters stay fixed.
      let checkSnapshot;
      try {
        checkSnapshot = await snapshot(pair);
        check(checkSnapshot, pair);
        if (
          leg.side === "long" &&
          (checkSnapshot.positions.length || checkSnapshot.pending)
        )
          throw Error(
            "Account changed before submission. Wait for existing requests and positions.",
          );
      } catch (error) {
        leg.error = error.message;
        break;
      }
      if (pair.closeRequested) break;
      leg.entry = "sending";
      leg.entryRequestedAt=now();
      try {await persist();}
      catch(error) {
        // execute has not been called for this leg. Preserve any earlier submitted
        // leg, but never leave this rejected reservation labelled as a live send.
        leg.entry="not_sent";delete leg.entryRequestedAt;
        leg.error="Entry not submitted: "+error.message;
        const noneSent=pair.legs.every(l=>l.entry==="not_sent");
        pair.status=noneSent?"closed":"attention";
        if(noneSent)pair.closedAt=now();
        pair.message=(noneSent?"No entries submitted. ":"Pair incomplete. Close pair unwinds identified fills. ")+leg.side+" entry reservation was not saved. "+error.message;
        // A persistent outage may reject this correction too. The failed leg
        // remains known not sent in memory; prior durable records are retained.
        try {await persist();} catch {}
        throw Error(pair.message);
      }
      // Close can arrive while durable reservation is pending. No native click
      // has happened yet, so cancel this reservation before dispatching the leg.
      if(pair.closeRequested){
        leg.entry="not_sent";delete leg.entryRequestedAt;
        await persist();
        break;
      }
      try {
        const result = await execute({
          ...pair,
          side: leg.side,
          manualPairId: pair.id,
          deadline: now() + 3000,
        });
        if (result?.clicked === true) {
          leg.entry = "submitted";
          leg.entryAcknowledgedAt=now();
          const clicked=nativeClick(result.clickedAt,leg.entryRequestedAt,now());
          leg.clickedAt=clicked??now();leg.clickTimeSource=clicked==null?'acknowledgement':'native';
        } else if (result?.clicked === false) {
          leg.entry = "not_sent";
          leg.error =
            result.error ?? result.message ?? "Native entry unavailable.";
          break;
        } else {
          leg.entry = "uncertain";
          leg.error = result?.error ?? "Native response unavailable.";
          break;
        }
      } catch (error) {
        leg.entry = "uncertain";
        leg.error = error.message;
        break;
      }
      await persist();
    }
    await persist();
    if (pair.legs.every((l) => l.entry === "not_sent")) {
      pair.status = "closed";
      pair.closedAt = now();
      pair.message =
        "No entries submitted. " +
        (pair.legs.find((l) => l.error)?.error ?? "");
      await persist();
    } else await observe(pair);
    return { pair: structuredClone(pair) };
  }
  return {
    ready,
    records: async () => { await ready; return structuredClone(pairs.filter(active)); },
    blocksEntries: () => Boolean(loadError)||pairs.some(active),
    pulse() {
      if (pulseJob) return pulseJob;
      pulseJob = queued(async () => {
        for (const p of pairs.filter(active))
          try {
            await observe(p);
          } catch (error) {
            p.status = "attention";
            // Storage can fail after a complete verified read. Preserve that
            // observation; only read/identity/detail errors create a timing gap.
            if(!(error instanceof PairStorageError)){
              p.observationError = true;
              observationGap(p);
            }
            p.message = error.message;
            await persist();
          }
      }).finally(() => {
        pulseJob = null;
      });
      return pulseJob;
    },
    async request(m) {
      await ready;
      if (m.type === "pairClose") {
        const pair = current(m);
        if (!active(pair) || pair.id !== m.id)
          throw Error("Tracked pair not found in this tab.");
        if (pair.market !== m.market)
          throw Error("Return to " + pair.market + " before closing.");
        if (!pair.closeRequested) pair.closeQueue = captureQueue(queue,now());
        pair.closeRequested = true;
        await persist();
        return queued(async () => {
          await persist();
          await observe(pair);
          return { pair: structuredClone(pair) };
        });
      }
      if (m.type === "pairOpen") return queued(() => openPair(m));
      if (m.type === "pairRestore") return queued(() => restorePair(m));
      if (m.type === "pairInspect") {
        let recovery = null;
        try {
          const s = await snapshot(m);
          recovery = await recoveryFor(s, m);
          await preflight(s, m);
          return { ready: true, owner:s.owner, ticket:{margin:s.ticket.margin,leverage:s.ticket.leverage}, available: s.available, checkedAt: now() };
        } catch (error) { return { ready: false, reason: recovery?.reason ?? error.message, checkedAt: now(), ...(recovery ? {recovery} : {}) }; }
      }
      if (m.type === "pairHistory") {
        const identity=await identify(m);
        if(!identity?.ok||!/^0x[0-9a-f]{40}$/.test(identity.owner??'')||identity.market!==m.market)
          throw Error(identity?.error??'Connected wallet and market could not be verified. Reload Papertrade before reading saved history.');
        return {owner:identity.owner,market:m.market,checkedAt:now(),history:structuredClone(pairs.filter(p=>p.owner===identity.owner&&p.market===m.market&&p.status==='closed').slice(0,30))};
      }
      if (m.type === "pairState")
        return {
          pair: structuredClone(current(m) ?? null),
          history: structuredClone(pairs.filter(p => bound(p, m)).slice(0, 30)),
        };
      throw Error("Unsupported manual pair request.");
    },
  };
}
