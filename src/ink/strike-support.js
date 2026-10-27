/* Finite attack-entry support snapshot. Pure continuation, never a gait owner. */
'use strict';
(()=>{
 const keys=['rear','front'],clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);},copy=x=>JSON.parse(JSON.stringify(x)),freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
 const point=q=>[q[0],q[1],q[2]||0];
 function at(foot,time){
  if(!foot.swing)return point(foot.anchor);
  const s=foot.swing,u=clamp((time-s.start)/Math.max(1e-6,s.duration)),v=s.velocity||[0,0,0],a=point(s.from),b=point(s.to),h=u*u*(3-2*u),g=u*(1-u)*(1-u),wave=Math.sin(Math.PI*u)**2;
  return a.map((x,i)=>x+(b[i]-x)*h+(s.hermite?v[i]*s.duration*g:0)+(i===1?-s.height*wave:i===2?(s.arc||0)*wave:0));
 }
 function velocity(foot,time){const s=foot.swing;if(!s||time<s.start||time>=s.start+s.duration)return [0,0,0];const duration=Math.max(1e-6,s.duration),u=(time-s.start)/duration,d=6*u*(1-u)/duration,w=Math.PI*Math.sin(2*Math.PI*u)/duration,a=point(s.from),b=point(s.to);return a.map((x,i)=>(b[i]-x)*d+(s.hermite?(s.velocity?.[i]||0)*s.duration/duration*(1-4*u+3*u*u):0)+(i===1?-s.height*w:i===2?(s.arc||0)*w:0));}
 function capture(f,rule,{time=f._inkVisualClock||0,epoch=f._inkContactEpoch||0,root={x:f.x,y:f.y},scale=f.ch.scale||1,dir=f.dir}={}){
  const worldFeet=rule?.worldFeet||rule?.frame?.worldFeet;if(!worldFeet)return null;
  const feet={},face=f._inkFacing,gait=f._inkLocomotion,owns=face?.feetOwned&&!face.suspended,prior=f.attack?.strikeSupportPlan,priorChain=INK.StrikeModelData?.[f.ch.id+':'+f.attack?.m?.id]?.contactChain||(f.attack?.m?.id==='cMK'?'frontLeg':null);
  for(const k of keys){const anchor=point(worldFeet[k]);let swing=null;
   if(prior?.feet[k]){
    const old=prior.feet[k],landing=point(old.swing?.to||old.anchor),attacking=priorChain===k+'Leg';
    if(attacking&&anchor[1]<landing[1]-2*scale){
     const distance=Math.hypot(...landing.map((v,i)=>v-anchor[i]));
     swing={from:anchor.slice(),to:landing,velocity:[0,0,0],start:time,duration:Math.max(6,Math.ceil(1.5*distance/(10*scale))),height:0,arc:0,hermite:false,landingFromAttack:true};
    }else if(!attacking&&old.swing&&time<old.swing.start+old.swing.duration)swing=copy(old.swing);
   }
   else if(owns){const q=face.feet[k];if(q&&time<q.start+q.duration)swing={from:point(q.from),to:point(q.to),velocity:point(q.velocity||[0,0,0]),start:q.start,duration:q.duration,height:q.height||0,arc:q.arc||0,hermite:true};}
   else if(gait?.feet[k]?.swing){const q=gait.feet[k],s=q.swing;if(time<s.start+s.duration)swing={from:s.spatial3D?point(s.from):[...s.from,q.z||0],to:s.spatial3D?point(s.to):[...s.to,q.z||0],velocity:s.spatial3D?point(s.velocity||[0,0,0]):[...(s.velocity||[0,0]),0],start:s.start,duration:s.duration,height:s.height||0,arc:s.spatial3D?s.arc||0:0,hermite:!!s.run};}
   const foot={anchor,swing},planned=at(foot,time),correction=anchor.map((v,i)=>v-planned[i]),distance=Math.hypot(...correction);
   feet[k]={...foot,correction,correctionDuration:Math.max(3,Math.ceil(1.5*distance/(12*scale)))};
  }
  return freeze({version:1,time,epoch,origin:{x:root.x,y:root.y||0},scale,dir:dir===-1?-1:1,feet});
 }
 function rebase(plan,{root,epoch=plan?.epoch,time,previousTime}){if(!plan)return null;const p=copy(plan),dx=root.x-p.origin.x,dy=(root.y||0)-p.origin.y,dt=Number.isFinite(time)&&Number.isFinite(previousTime)?time-previousTime:0;for(const f of Object.values(p.feet)){for(const q of [f.anchor,f.swing?.from,f.swing?.to].filter(Boolean)){q[0]+=dx;q[1]+=dy;}if(f.swing)f.swing.start+=dt;}p.time+=dt;if(Number.isFinite(p.preparedAt))p.preparedAt+=dt;p.origin={x:root.x,y:root.y||0};p.epoch=epoch;return freeze(p);}
 // Commit only at an explicit simulation boundary, after shared torso drop.
 function prepare(plan,query,{roots,lengths,contactChain,frontLoad=.5}={}){
  if(!plan||!roots||!lengths)return plan;
  const time=query.time??plan.time+(query.age||0),scale=query.scale||plan.scale,dir=query.dir||plan.dir,current=sample(plan,{...query,time,contactChain}),p=copy(plan),load=clamp(frontLoad),candidates=[];
  p.frontLoad=load;
  for(const k of keys){if(contactChain===k+'Leg')continue;
   const foot=p.feet[k];if(foot.swing&&time<foot.swing.start+foot.swing.duration)continue;
   const H=roots[k],lens=lengths[k];if(!H||!lens)continue;
   const E=current.targets[k],radius=lens[0]+lens[1]-.02,dist=Math.hypot(...E.map((v,i)=>v-H[i]));if(dist<=radius+.25)continue;
   // Preserve ankle height when a ground-plane intersection exists. Otherwise
   // expose residual; do not invent a ground point beyond a fixed-length leg.
   const dy=E[1]-H[1],horizontalSquared=radius*radius-dy*dy;if(horizontalSquared<=0)continue;
   const dx=E[0]-H[0],dz=E[2]-H[2],horizontal=Math.hypot(dx,dz)||1,allowed=Math.sqrt(horizontalSquared)*.97;
   const goal=[H[0]+dx/horizontal*Math.min(horizontal,allowed),E[1],H[2]+dz/horizontal*Math.min(horizontal,allowed)];
   candidates.push({k,load:contactChain?1:k==='front'?load:1-load,goal});
  }
  candidates.sort((a,b)=>a.load-b.load||a.k.localeCompare(b.k));
  // Never release a second support while an earlier corrective step is live.
  const busy=keys.some(k=>p.feet[k].swing?.correctionStep&&time<p.feet[k].swing.start+p.feet[k].swing.duration);
  if(candidates.length&&!busy){const c=candidates[0],from=current.worldFeet[c.k],to=[query.root.x+c.goal[0]*scale*dir,665+(query.root.y||0)+c.goal[1]*scale,c.goal[2]*scale*dir],distance=Math.hypot(...to.map((v,i)=>v-from[i])),duration=Math.max(6,Math.ceil(1.5*distance/(10*scale)));
   p.feet[c.k]={anchor:from.slice(),correction:[0,0,0],correctionDuration:3,swing:{from:from.slice(),to,velocity:[0,0,0],start:time,duration,height:Math.min(10,3+distance/8),arc:0,hermite:false,correctionStep:true}};
  }
  p.preparedAt=time;p.singleSupportRisk=!!contactChain&&candidates.length>0;return freeze(p);
 }
 function sample(plan,{age=0,time=plan?.time+age,root,scale=plan?.scale||1,dir=plan?.dir||1,epoch=plan?.epoch,contactChain,defaultTargets={},frontLoad=plan?.frontLoad??.5}={}){
  if(!plan||!root)return null;if(epoch!==plan.epoch)plan=rebase(plan,{root,epoch});const targets={},weights={},worldFeet={},worldVelocities={};let completed=true;
  for(const k of keys){const f=plan.feet[k],s=f.swing,u=s?clamp((time-s.start)/s.duration):1,q=at(f,time),c=1-smooth((time-plan.time)/f.correctionDuration);for(let i=0;i<3;i++)q[i]+=f.correction[i]*c;
   const vel=velocity(f,time),cu=(time-plan.time)/f.correctionDuration,cd=cu>0&&cu<1?-6*cu*(1-cu)/f.correctionDuration:0;for(let i=0;i<3;i++)vel[i]+=f.correction[i]*cd;
   const owned=contactChain===k+'Leg';const load=contactChain?1:k==='front'?clamp(frontLoad):1-clamp(frontLoad);weights[k]=owned?0:load*(s&&time<s.start+s.duration?1-Math.sin(Math.PI*u)**2:1);completed&&=!s||time>=s.start+s.duration;
   targets[k]=owned&&defaultTargets[k]?point(defaultTargets[k]):[(q[0]-root.x)/scale*dir,(q[1]-665-(root.y||0))/scale,q[2]/scale*dir];worldVelocities[k]=owned&&defaultTargets[k]?null:vel;worldFeet[k]=owned?[root.x+targets[k][0]*scale*dir,665+(root.y||0)+targets[k][1]*scale,targets[k][2]*scale*dir]:q;
  }
  return {targets,weights,worldFeet,worldVelocities,completed,singleSupportRisk:!!plan.singleSupportRisk,epoch:plan.epoch};
 }
 INK.StrikeSupport=Object.freeze({capture,sample,rebase,prepare});
})();
