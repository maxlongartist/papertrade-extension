export function readStatusPressure(document,now=Date.now()) {
 const panel=document.querySelector('#tradeStatusPanel');if(!panel)return null;
 const rows=[...panel.querySelectorAll('.trade-status-metric-row')];if(rows.length!==4)return null;
 const values=rows.map(r=>r.querySelector('b')?.textContent?.trim()??'');
 const level=rows[0].querySelector('[data-congestion]')?.getAttribute('data-congestion');
 if(!['LOW','MEDIUM','HIGH'].includes(level)||!/^\d[\d,\s]*\s*tx$/.test(values[1])||!/^\d+(?:[.,]\d+)?$/.test(values[2])||!/^~?\d+s$/.test(values[3]))return null;
 const pending=Number(values[1].replace(/[^\d]/g,'')),average=Number(values[2].replace(',','.')),seconds=Number(values[3].replace(/[^\d]/g,''));
 if(!Number.isSafeInteger(pending)||pending>10000000||!Number.isFinite(average)||average>1000000||!Number.isSafeInteger(seconds)||seconds>1000000)return null;
 return {source:'status-page',level,pending,avgTxPerBlock:average,clearSeconds:seconds,neededBlocks:null,trend:'Native Status reading',sourceAt:now,receivedAt:now};
}
export function validateStatusReading(s,now=Date.now()) {
 if(!s||s.source!=='status-page'||!['LOW','MEDIUM','HIGH'].includes(s.level)||!Number.isSafeInteger(s.pending)||s.pending<0||s.pending>10000000||!Number.isFinite(s.avgTxPerBlock)||s.avgTxPerBlock<0||s.avgTxPerBlock>1000000||!Number.isSafeInteger(s.clearSeconds)||s.clearSeconds<0||s.clearSeconds>1000000||!Number.isFinite(s.sourceAt)||now-s.sourceAt>=5000||s.sourceAt>now+1000)return null;
 return {source:'status-page',level:s.level,pending:s.pending,avgTxPerBlock:s.avgTxPerBlock,clearSeconds:s.clearSeconds,neededBlocks:null,trend:'Native Status reading',sourceAt:s.sourceAt,receivedAt:now};
}
