/* Simulation transactions for native ground hits. Response math is injected
 * through HitRuleResponse; no presentation settings or displayed frames. */
'use strict';
(()=>{
 const pending=new WeakMap(),queues=new WeakMap(),serials=new WeakMap(),copy=x=>JSON.parse(JSON.stringify(x));
 const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
 const ready=()=>['create','commit','advance','sample'].every(k=>typeof INK.HitRuleResponse?.[k]==='function');
 const ground=f=>f?.state==='hit'&&f.y===0&&!f.airLock&&!f.captured&&!f.throwAction&&f.hp>0;
 const world=f=>({x:f.x,y:f.y,dir:f.dir===-1?-1:1,scale:f.ch.scale||1});
 function compatible(f,ep){const d=INK.HitRulePolicy?.evaluate(f);return d?.mode==='native'&&d.fingerprint===ep?.source?.carrier?.policy?.fingerprint;}
 const owns=f=>!!(ready()&&ground(f)&&f._inkHitRule&&compatible(f,f._inkHitRule));
 const capture=f=>INK.HitRuleSource?.capture(f)||null;
 const witnessed=facts=>facts?.evidence?.point==='witness'&&typeof facts.hurtID==='string'&&/^hurt\.(head|chest|abdomen|pelvis|(?:front|rear)(?:Arm|Leg)(?:\.|$))/.test(facts.hurtID);
 function begin(f,source,facts){if(!witnessed(facts)){if(f?._inkHitRule)release(f);return null;}if(!ready()||pending.has(f))return null;const old=owns(f)?f._inkHitRule:null;if(!old&&!source)return null;const time=f._inkVisualClock;if(!Number.isInteger(time)||time<0)return null;const tx={source:old?.source||source,facts:freeze(copy(facts)),old,time};pending.set(f,tx);return tx;}
 function release(f){pending.delete(f);queues.delete(f);f._inkHitRule=null;}
 function finish(f,tx){if(!tx||pending.get(f)!==tx)return null;pending.delete(f);if(!ground(f)||!ready()){release(f);return null;}let ep=tx.old;
  if(!ep){if(!compatible(f,{source:tx.source})){release(f);return null;}const response=INK.HitRuleResponse.create(tx.source,f);if(!response)return null;const serial=(serials.get(f)||0)+1;serials.set(f,serial);ep=freeze({...response,owner:'hit:'+f.index+':'+(f._inkContactEpoch||0)+':'+tx.time+':'+serial,source:tx.source,born:tx.time,time:tx.time,epoch:f._inkContactEpoch||0,dir:f.dir===-1?-1:1,previous:null});}
  f._inkHitRule=ep;const q=queues.get(f)||[];queues.set(f,[...q,tx.facts]);return ep;
 }
 function abort(f,tx){if(pending.get(f)===tx)pending.delete(f);}
 function settle(f){const facts=queues.get(f);queues.delete(f);if(!owns(f)){if(f._inkHitRule)release(f);return null;}const old=f._inkHitRule,time=f._inkVisualClock;if(!facts?.length&&time===old.time)return old;if(!Number.isInteger(time)||time<old.time){release(f);return null;}const next=facts?.length?INK.HitRuleResponse.commit(old,f,freeze(facts.slice().sort((a,b)=>String(a.contactID).localeCompare(String(b.contactID)))),time):INK.HitRuleResponse.advance(old,f,time);if(!next){release(f);return null;}return f._inkHitRule=freeze({...next,owner:old.owner,source:old.source,born:old.born,epoch:old.epoch,dir:old.dir,time,previous:{...old,previous:null}});}
 function sample(f,{time=f._inkVisualClock,world:w=world(f)}={}){if(!owns(f))return null;let ep=f._inkHitRule;if(time<ep.time){ep=ep.previous;if(!ep||time<ep.time)return null;}return INK.HitRuleResponse.sample(ep,f,time,w);}
 function geometry(f,options={}){const w=options.world||world(f),time=options.time??f._inkVisualClock,q=sample(f,{time,world:w});if(!q?.model)return null;const g=INK.StrikeCollider.body(q.model,{world:{x:w.x,groundWorldY:665+w.y,dir:w.dir,scale:w.scale}});if(!g?.valid)return null;
  const view=freeze({index:f.index,ch:{id:f.ch.id,scale:f.ch.scale},x:w.x,y:w.y,dir:w.dir,state:f.state,hp:f.hp,airLock:!!f.airLock,captured:!!f.captured,_inkVisualClock:time,_inkContactEpoch:f._inkContactEpoch||0,_inkHitRule:f._inkHitRule});
  return {...g,grabHurt:g.hurt.filter(b=>!/arm/i.test(b.part||b.id||'')),bodyModel:{kind:'hit-rule',owner:f._inkHitRule.owner,epoch:f._inkHitRule.epoch,clock:time,dir:w.dir,world:w,view}};
 }
 function between(previous,current,u){const a=previous?.bodyModel,b=current?.bodyModel;if(!a||!b||a.kind!=='hit-rule'||b.kind!=='hit-rule'||a.owner!==b.owner||a.epoch!==b.epoch||a.dir!==b.dir||!Number.isFinite(u)||u<0||u>1||b.clock<a.clock||b.clock-a.clock>1||a.world.scale!==b.world.scale)return null;const time=a.clock+(b.clock-a.clock)*u,w={...a.world,x:a.world.x+(b.world.x-a.world.x)*u,y:a.world.y+(b.world.y-a.world.y)*u},view={...(u===1?b.view:a.view),x:w.x,y:w.y,_inkVisualClock:time};if(b.view._inkHitRule.time<=time)view._inkHitRule=b.view._inkHitRule;return geometry(view,{time,world:w});}
 function reset(f){release(f);serials.delete(f);}
 function handoff(f){const time=f._inkVisualClock,w=world(f),q=sample(f);if(!q)return null;const ep=f._inkHitRule,h=.001,lo=Math.max(ep.previous?.time??ep.time,time-h),hi=time+h,rootVelocity=[Number.isFinite(f.px)?f.x-f.px:0,Number.isFinite(f.py)?f.y-f.py:0];
  const at=t=>{const dt=t-time,v=Object.create(f),w2={...w,x:w.x+rootVelocity[0]*dt,y:w.y+rootVelocity[1]*dt};v.x=w2.x;v.y=w2.y;return sample(v,{time:t,world:w2});},before=at(lo),after=at(hi);if(!before?.worldFeet||!after?.worldFeet)return null;
  const velocity=Object.fromEntries(['rear','front'].map(k=>[k,q.worldFeet[k].map((_,i)=>(after.worldFeet[k][i]-before.worldFeet[k][i])/(hi-lo))])),planned=INK.HitRuleFeet.sample(ep.feet,time);if(!planned)return null;
  let feet=ep.feet;const error={};for(const k of ['rear','front'])error[k]={position:Math.hypot(...q.worldFeet[k].map((v,i)=>v-planned[k].point[i])),velocity:Math.hypot(...velocity[k].map((v,i)=>v-planned[k].velocity[i]))};
  if(Object.values(error).some(e=>e.position>1e-5||e.velocity>1e-3)){
   feet=INK.HitRuleFeet.create(time,Object.fromEntries(['rear','front'].map(k=>[k,{point:q.worldFeet[k],velocity:velocity[k]}])));
   for(const k of ['rear','front']){if(error[k].position<=1e-5&&error[k].velocity<=1e-3){feet=freeze({...feet,feet:{...feet.feet,[k]:ep.feet.feet[k]}});continue;}const row=ep.feet.feet[k],remaining=row.to?row.start+row.duration-time:0,to=row.to||planned[k].point;if(remaining>0||Math.hypot(...velocity[k])>1e-9||error[k].position>1e-5)feet=INK.HitRuleFeet.retarget(feet,k,time,{to,duration:remaining>0?remaining:4,height:remaining>0?row.height||0:0,arc:remaining>0?row.arc||0:0});}
  }
  return {model:q.model,worldVelocities:velocity,velocityEvidence:'actual-rule-local-difference',velocityStep:h,footPlanMismatch:error,hitHandoff:INK.HitRuleHandoff?.capture({...q,worldVelocities:velocity},{time,dir:w.dir}),frame:q.frame,feet:q.worldFeet,hitFeet:feet,time,scale:w.scale,dir:w.dir,world:w};
 }

 INK.HitRule=Object.freeze({capture,begin,finish,abort,settle,owns,sample,geometry,between,handoff,release,reset,witnessed});
})();
