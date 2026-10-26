/* Ground-hit visual ownership. Accepted contacts transact before publishing a body. */
'use strict';
(() => {
 const pending=new WeakMap(),consumed=new WeakSet(),clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),world=f=>({x:f.x,y:f.y,dir:f.dir,scale:f.renderScale||f.ch.scale||1});
 const available=()=>INK.HitBody?.active()&&INK.HitBodyFrame&&INK.HitDynamics;
 const eligible=f=>f.state==='hit'&&f.y===0&&!f.airLock&&!f.captured&&!f.throwAction&&f.hp>0;
 const owns=f=>!!(available()&&!f._inkNoHitEpisode&&f._inkHitEpisode&&eligible(f));
 const clearBridges=f=>{f._inkStateVisualBlend=null;f._inkVisualTransition=null;f._inkJointTransition=null;f._inkFrameTransition=null;};
 function begin(f,from,facts){if(!available()||!from?.frame)return null;const tx={from,facts,reactions:[],previous:f._inkHitEpisode,time:f._inkVisualClock||0};pending.set(f,tx);return tx;}
 function enqueue(f,reaction){const tx=pending.get(f);if(!tx)return false;tx.reactions.push(reaction);return true;}
 function clean(f){const v=Object.create(f);Object.assign(v,{_inkNoHitEpisode:true,_inkHitEpisode:null,_inkHitBody:null,_inkReaction:null,_inkRecoil:null,_inkWeight:null,_inkSupport:null,_inkLocomotion:null,_inkState:null,_inkStateBlend:null,_inkStateVisualBlend:null,_inkVisualTransition:null,_inkJointTransition:null,_inkTransition:null,_inkFrameTransition:null});return v;}
 function neutral(f,source){
  const v=clean(f);Object.assign(v,{state:'idle',stateAge:0,attack:null,move:0,crouch:false,jumpPre:0,captured:false,captureKind:null,throwAction:null});
  const pose=SVG_FIGHTER.pose(v),p=INK.Runtime.visual(v,pose,world(v));
  return {pose:p,frame:INK.VisualFrame.get(p)};
 }
 const distanceToSegment=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],u=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(p[0]-a[0]-u*dx,p[1]-a[1]-u*dy);};
 function drive(f,tx,r,frame){
  const facts=tx.facts,c=r.contact||{},scale=world(f).scale,point=facts.point||r.point,local=[(point[0]-f.x)/scale,(point[1]-665-f.y)/scale],input=facts.incoming||[r.worldDir||f.dir,0],n=Math.hypot(...input)||1,incoming=input.map(x=>x/n),raw=facts.witness?.normal||c.normalGeom||incoming,nl=Math.hypot(...raw)||1,normal=raw.map(x=>x/nl),dot=normal[0]*incoming[0]+normal[1]*incoming[1];if(dot<0)normal.forEach((x,i)=>normal[i]=-x);
  const part=String(facts.witness?.hurtPart||c.hurtPart||''),zone=part==='head'?'head':/leg|foot|shin/i.test(part)?'leg':r.zone==='head'||r.zone==='leg'?r.zone:'body',profile=INK.HitBody.profiles[f.ch.id]||INK.HitBody.profiles.ryu,dir=tx.previous?.dir||(f.dir<0?-1:1),measured=c.affectsPush===true,contactGain=measured?clamp(.8+.25*c.quality+.12*c.closing/8,.75,1.15):1,energy=clamp(r.energy*contactGain,0,1.6),sign=(normal[0]*.75+incoming[0]*.25)*dir;
  const joint=k=>frame.joints3D[k]||frame.rig.anatomy.sockets[k],chest=joint('chest'),hip=joint('pelvis'),lever=clamp(((local[0]-chest[0])*normal[1]-(local[1]-chest[1])*normal[0])/110,-1,1)*dir;
  // Screen torque drives screen bend. Yaw below is a designed side reaction,
  // not an inferred physical 3D torque from a 2D collision witness.
  let leg=/rear/i.test(part)?'ra':'fa';if(zone==='leg'&&!/rear|front/i.test(part)){const score=k=>{const q=frame.joints3D[k+'Leg'];return Math.min(distanceToSegment(local,q[0],q[1]),distanceToSegment(local,q[1],q[2]));};leg=score('rear')<score('front')?'ra':'fa';}
  const direct={},delayed=[],gain=energy*(INK.Kinetic.settings.impact??1),add=(delay,values)=>delayed.push({delay:clamp(Math.round(delay*profile.lag),0,8),values:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,v*gain]))});
  if(zone==='head'){direct.head=-sign*9*gain;add(2,{lean:sign*4,chest:lever*3});add(5,{pelvis:sign*2,bob:2});add(4,{fwY:-3,rwY:-2});}
  else if(zone==='leg'){direct[leg+'Y']=-8*gain;add(1,{pelvis:sign*10,bob:7});add(3,{lean:sign*5,chest:lever*2});add(5,{head:-sign*3});add(4,{[leg+'X']:-sign*8*profile.step,fwX:sign*3,rwX:sign*3});}
  else{direct.chest=-10*profile.compression*gain;add(2,{pelvis:sign*4,bob:3});add(1,{lean:sign*10,chest:lever*3});add(4,{head:-sign*5});add(5,{fwX:-sign*6,rwX:-sign*5,fwY:3,rwY:3});}
  return {direct,delayed,record:Object.freeze({time:tx.time,zone,part,leg,point:Object.freeze(point.slice()),incoming:Object.freeze(incoming),normal:Object.freeze(normal),energy,quality:facts.witness||c.hurtPart?'measured':'fallback',momentumMeasured:measured})};
 }
 function finish(f,tx){
  if(!tx||pending.get(f)!==tx)return;pending.delete(f);
  if(!eligible(f)||!tx.reactions.length){release(f);if(tx.from&&!['captured','throwing'].includes(f.state))INK.StateTransitions.bind(f,tx.from,{next:f.state,kind:f.state});return;}
  let ep=tx.previous;
  if(!ep){const source=tx.from.frame.frame,rest=neutral(f,source);ep={born:tx.time,source,carrier:INK.HitBodyFrame.capture(source),displayPose:INK.copy(tx.from.pose),rest:rest.frame,dynamics:INK.HitDynamics.create(tx.time),previousDynamics:null,contacts:[],dir:f.dir<0?-1:1};}
  const current=tx.from.frame.frame,drives=tx.reactions.map(r=>drive(f,tx,r,current)),dynamics=INK.HitDynamics.commit(ep.dynamics,drives,tx.time);
  for(const r of tx.reactions)consumed.add(r);
  f._inkHitEpisode=Object.freeze({...ep,previousDynamics:ep.dynamics,dynamics,contacts:Object.freeze([...ep.contacts,...drives.map(d=>d.record)].slice(-3))});
  f._inkHitBody=null;clearBridges(f);
 }
 function release(f){f._inkHitEpisode=null;f._inkHitBody=null;}
 function abort(f,tx){if(pending.get(f)===tx)pending.delete(f);}
 function sample(f,w=world(f),time=f._inkVisualClock||0){
  const ep=f._inkHitEpisode;if(!ep)return null;
  const state=time>=ep.dynamics.time?ep.dynamics:ep.previousDynamics&&time>=ep.previousDynamics.time?ep.previousDynamics:null,flat=state?INK.HitDynamics.sample(state,time):{},q={};
  for(const key of ['head','headYaw','chest','chestYaw','pelvis','pelvisYaw','lean','bob'])q[key]=flat[key]||0;
  for(const key of ['fw','rw','fe','re','fa','ra'])q[key]=[flat[key+'X']||0,flat[key+'Y']||0];
  const age=Math.max(0,time-ep.born),u=clamp((age-3)/15,0,1),settle=u*u*(3-2*u),latest=ep.contacts.at(-1),footTargets={},support={};
  for(const key of ['rear','front']){
   const release=latest?.zone==='leg'&&latest.leg===(key==='rear'?'ra':'fa'),a=ep.source.worldFeet[key],rest=ep.rest.joints3D[key+'Leg'][2],start=release?1:4,end=release?9:13,progress=clamp((age-start)/(end-start),0,1),blend=progress*progress*(3-2*progress),scale=w.scale||1;
   const anchored=[(a[0]-w.x)/scale,(a[1]-665-w.y)/scale,(a[2]||0)/scale],lift=(release?12:3)*Math.sin(Math.PI*progress)**2;
   footTargets[key]=anchored.map((v,i)=>v+(rest[i]-v)*blend);footTargets[key][1]-=lift;
   support[key]={phase:progress===0?'bear':progress===1?'settled':'recover',released:release,weight:1-blend};
  }
  const frame=INK.HitBodyFrame.deform(ep.carrier,q,{world:w,dir:ep.dir,settleFrame:ep.rest,settle,footTargets});
  return INK.VisualFrame.attach(INK.copy(ep.displayPose),{...frame,mode:'contact',contactCarrier:ep.carrier,hitEpisode:{age,settle,support,contacts:ep.contacts.length,representation:ep.carrier.representation}});
 }
 function support(f){if(!owns(f))return false;INK.Locomotion?.reset(f);f._inkSupport={time:f._inkVisualClock||0,x:f.x,dir:f.dir,velocity:0,drive:0,brake:0,turn:0,distance:0,mode:'contact',contacts:null};return true;}
 INK.HitEpisode={begin,enqueue,finish,abort,owns,sample,release,clean,support,pending:f=>pending.has(f),consumed:r=>!!r&&consumed.has(r)};
})();
