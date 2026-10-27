/* Sparse own-move geometry query; no opponent prediction or combat mutation. */
'use strict';
(() => {
 const nativeCache=new WeakMap();
 const frozen=rows=>Object.freeze(rows.map(r=>Object.freeze(r)));
 function supports(m){return !!m&&m.category==='normal'&&['s','c'].includes(m.normalState)&&!m.throw&&!m.air&&!m.travel&&!String(m.kind).includes('projectile')&&Number.isFinite(m.startup)&&m.startup>=0&&Number.isFinite(m.active)&&m.active>=1;}
 function sample(f,m,geometry){
  if(typeof geometry!=='function')return null;
  const air=INK.AirStrike?.candidateFrames(f,m);if(air)return air;
  if(!supports(m))return null;
  const first=Math.ceil(m.startup),last=Math.ceil(m.startup+m.active)-1;if(last<first)return null;
  const native=INK.StrikeModel?.candidate(f,m),times=native?Array.from({length:Math.ceil(m.active*8)},(_,i)=>m.startup+i*.125).filter(t=>t<m.startup+m.active):[...new Set([first,Math.floor((first+last)/2),last])],frames=[];
  if(m.movementStrike&&!native)return null;
  const carry=t=>{const q=m.movementStrike;if(!native||!q)return 0;const n=Math.max(1,q.frames),steps=Math.min(n,Math.max(0,Math.floor(t)));return Math.min(q.budget,q.budget*steps*(2*n-steps+1)/(n*(n+1)));};
  const store=INK.Runtime?.store;let cache=null,key=null;
  if(native&&geometry===globalThis.SVG_FIGHTER?.geometry&&store&&Number.isFinite(store.revision)&&INK.Canonical?.encode){
   try{key=INK.Canonical.encode({character:f.ch.id,scale:f.renderScale||f.ch.scale||1,move:m});}catch{/* Non-JSON/custom move metadata is never cached. */}
   if(key!==null){cache=nativeCache.get(store);if(!cache||cache.revision!==store.revision||cache.geometry!==geometry||cache.data!==INK.StrikeModelData){cache={revision:store.revision,geometry,data:INK.StrikeModelData,rows:new Map()};nativeCache.set(store,cache);}if(cache.rows.has(key))return cache.rows.get(key);}
  }
  for(const t of times){
   const view=Object.create(f);Object.assign(view,{state:'attack',stateT:0,stateAge:t,attack:{m,t,confirmed:false,hitConfirmed:false,holding:false,hitsDone:new Set(),contacted:new Set()},x:carry(t),y:0,px:carry(t),py:0,dir:1,intentDir:1,crouch:m.normalState==='c',move:0,jumpPre:0,airLock:false,captured:false,throwAction:null,walkT:0,push:0,vx:0,vy:0,_inkTransition:null,_inkVisualTransition:null,_inkJointTransition:null,_inkStateVisualBlend:null,_inkStateBlend:null,_inkFrameTransition:null,_inkFacing:null,_inkLocomotion:null,_inkSupport:null,_inkHitEpisode:null,_inkHitBody:null,_inkReaction:null,_inkRecoil:null,_inkWeight:null,_inkPrevView:null,_inkHistory:null,_inkMotor:null,_inkPursuit:null,_inkDefense:null,_inkMovementStrike:null,_inkTempo:null,_inkVisualClock:t,_inkRawVisual:true,_poseSimulationFrame:null,_poseVelocity:null,pose:null});
   const result=geometry(view),hit=[];
   for(const r of result?.hit||[]){if(![r.x,r.y,r.w,r.h].every(Number.isFinite)||r.w<0||r.h<0)continue;hit.push({x:r.x,y:r.y-665,w:r.w,h:r.h,id:r.id??r.part,part:typeof r.part==='string'?r.part:null});}
   frames.push(Object.freeze({t,hit:frozen(hit),forward:Math.max(0,...hit.map(r=>r.x+r.w))}));
  }
  const answer=Object.freeze({character:f.ch.id,move:m.id,scale:f.renderScale||f.ch.scale||1,space:'root-local-world-units',floor:665,frames:Object.freeze(frames),forward:Math.max(0,...frames.map(r=>r.forward)),sparse:true,sampling:native?'eighth-frame':'three-frame'});
  if(cache){if(cache.rows.size>=96)cache.rows.delete(cache.rows.keys().next().value);cache.rows.set(key,answer);}return answer;
 }
 // Stateless range estimate for committed chains. The caller owns observation
 // delay and supplies forward travel already earned at each candidate time.
 function estimate(f,reach,hurt,{travelAt=null,uncertainty=0}={}){
  const valid=b=>b&&['x','y','w','h'].every(k=>Number.isFinite(b[k]))&&b.w>0&&b.h>0;
  if(!f||![f.x,f.y].every(Number.isFinite)||!reach||reach.space!=='root-local-world-units'||!Array.isArray(hurt)||!Array.isArray(reach.frames)||!Number.isFinite(uncertainty)||uncertainty<0||travelAt!==null&&typeof travelAt!=='function')return null;
  const dir=f.dir===-1?-1:1,u=uncertainty,targets=hurt.filter(valid).map(b=>({lo:dir>0?b.x+u:-(b.x+b.w-u),hi:dir>0?b.x+b.w-u:-(b.x+u),top:b.y+u,bottom:b.y+b.h-u,part:b.part})).filter(b=>b.hi>b.lo&&b.bottom>b.top);
  if(!targets.length)return null;
  const floor=Number.isFinite(reach.floor)?reach.floor:665;
  for(const frame of reach.frames.slice().sort((a,b)=>a.t-b.t)){
   if(!Number.isFinite(frame.t)||!Array.isArray(frame.hit))continue;
   const travel=travelAt?travelAt(frame.t):0;if(!Number.isFinite(travel)||travel<0)continue;
   for(const hit of frame.hit.filter(valid)){
    const lo=dir*f.x+hit.x+travel,hi=lo+hit.w,top=floor+f.y+hit.y,bottom=top+hit.h;
    for(const target of targets)if(Math.min(hi,target.hi)>Math.max(lo,target.lo)&&Math.min(bottom,target.bottom)>Math.max(top,target.top))return {t:frame.t,hitPart:hit.part??null,hurtPart:target.part??null,travel};
   }
  }
  return null;
 }
 // Training-only suggestion. Intervals are open collision intervals; neither
 // actors nor boxes are moved here. Every route move must have a common span.
 function placement(f,d,choices,geometry){
  const valid=b=>b&&['x','y','w','h'].every(k=>Number.isFinite(b[k]))&&b.w>0&&b.h>0;
  if(!f||!d||![f.x,f.y,d.x,d.y].every(Number.isFinite)||!Array.isArray(choices)||!choices.length||typeof geometry!=='function')return null;
  const dir=f.dir===-1?-1:1,targets=(geometry(d)?.hurt||[]).filter(valid).map(b=>({lo:dir>0?b.x-d.x:d.x-b.x-b.w,hi:dir>0?b.x+b.w-d.x:d.x-b.x,top:b.y,bottom:b.y+b.h}));
  if(!targets.length)return null;
  const union=intervals=>{const out=[];for(const q of intervals.sort((a,b)=>a[0]-b[0])){const last=out.at(-1);if(last&&q[0]<last[1])last[1]=Math.max(last[1],q[1]);else out.push(q.slice());}return out;};
  let common=null;
  for(const choice of choices){const reach=choice?.reach;if(!reach||reach.space!=='root-local-world-units'||!Array.isArray(reach.frames))return null;const spans=[];
   for(const frame of reach.frames)for(const hit of (frame.hit||[]).filter(valid)){
    const top=(Number.isFinite(reach.floor)?reach.floor:665)+f.y+hit.y,bottom=top+hit.h;
    for(const target of targets)if(Math.min(bottom,target.bottom)>Math.max(top,target.top)){const lo=Math.max(0,hit.x-target.hi),hi=hit.x+hit.w-target.lo;if(hi>lo)spans.push([lo,hi]);}
   }
   const offered=union(spans);if(!offered.length)return null;
   common=common===null?offered:union(common.flatMap(a=>offered.map(b=>[Math.max(a[0],b[0]),Math.min(a[1],b[1])]).filter(q=>q[1]>q[0])));
   if(!common.length)return null;
  }
  // At least eight units from both open edges; never invent safety by widening.
  const candidates=common.filter(q=>q[1]-q[0]>16).map(interval=>{const inset=Math.min(10,(interval[1]-interval[0])/2),distance=Math.max(interval[0]+inset,Math.min(interval[1]-inset,160));return {distance,interval:interval.slice(),inset,estimated:true};});
  candidates.sort((a,b)=>Math.abs(a.distance-160)-Math.abs(b.distance-160)||a.distance-b.distance);return candidates[0]||null;
 }
 INK.DuelReach={supports,sample,estimate,placement};
})();
