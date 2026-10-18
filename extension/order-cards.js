// Update display slots while retaining user-owned recovery controls and focus.
const parts=['title','state','edit','description','health','actions'];
export function syncOrderCards(container,html){
 const template=container.ownerDocument.createElement('template');template.innerHTML=html;
 const incoming=[...template.content.children];
 if(!incoming.length||incoming[0].matches('.empty')){if(container.innerHTML!==template.innerHTML)container.replaceChildren(...incoming);return;}
 const ids=new Set();for(const card of incoming){if(!card.matches('article[data-order-id]')||!card.dataset.orderId||ids.has(card.dataset.orderId))throw Error('Invalid order card identity.');ids.add(card.dataset.orderId);}
 const existing=new Map([...container.children].filter(n=>n.matches('article[data-order-id]')).map(n=>[n.dataset.orderId,n]));
 for(const [id,card] of existing)if(!ids.has(id)){card.remove();existing.delete(id);}
 for(const child of [...container.children])if(!child.matches('article[data-order-id]'))child.remove();
 let cursor=container.firstElementChild;
 for(const fresh of incoming){
  let card=existing.get(fresh.dataset.orderId);
  if(card){
   for(const part of parts){const old=card.querySelector(`[data-order-part="${part}"]`),next=fresh.querySelector(`[data-order-part="${part}"]`);if(!old||!next)throw Error('Incomplete order card.');if(old.innerHTML!==next.innerHTML)old.replaceChildren(...next.childNodes);old.className=next.className;old.hidden=next.hidden;}
   card.dataset.recoveryAllowed=fresh.dataset.recoveryAllowed;
   if(card.dataset.recoveryAllowed!=='true')card.querySelector('.recovery')?.remove();
   existing.delete(fresh.dataset.orderId);
  }else card=fresh;
  if(card!==cursor)container.insertBefore(card,cursor);cursor=card.nextElementSibling;
 }
 for(const card of existing.values())card.remove();
 for(const child of [...container.children])if(!child.matches('article[data-order-id]'))child.remove();
}
