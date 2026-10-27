/* Shared completed-action snapshots; perception matures on simulation ticks. */
'use strict';
(() => {
 const capacity=96;let history=[],lastAction=null;
 const finite=(x,fallback=0)=>Number.isFinite(x)?x:fallback;
 const primitive=x=>typeof x==='string'||typeof x==='number'&&Number.isFinite(x)||typeof x==='boolean'?x:null;
 const clone=v=>Array.isArray(v)?v.map(clone):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).map(k=>[k,clone(v[k])])):primitive(v);
 const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
 function reset(){history=[];lastAction=null;}
 function clock(G){const action=G?.actionTick;if(!Number.isFinite(action))return null;if(lastAction!==null&&action<lastAction)reset();return action;}
 function capture(fighters,G,{completed=false,geometry=null}={}){
  const action=clock(G);if(action===null)return null;
  if(action===lastAction)return history.at(-1)||null;
  if(G._inkStepFrozen||G.hitstop>0&&!completed)return history.at(-1)||null;
  const actors=fighters.map((f,index)=>{
   const boxes=typeof geometry==='function'?geometry(f)?.hurt:null;
   const hurt=(Array.isArray(boxes)?boxes:[]).filter(b=>b&&['x','y','w','h'].every(k=>Number.isFinite(b[k]))&&b.w>=0&&b.h>=0).slice(0,20).map(b=>({x:b.x,y:b.y,w:b.w,h:b.h,id:primitive(b.id??b.part),part:typeof b.part==='string'?b.part:null}));
   const a=f.attack,m=a?.m,attack=a&&m?{id:primitive(m.id),combatID:primitive(a.combatID),kind:primitive(m.kind),category:primitive(m.category),height:primitive(m.height),range:finite(m.range),startup:finite(m.startup),active:finite(m.active),total:finite(m.total),t:finite(a.t),holding:a.tempo?.phase==='holding'||!!a.holding,throw:!!m.throw}:null;
   return {index:finite(f.index,index),t:finite(G.tick),action,dir:finite(f.dir,1),basisDir:finite(f._inkAirBody?.dir,f.dir||1),vx:finite(f.vx),flightID:primitive(f._inkAirBody?.owner??(f._inkFlight&&!f._inkFlight.landed?'jump:'+f.index+':'+f._inkFlight.start:f._inkPursuit?'pursuit:'+f.index+':'+f._inkPursuit.start:null)),bodyView:{kind:f.attack?.airStrikeContext?'air-strike':f._inkAirBody?'air-body':'other',phase:finite(f._inkAirBody?.phase),fast:!!f._inkFlight?.fast,age:finite(f.attack?.t)},policyRevision:primitive(f.attack?.airStrikePolicy?.fingerprint??f._inkAirBody?.policy?.fingerprint),x:finite(f.x),y:finite(f.y),vy:finite(f.vy),state:primitive(f.state),stateT:finite(f.stateT),crouch:!!f.crouch,hp:finite(f.hp),attack,hurt,exchange:clone(INK.ExchangeFacts?.public?.(f,G)??null),projectiles:(G.shots||[]).filter(s=>s.owner===f&&s.life>0).map(s=>({combatID:primitive(s.combatID),x:finite(s.x),y:finite(s.y),v:finite(s.v),dir:finite(s.dir,1),r:finite(s.r),clashes:finite(s._flowClashes)}))};
  });
  for(const actor of actors){const other=actors.find(other=>other.index!==actor.index);actor.ownProjectiles=other?.projectiles||[];actor.receivedContacts=(other?.exchange?.events||[]).filter(r=>r.target===actor.index&&['hit','block','parry','armor'].includes(r.result)).map(r=>({id:r.id,epoch:r.epoch,serial:r.serial,result:r.result,target:r.target,firstResult:r.firstResult,resultChanged:r.resultChanged}));}
  const batch=freeze({action,t:finite(G.tick),actors});history.push(batch);if(history.length>capacity)history.shift();lastAction=action;return batch;
 }
 function observe(f,G,delay){
  const action=clock(G);if(action===null||lastAction===null)return null;
  // Physical snapshots only publish after completed actions. During hitstop
  // simulation time can make an existing snapshot visible, without inventing
  // movement, aging a plan or publishing another geometry sample.
  const lag=Number.isFinite(delay)?Math.max(0,Math.ceil(delay)):0,cutoff=finite(G.tick)-lag;
  const batch=history.findLast(b=>b.t<=cutoff);if(!batch)return null;
  return batch.actors.find(a=>a.index!==f.index)||null;
 }
 INK.DuelPerception={capture,observe,reset,capacity};
})();
