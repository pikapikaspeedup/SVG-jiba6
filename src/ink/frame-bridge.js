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
 function begin(f,from,{state=f.state,attack=null,duration=5,impact=false,guard=false,deadlineFrame=null}={}){
  if(!from||duration<=0||['throwing','captured','down','ko'].includes(state)){f._inkFrameTransition=null;return;}
  const start=f._inkVisualClock||0,feet=sampleFeet(from.footPlan,start),remaining=Math.max(0,(feet?.endTime||start)-start);
  f._inkFrameTransition=Object.freeze({from,state,attack,duration,impact,guard,deadlineFrame,start,supportDuration:feet?remaining+10:duration});
 }
 function apply(f,target,{world:currentWorld,time=f._inkVisualClock||0}={}){
  const tr=f._inkFrameTransition;if(!tr||f.state!==tr.state||tr.attack&&f.attack?.m.id!==tr.attack)return target;
  const age=time-tr.start,grounded=f.y===0&&!f.airLock&&!f.captured&&!f.attack?.m.throw;
  // A newly committed walking/turning plan supersedes a captured plan. Only
  // actions without that live support owner continue their outgoing footstep.
  const liveSupport=target.mode==='locomotion'&&!!(INK.FacingMotion?.sample(f,time)?.ownsFeet||INK.Locomotion?.sample(f,time));
  const footPlan=grounded&&!liveSupport?tr.from.footPlan:null,feet=sampleFeet(footPlan,time),total=feet?Math.max(tr.duration,tr.supportDuration):tr.duration;
  if(age<0||age>=total)return target;
  const old=tr.from.frame,w=currentWorld||world(f),oldWorld=tr.from.world,scale=w.scale||1,ratio=oldWorld.scale/scale;
  const shift=[(oldWorld.x-w.x)/scale,(oldWorld.y-w.y)/scale,0],t=ease(age/tr.duration),critical=contactChains(f);
  const point=q=>q.map((v,i)=>v*ratio+shift[i]);
  const matrix=m=>[m[0]*ratio,m[1]*ratio,m[2]*ratio,m[3]*ratio,m[4]*ratio+shift[0],m[5]*ratio+shift[1]];
  const angle=(a,b,u=t)=>a+Math.atan2(Math.sin((b-a)*Math.PI/180),Math.cos((b-a)*Math.PI/180))*180/Math.PI*u;
  const joints3D={},sockets={},depth={},surfaces={},rig={},endFrames={},fanFrames={},residuals={},deadlines={};
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
   const lengths=source.slice(0,2).map((q,i)=>mix(distance(q,source[i+1])*ratio,distance(dest[i],dest[i+1]),t));
   const solved=done?{chain:dest,residual:0}:age===0&&!tr.impact?{chain:a,residual:0}:INK.VisualFrame.twoBone3D(root,end,lengths[0],lengths[1],pole);
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
  return {...target,rig,joints3D,skinMatrices,headMatrix,endFrames,fanFrames,materialAngles,worldFeet,bridge:{age,duration:total,critical,deadlines,footPlan,residuals}};
 }
 INK.FrameBridge={capture,begin,apply,contactChains};
})();
