/* Contact-owned, bounded analytic body transmission. No combat authority. */
'use strict';
(() => {
 const settings={enabled:true},limit=(v,a,b)=>Math.max(a,Math.min(b,v)),finite=(v,d=0)=>Number.isFinite(v)?v:d;
 const profiles=Object.freeze(Object.fromEntries(Object.entries({ryu:[1.12,.82,.85,1.1],ken:[1.02,1.08,1.02,.9],chun:[.9,.96,.94,1],cammy:[.88,1.22,1.18,.85],luke:[1.14,.86,.82,1.2],juri:[.9,1.18,1.08,.9],mai:[.86,1.25,1.12,1.05],iori:[1.06,1.12,.92,1.15]}).map(([id,p])=>[id,Object.freeze({compression:p[0],twist:p[1],step:p[2],lag:p[3]})])));
 let seen=new WeakMap();
 const active=()=>settings.enabled&&INK.Kinetic?.settings.enabled&&INK.StrikeFeel?.settings.enabled!==false;
 const excluded=f=>f.y<0||['down','ko','captured','throwing','tumble'].includes(f.state);
 function reset(f){f._inkHitBody=null;INK.HitEpisode?.release(f);seen.delete(f);}
 function commit(f,r){
  if(!active()||!r||r.guard||r.parry||r.armor||r.outcome&&r.outcome!=='hit'||r.contact?.throwing)return false;
  let set=seen.get(f);if(!set){set=new WeakSet();seen.set(f,set);}if(set.has(r))return false;set.add(r);
  const c=r.contact||{},p=profiles[f.ch.id]||profiles.ryu,dir=f.dir<0?-1:1,scale=f.renderScale||f.ch.scale||1,point=c.point||r.point||[f.x,665+f.y-230*scale],normal=c.normalGeom||c.normal||[r.worldDir||dir,0];
  const hurtPart=String(c.hurtPart||''),zone=hurtPart==='head'?'head':/leg|foot|shin/i.test(hurtPart)?'leg':r.zone==='head'||r.zone==='leg'?r.zone:'body';
  const packet=Object.freeze({born:finite(r.actorBirth,f._inkVisualClock||0),duration:28,dir,localDirection:(r.worldDir||dir)*dir,point:Object.freeze([(point[0]-f.x)/scale*dir,(point[1]-665-f.y)/scale]),normal:Object.freeze([finite(normal[0])*dir,finite(normal[1])]),zone,hurtPart,energy:limit(finite(r.energy,.5),0,1.6),compression:limit(finite(c.compression,p.compression),.6,1.4),twist:limit(finite(c.twist,p.twist),.6,1.4),step:limit(finite(c.step,p.step),.6,1.4),lag:p.lag});
  f._inkHitBody=Object.freeze([...(f._inkHitBody||[]).filter(q=>packet.born-q.born<q.duration),packet].slice(-3));return true;
 }
 // Strictly zero before arrival. Delayed stages start with zero displacement
 // and velocity; the directly struck segment alone has immediate compression.
 function wave(age,delay,duration,direct=false){if(age<delay||age>=duration)return 0;const t=age-delay,tail=(1-age/duration)**2;return (direct?Math.cos(t*.23):(1-Math.exp(-t*.7))**2*Math.cos(t*.23))*Math.exp(-t*.085)*tail;}
 function sample(f,time=f._inkVisualClock||0){
  const out={head:0,headYaw:0,chest:0,chestYaw:0,pelvis:0,pelvisYaw:0,lean:0,bob:0,fw:[0,0],rw:[0,0],fe:[0,0],re:[0,0],fa:[0,0],ra:[0,0],count:0};
  if(!active()||excluded(f))return out;
  for(const q of f._inkHitBody||[]){const age=time-q.born;if(age<0||age>=q.duration)continue;out.count++;
   // Reproject the stored impact basis into today's pose basis: a facing
   // change cannot reverse the residual force in world space.
   const sign=q.localDirection*q.dir*(f.dir<0?-1:1),gain=q.energy,delays=q.zone==='head'?[0,2,5,1]:q.zone==='leg'?[5,3,0,4]:[4,0,3,1];
   const [head,chest,hip,shoulder]=delays.map(d=>wave(age,d*q.lag,q.duration,d===0)*gain),arm=wave(age,5*q.lag,q.duration)*gain;
   // Signed 2D lever about chest/hip: actual height varies continuously
   // inside a zone; opposite off-centre contacts can twist oppositely.
   const chestLever=limit((q.point[0]*q.normal[1]-(q.point[1]+240)*q.normal[0])/110,-1,1),hipLever=limit((q.point[0]*q.normal[1]-(q.point[1]+150)*q.normal[0])/150,-1,1);
   const basis=q.dir*(f.dir<0?-1:1),turn=basis*q.twist*chestLever,hipTurn=basis*q.twist*hipLever,high=limit((-q.point[1]-230)/150,-1,1),headGain=1+.3*high,chestGain=1-.18*Math.abs(high),hipGain=1-.3*high;
   out.head-=sign*(q.zone==='head'?17:7)*head*headGain;out.headYaw+=turn*8*head*headGain;
   out.chest-=q.compression*(q.zone==='body'?14:5)*chest*chestGain;out.chestYaw+=turn*12*chest*chestGain;out.lean+=sign*7*chest;
   out.pelvis+=sign*(q.zone==='leg'?10:3)*hip*hipGain;out.pelvisYaw-=hipTurn*(q.zone==='leg'?10:5)*hip*hipGain;out.bob+=q.compression*Math.abs(hip)*(q.zone==='leg'?7:2);
   out.fe[0]+=sign*5*shoulder;out.re[0]+=sign*3*shoulder;out.fw[0]+=sign*10*arm;out.rw[0]+=sign*6*arm;out.fw[1]-=4*arm;out.rw[1]-=5*arm;
   if(q.zone==='leg'){const key=/rear/i.test(q.hurtPart)?'ra':'fa';out[key][0]-=sign*10*hip*q.step;out[key][1]-=5*Math.abs(hip);}
  }
  for(const k of Object.keys(out)){if(k==='count')continue;if(Array.isArray(out[k]))out[k]=out[k].map(v=>limit(v,-18,18));else out[k]=limit(out[k],-22,22);}return out;
 }
 function response(f,p,r,now,motion=1){
  if(INK.HitEpisode?.consumed(r)||INK.HitEpisode?.pending(f))return true;
  if(!active()||r?.guard||r?.parry||r?.armor)return false;
  if(excluded(f)||f.attack||['block','parry'].includes(f.state))return true;
  const q=sample(f,now),gain=limit(finite(motion,1),0,2)*(INK.Kinetic.settings.impact??1);
  for(const [k,v] of Object.entries(q)){if(k==='count')continue;if(Array.isArray(v)){if(Array.isArray(p[k]))p[k]=p[k].map((x,i)=>x+v[i]*gain);}else p[k]=(p[k]||0)+v*gain;}
  return true;
 }
 INK.HitBody={settings,profiles,active,commit,reset,sample,response,wave};
})();
