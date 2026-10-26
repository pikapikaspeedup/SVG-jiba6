/* Pure per-move preparation and guard-return prototype; not a combat solver.
 * Root integration must replace old StrikeMotion/RecoveryMotion for this set,
 * and constrain actual contact chains after visual articulation. */
'use strict';
(()=>{
 const settings={enabled:true};
 const active=()=>settings.enabled&&INK.Kinetic?.settings.enabled!==false&&INK.Runtime?.enabled!==false&&INK.MotionGraph?.settings.enabled!==false;
 const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
 const copy=p=>INK.copy?INK.copy(p):JSON.parse(JSON.stringify(p));
 const get=f=>INK.StrikeScoreData?.[f?.ch?.id+':'+f?.attack?.m?.id];
 function supports(f){const row=get(f);return active()&&!!row&&!f.attack.m.wakeStrike&&(f.attack.m.contactPart??null)===row.contactPart&&f.state==='attack'&&f.y===0&&!f.captured&&!f.airLock&&!f.attack.m.air&&!f.attack.m.throw;}
 const numeric=v=>typeof v==='number'&&Number.isFinite(v);
 function mix(a,b,u){if(numeric(a)&&numeric(b))return a+(b-a)*u;if(Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every(numeric)&&b.every(numeric))return a.map((v,i)=>v+(b[i]-v)*u);return u>=.5?b:a;}
 function interpolate(a,b,u){const p={};for(const k of new Set([...Object.keys(a),...Object.keys(b)]))p[k]=mix(a[k],b[k],u);return p;}
 function poseAt(f,source,{basePose=null,time}={}){
  if(!supports(f))return source;const row=get(f),a=f.attack,m=a.m,b=row.binding;
  // A held attack cannot progress from a render-time override.
  const t=a.tempo?.phase==='holding'?a.t:Number.isFinite(time)?time:a.t;
  const record={binding:b,clip:{duration:b.startup+b.active+b.recovery}};
  const phaseMap=()=>t<m.startup?t/m.startup*b.startup:t<m.startup+m.active?b.startup+(t-m.startup)/m.active*b.active:b.startup+b.active+(t-m.startup-m.active)/Math.max(1,m.total-m.startup-m.active)*b.recovery;
  const frame=INK.Runtime?.clipFrame?INK.Runtime.clipFrame(record,m,t):phaseMap(),end=b.startup+b.active,total=end+b.recovery;
  if(!Number.isFinite(frame)||frame<=0||frame>=total||frame>=b.startup&&frame<=end)return source;
  let target,weight;
  if(frame<b.startup){const nodes=row.prepWaypoints||[row.prep],first=nodes[0],last=nodes.at(-1);weight=frame<=first.frame?smooth(frame/first.frame):frame>=last.frame?smooth((b.startup-frame)/(b.startup-last.frame)):1;target=frame<=first.frame?first.pose:last.pose;for(let i=1;i<nodes.length;i++)if(frame>=nodes[i-1].frame&&frame<=nodes[i].frame){target=interpolate(nodes[i-1].pose,nodes[i].pose,smooth((frame-nodes[i-1].frame)/(nodes[i].frame-nodes[i-1].frame)));break;}}
  else{
   const first=row.recovery[0].frame,last=row.recovery.at(-2).frame;weight=frame<=first?smooth((frame-end)/(first-end)):frame>=last?smooth((total-frame)/(total-last)):1;
   const evaluate=nodes=>{const points=[{frame:end,pose:basePose||source},...nodes];let left=points[0],right=points.at(-1);for(let i=1;i<points.length;i++)if(frame<=points[i].frame){left=points[i-1];right=points[i];break;}return interpolate(left.pose,right.pose,smooth((frame-left.frame)/Math.max(1e-9,right.frame-left.frame)));};
   target=evaluate(row.recovery);
   const outcome=resultInfo(f);
   if(outcome.result!=='neutral'){
    const nodes=row.recovery.map(n=>({frame:n.frame,pose:copy(n.pose)})),limb=row.contactChain==='frontLeg'?'fa':'fw';
    if(outcome.result==='hit'){nodes[0].pose=interpolate(nodes[0].pose,nodes[1].pose,.18);nodes[1].frame=Math.max(nodes[0].frame+.25,Math.min(nodes[1].frame,end+b.recovery*.68));}
    else if(outcome.result==='block'){
     const direction=strikeDirection(f,row),amount=m.id==='sHP'?7:m.id==='cMK'?5:4;
     nodes[0].pose[limb]=nodes[0].pose[limb].map((v,i)=>v-direction[i]*amount);
     if(f.ch.id==='mai')nodes[0].pose.fanAngle=(nodes[0].pose.fanAngle||0)-amount;
    }else if(outcome.result==='cleanMiss')nodes[0].frame=Math.min(nodes[1].frame-.25,nodes[0].frame+b.recovery*.08);
    const onset=outcome.onsetAge==null?end:(INK.Runtime?.clipFrame?INK.Runtime.clipFrame(record,m,outcome.onsetAge):end+Math.max(0,outcome.onsetAge-m.startup-m.active)/Math.max(1,m.total-m.startup-m.active)*b.recovery),gate=smooth((frame-Math.max(end,onset))/2);
    target=interpolate(target,evaluate(nodes),gate);
   }
  }
  if(weight<=0)return source;const p=copy(source);
  for(const [k,v] of Object.entries(target)){if(v===undefined)continue;p[k]=mix(source[k]??v,v,weight);}
  const carry=Math.max(0,Math.min(18,Number(f.attack.m.movementStrike?.budget)||0))/18;
  if(frame<b.startup&&carry){p.lean=(p.lean||0)+3*carry*weight;p.chest=(p.chest||0)-2*carry*weight;}
  return INK.Articulation?.inherit?INK.Articulation.inherit(source,p):p;
 }
 let cache=new WeakMap(),directionCache=new WeakMap(),revision=null;
 const resultInfo=f=>{if(f.attack._scoreOutcome)return f.attack._scoreOutcome;const facts=INK.ExchangeFacts?.inspect?.(f.attack),r=facts?.result??f.attack.contactResult;return {result:['hit','block','cleanMiss'].includes(r)?r:'neutral',onsetAge:Number.isFinite(facts?.contactAge)?facts.contactAge:Number.isFinite(f.attack._inkContact?.attackAge)?f.attack._inkContact.attackAge:null};};
 function strikeDirection(f,row){const original=INK.Runtime?.record?.(f,f.attack.m)?.clip;if(original&&INK.CompiledClip){let map=directionCache.get(original);if(!map){map=new Map();directionCache.set(original,map);}const key=String(f.attack.m.startup);if(map.has(key))return map.get(key);const compiled=new INK.CompiledClip(original),rec=INK.Runtime.record(f,f.attack.m),m=f.attack.m,k=row.contactChain==='frontLeg'?'fa':'fw',at=t=>compiled.sample(INK.Runtime.clipFrame(rec,m,t))[k],a=at(Math.max(0,m.startup-1)),b=at(m.startup),v=[b[0]-a[0],b[1]-a[1]],length=Math.hypot(...v);if(length>1e-6){const dir=v.map(x=>x/length);if(map.size>=8)map.delete(map.keys().next().value);map.set(key,dir);return dir;}}return row.strikeDirection||[1,0];} 
 function clip(f){
  if(!supports(f)||!INK.CompiledClip||!INK.Runtime?.record)return null;
  const runtime=INK.Runtime,record=runtime.record(f,f.attack.m);if(!record?.clip)return null;
  if(revision!==runtime.revision){cache=new WeakMap();directionCache=new WeakMap();revision=runtime.revision;}
  const m=f.attack.m,duration=m.total;if(!Number.isInteger(duration)||duration<1||duration>1000)return null;
  const budget=Math.max(0,Math.min(18,Number(m.movementStrike?.budget)||0)),outcome=resultInfo(f),result=outcome.result,key=JSON.stringify([m.startup,m.active,duration,budget,result,outcome.onsetAge]);
  let variants=cache.get(record.clip);if(!variants){variants=new Map();cache.set(record.clip,variants);}if(variants.has(key))return variants.get(key);
  const original=new INK.CompiledClip(record.clip),tracks={},profile=runtime.profile?runtime.profile(f.ch.id):f.ch;
  // Compile only authored numeric channels. Hand shapes stay discrete renderer
  // controls; neither strings nor combat root coordinates enter angular baking.
  const view=Object.create(f);view.attack={...f.attack,tempo:null,contactResult:result,_scoreOutcome:outcome,m:{...m,movementStrike:budget?{...m.movementStrike,budget}:null}};
  for(let i=0;i<=duration*4;i++){
   const t=i*.25,frame=runtime.clipFrame(record,m,t),base=original.sample(frame);view.attack.t=t;
   const p=poseAt(view,base,{time:t});
   for(const [channel,value] of Object.entries(p)){
    if(['rootX','rootY'].includes(channel)||!(numeric(value)||Array.isArray(value)&&value.length===2&&value.every(numeric)))continue;
    (tracks[channel]||(tracks[channel]=[])).push([t,Array.isArray(value)?value.slice():value,'linear']);
   }
  }
  const data={version:1,id:'score:'+f.ch.id+':'+m.id,duration,tracks,phases:{startup:[0,m.startup],active:[m.startup,m.startup+m.active],recovery:[m.startup+m.active,duration]}};
  const value={data,profile,original,record};if(variants.size>=8)variants.delete(variants.keys().next().value);variants.set(key,value);return value;
 }
 function sample(f,source,options={}){
  if(!supports(f))return source;const compiled=clip(f);
  if(!compiled||!INK.Articulation?.prepare)return poseAt(f,source,options);
  const t=f.attack.tempo?.phase==='holding'?f.attack.t:Number.isFinite(options.time)?options.time:f.attack.t;
  const base=options.basePose||compiled.original.sample(INK.Runtime.clipFrame(compiled.record,f.attack.m,t));
  const p=copy(poseAt(f,base,{time:t}));
  // Retain the already-composed visual layer delta in the same author space.
  // New authored coordinates own the score; small guard/kinetic corrections
  // remain corrections rather than being absorbed by the old clip context.
  for(const [key,value] of Object.entries(source)){
   if(['handFront','handRear'].includes(key)&&key in p)continue;
   if(numeric(value)&&numeric(base[key])&&numeric(p[key]))p[key]+=value-base[key];
   else if(Array.isArray(value)&&Array.isArray(base[key])&&Array.isArray(p[key])&&value.every(numeric))p[key]=p[key].map((v,i)=>v+value[i]-base[key][i]);
   else if(!(key in p)||!numeric(value)&&!Array.isArray(value))p[key]=value;
  }
  return INK.Articulation.prepare(p,compiled.data,Math.max(0,Math.min(compiled.data.duration,t)),compiled.profile);
 }
 INK.StrikeScore=Object.freeze({settings,active,supports,sample,clip});
})();
