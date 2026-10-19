import {findEntryFillConflict,entryFillMarginTolerance} from './entry-fill-conflicts.js';
import {canCancelEntry,invalidEntryExpiryMessage} from './order-actions.js';
import {nativeClick} from './execution-timing.js';
import {validOwner,verifySnapshot} from './account.js';
import { fresh, hit, validateOrder, exitReason, entryWindow, validateExits, papertradePrice,exitTriggerPrice,entryBlockReason } from './core.js';
// Same engine runs in Chrome and the browser integration fixture.
export function createEngine({ load, save, probe, execute, positions, close, now = () => Date.now(), timeoutMs = 5000 }) {
  let orders = [], ticks = {}, venue = null, feed = 'Connecting', serial = Promise.resolve(), quoteRun=null,quoteDirty=false;
  const initialized = load().then(async stored => {
    orders = Array.isArray(stored) ? stored : [];
    let changed = false;
    orders = orders.map(order => {
      if(order.status==='watching'&&order.entryMode==='market'){changed=true;return {...order,status:'cancelled',message:'Unsubmitted market request discarded after restart. Submit explicitly again.'};}
      if (['watching','awaiting_fill','submitted','exits_armed','close_submitted'].includes(order.status) && !validOwner(order.owner)) {
        changed=true;return {...order,status:'attention',message:'Saved watch has no verified wallet binding. Re-arm it from your intended wallet. No automatic action.'};
      }
      if(order.status==='watching'&&(!Number.isFinite(order.expiresAt)||order.expiresAt<=0||order.expiresAt>8640000000000000)) {
        changed=true;return {...order,status:'attention',entryDisabledReason:'invalid_expiry',message:invalidEntryExpiryMessage};
      }
      if(order.status==='attention'&&order.message===invalidEntryExpiryMessage&&order.entryDisabledReason!=='invalid_expiry'&&(!Number.isFinite(order.expiresAt)||order.expiresAt<=0||order.expiresAt>8640000000000000)) {
        changed=true;return {...order,entryDisabledReason:'invalid_expiry'};
      }
      if(order.status==='exits_armed')return {...order,positionObservation:'unknown',positionCheckedAt:null};
      if (order.status === 'close_submitted') {
        // Observations on opposite sides of a worker restart are not consecutive.
        changed = true;
        return {...order,absentCount:0,closeCheckAt:null,closeObservation:'Awaiting fresh observation',message:'Close already submitted. Waiting for two fresh complete native observations; no retry.'};
      }
      if (!['submitting','closing'].includes(order.status)) return order;
      changed = true;
      return { ...order, status: 'attention', message: 'Restart interrupted execution. Check native Positions and Status; no retry.' };
    });
    if (changed) await save(orders);
  });
  const queued = fn => {
    const run = serial.then(() => initialized).then(fn);
    serial = run.catch(() => {});
    return run;
  };
  async function persist() { await save(structuredClone(orders)); }
  // User changes become active only after storage acknowledges the complete snapshot.
  async function commitOrderSet(next,failure='Watch change was not saved. Previous settings remain active.') {
    try{await save(structuredClone(next));}
    catch(error){throw Error(`${failure} ${error.message}`);}
    orders=next;
  }
  async function commitWatch(index,watch,failure) {
    const next=orders.slice();next[index]=watch;await commitOrderSet(next,failure);
  }
  const lastPositionCheck = {}, observationJobs=new Map(), closeJobs=new Map(), entryJobs=new Map(), crossings=new Map(), observationDirty=new Set();
  const journal=(order,type,extra={})=>{order.events=[...(order.events??[]),{at:now(),type,...extra}].slice(-50);};
  const entryFillConflictMessage=order=>`A matching ${order.market} ${order.side} entry is pending. SL / TP needs an unambiguous fill; wait for it to fill or cancel its watch before submission.`;
  function assertEntryFillUnambiguous(order){if(findEntryFillConflict(order,orders))throw Error(entryFillConflictMessage(order));}
  const retain=list=>{const live=list.filter(o=>['watching','submitting','awaiting_fill','submitted','exits_armed','closing','close_submitted'].includes(o.status));const done=list.filter(o=>!live.includes(o));return [...live,...done.slice(0,Math.max(0,200-live.length))];};
  // Page reads run outside the mutation queue: slow UI/settlement reads cannot block exits.
  async function applyObservation(index, observedSnapshot) {
    for(const targetIndex of [index]) {
      let order=orders[targetIndex];index=targetIndex;
      if(order.status==='exits_armed') {
        // Ephemeral health only: do not write to disk on every page poll, disarm
        // the watch, mark a position closed, or gate price-triggered exits.
        let state='unavailable';
        try{verifySnapshot(observedSnapshot,order.owner);state=observedSnapshot.positions.some(p=>p.market===order.market&&p.side===order.side&&p.positionId===order.positionId)?'visible':'absent';}catch{}
        orders[index]={...order,positionObservation:state,positionCheckedAt:now()};continue;
      }
      if(order.status==='close_submitted') {
        try {const observed=observedSnapshot;verifySnapshot(observed,order.owner);
          const exists=observed.positions.some(p=>p.market===order.market&&p.positionId===order.positionId);
          const absent=exists?0:(order.absentCount??0)+1;
          order=orders[index]={...order,absentCount:absent,closeCheckAt:now(),closeObservation:exists?'Position still open':'Position absent'};
          if(absent>=2){order.status='closed';order.closedObservedAt=now();order.message='Closed in native Positions: absent in two complete observations. Settlement price/PnL unverified.';journal(order,'position_absent');}
          else if(exists && now()-(order.closeSubmittedAt??now())>30000)order.message='Close submitted but position remains open. Needs attention; no automatic retry.';
          await persist();
        }catch(error){orders[index]={...order,absentCount:0,closeObservation:'Unavailable',message:'Close confirmation unavailable: '+error.message};await persist();}continue;
      }
      if (order.status === 'awaiting_fill' || (order.status==='submitted'&&order.bindingSnapshotComplete===true&&typeof positions==='function')) {
        if (now() >= (order.entryMode==='market'?(order.submittedAt??order.createdAt)+86400000:order.expiresAt)) {
          orders[index] = {...order,status:'attention',message:'Fill monitoring expired. Attach exits to the intended native position explicitly.'};await persist();continue;
        }
        try {
          const observed = observedSnapshot;
          verifySnapshot(observed,order.owner);
          const observedPositions = observed.positions.filter(p=>p.market===order.market && p.side===order.side);
          orders[index] = {...orders[index],lastObservedPositions:observedPositions,lastObservedAt:now()};
          const used = new Set(orders.filter(o=>o.owner===order.owner&&o.market===order.market).map(o=>o.positionId).filter(Boolean));
          const candidates = observed.positions.filter(p=>p.market===order.market && p.side===order.side && !order.beforePositionIds.includes(p.positionId) && !used.has(p.positionId) && p.leverage===order.leverage && Math.abs(p.margin-order.margin)<=entryFillMarginTolerance);
          if (candidates.length > 1) {const error=Error('Multiple matching fills; cannot select a position safely.');error.ambiguous=true;throw error;}
          if (!candidates.length) {
            if(order.status==='submitted')continue;
            orders[index] = {...orders[index],message:`Exits INACTIVE: ${observedPositions.length} native position(s) observed; none is a new matching fill. Use Attach exits to select the intended position.`,bindingDiagnostic:{beforePositionIds:order.beforePositionIds,observed:observedPositions}};await persist();continue;
          }
          const filled=candidates[0],hasExits=order.stopLoss!=null||order.takeProfit!=null;
          order = orders[index] = {...order,fillPrice:filled.entryPrice,fillObservedAt:now(),entryDeviation:Number.isFinite(filled.entryPrice)?filled.entryPrice-order.price:null,positionId:filled.positionId,positionObservation:'visible',positionCheckedAt:now(),status:hasExits?'exits_armed':'filled',message:hasExits?`TP / SL armed for native position #${filled.positionId}.`:`Entry observed in native position #${filled.positionId}.`};journal(order,'fill_observed',{price:filled.entryPrice});await persist();
        } catch (error) {
          orders[index] = {...order,status:error.ambiguous?'attention':order.status,observationFailures:(order.observationFailures??0)+1,message:`${order.status==='submitted'?'Fill identification pending':'Exits inactive; retrying position observation'}: ${error.message}`};await persist();continue;
        }
      }
    }
    await manageExits();
  }
  function scheduleObservations({forceMarket}={}) {
    if(typeof positions!=='function')return;
    for(const order of orders) {
      if(!['exits_armed','close_submitted','awaiting_fill'].includes(order.status)&&!(order.status==='submitted'&&order.bindingSnapshotComplete===true))continue;
      if(observationJobs.has(order.id)){if(forceMarket===order.market)observationDirty.add(order.id);continue;}
      const interval=order.status==='awaiting_fill'?100:1000;
      if(forceMarket!==order.market&&now()-(lastPositionCheck[order.id]??0)<interval)continue;
      lastPositionCheck[order.id]=now();const status=order.status;
      const job=Promise.resolve().then(()=>positions(structuredClone(order))).catch(error=>({error:error.message})).then(observed=>queued(async()=>{
        const index=orders.findIndex(o=>o.id===order.id&&o.status===status);
        if(index>=0)await applyObservation(index,observed);
      })).finally(()=>{observationJobs.delete(order.id);if(observationDirty.delete(order.id))void queued(()=>scheduleObservations({forceMarket:order.market}));});
      observationJobs.set(order.id,job);job.catch(()=>{});
    }
  }
  async function manageExits() {
    for (let index = 0; index < orders.length; index++) {
      let order = orders[index];
      if (order.status !== 'exits_armed') continue;
      const crossing=crossings.get(order.id),current=ticks[order.market];
      const latched=crossing&&now()-crossing.receivedAt<=750&&now()-crossing.sourceAt<=750;
      const reason = latched?crossing.reason:exitReason(order,current,now());
      if(crossing&&!latched)crossings.delete(order.id);
      if (!reason || (!latched&&(!current||now()-current.sourceAt>750||current.sourceAt>now()+100))) continue;
      orders[index] = {...order,status:'closing',triggeredExitAt:latched?crossing.receivedAt:now(),triggerQuoteSourceAt:latched?crossing.sourceAt:current.sourceAt,triggeredExitPrice:latched?crossing.price:(exitTriggerPrice(order,current)),exitReason:reason,message:`${reason} reached. Other exit disarmed; closing #${order.positionId}…`};journal(orders[index],'exit_triggered',{price:orders[index].triggeredExitPrice,reason});await persist();
      crossings.delete(order.id);
      const reserved=structuredClone(orders[index]),deadline=now()+750;
      let timer;
      const job=Promise.race([close({...reserved,deadline}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Close acknowledgement timed out.')),timeoutMs);})])
        .then(result=>{if(result?.deferred===true&&result.clicked===false)return {result};if(!result?.ok||!result.clicked)throw Error(result?.error??'Native Close not acknowledged.');return {result};},error=>({error}))
        .catch(error=>({error})).then(outcome=>queued(async()=>{
          const at=orders.findIndex(o=>o.id===reserved.id&&o.status==='closing');if(at<0)return;
          if(outcome.result?.deferred===true&&outcome.result.clicked===false){orders[at]={...orders[at],status:'exits_armed',exitExecutionCheck:outcome.result.executionCheck??null,message:outcome.result.message??'TP outside price allowance. Nothing clicked; watching exits again.'};journal(orders[at],'exit_deferred');await persist();if(exitReason(orders[at],ticks[orders[at].market],now())==='stop loss')await manageExits();return;}
          orders[at]=outcome.error?{...orders[at],status:'attention',message:`Exit needs attention: ${outcome.error.message} Check native position immediately. No automatic retry.`}:{...orders[at],status:'close_submitted',closeSubmittedAt:now(),exitExecutionCheck:outcome.result.executionCheck??null,message:outcome.result.message??`${reason} Close submitted. Check native settlement.`};
          journal(orders[at],orders[at].status);await persist();
        })).finally(()=>{clearTimeout(timer);if(closeJobs.get(reserved.id)===job)closeJobs.delete(reserved.id);});
      closeJobs.set(reserved.id,job);job.catch(()=>{});
    }
  }
  function startEntry(order) {
    if(entryJobs.has(order.id))return;
    let reserved=null,timer,recheck=false;const startingTick=ticks[order.market],revision=order.editRevision??0;
    const job=Promise.resolve().then(()=>probe(structuredClone(order))).then(ready=>queued(async()=>{
      const index=orders.findIndex(o=>o.id===order.id&&o.status==='watching');if(index<0)return null;
      const current=orders[index];
      if((current.editRevision??0)!==revision){recheck=true;return null;}
      if(now()>=current.expiresAt){orders[index]={...current,status:'expired',message:'Entry watch expired during native checks. Nothing submitted.'};await persist();return null;}
      if(!ready?.ok)throw Error(ready?.error??'Native order ticket unavailable.');
      if(!validOwner(current.owner)||ready.owner!==current.owner)throw Error('Wallet changed before submission. Return to the original wallet.');
      if(current.entryTolerance!=null&&ready.precisionSupported!==true)throw Error('Reload Papertrade to activate the new entry price checks.');
      validateOrder(current,venue,now());
      if(findEntryFillConflict(current,orders)){orders[index]={...current,message:entryFillConflictMessage(current)};await persist();return null;}
      if(!entryWindow(current,ticks[current.market],now()))return null;
      orders[index]={...current,status:'submitting',triggeredAt:now(),message:'Submitting through native Papertrade ticket…'};await persist();
      if(now()>=current.expiresAt){orders[index]={...orders[index],status:'expired',message:'Entry watch expired while saving its reservation. Nothing submitted.'};await persist();return null;}
      const deadline=Math.min(now()+750,Number.isFinite(current.expiresAt)?current.expiresAt-1:Infinity);
      reserved={...orders[index],deadline,referenceQuote:structuredClone(ticks[current.market])};return reserved;
    })).then(async execution=>{
      if(!execution)return null;
      return await Promise.race([execute(execution),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Page did not acknowledge before timeout. Check native Positions and Status.')),timeoutMs);})]);
    }).then(result=>queued(async()=>{
      if(!reserved)return;
      const index=orders.findIndex(o=>o.id===order.id&&o.status==='submitting');if(index<0)return;
      if(result?.deferred===true&&result.clicked===false){orders[index]={...orders[index],status:'watching',message:result.message??'Price left entry window. Nothing submitted; watching again.'};await persist();return;}
      if(!result?.ok||!result.clicked)throw Error(result?.error??'Native submission was not acknowledged.');
      const hasExits=reserved.stopLoss!=null||reserved.takeProfit!=null;
      if(hasExits&&!Array.isArray(result.beforePositionIds))throw Error('Entry response lacks position snapshot. Exits inactive; check Positions.');
      orders[index]={...orders[index],entryTriggerPrice:reserved.priceMode==='papertrade'?papertradePrice(reserved.referenceQuote):(reserved.side==='long'?reserved.referenceQuote.ask:reserved.referenceQuote.bid),bindingSnapshotComplete:result.bindingSnapshotComplete??false,executionCheck:result.executionCheck??null,beforePositionIds:result.beforePositionIds??[],status:hasExits?'awaiting_fill':'submitted',submittedAt:now(),entryClickedAt:nativeClick(result.clickedAt,reserved.triggeredAt??reserved.createdAt,now()),message:hasExits?'Entry clicked. TP / SL INACTIVE until native fill is identified.':result.message??'Native submit clicked. Verify venue confirmation in Positions / Status.'};
      journal(orders[index],orders[index].status,{triggerPrice:orders[index].entryTriggerPrice});await persist();scheduleObservations();
    })).catch(error=>queued(async()=>{
      const index=orders.findIndex(o=>o.id===order.id&&['watching','submitting'].includes(o.status));if(index<0)return;
      if(!reserved&&(orders[index].editRevision??0)!==revision){recheck=true;return;}
      orders[index]={...orders[index],status:reserved?'attention':'failed',message:`${error.message} No automatic retry.`};journal(orders[index],orders[index].status);await persist();
    })).finally(()=>{clearTimeout(timer);entryJobs.delete(order.id);if(recheck||ticks[order.market]!==startingTick)void queued(process);});
    entryJobs.set(order.id,job);job.catch(()=>{});
  }
  async function process() {
    await manageExits();
    scheduleObservations();
    for (let index = 0; index < orders.length; index++) {
      const order = orders[index];
      if (order.status !== 'watching') continue;
      if (now() >= order.expiresAt) {
        orders[index] = { ...order, status: 'expired', message: order.entryMode==='market'?'Market request expired after 10 seconds. Nothing submitted.':'24-hour watch expired. Nothing submitted.' };
        await persist(); continue;
      }
      if(findEntryFillConflict(order,orders)){const message=entryFillConflictMessage(order);if(order.message!==message){orders[index]={...order,message};await persist();}continue;}
      if (!entryWindow(order, ticks[order.market], now())) {
        const reason=entryBlockReason(order,ticks[order.market],now());if(order.message!==reason){orders[index]={...order,message:reason};await persist();}
        continue;
      }
      startEntry(order);
    }
  }
  function scheduleQuoteProcessing() {
    if(quoteRun){quoteDirty=true;return quoteRun;}
    quoteRun=queued(async()=>{do{quoteDirty=false;await process();}while(quoteDirty);}).finally(()=>{quoteRun=null;if(quoteDirty)void scheduleQuoteProcessing();});return quoteRun;
  }
  return {
    setVenue(value) { venue = value; },
    setFeed(value) { feed = value; },
    quote(tick) {
      if (!fresh(tick, now()) || !['BTC', 'ETH'].includes(tick.market) || tick.sourceAt < (ticks[tick.market]?.sourceAt ?? 0)) return Promise.resolve();
      ticks[tick.market] = tick;
      // Preserve brief fresh crossings even when a subsequent quote reverses before evaluation.
      for(const order of orders)if(order.status==='exits_armed'&&order.market===tick.market&&!crossings.has(order.id)) {
        const reason=exitReason(order,tick,now());if(reason&&now()-tick.sourceAt<=750&&tick.sourceAt<=now()+100&&now()-tick.receivedAt<=750)crossings.set(order.id,{reason,sourceAt:tick.sourceAt,receivedAt:now(),price:exitTriggerPrice(order,tick)});
      }
      return scheduleQuoteProcessing().then(()=>queued(()=>{}));
    },
    pulse() { return queued(process).then(()=>queued(()=>{})); },
    settled() {return new Promise((resolve,reject)=>setTimeout(()=>queued(()=>{}).then(resolve,reject),0));},
    request(message) {
      const prepare=async()=>{
        await initialized;
        if(message.type==='create'||message.type==='check')return {ready:await probe(message.order)};
        if(['listPositions','protectPosition','positionsForOrder','attachExits','editWatch'].includes(message.type)) {
          const order=orders.find(o=>o.id===message.id);
          const editRevision=order?.editRevision??0,editStatus=order?.status;
          if(message.type==='editWatch'&&order?.status==='watching') {
            const ready=await probe({...order,targetTabId:message.targetTabId??order.targetTabId,targetTabKey:message.targetTabKey??order.targetTabKey});
            return {ready,editStatus,editRevision,probeAt:now()};
          }
          const market=message.market??order?.market;if(!['BTC','ETH'].includes(market))throw Error('Invalid market.');
          const snapshot=await positions({...order,market,targetTabId:message.targetTabId??order?.targetTabId,targetTabKey:message.targetTabKey??order?.targetTabKey});return {snapshot,snapshotAt:now(),editStatus,editRevision};
        }
        return {};
      };
      const response=prepare().then(prepared=>queued(async () => {
        if(message.type==='positionsChanged'){scheduleObservations({forceMarket:message.market});return {ok:true};}
        if (message.type === 'state') return { orders: structuredClone(orders), ticks: structuredClone(ticks), venue, feed };
        if (message.type === 'check') return prepared.ready;
        if (message.type === 'create') {
          if (orders.filter(o => ['watching', 'submitting'].includes(o.status)).length >= 10) throw Error('Maximum 10 active watches.');
          if(message.order.entryMode==='market'&&!fresh(ticks[message.order.market],now()))throw Error('Waiting for a fresh market quote.');
          const input=message.order.entryMode==='market'?{...message.order,price:papertradePrice(ticks[message.order.market])}:message.order;
          const order = validateOrder(input, venue, now());
          if (!fresh(ticks[order.market], now())) throw Error('Waiting for a fresh market quote.');
          const ready = prepared.ready;
          if (!ready?.ok) throw Error(ready?.error ?? 'Connect and authorize your wallet first.');
          if(!validOwner(ready.owner))throw Error('Connected wallet identity unavailable. Reload Papertrade before arming a watch.');
          order.owner=ready.owner;
          if(ready.precisionSupported!==true)throw Error('Reload Papertrade to activate the new entry price checks.');
          assertEntryFillUnambiguous(order);
          journal(order,'created',{target:order.price});await commitOrderSet(retain([order,...orders]),'This watch was not armed. Existing watches remain active.');
          // Immediate marketable thresholds must execute without waiting for another tick.
          await process();
          return { order: structuredClone(orders.find(o => o.id === order.id)) };
        }
        if(message.type==='listPositions' || message.type==='protectPosition') {
          if(!['BTC','ETH'].includes(message.market))throw Error('Invalid market.');
          const snapshot=prepared.snapshot;if(now()-prepared.snapshotAt>500)throw Error('Position observation expired; try again.');verifySnapshot(snapshot);
          const visible=snapshot.positions.filter(p=>p.market===message.market&&['long','short'].includes(p.side));
          if(message.type==='listPositions')return {owner:snapshot.owner,positions:visible};
          if(message.expectedOwner!=null&&(!validOwner(message.expectedOwner)||message.expectedOwner!==snapshot.owner))throw Error('Wallet changed after position selection. Load positions again before saving.');
          const matches=visible.filter(p=>p.positionId===String(message.positionId));
          if(matches.length!==1)throw Error('Selected native position is no longer available. Refresh positions.');
          const target=matches[0];
          if(!Number.isFinite(target.entryPrice)||target.entryPrice<=0||!Number.isFinite(target.margin)||target.margin<=0||!Number.isInteger(target.leverage)||target.leverage<1)throw Error('Native position details could not be read safely.');
          if(orders.some(o=>o.owner===snapshot.owner&&o.market===message.market&&o.positionId===target.positionId&&['exits_armed','closing','close_submitted'].includes(o.status)))throw Error('Position already has an active or submitted exit.');
          if(!fresh(ticks[message.market],now()))throw Error('Waiting for a fresh market quote.');
          const exits=validateExits({...message,side:target.side},2);if(exits.stopLoss==null&&exits.takeProfit==null)throw Error('Enter a stop loss or take profit.');
          const order={...target,...exits,owner:snapshot.owner,price:target.entryPrice,id:crypto.randomUUID(),targetTabId:message.targetTabId,targetTabKey:message.targetTabKey,kind:'position_exits',positionObservation:'visible',positionCheckedAt:now(),exitPriceMode:'mark',priceMode:'papertrade',status:'exits_armed',createdAt:now(),userAttached:true,message:`TP / SL armed for existing native position #${target.positionId}. No entry opened.`};
          journal(order,'exits_armed');await commitOrderSet(retain([order,...orders]),'This watch was not armed. Existing watches remain active.');await manageExits();return {ok:true,order:structuredClone(orders.find(o=>o.id===order.id))};
        }
        if (message.type === 'positionsForOrder' || message.type === 'attachExits') {
          const index=orders.findIndex(o=>o.id===message.id),order=orders[index];
          if(!order || !(order.stopLoss!=null || order.takeProfit!=null) || !['attention','awaiting_fill'].includes(order.status))throw Error('This order has no inactive exits to attach.');
          const snapshot=prepared.snapshot;if(now()-prepared.snapshotAt>500)throw Error('Position observation expired; try again.');verifySnapshot(snapshot,order.owner);
          const matches=snapshot.positions.filter(p=>p.market===order.market&&p.side===order.side&&p.leverage===order.leverage&&Math.abs(p.margin-order.margin)<=entryFillMarginTolerance);
          if(message.type==='positionsForOrder')return {positions:matches,beforePositionIds:order.beforePositionIds??[],diagnostic:order.bindingDiagnostic??null};
          const target=matches.find(p=>p.positionId===String(message.positionId));if(!target)throw Error('Selected native position no longer matches this ticket.');
          if(orders.some(o=>o.id!==order.id&&o.owner===order.owner&&o.market===order.market&&o.positionId===target.positionId&&['exits_armed','closing','close_submitted'].includes(o.status)))throw Error('Position already has an active or submitted exit.');
          const attached={...order,owner:snapshot.owner,targetTabId:message.targetTabId??order.targetTabId,targetTabKey:message.targetTabKey??order.targetTabKey,exitPriceMode:'mark',positionId:target.positionId,positionObservation:'visible',positionCheckedAt:now(),userAttached:true,status:'exits_armed',message:`TP / SL armed by your selection for #${target.positionId}.`};
          await commitWatch(index,attached);await manageExits();return {ok:true,order:structuredClone(orders.find(o=>o.id===order.id))};
        }
        if(message.type==='editWatch') {
          const index=orders.findIndex(o=>o.id===message.id),order=orders[index];
          if(!order||!['watching','exits_armed'].includes(order.status))throw Error('Only watching entries or armed exits can be edited.');
          if(prepared.editStatus!==order.status)throw Error('Only watching entries or armed exits can be edited. Refresh before editing this changed order.');
          const expected=message.expectedRevision??0,current=order.editRevision??0;
          if(!Number.isSafeInteger(expected)||expected<0)throw Error('Invalid edit revision. Reopen Edit before saving.');
          if(expected!==current||prepared.editRevision!==current)throw Error('This watch changed since you opened Edit or changed while saving. Reopen Edit to load the latest settings; your draft is retained.');
          if(!fresh(ticks[order.market],now()))throw Error('Fresh quote required before editing.');
          const changes=validateExits({...message,side:order.side},order.exitLead??2);let edited;
          if(order.status==='exits_armed') {const snapshot=prepared.snapshot;if(now()-prepared.snapshotAt>500)throw Error('Position observation expired; try again.');verifySnapshot(snapshot,order.owner);if(!snapshot.positions.some(p=>p.market===order.market&&p.positionId===order.positionId))throw Error('Position no longer available.');if(changes.stopLoss==null&&changes.takeProfit==null)throw Error('Enter SL or TP, or use Cancel exits.');edited={...order,...changes,positionObservation:'visible',positionCheckedAt:now(),exitPriceMode:'mark',targetTabId:message.targetTabId??order.targetTabId,targetTabKey:message.targetTabKey??order.targetTabKey,priceMode:'papertrade'};}
          else {
            const ready=prepared.ready;
            if(!ready?.ok)throw Error(ready?.error??'Connect and authorize your wallet first.');
            if(!validOwner(ready.owner)||!validOwner(order.owner))throw Error('Connected wallet identity unavailable. Reload Papertrade before editing.');
            if(ready.owner!==order.owner)throw Error('Wallet changed. Switch to the original wallet before editing this watch.');
            if(ready.precisionSupported!==true)throw Error('Reload Papertrade to activate the new entry price checks.');
            if(now()-prepared.probeAt>500)throw Error('Wallet observation expired; try again.');
            const validated=validateOrder({...order,...changes,price:message.price??order.price,entryTolerance:message.entryTolerance??order.entryTolerance,entryMode:message.entryMode??order.entryMode??'near',priceMode:'papertrade'},venue,now());assertEntryFillUnambiguous({...order,...changes});edited={...order,...changes,exitPriceMode:'mark',entryTolerance:validated.entryTolerance,entryMode:validated.entryMode,price:validated.price,targetTabId:message.targetTabId??order.targetTabId,targetTabKey:message.targetTabKey??order.targetTabKey,priceMode:'papertrade'};}
          edited.editRevision=current+1;edited.message='Updated watch. Crossed thresholds can execute immediately.';journal(edited,'edited');
          await commitWatch(index,edited);crossings.delete(order.id);await process();return {order:structuredClone(orders.find(o=>o.id===message.id))};
        }
        if (message.type === 'cancelExits') {
          const index=orders.findIndex(o=>o.id===message.id),order=orders[index];if(!order||!['awaiting_fill','exits_armed'].includes(order.status))throw Error('Exit watch cannot be cancelled in this state.');
          const cancelled={...order,status:'exits_disabled',message:'SL / TP removed. Any existing position remains open; a submitted entry has not been cancelled.'};journal(cancelled,'exits_cancelled');await commitWatch(index,cancelled);crossings.delete(order.id);return {ok:true,message:cancelled.message};
        }
        if (message.type === 'cancel') {
          const index=orders.findIndex(o=>o.id===message.id),order=orders[index];
          if (!canCancelEntry(order)) throw Error('Only a watching order or a disabled unsent entry can be cancelled. Check native Status for submitted requests.');
          const cancelled={...order,status:'cancelled',message:'Order cancelled before submission. No entry will be sent.'};journal(cancelled,'cancelled');await commitWatch(index,cancelled,order.status==='watching'?undefined:'Disabled entry was not cancelled. It remains disabled.');crossings.delete(order.id);return {ok:true,message:cancelled.message};
        }
        throw Error('Unsupported request. This version supports limit entries with optional TP / SL.');
      }));
      // UI callers can await their own entry without holding up price-trigger processing.
      return response.then(async result=>{if(message.type==='create'){await entryJobs.get(result.order.id);return queued(()=>({order:structuredClone(orders.find(o=>o.id===result.order.id))}));}return result;});
    }
  };
}
