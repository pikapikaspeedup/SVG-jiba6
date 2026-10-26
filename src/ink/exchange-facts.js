/* Accepted simulation facts. Only settle publishes; readers cannot advance state. */
'use strict';
(() => {
 let epoch=0, sources=new WeakMap(), actors=new WeakMap();
 const accepted=new Set(['hit','block','parry','armor','throw','tech']), endings=new Set(['natural','cancel','feint','interrupted','capture','round']);
 const now=G=>Number.isFinite(G?.actionTick)?G.actionTick:0;
 const scalar=v=>typeof v==='string'||Number.isFinite(v)?v:null;
 function bucket(f){let b=actors.get(f);if(!b){b={records:[],events:[],serial:0,published:Object.freeze({epoch,records:Object.freeze([]),events:Object.freeze([])})};actors.set(f,b);}return b;}
 function eligible(f,a){const m=a?.m;return !!m&&typeof a.combatID==='string'&&m.category==='normal'&&['s','c'].includes(m.normalState)&&f.y===0&&!f.captured&&!m.air&&!m.throw&&!String(m.kind).includes('projectile')&&m.damage>0;}
 function begin(f,a,G){if(!eligible(f,a))return null;const existing=sources.get(a);if(existing)return existing.id;const b=bucket(f),m=a.m,r={id:epoch+':'+a.combatID,combatID:a.combatID,epoch,actor:scalar(f.index),character:scalar(f.ch?.id),move:scalar(m.id),start:now(G),startup:m.startup,active:m.active,total:m.total,commit:now(G),age:a.t||0,contacts:0,result:null,target:null,contactAt:null,contactAge:null,endedAt:null,reason:null,whiff:false,activeClosed:false,coverage:m.hits===1?'pending':'unsupported',detectionModel:null,avoided:false,settledAt:null,dirty:false,_contactEpoch:f._inkContactEpoch??0,_first:Math.ceil(m.startup),_last:Math.ceil(m.startup+m.active)-1,_next:Math.ceil(m.startup),_lastSample:null,_broken:false,_close:false,_terminalRequired:false,_terminal:false};sources.set(a,r);b.records.push(r);if(b.records.length>8)b.records.shift();return r.id;}
 function contact(f,a,d,result,G){const r=a&&sources.get(a);if(!r||(!accepted.has(result)&&result!=='immune')||!bucket(f).records.includes(r))return false;if(result==='immune'){r.avoided=true;if(!r.contacts)r.result='avoided';}else{r.contacts++;r.result=result;}r.target=scalar(d?.index);r.contactAt=now(G);r.contactAge=a.t;r.age=Math.max(r.age,a.t||0);r.dirty=true;return true;}
 function end(f,a,reason,G){const r=a&&sources.get(a);if(!r||r.reason||!endings.has(reason))return false;r.reason=reason;r.endedAt=now(G);r.age=Math.max(r.age,a.t||0);r.dirty=true;return true;}
 function sampleActive(f,a,evidence={},G){
  const r=a&&sources.get(a);if(!r||r.activeClosed||!bucket(f).records.includes(r))return false;
  if((f._inkContactEpoch??0)!==r._contactEpoch){r._broken=true;return false;}
  const age=evidence.age??a.t,model=evidence.model;
  if(evidence.complete!==true||!['discrete','sweep'].includes(model)||!Number.isInteger(age)||r.detectionModel&&r.detectionModel!==model){r._broken=true;return false;}
  r.detectionModel=model;r.age=Math.max(r.age,age);
  if(evidence.terminal){if(age!==r.startup+r.active){r._broken=true;return false;}r._terminal=true;return true;}
  if(age===r._lastSample)return true;
  if(age!==r._next||age<r._first||age>r._last){r._broken=true;return false;}
  r._lastSample=age;r._next=age+1;return true;
 }
 function requestClose(f,a,{terminalRequired=false}={},G){const r=a&&sources.get(a);if(!r||r.activeClosed||!bucket(f).records.includes(r))return false;r.age=Math.max(r.age,a.t||0);if(r.age<r.startup+r.active)return false;r._close=true;r._terminalRequired=r._terminalRequired||!!terminalRequired;return true;}
 function snapshot(r){return Object.freeze(Object.fromEntries(Object.entries(r).filter(([k])=>k!=='dirty'&&!k.startsWith('_'))));}
 function inspect(a){const r=a&&sources.get(a);return r?._published||null;}
 function settle(fighters,G){const t=now(G);for(const f of fighters){const b=actors.get(f);if(!b)continue;const live=f.attack&&sources.get(f.attack);if(live)live.age=Math.max(live.age,f.attack.t||0);for(const r of b.records){
   if(!r.activeClosed&&(r._close||r.reason)){
    r.activeClosed=true;
    if(r.coverage!=='unsupported')r.coverage=!r._broken&&r._next===r._last+1&&(!r._terminalRequired||r._terminal)&&r._close?'complete':'broken';
    if(!r.contacts){r.result=r.avoided?'avoided':r.reason&&r.reason!=='natural'?r.reason:r.coverage==='complete'?'cleanMiss':'unknown';r.whiff=r.result==='cleanMiss';}
    r.dirty=true;
   }else if(!r.activeClosed&&r.age>=r.startup+r.active&&!r.contacts&&!r.avoided&&r.result!=='unknown'){
    // Age alone cannot prove the detector visited any active sample.
    r.result='unknown';r.dirty=true;
   }
   if(r.dirty){const resultChanged=r.result!==(r._published?.result??null),firstResult=!r._learnedResult&&['cleanMiss','hit','block','parry','armor'].includes(r.result);if(firstResult)r._learnedResult=true;r.settledAt=t;b.events.push(Object.freeze({serial:++b.serial,id:r.id,epoch,at:t,firstResult,resultChanged,result:r.result,reason:r.reason,contacts:r.contacts,target:r.target,activeClosed:r.activeClosed,coverage:r.coverage}));if(b.events.length>24)b.events.splice(0,b.events.length-24);r.dirty=false;r._published=snapshot(r);}}
  b.published=Object.freeze({epoch,records:Object.freeze(b.records.filter(r=>r.settledAt!==null).map(snapshot)),events:Object.freeze(b.events.slice())});}}
 function publicFacts(f){return actors.get(f)?.published||Object.freeze({epoch,records:Object.freeze([]),events:Object.freeze([])});}
 function reset(){epoch++;sources=new WeakMap();actors=new WeakMap();}
 INK.ExchangeFacts=Object.freeze({begin,contact,end,sampleActive,requestClose,inspect,settle,public:publicFacts,reset});
})();
