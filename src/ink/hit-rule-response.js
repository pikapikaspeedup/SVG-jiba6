/* Fixed-memory ground-hit episode. Contact facts and finite foot plans are
 * committed by simulation; presentation and combat consume the same sample. */
'use strict';
(()=>{
 const copy=x=>JSON.parse(JSON.stringify(x)),clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),rad=Math.PI/180;
 const quint=x=>{x=clamp(x);return clamp(x*x*x*(10+x*(-15+6*x)));};
 const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
 const unit=v=>{const n=Math.hypot(...v);return n>1e-10?v.map(x=>x/n):null;};
 function slerp(a,b,w){
  if(w<=0)return a.slice();if(w>=1)return b.slice();const x=unit(a),y=unit(b);if(!x||!y)return (x||y||[0,1,0]).slice();const d=clamp(x.reduce((s,v,i)=>s+v*y[i],0),-1,1);
  if(d>.999999)return unit(x.map((v,i)=>v+(y[i]-v)*w));
  let tangent=unit(y.map((v,i)=>v-d*x[i]));if(!tangent){const index=x.map(Math.abs).indexOf(Math.min(...x.map(Math.abs))),basis=[0,0,0];basis[index]=1;tangent=unit(basis.map((v,i)=>v-x[index]*x[i]));}
  const theta=Math.acos(d)*w;return x.map((v,i)=>v*Math.cos(theta)+tangent[i]*Math.sin(theta));
 }
 const chestPole=(v,p)=>{const yaw=(p.yaw||0)*rad,lean=(p.lean||0)*rad,twist=(p.twist||0)*rad,turn=(q,a)=>[q[0]*Math.cos(a)+q[2]*Math.sin(a),q[1],-q[0]*Math.sin(a)+q[2]*Math.cos(a)],q=turn(v,twist),r=[q[0]*Math.cos(lean)-q[1]*Math.sin(lean),q[0]*Math.sin(lean)+q[1]*Math.cos(lean),q[2]];return unit(turn(r,yaw));};
 function create(source,f){
  const carrier=source?.carrier,id=carrier?.model?.profile?.id,data=INK.HitRuleData?.get(id),rest=INK.HitRuleData?.rest(id);if(!carrier||!data||!rest||!INK.HitRuleSupport)return null;
  const p=carrier.entry.pose,poseDelta={lean:clamp(-(p.lean||0),-6,6),twist:clamp(-(p.twist||0),-8,8)},nextPose={...p,lean:(p.lean||0)+poseDelta.lean,twist:(p.twist||0)+poseDelta.twist};
  const targetPoles={...carrier.entry.poles};for(const n of ['frontArm','rearArm'])targetPoles[n]=chestPole(rest.poles[n],nextPose);
  const target=INK.DefenseBody.solve(carrier.model.profile,nextPose,carrier.entry.targets,{bodyX:carrier.entry.bodyX,poles:targetPoles,guardRelative:rest.wrists.rear,frontGuardRelative:rest.wrists.front,supportWeights:{front:0,rear:0}}),targetDeltas={};
  for(const n of ['frontArm','rearArm'])targetDeltas[n]=target.joints3D[n][2].map((v,i)=>v-carrier.entry.targets[n][i]);
  const armDirections=Object.fromEntries(['frontArm','rearArm'].map(n=>[n,{source:[0,1].map(i=>unit(carrier.model.joints3D[n][i+1].map((v,j)=>v-carrier.model.joints3D[n][i][j]))),target:[0,1].map(i=>unit(target.joints3D[n][i+1].map((v,j)=>v-target.joints3D[n][i][j])))}]));
  const feet=INK.HitRuleSupport.create(source,f);if(!feet)return null;
  return freeze({source,born:source.time,time:source.time,dir:carrier.world.dir,feet,dynamics:INK.HitRuleDynamics.create(source.time),restPlan:{delay:2,duration:data.returnFrames,poseDelta,targetDeltas,armDirections,sourcePoles:carrier.entry.poles,targetPoles,materials:rest},contactCount:0,lastContact:null});
 }
 function sample(ep,f,time,world){
  if(!ep||!Number.isFinite(time)||time<ep.born)return null;const source=ep.source,carrier=source.carrier,feet=INK.HitRuleFeet.sample(ep.feet,time);if(!feet)return null;
  // The episode's original facing is immutable. A hit cannot reinterpret its
  // old response when input intent turns; turning belongs to the next owner.
  const ownedWorld={...world,dir:ep.dir},worldFeet=Object.fromEntries(['rear','front'].map(k=>[k,feet[k].point])),dynamics=INK.HitRuleDynamics.sample(ep.dynamics,time),r=ep.restPlan,w=quint((time-ep.born-r.delay)/r.duration);
  let base;if(w===0)base=INK.HitRuleBody.clone(carrier);else base=INK.HitRuleBody.deform(carrier,{world:ownedWorld,poseDelta:Object.fromEntries(Object.entries(r.poseDelta).map(([k,v])=>[k,v*w])),targetDeltas:Object.fromEntries(Object.entries(r.targetDeltas).map(([k,v])=>[k,v.map(x=>x*w)])),armDirections:Object.fromEntries(Object.entries(r.armDirections).map(([n,d])=>[n,d.source.map((v,i)=>slerp(v,d.target[i],w))])),worldFeet,supportWeights:{front:0,rear:0},carrierWeight:1-w});
  if(!base)return null;const model=INK.HitRuleSpatial.solve(base,dynamics.value,{world:ownedWorld,worldFeet});if(!model)return null;
  model.pose.fan=(carrier.model.pose.fan??.7)+((r.materials.fan??.7)-(carrier.model.pose.fan??.7))*w;model.pose.fanAngle=(carrier.model.pose.fanAngle||0)+((r.materials.fanAngle||0)-(carrier.model.pose.fanAngle||0))*w;
  if(w>.5){model.pose.handFront=r.materials.hands.front;model.pose.handRear=r.materials.hands.rear;}
  const frame={...INK.StrikeModelFrame.build(f,model,{world:ownedWorld}),mode:'hit-rule',nativeBody:true};
  return {model,frame,pose:model.pose,worldFeet:frame.worldFeet,plannedFeet:worldFeet,worldVelocities:Object.fromEntries(['rear','front'].map(k=>[k,feet[k].velocity])),dynamics,time,restWeight:w};
 }
 const currentWorld=(ep,f)=>({x:f.x,y:f.y,dir:ep.dir,scale:ep.source.carrier.world.scale});
 function commit(ep,f,facts,time){
  const before=sample(ep,f,time,currentWorld(ep,f));if(!before)return null;
  const id=ep.source.carrier.model.profile.id,drives=facts.map(fact=>INK.HitRuleData.drive(id,{hurtID:fact.hurtID,s:fact.incoming[0]*ep.dir,tau:fact.leverTau??0,level:fact.level,last:fact.last,counter:fact.counter})).filter(Boolean);
  const dynamics=INK.HitRuleDynamics.commit(ep.dynamics,drives,time),feet=INK.HitRuleSupport.prepare(ep,f,facts,time,before);if(!feet)return null;
  return {...ep,time,dynamics,feet,contactCount:ep.contactCount+facts.length,lastContact:facts.length?facts[facts.length-1]:ep.lastContact};
 }
 function advance(ep,f,time){const before=sample(ep,f,time,currentWorld(ep,f));if(!before)return null;const feet=INK.HitRuleSupport.prepare(ep,f,[],time,before);return feet?{...ep,time,feet,dynamics:INK.HitRuleDynamics.advance(ep.dynamics,time)}:null;}
 INK.HitRuleResponse=Object.freeze({create,commit,advance,sample});
})();
