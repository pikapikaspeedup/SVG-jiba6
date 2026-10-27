/* Finite air-to-ground foot handoff. The caller has already committed root y=0
 * and existing landing recovery. This module never changes either. */
'use strict';
(()=>{
 const keys=['rear','front'],finite=q=>Array.isArray(q)&&q.length===3&&q.every(Number.isFinite),freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
 function create(f,current,{previous=null,time=f._inkVisualClock,dir=f.dir,scale=f.ch.scale||1}={}){
  if(!current?.model||!Number.isFinite(time)||!(scale>0)||f.y!==0||![1,-1].includes(dir))return null;
  current={...current,model:JSON.parse(JSON.stringify(current.model))};
  const world={x:f.x,y:0,dir,scale},frame=INK.StrikeModelFrame.build(f,current.model,{world}),feet=frame.worldFeet,velocity={},evidence={};
  // Prefer explicit rule derivatives. Otherwise a completed-rule secant is
  // honest finite-difference evidence, never a displayed-frame derivative. The
  // rebuilt current feet include this completed step's root landing displacement.
  for(const k of keys){if(!finite(feet?.[k]))return null;if(finite(current.worldVelocities?.[k])){velocity[k]=current.worldVelocities[k].slice();evidence[k]=current.velocityEvidence||'provided-rule-velocity';}
   else if(previous&&Number.isFinite(previous.time)&&Number.isFinite(current.time)&&current.time>previous.time&&current.time-previous.time<=1&&finite(previous.worldFeet?.[k])){velocity[k]=feet[k].map((v,i)=>(v-previous.worldFeet[k][i])/(current.time-previous.time));evidence[k]='completed-boundary-secant';}
   else return null;
  }
  const residuals={},segments={},normalConstraints={};for(const k of keys){const n=k+'Leg',chain=current.model.joints3D[n],lens=current.model.physicalLengths[n],H=[f.x+chain[0][0]*scale*dir,665+chain[0][1]*scale,chain[0][2]*scale*dir],ground=665-16*scale,L=(lens[0]+lens[1]-.01)*scale,vertical=ground-H[1],radius=Math.sqrt(Math.max(0,L*L-vertical*vertical)),p=feet[k],dx=p[0]-H[0],dz=p[2]-H[2],distance=Math.hypot(dx,dz),ratio=distance>radius&&distance>0?radius/distance:1,to=[H[0]+dx*ratio,ground,H[2]+dz*ratio];
   residuals[k]=Math.max(0,Math.abs(vertical)-L);const travel=Math.hypot(...to.map((v,i)=>v-p[i])),speed=Math.hypot(...velocity[k]);if(travel<1e-7&&speed<1e-7){normalConstraints[k]={before:0,after:0,penetration:Math.max(0,p[1]-ground)};continue;}
   // No new lift: settle the actual airborne feet, don't replay a jump.
   const duration=Math.max(INK.AirBodyData?.landing?.[f.ch.id]?.[k]||4,Math.ceil(1.5*travel/(12*scale)),Math.ceil(speed/(6*scale))),before=velocity[k][1],clearance=Math.max(0,ground-p[1]);
   // With a zero end velocity, vY*duration <= 3*clearance keeps the
   // cubic below the ground plane. At contact downward normal velocity is
   // removed; tangential X/Z and all initial positions are unchanged.
   velocity[k][1]=Math.min(before,3*clearance/duration);normalConstraints[k]={before,after:velocity[k][1],penetration:Math.max(0,p[1]-ground)};segments[k]={to,duration,height:0,arc:0};
  }
  let plan=INK.HitRuleFeet.create(time,Object.fromEntries(keys.map(k=>[k,{point:feet[k],velocity:velocity[k]}])));for(const k of keys)if(segments[k])plan=INK.HitRuleFeet.retarget(plan,k,time,segments[k]);
  const sample={model:current.model,time,worldVelocities:velocity};return freeze({frame,feet,hitFeet:plan,hitHandoff:INK.HitRuleHandoff.capture(sample,{time,dir}),model:current.model,time,world,dir,scale,worldVelocities:velocity,velocityEvidence:evidence,landingResiduals:residuals,normalConstraints,continuity:'C0-body and feet; tangential velocity preserved; downward normal constrained at landing'});
 }
 INK.AirLanding=Object.freeze({create});
})();
