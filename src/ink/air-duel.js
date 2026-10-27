/* Delayed, uncertain air-window decisions. Candidate hit boxes are supplied
 * from the actor's native model; no opponent actor/input reference is accepted. */
'use strict';
(()=>{
 const settings={enabled:false},clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),box=b=>b&&['x','y','w','h'].every(k=>Number.isFinite(b[k]))&&b.w>0&&b.h>0;
 function predict(obs,t,variant,vx){let x=0,y=obs.y,vy=obs.vy,fast=!!obs.bodyView?.fast,left=t;const air=y<0;while(left>0){const dt=Math.min(1,left);if(air){if(variant===1&&vy< -8)vy=-8;if(variant===2&&vy>=-.5&&!fast){fast=true;vy=Math.max(7,vy);}if(fast)vy=Math.min(18,vy+.45);y+=vy*dt;vy+=.7;if(y>=0)return null;}x+=(vx+(variant===1?.35:variant===2?-.35:0))*dt;left-=dt;}return {dx:x,dy:y-obs.y};}
 function candidates(f,obs,G,frames,{vx=obs?.vx||0}={}){
  if(!obs||!Array.isArray(obs.hurt)||!Number.isFinite(obs.action)||!Number.isFinite(obs.vy)||!Number.isFinite(obs.y))return [];
  const lag=Math.max(0,G.actionTick-obs.action),out=[];
  for(const row of (frames||[]).slice(0,3)){if(!Number.isFinite(row.t)||row.t<0||row.t>24)continue;const horizon=lag+row.t;if(horizon>40)continue;let reached=0;
   for(let variant=0;variant<3;variant++){const predicted=predict(obs,horizon,variant,vx);if(!predicted)continue;
    // Require a real overlap margin, rather than shrinking every thin hurt
    // proxy on both axes until the entire body silently disappears.
    const margin=5,hit=(row.hit||[]).filter(box),hurt=obs.hurt.filter(box);if(hit.some(a=>hurt.some(b=>Math.min(a.x+a.w,b.x+predicted.dx+b.w)-Math.max(a.x,b.x+predicted.dx)>=margin&&Math.min(a.y+a.h,b.y+predicted.dy+b.h)-Math.max(a.y,b.y+predicted.dy)>=margin)))reached++;
   }if(reached>=2)out.push({t:row.t,uncertainty:5,horizon,reachFraction:reached/3});
  }return out;
 }
 function projectFrames(f,samples){
  if(samples?.space!=='root-local-world-units')return [];
  return (samples.frames||[]).slice(0,3).map(row=>{
   const t=row.t,air=f.y<0,fast=!!f._inkFlight?.fast,valid=Number.isFinite(t)&&t>=0&&t<=24;let y=f.y,vy=f.vy||0,remaining=valid?t:0,landed=false;
   // requestMove commits vx=0. No future directional input is assumed.
   // Fast descent is already committed, so its .45 impulse/cap precedes the
   // ordinary y+=vy; vy+=.7 integration. Fractional tail samples that step.
   while(air&&remaining>0){const dt=Math.min(1,remaining),stepV=fast?Math.min(18,vy+.45):vy;y+=stepV*dt;if(y>=0){landed=true;break;}vy=stepV+.7;remaining-=dt;}
   const ownUncertainty=air&&!fast?.06*t*(t+1):0;
   return {t,ownUncertainty,prediction:{horizontal:'committed-vx-zero',vertical:fast?'committed-fast':'no-new-input',futureInput:'unknown',rootX:f.x,rootY:y},hit:!valid||landed?[]:(row.hit||[]).filter(box).map(b=>({...b,x:f.dir===-1?f.x-b.x-b.w:f.x+b.x,y:665+y+b.y}))};
  });
 }
 function update(f,b,obs,G,api){
  if(!settings.enabled||!obs)return false;const now=G.actionTick,q=f._inkAirDuel||(f._inkAirDuel={last:-1,cooldown:0,plan:null,observation:null,vx:0,knownVelocity:false});if(q.last===now)return false;q.last=now;q.claimed=false;
  if(q.observation?.action!==obs.action){const old=q.observation,dt=old?obs.action-old.action:0;q.knownVelocity=dt>0&&dt<=12;q.vx=Number.isFinite(obs.vx)?clamp(obs.vx,-8,8):q.knownVelocity?clamp((obs.x-old.x)/dt,-8,8):0;q.observation={action:obs.action,x:obs.x,y:obs.y};}
  const excluded=f.hp<=0||f.attack||f.captured||f.throwAction||f.airLock||f.jumpPre||f.landT>0||f._inkPursuit||!['idle','recovery'].includes(f.state)||(f.y>=0&&obs.y>=-12)||['hit','tumble','down','rise','captured','throwing','ko'].includes(obs.state)||obs.attack?.kind==='upper'||(obs.projectiles||[]).some(s=>s.dir*(f.x-s.x)>0&&Math.abs(s.x-f.x)<380);
  if(excluded){q.plan=null;return false;}
  q.claimed=q.supported!==false;const flight=obs.flightID||(f._inkAirBody?.owner??'air:'+f.index);if(q.flight!==flight){q.flight=flight;q.reviews=0;q.plan=null;q.reviewStages=[];q.supported=null;q.claimed=true;}const phaseVelocity=f.y<0?(f.vy||0):obs.vy+.7*Math.max(0,now-obs.action),stage=phaseVelocity< -2?0:phaseVelocity<=3?1:2;if(now<(q.nextReview||0)||q.reviewAction===obs.action||q.reviews>=3||q.reviewStages.includes(stage)||now<q.cooldown)return false;q.nextReview=now+4;q.reviewAction=obs.action;q.reviews++;q.reviewStages.push(stage);q.plan={until:now+4};
  const ids=f.y<0?(obs.y<0?['aMP','aHK']:['aHK','aMP']):['cHP'],available=ids.map(id=>({id,frames:api.frames(f,id)})).filter(c=>Array.isArray(c.frames)&&c.frames.length);q.supported=available.length>0;q.claimed=q.supported;if(!q.supported){q.plan=null;return false;}for(const {id,frames} of available){const choices=candidates(f,obs,G,frames,q);if(!choices.length)continue;
   q.plan=null;q.cooldown=now+18;return !!api.attack(f,id,f.y<0?(obs.y<0?'延迟观察 · 空中截击':'延迟观察 · 晚脚跳入'):'延迟观察 · 对空窗口');
  }return false;
 }
 INK.AirDuel=Object.freeze({settings,active:()=>settings.enabled,update,candidates,projectFrames,claimed:f=>!!(settings.enabled&&f._inkAirDuel?.claimed),inspect:f=>f._inkAirDuel?{claimed:!!f._inkAirDuel.claimed,flight:f._inkAirDuel.flight,reviews:f._inkAirDuel.reviews,nextReview:f._inkAirDuel.nextReview,cooldown:f._inkAirDuel.cooldown}:null,reset:f=>{f._inkAirDuel=null;}});
})();
