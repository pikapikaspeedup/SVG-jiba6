/* Preferences learned only from delayed public snapshots, never hidden input. */
'use strict';
(() => {
 const rows={ryu:[1.1,.9,1.3,.8,235,9],ken:[1.05,.65,.85,1.5,185,5],chun:[1.4,1.15,1.1,.8,250,7],cammy:[.95,1.2,.85,1.45,175,4],luke:[1.25,.85,1.2,1.05,220,6],juri:[1.15,1.4,.8,1.1,230,8],mai:[1.15,1.25,1.15,.7,270,11],iori:[.8,.85,1.1,1.55,180,6]};
 const profiles=Object.fromEntries(Object.entries(rows).map(([id,v])=>[id,Object.freeze(Object.fromEntries(['probe','bait','intercept','press','distance','rest'].map((k,i)=>[k,v[i]])))]));
 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),finite=(x,f=0)=>Number.isFinite(x)?x:f;
 const profile=id=>profiles[id]||profiles.ryu;
 function bias(m){const b=v=>clamp(v,-.15,.15);return {probe:b((m.whiffRate-.5)*.3),bait:b((m.heavyRate-.5)*.2+(m.approach-.5)*.1),intercept:b((m.heavyRate-.5)*.2+(m.lowRate-.5)*.1),press:b((m.guardRate-.5)*-.3)};}
 function observe(memory,obs,G,self){
  const old=memory||{},m={whiffRate:clamp(finite(old.whiffRate,.5)),heavyRate:clamp(finite(old.heavyRate,.5)),lowRate:clamp(finite(old.lowRate,.5)),approach:clamp(finite(old.approach,.5)),guardRate:clamp(finite(old.guardRate,.5)),samples:clamp(finite(old.samples),0,64),seenIDs:(old.seenIDs||[]).slice(-16),seenKinds:(old.seenKinds||[]).slice(-16),lastAction:finite(old.lastAction,-1),lastX:finite(old.lastX),lastSelfX:finite(old.lastSelfX),lastGuard:!!old.lastGuard,factEpoch:finite(old.factEpoch,-1),eventSerial:finite(old.eventSerial),attackSerial:finite(old.attackSerial),receiptEpoch:finite(old.receiptEpoch,-1),receiptSerial:finite(old.receiptSerial)};
  if(!obs||!Number.isFinite(obs.action)||obs.action<=m.lastAction){m.bias=bias(m);return m;}
  const ewma=(k,v)=>{m[k]=clamp(m[k]*.92+v*.08);};
  function remember(id){m.seenIDs.push(id);m.seenKinds.push(1);if(m.seenIDs.length>16){m.seenIDs.shift();m.seenKinds.shift();}}
  const epoch=finite(obs.exchange?.epoch),a=obs.attack;
  if(epoch>m.factEpoch){m.factEpoch=epoch;m.eventSerial=0;m.attackSerial=0;}
  const attackSerial=typeof a?.combatID==='string'?Number(/^attack:(\d+)$/.exec(a.combatID)?.[1]):NaN;
  if(epoch===m.factEpoch&&Number.isFinite(attackSerial)&&attackSerial>m.attackSerial){m.attackSerial=attackSerial;if(a.category==='normal'){remember(epoch+':'+a.combatID);ewma('heavyRate',/H[PK]$/.test(a.id||'')?1:0);ewma('lowRate',a.height==='low'?1:0);}}
  for(const r of [...(obs.exchange?.events||[])].sort((a,b)=>a.serial-b.serial)){
   if(epoch!==m.factEpoch||r.epoch!==epoch||!Number.isFinite(r.serial)||r.serial<=m.eventSerial)continue;m.eventSerial=r.serial;
   if(r.firstResult!==true||!['cleanMiss','hit','block','parry','armor'].includes(r.result))continue;
   remember(r.id);ewma('whiffRate',r.result==='cleanMiss'?1:0);m.samples=Math.min(64,m.samples+1);
  }
  // Receipts are the other actor's event stream, never the observed actor's
  // outgoing block results. Serial watermarks survive diagnostic-ID eviction.
  for(const r of [...(obs.receivedContacts||[])].sort((a,b)=>a.serial-b.serial)){
   if(!Number.isFinite(r.epoch)||!Number.isFinite(r.serial)||r.epoch<m.receiptEpoch)continue;
   if(r.epoch>m.receiptEpoch){m.receiptEpoch=r.epoch;m.receiptSerial=0;}
   if(r.serial<=m.receiptSerial)continue;m.receiptSerial=r.serial;
   if(r.firstResult!==true||r.target!==obs.index||!['hit','block','parry','armor'].includes(r.result))continue;
   remember('received:'+r.id);ewma('guardRate',r.result==='block'||r.result==='parry'?1:0);
  }
  if(m.lastAction>=0&&Number.isFinite(obs.x)&&Number.isFinite(self?.x)){
   // Only opponent displacement counts; the observer's own movement is not
   // mistaken for an approach by the opponent.
   const sign=Math.sign(m.lastSelfX-m.lastX),dt=obs.action-m.lastAction;
   ewma('approach',clamp((obs.x-m.lastX)*sign/dt/6));
  }
  m.lastAction=obs.action;m.lastX=finite(obs.x,m.lastX);m.lastSelfX=finite(self?.x,m.lastSelfX);m.bias=bias(m);return m;
 }
 INK.DuelPersonality=Object.freeze({profile,observe});
})();
