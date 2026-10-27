/* Spacing rules: a committed retreat can earn one normal attack cancel only
 * after an entire opposing normal's active phase has missed. No iframe/meter/
 * damage bonus. Geometry facts and this deliberately chosen rule stay separate.
 */
'use strict';
(() => {
 const S=INK.ContactSolver;
 let previous=new Map(),observed=new Map(),serials=new Map(),ids=new WeakMap(),certificates=[];
 const settings={enabled:false,reentry:true},events=[];
 const rules=Object.freeze({duration:24,travelFrames:8,speed:7,nearDistance:18,minTravel:8,cancelFrames:4});
 const id=(a,actor)=>{if(!a)return null;if(!ids.has(a)){const n=(serials.get(actor)||0)+1;serials.set(actor,n);ids.set(a,actor+':'+n);}return ids.get(a);};
 const emit=(G,type,data={})=>{const row={frame:G.actionTick,type,...data};events.push(row);if(events.length>160)events.shift();return row;};
 const supports=m=>m&&m.category==='normal'&&m.hits===1&&!m.air&&!m.throw&&!m.super&&!m.kind.includes('projectile')&&m.total>m.startup+m.active;
 const normal=a=>a&&supports(a.m);
 const index=a=>a?Math.min(a.m.hits-1,Math.floor((a.t-a.m.startup)/(a.m.active/a.m.hits))):-1;
 const active=a=>a&&a.t>=a.m.startup&&a.t<a.m.startup+a.m.active;
 const terminal=a=>normal(a)&&a.t===a.m.startup+a.m.active;
 const take=(f,geometry,G)=>({fighter:f,attack:f.attack,serial:id(f.attack,f.index),epoch:f._inkContactEpoch||0,t:f.attack?.t,index:index(f.attack),
  active:!!active(f.attack),terminal:!!terminal(f.attack),x:f.x,y:f.y,dir:f.dir,state:f.state,captured:!!f.captured,
  frame:G.actionTick,revision:INK.Runtime?.revision||0,geometry});
 const nativeGeometry=g=>!!(g?.strikeModel||g?.bodyModel);
 const nativeOwner=f=>INK.HitRule?.owns(f)||INK.StrikeModel?.owns(f)||INK.RulePose?.owns(f);
 const sameBody=(a,b)=>typeof a?.geometry.bodyModel?.owner==='string'&&a.geometry.bodyModel.owner.length>0&&a.geometry.bodyModel.owner===b?.geometry.bodyModel?.owner&&a.y===0&&b.y===0;
 function modelContinuous(a,b){
  if(a?.geometry.strikeModel||b?.geometry.strikeModel)return !!(a?.geometry.strikeModel&&b?.geometry.strikeModel&&a.attack===b.attack);
  if(a?.geometry.bodyModel||b?.geometry.bodyModel)return sameBody(a,b);
  return true;
 }
 function continuous(a,b){return a&&b&&b.frame===a.frame+1&&a.dir===b.dir&&(a.state===b.state||sameBody(a,b))&&modelContinuous(a,b)&&
  !a.captured&&!b.captured&&a.revision===b.revision&&a.epoch===b.epoch;}
 function boxBefore(old,now){const matches=old?.filter(b=>(b.id??b.part)===(now.id??now.part))||[];return matches.length===1?matches[0]:null;}
 function inspectPair(a,b,pa,pb){
  const sweep=continuous(pa,a)&&continuous(pb,b)&&pa.attack===a.attack&&pa.active&&(a.active||a.terminal)&&pa.index===a.index&&(a.geometry.strikeModel?a.t>=pa.t&&a.t<=pa.t+1:a.t===pa.t+1);
  const shapes=arr=>arr.every(S.valid)&&new Set(arr.map(b=>b.id??b.part)).size===arr.length;
  let coverage=shapes(a.geometry.hit)&&shapes(b.geometry.hurt);
  if(pa?.active&&pa.attack===a.attack)coverage &&= sweep&&pa.geometry.hit.length===a.geometry.hit.length&&pb.geometry.hurt.length===b.geometry.hurt.length;
  if(sweep&&(nativeGeometry(a.geometry)||nativeGeometry(b.geometry))&&INK.StrikeSweep){
   const curve=(before,now)=>{
    if(before?.geometry.strikeModel&&now.geometry.strikeModel&&before.attack===now.attack)return u=>INK.StrikeModel?.between?.(before.geometry,now.geometry,u);
    if(sameBody(before,now))return u=>now.geometry.bodyModel?.kind==='hit-rule'?INK.HitRule?.between(before.geometry,now.geometry,u):INK.RulePose?.between?.(before.geometry,now.geometry,u);
    return undefined;
   };
   const result=INK.StrikeSweep.inspect(pa.geometry,a.geometry,pb.geometry,b.geometry,{sampleA:curve(pa,a),sampleB:curve(pb,b)});
   return {...result,coverage:coverage&&result.coverage,contact:result.contact?{...result.contact,attacker:a.fighter.index,defender:b.fighter.index,serial:a.serial,hitIndex:a.index,swept:true,approximation:'eighth-frame-AABB'}:null};
  }
  let contact=null,near=null,overlapped=false;
  for(const hit of [...a.geometry.hit].sort((x,y)=>(x.id??x.part).localeCompare(y.id??y.part)))for(const hurt of [...b.geometry.hurt].sort((x,y)=>(x.id??x.part).localeCompare(y.id??y.part))){
   const oldHit=sweep&&boxBefore(pa.geometry.hit,hit),oldHurt=sweep&&boxBefore(pb.geometry.hurt,hurt);
   const swept=oldHit&&oldHurt;
   if(sweep&&!swept)coverage=false;
   if(a.terminal&&!swept)continue;
   const c=swept?S.sweep(oldHit,hit,oldHurt,hurt):S.discrete(hit,hurt);
   const g=swept?S.closest(oldHit,hit,oldHurt,hurt):{...S.gap(hit,hurt),time:1};
   if(c){overlapped=true;const row={...c,attacker:a.fighter.index,defender:b.fighter.index,serial:a.serial,hitIndex:a.index,hitID:hit.id??hit.part,hurtID:hurt.id??hurt.part,hitPart:hit.part,hurtPart:hurt.part,swept:!!swept};
    if(!contact||row.time<contact.time)contact=row;
   }
   if(g&&(!near||g.distance<near.distance))near={...g,hitID:hit.id??hit.part,hurtID:hurt.id??hurt.part,hitPart:hit.part,hurtPart:hurt.part};
  }
  return{contact,near,overlapped,coverage};
 }
 const Spacing={settings,rules,events,inspectPair,supports,
  begin(G,fighters,geometry){
   // Capture after last step's push correction, before this step moves roots.
   if(!settings.enabled&&!fighters.some(nativeOwner))return;
   previous=new Map(fighters.map(f=>[f.index,take(f,geometry(f,terminal(f.attack)),{actionTick:G.actionTick})]));
  },
  set(enabled){if(typeof enabled!=='boolean')throw TypeError('间距规则需要布尔值');if(enabled!==settings.enabled){settings.enabled=enabled;this.reset();}return enabled;},
  reset(){certificates=[];previous.clear();observed.clear();events.length=0;ids=new WeakMap();serials.clear();for(const f of globalThis.SVG_FIGHTER?.fighters||[]){f._inkRetreat=null;if(f.state==='evade')globalThis.SVG_FIGHTER.setState(f,'idle');}},
  setReward(value){if(typeof value!=='boolean')throw TypeError('反入奖励需要布尔值');settings.reentry=value;},
  invalidate(f){f._inkContactEpoch=(f._inkContactEpoch||0)+1;previous.delete(f.index);observed.clear();certificates=[];},
  retreat(f,G,setState){
   if(!settings.enabled||G.phase!=='fight'||G.paused||G.hitstop>0||f.hp<=0||f.state!=='idle'||f.attack||f.y!==0||f.landT>0||f.jumpPre>0)return false;
   setState(f,'evade',rules.duration);f.vx=0;f.crouch=false;f._inkRetreat={start:G.actionTick,origin:f.x,dir:f.dir,ready:false,used:false};
   INK.Input?.reset(f);emit(G,'retreat',{player:f.index});return true;
  },
  move(f){if(!settings.enabled||f.state!=='evade'||!f._inkRetreat)return;
   f.crouch=false;
   if(f.stateAge<=rules.travelFrames)f.x=Math.max(105,Math.min(1335,f.x-f._inkRetreat.dir*rules.speed));
  },
  canCancel(f,m,G=globalThis.SVG_FIGHTER?.state){return settings.enabled&&settings.reentry&&f.state==='evade'&&f.stateT<=rules.cancelFrames&&f._inkRetreat?.ready&&(!G||G.actionTick>=f._inkRetreat.availableAt)&&!f._inkRetreat.used&&m?.category==='normal'&&['sMP','sHP'].includes(m.id)&&!m.air&&!m.throw&&!m.super;},
  consume(f,m,G){if(!this.canCancel(f,m,G))return null;f._inkRetreat.used=true;return{source:f._inkRetreat.source};},
  started(f,permit,G){if(permit)emit(G,'reentry',{player:f.index,move:f.attack.m.id,source:permit.source,serial:id(f.attack,f.index)});},
  cancel(f,state){f._inkContactEpoch=(f._inkContactEpoch||0)+1;if(f._inkRetreat&&state!=='evade')f._inkRetreat=null;},
  frame(G,fighters,geometry){
   if(!settings.enabled&&!fighters.some(nativeOwner)){previous.clear();return null;}
   certificates=[];
   const snapshots=new Map([...fighters].sort((a,b)=>a.index-b.index).map(f=>{
    return[f.index,take(f,geometry(f,terminal(f.attack)),G)];
   })),pairs=new Map();
   for(const f of [...fighters].sort((a,b)=>a.index-b.index)){
    const a=snapshots.get(f.index),b=snapshots.get(1-f.index),old=observed.get(f.index);
    if(old&&(old.attack!==a.attack||!normal(a.attack)||(!a.active&&!a.terminal)))observed.delete(f.index);
    if(!normal(a.attack)||(!a.active&&!a.terminal)||!settings.enabled&&!nativeGeometry(a.geometry)&&!nativeGeometry(b.geometry))continue;
    let record=observed.get(f.index);
    if(!record){record={attack:a.attack,serial:a.serial,touched:false,near:null,retreat:b.fighter._inkRetreat,
     certifiable:a.t===a.attack.m.startup&&b.state==='evade',last:a.t};observed.set(f.index,record);}
    else {record.certifiable &&= a.t===record.last+1&&continuous(previous.get(f.index),a)&&continuous(previous.get(b.fighter.index),b);record.last=a.t;}
    if(!a.geometry.hit.length||!b.geometry.hurt.length)record.certifiable=false;
    const result=inspectPair(a,b,previous.get(f.index),previous.get(1-f.index));pairs.set(f.index,result);record.certifiable &&= result.coverage;
    record.touched ||= result.overlapped||!!a.attack.confirmed||a.attack.hitsDone.size>0;
    const r=b.fighter._inkRetreat,g=result.near;
    // Only deliberate grounded retreats, never jumping, blocking or invulnerability.
    if(settings.enabled&&record.certifiable&&!record.touched&&r===record.retreat&&r&&b.state==='evade'&&b.y===0&&!b.fighter.invuln&&g&&g.distance>1e-7&&g.distance<=rules.nearDistance&&
       Math.abs(b.x-r.origin)>=rules.minTravel&&Math.abs(g.pointA[0]-g.pointB[0])>1e-7){
     if(!record.near||g.distance<record.near.distance)record.near=g;
    }
    if(a.terminal){certificates.push({record,attacker:f,defender:b.fighter});observed.delete(f.index);}
   }
   pairs.geometry=new Map([...snapshots].map(([i,s])=>[i,s.geometry]));previous=snapshots;return pairs;
  },
  finish(G){
   for(const {record:r,attacker:a,defender:d} of certificates){
    const retreat=d._inkRetreat;
    if(!r.certifiable||r.touched||!r.near||!retreat||retreat!==r.retreat||retreat.used||
       d.state!=='evade'||d.hp<=0||a.hp<=0||a.attack!==r.attack||a.attack.confirmed||a.attack.hitsDone.size)continue;
    retreat.ready=true;retreat.availableAt=G.actionTick+1;retreat.source=r.serial;
    emit(G,'near-miss',{player:d.index,attacker:a.index,move:a.attack.m.id,serial:r.serial,distance:r.near.distance,pointA:r.near.pointA,pointB:r.near.pointB});
   }
   certificates=[];
  },
  contact(G,row,result){if(!row)return;emit(G,'contact',{...row,result});},
  authority(){return {previous,observed:[...observed].map(([actor,r])=>[actor,{...r,retreatMatches:r.retreat===previous.get(1-actor)?.fighter._inkRetreat}]),serials,certificates};},
  inspect(){return{enabled:settings.enabled,reentry:settings.reentry,rules:{...rules},events:events.map(e=>structuredClone(e))};}
 };
 INK.Spacing=Spacing;
})();
