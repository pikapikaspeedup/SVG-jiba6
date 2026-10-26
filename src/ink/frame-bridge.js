/* World-space presentation handoff. Contact limbs meet the attack deadline;
 * committed support steps retain their own clock. Never supplies combat geometry. */
'use strict';
(() => {
 const names=['rearArm','frontArm','rearLeg','frontLeg'],mix=(a,b,u)=>a+(b-a)*u;
 const blend=(a,b,u)=>a.map((v,i)=>mix(v,b[i],u)),distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 const ease=u=>{u=INK.clamp(u);return u*u*(3-2*u);};
 const frameOf=p=>INK.VisualFrame?.get(p),world=f=>({x:f.x,y:f.y,scale:f.renderScale||f.ch.scale||1});
 function capture(f,p){
  const frame=frameOf(p);if(!frame)return null;
  return {frame,world:world(f),time:f._inkVisualClock||0,footPlan:frame.bridge?.footPlan||(f._inkFacing?.feetOwned?{kind:'turn',plan:f._inkFacing}:f._inkLocomotion?{kind:'gait',plan:f._inkLocomotion}:null)};
 }
 const sampleFeet=(plan,time)=>plan?.kind==='turn'?INK.FacingMotion.sampleFeet(plan.plan,time):plan?.kind==='gait'?INK.Locomotion.samplePlan(plan.plan,time):null;
 function contactChains(f){
  const m=f.attack?.m;if(!m)return [];
  const kick=m.contactPart?m.contactPart==='foot':m.pose==='kick'||['drill','dive','spin'].includes(m.kind)||m.pose==='upper'&&f.ch.female;
  return kick?(m.kind==='spin'?['frontLeg','rearLeg']:['frontLeg']):['frontArm'];
 }
 function begin(f,from,{state=f.state,attack=null,duration=5,impact=false,guard=false,deadlineFrame=null,carry=0}={}){
  if(!from||duration<=0||['throwing','captured','down','ko'].includes(state)){f._inkFrameTransition=null;return;}
  if(attack&&from.footPlan?.kind==='gait'&&INK.Locomotion?.strikePlan){
   const plan=INK.Locomotion.strikePlan(from.footPlan.plan,{time:f._inkVisualClock||0,world:from.world,frame:from.frame,deadlineFrame,carry,dir:f.dir});
   if(plan)from={...from,footPlan:{kind:'gait',plan}};
  }
  const start=f._inkVisualClock||0,feet=sampleFeet(from.footPlan,start),remaining=Math.max(0,(feet?.endTime||start)-start);
  f._inkFrameTransition=Object.freeze({from,state,attack,duration,impact,guard,deadlineFrame,start,supportDuration:feet?remaining+10:duration});
 }
 // Contact legacy chains live in a native plane. Fit through their saved
 // forward map; artificial display depth never supplies an IK bone length.
 function contactChain(frame,name,a,root,end,ratio){
  const carrier=frame.contactCarrier,native=frame.nativeChains?.[name]||carrier?.nativeChains?.[name],B=frame.forwardBindings?.[name]||carrier?.bindings?.[name];
  if(!native||!B)return null;
  const lengths=[0,1].map(i=>Math.hypot(...native[i+1].map((v,j)=>v-native[i][j]))),angles=[0,1].map(i=>Math.atan2(native[i+1][1]-native[i][1],native[i+1][0]-native[i][0]));
  const fk=()=>{const p=native[0],j=[p[0]+lengths[0]*Math.cos(angles[0]),p[1]+lengths[0]*Math.sin(angles[0])];return [p.slice(),j,[j[0]+lengths[1]*Math.cos(angles[1]),j[1]+lengths[1]*Math.sin(angles[1])]];};
  const project=q=>[ratio*(B[0]*q[0]+B[2]*q[1]),ratio*(B[1]*q[0]+B[3]*q[1])],initial=fk().map(project),correction=a.map((p,i)=>[p[0]-a[0][0]-initial[i][0]+initial[0][0],p[1]-a[0][1]-initial[i][1]+initial[0][1]]);
  if(correction.some(q=>Math.hypot(...q)>24*ratio))return null;
  for(let k=0;k<12;k++){const points=fk().map(project),last=points[2],error=[end[0]-root[0]-last[0]+points[0][0]-correction[2][0],end[1]-root[1]-last[1]+points[0][1]-correction[2][1]],jac=angles.map((v,i)=>{const x=-lengths[i]*Math.sin(v),y=lengths[i]*Math.cos(v);return [ratio*(B[0]*x+B[2]*y),ratio*(B[1]*x+B[3]*y)];}),den=jac.flat().reduce((s,v)=>s+v*v,80);for(let i=0;i<2;i++)angles[i]+=Math.max(-.08,Math.min(.08,(jac[i][0]*error[0]+jac[i][1]*error[1])/den));}
  const points=fk().map(project),chain=points.map((q,i)=>[root[0]+q[0]-points[0][0]+correction[i][0],root[1]+q[1]-points[0][1]+correction[i][1],a[i][2]+root[2]-a[0][2]]);
  return {chain,residual:distance(chain[2],end),native:fk(),metric:'nativeProjected'};
 }
 function apply(f,target,{world:currentWorld,time=f._inkVisualClock||0}={}){
  const tr=f._inkFrameTransition;if(!tr||f.state!==tr.state||tr.attack&&f.attack?.m.id!==tr.attack)return target;
  const age=time-tr.start,grounded=f.y===0&&!f.airLock&&!f.captured&&!f.attack?.m.throw;
  // A newly committed walking/turning plan supersedes a captured plan. Only
  // actions without that live support owner continue their outgoing footstep.
  const liveSupport=target.mode==='locomotion'&&!!(INK.FacingMotion?.sample(f,time)?.ownsFeet||INK.Locomotion?.sample(f,time));
  const footPlan=grounded&&!liveSupport&&tr.from.frame.mode!=='contact'?tr.from.footPlan:null,feet=sampleFeet(footPlan,time),total=feet?Math.max(tr.duration,tr.supportDuration):tr.duration;
  if(age<0||age>=total)return target;
  const old=tr.from.frame,w=currentWorld||world(f),oldWorld=tr.from.world,scale=w.scale||1,ratio=oldWorld.scale/scale;
  const shift=[(oldWorld.x-w.x)/scale,(oldWorld.y-w.y)/scale,0],t=ease(age/tr.duration),critical=contactChains(f);
  const point=q=>q.map((v,i)=>v*ratio+shift[i]);
  const matrix=m=>[m[0]*ratio,m[1]*ratio,m[2]*ratio,m[3]*ratio,m[4]*ratio+shift[0],m[5]*ratio+shift[1]];
  const angle=(a,b,u=t)=>a+Math.atan2(Math.sin((b-a)*Math.PI/180),Math.cos((b-a)*Math.PI/180))*180/Math.PI*u;
  const joints3D={},sockets={},depth={},surfaces={},rig={},endFrames={},fanFrames={},residuals={},deadlines={},chainMetrics={},nativeChains={};
  const c=target.rig.profile,materialAngles=tr.impact?target.materialAngles:Object.fromEntries(Object.keys(target.materialAngles).map(k=>[k,angle(old.materialAngles[k],target.materialAngles[k])]));
  for(const name of names){
   const source=old.joints3D[name],dest=target.joints3D[name];if(!source||!dest)return target;
   const leg=name.endsWith('Leg'),key=name.startsWith('rear')?'rear':'front',support=leg&&feet&&!critical.includes(name),immediate=tr.guard&&name==='frontArm';
   const done=immediate||leg&&liveSupport||!support&&age>=tr.duration,a=source.map(point),root=tr.impact?dest[0].slice():blend(a[0],dest[0],t);
   const forecast=critical.includes(name)&&tr.deadlineFrame?.joints3D[name];
   // A 2–3 frame jab has no room for a slow/fast/slow presentation envelope.
   // Distribute its required travel evenly; longer startup retains easing.
   const travel=forecast&&tr.duration<=3?INK.clamp(age/tr.duration):t;
   // The outgoing hand is world-continuous, but the incoming strike belongs
   // to the actor's moving root. Do not pin its forecast to the old root.
   let end=blend(a[2],forecast?forecast[2].map(v=>v*ratio):dest[2],travel),pole=blend(a[1].map((v,i)=>v-a[0][i]),dest[1].map((v,i)=>v-dest[0][i]),t),progress=t;
   if(support){
    const q=feet.feet[key]?.targetWorld||feet.feet3D?.[key]||feet.feet[key],startFeet=sampleFeet(footPlan,tr.start),initial=startFeet.feet[key]?.targetWorld||startFeet.feet3D?.[key]||startFeet.feet[key],actual=tr.from.frame.worldFeet[key];
    const anchor=[(q[0]-w.x)/scale,(q[1]-665-w.y)/scale,(q[2]||0)/scale],settle=1-ease(age/4);
    for(let i=0;i<3;i++)anchor[i]+=((actual[i]||0)-(initial[i]||0))/scale*settle;
    progress=ease((time-feet.endTime)/10);end=blend(anchor,dest[2],progress);
   }
   deadlines[name]=support?tr.supportDuration:tr.duration;
   const contactExit=old.mode==='contact',spatialContact=contactExit&&old.contactCarrier?.representation==='spatial3D';
   const lengths=source.slice(0,2).map((q,i)=>contactExit?distance(q,source[i+1])*ratio:mix(distance(q,source[i+1])*ratio,distance(dest[i],dest[i+1]),t));
   const nativeFit=contactExit&&!spatialContact?contactChain(old,name,a,root,end,ratio):null;
   const cross=contactExit&&!spatialContact&&!nativeFit?{chain:a.map((p,i)=>blend(p,dest[i],t)),residual:distance(blend(a[2],dest[2],t),end),metric:'crossRepresentation'}:null;
   const solved=done?{chain:dest,residual:0}:age===0&&!tr.impact?{chain:a,residual:0}:nativeFit||cross||INK.VisualFrame.twoBone3D(root,end,lengths[0],lengths[1],pole);
   chainMetrics[name]=done?'destination':solved.metric||(contactExit?'fixedSpatial':'legacyBridge');if(solved.native)nativeChains[name]=solved.native;
   joints3D[name]=solved.chain;sockets[name]=solved.chain.map(q=>q.slice(0,2));rig[name]=sockets[name];depth[name]=solved.chain.map(q=>q[2]);residuals[name]=solved.residual*scale;
   surfaces[name]={...target.rig.anatomy.surfaces[name],depth:depth[name],segmentDepth:[(depth[name][0]+depth[name][1])/2,(depth[name][1]+depth[name][2])/2]};
   if(done){endFrames[name]=target.endFrames[name];if(target.fanFrames?.[name])fanFrames[name]=target.fanFrames[name];continue;}
   const from=matrix(old.endFrames[name]),to=target.endFrames[name],heading=materialAngles[leg?'pelvis':'body']*Math.PI/180;
   const authoredAngle=leg?(key==='rear'?target.legacyPose.rfoot:target.legacyPose.ffoot)||0:angle(Math.atan2(from[1],from[0])*180/Math.PI,Math.atan2(to[1],to[0])*180/Math.PI);
   const options={kind:leg?'foot':'hand',scale:leg?(c.female?.79:.88):(c.female?.7:c.id==='luke'?.88:.82),heading,authoredAngle};
   endFrames[name]=age===0&&!tr.impact?from:INK.VisualFrame.thickEndFrame(solved.chain,options);
   if(target.fanFrames?.[name])fanFrames[name]=INK.VisualFrame.thinFanFrame(solved.chain,options);
  }
  for(const name of ['pelvis','chest','neck','head']){
   const a=old.joints3D[name]||[...old.rig.anatomy.sockets[name],0],b=target.joints3D[name]||[...target.rig.anatomy.sockets[name],0];
   joints3D[name]=tr.impact?b.slice():blend(point(a),b,t);sockets[name]=joints3D[name].slice(0,2);
  }
  const skinMatrices=tr.impact?target.skinMatrices:target.skinMatrices.map((m,i)=>blend(matrix(old.skinMatrices[i]),m,t));
  const headMatrix=tr.impact?target.headMatrix:blend(matrix(old.headMatrix),target.headMatrix,t);
  Object.defineProperties(rig,{profile:{value:c},anatomy:{value:{...target.rig.anatomy,sockets,depth,surfaces}}});
  const worldFeet=Object.fromEntries(['rear','front'].map(k=>{const q=joints3D[k+'Leg'][2];return[k,[w.x+q[0]*scale,665+w.y+q[1]*scale,q[2]*scale]];}));
  return {...target,rig,joints3D,skinMatrices,headMatrix,endFrames,fanFrames,materialAngles,worldFeet,bridge:{age,duration:total,critical,deadlines,footPlan,residuals,chainMetrics,nativeChains,contactExit:old.mode==='contact',representation:old.contactCarrier?.representation||null}};
 }
 INK.FrameBridge={capture,begin,apply,contactChains};
})();
