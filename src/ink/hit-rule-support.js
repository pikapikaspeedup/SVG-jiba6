/* Finite native-hit foot planning at simulation boundaries. No root motion,
 * support drop, input locks or render feedback. Reach failures remain visible. */
'use strict';
(()=>{
 const keys=['rear','front'],vec=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite),norm=v=>Math.hypot(...v),sub=(a,b)=>a.map((v,i)=>v-b[i]);
 const world=f=>({x:f.x,y:f.y,dir:f.dir===-1?-1:1,scale:f.ch.scale||1});
 function landing(model,key,w,desired){const chain=model?.joints3D?.[key+'Leg'],L=model?.physicalLengths?.[key+'Leg'];if(!chain||!L)return null;const hip=[w.x+chain[0][0]*w.scale*w.dir,665+w.y+chain[0][1]*w.scale,chain[0][2]*w.scale*w.dir],y=665+w.y-16*w.scale,r=(L[0]+L[1]-.5)*w.scale,dy=y-hip[1],radius=Math.sqrt(Math.max(0,r*r-dy*dy)),dx=desired[0]-hip[0],dz=desired[2]-hip[2],n=Math.hypot(dx,dz),k=n>radius?radius/(n||1):1;return [hip[0]+dx*k,y,hip[2]+dz*k];}
 function duration(a,b,v,scale){return Math.max(4,Math.ceil(1.5*norm(sub(b,a))/(12*scale)),Math.ceil(norm(v)/(6*scale)));}
 function create(source,f){const F=INK.HitRuleFeet,data=INK.HitRuleData.get(f.ch.id),w=world(f),time=source?.time;if(!F||!data||!Number.isFinite(time))return null;const input={};for(const key of keys){const p=source.worldFeet?.[key],v=source.worldVelocities?.[key];if(!vec(p)||!vec(v))return null;input[key]={point:p,velocity:v};}let plan=F.create(time,input);
  for(const key of keys){const q=input[key],ground=665+w.y-16*w.scale;if(norm(q.velocity)<1e-9&&Math.abs(q.point[1]-ground)<.5*w.scale)continue;const to=landing(source.carrier.model,key,w,[q.point[0],ground,q.point[2]]);if(!to)return null;plan=F.retarget(plan,key,time,{to,duration:duration(q.point,to,q.velocity,w.scale),height:0,arc:0});}return plan;
 }
 function prepare(ep,f,facts,time,bodySample){const F=INK.HitRuleFeet,data=INK.HitRuleData.get(f.ch.id),w={...world(f),dir:ep.dir||ep.source.carrier.world.dir},model=bodySample?.model;if(!data||!model||!ep.feet)return null;let plan=ep.feet;const sampled=F.sample(plan,time);if(!sampled)return null;const requests={front:[0,0],rear:[0,0]};
  for(const fact of facts||[]){const region=INK.HitRuleData.region(fact.hurtID),key=region==='frontLeg'?'front':region==='rearLeg'?'rear':null;if(!key)continue;const n=fact.normal||fact.incoming||[0,0],gain=(fact.hurtID.includes('.upper.')?.65:1)*(fact.last===false?.7:1);requests[key][0]+=n[0]*gain;requests[key][1]+=gain;}
  const touched=new Set();for(const key of keys){const request=requests[key];if(!request[1])continue;const q=sampled[key],shift=Math.max(-1,Math.min(1,request[0]))*data.redirect*w.scale,to=landing(model,key,w,[q.point[0]+shift,665+w.y-16*w.scale,q.point[2]]);if(!to)return null;plan=F.retarget(plan,key,time,{to,duration:duration(q.point,to,q.velocity,w.scale),height:data.lift*w.scale*Math.min(1,request[1]),arc:0});touched.add(key);}
  // Root push can exhaust a planted leg. Correct one foot only; an existing
  // swing keeps its finite trajectory unless the actual new hit targets it.
  if(!touched.size){let candidate=null,error=0;for(const key of keys){const q=sampled[key],row=plan.feet[key];if(row.to&&time<row.start+row.duration)continue;const chain=model.joints3D[key+'Leg'],L=model.physicalLengths[key+'Leg'],hip=[w.x+chain[0][0]*w.scale*w.dir,665+w.y+chain[0][1]*w.scale,chain[0][2]*w.scale*w.dir],excess=norm(sub(q.point,hip))-(L[0]+L[1]-.5)*w.scale;if(excess>error+.5*w.scale){candidate=key;error=excess;}}
   if(candidate){const q=sampled[candidate],to=landing(model,candidate,w,q.point);if(!to)return null;plan=F.retarget(plan,candidate,time,{to,duration:duration(q.point,to,q.velocity,w.scale),height:Math.min(4,data.lift)*w.scale,arc:0});}
  }return plan;
 }
 INK.HitRuleSupport=Object.freeze({create,prepare});
})();
