/* Final-frame strike sections. One observation per simulation/VFX stamp;
 * never resample yesterday's pose using today's contact or facing state. */
'use strict';
(()=>{
 const {mat}=INK,valid=p=>Array.isArray(p)&&p.slice(0,2).every(Number.isFinite),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const links={frontHand:['frontArm',2],rearHand:['rearArm',2],frontFoot:['frontLeg',2],rearFoot:['rearLeg',2],frontElbow:['frontArm',1],rearElbow:['rearArm',1],frontKnee:['frontLeg',1],rearKnee:['rearLeg',1]};
 function stage(f,snapshot){
  if(!f.attack||!snapshot?.frame?.frame)return;
  f._inkTraceStaged={attack:f.attack,age:f.attack.t,record:INK.Runtime.record(f,f.attack.m),pose:snapshot.pose,frame:snapshot.frame.frame,x:f.x,y:f.y,dir:f.dir,scale:f.renderScale||f.ch.scale||1,time:INK.VFX.time};
 }
 function sample(f,record,time,options={}){
  const a=f.attack;if(!a||!record)return new Map();
  const pose=options.pose||SVG_FIGHTER.visualPose(f),frame=options.frame||INK.VisualFrame.get(pose),rig=frame?.rig||INK.Runtime.visualRig(f,pose),root=options.world||{x:f.x,y:f.y,scale:f.renderScale||f.ch.scale||1},scale=root.scale||1,epoch=options.epoch||0;
  if(!frame)return new Map();
  const world=q=>[root.x+q[0]*scale,665+root.y+q[1]*scale],phase=a.t<a.m.startup?'startup':a.t<a.m.startup+a.m.active?'active':'recovery',clipTime=INK.Runtime.clipFrame(record,a.m,a.t),out=new Map();
  const names=new Set([...(options.names||record.fx.map(e=>e.socket)),'frontHand','frontFoot','rearHand','rearFoot']);if(f.ch.id==='mai')names.add('fanTip');
  for(const name of names){
   let tip,joint,edgeA,edgeB,rim=null,geometryQuality='rigProxy';
   if((name==='fanTip'||name==='fanGrip')&&frame.fanFrames?.frontArm&&pose.fan!==0){
    const shape=INK.FanGeometry.sample(pose.fan??.9),F=mat.multiply(frame.fanFrames.frontArm,INK.FanGeometry.transform(pose));
    const fan=q=>world(mat.point(F,q));tip=fan(name==='fanGrip'?shape.grip:shape.tip);joint=fan(shape.grip);rim=Object.freeze(shape.rim.map(q=>Object.freeze(fan(q))));edgeA=rim[0];edgeB=rim.at(-1);geometryQuality='renderSurface';
   }else if(links[name]){
    const [limb,index]=links[name],chain=frame.rig[limb];tip=world(chain[index]);joint=world(chain[Math.max(0,index-1)]);
    const E=frame.endFrames[limb],foot=limb.endsWith('Leg');
    if(index===2&&E){edgeA=world(mat.point(E,[foot?10:6,foot?-8:-10]));edgeB=world(mat.point(E,[foot?10:6,foot?8:10]));}
   }else{tip=world(INK.Runtime.socket(pose,rig,name));joint=tip.slice();}
   if(!valid(tip)||!valid(joint))continue;
   if(!edgeA){const dx=tip[0]-joint[0],dy=tip[1]-joint[1],n=Math.hypot(dx,dy)||1,w=4*scale;edgeA=[tip[0]-dy/n*w,tip[1]+dx/n*w];edgeB=[tip[0]+dy/n*w,tip[1]-dx/n*w];}
   const row=Object.freeze({point:Object.freeze(tip),tip,joint:Object.freeze(joint),edgeA:Object.freeze(edgeA),edgeB:Object.freeze(edgeB),rootWorld:Object.freeze([root.x,665+root.y]),rim,geometryQuality,time,actorTime:f._inkVisualClock??time,hitIndex:Math.max(0,Math.min((a.m.hits||1)-1,Math.floor((a.t-a.m.startup)/(a.m.active/(a.m.hits||1))))),channel:name,actionAge:a.t,clipTime,phase,attackID:a.combatID||null,epoch,socket:name});
   out.set(name,row);
  }
  return out;
 }
 function capture(f,record,time,history,observation=null){
  const a=f.attack;if(!a||!history||history.attack!==a)return new Map();
  if(history.traceTime===time)return history.traceCurrent||new Map();
  const old=history.traceRoot;if(old&&(Math.hypot(f.x-old.x,f.y-old.y)>80||a.t<old.age))history.traceEpoch=(history.traceEpoch||0)+1;
  const out=sample(f,record,time,{pose:observation?.pose,frame:observation?.frame,epoch:history.traceEpoch||0,names:history.socketNames});
  for(const [name,row] of out){let list=history.socketHistory.get(name);if(!list){list=[];history.socketHistory.set(name,list);}list.push({t:row.clipTime,x:row.tip[0],y:row.tip[1],...row});if(list.length>96)list.shift();}
  history.traceCurrent=out;history.traceTime=time;history.traceRoot={x:f.x,y:f.y,age:a.t,dir:f.dir};history.socketUntil=INK.Runtime.clipFrame(record,a.m,a.t);history.traceOwned=true;return out;
 }
 function contactMotion(f,d,m,witness,snapshot){
  const part=witness?.hitPart,kick=part==='rear-kick'||part==='foot'||part==='shin'||(!part&&(m.contactPart==='foot'||m.pose==='kick')),socket=part==='fan'?'fanTip':part==='elbow'?'frontElbow':part==='rear-kick'?'rearFoot':kick?'frontFoot':'frontHand',fallback={incoming:[f.dir,0],evidence:'facing',surface:'none',continuous:false,channel:socket};
  if(['energy','body-dive','flame-pillar'].includes(part))return fallback;
  const record=INK.Runtime.record(f,m),h=f._inkTrail,a=f.attack;if(!record||!a)return fallback;
  const now=sample(f,record,INK.VFX.time,{pose:snapshot?.pose,frame:snapshot?.frame?.frame,epoch:h?.traceEpoch||0,names:[socket]}).get(socket);if(!now)return fallback;
  const dx=now.tip[0]-now.joint[0],dy=now.tip[1]-now.joint[1],length=Math.hypot(dx,dy),axis=length>1e-6?[dx/length,dy/length]:fallback.incoming;
  const base={...fallback,incoming:axis,evidence:'chainAxis',surface:now.geometryQuality,epoch:now.epoch};
  const prior=h?.attack===a?h.socketHistory.get(socket)?.findLast(r=>r.time<now.time&&r.actionAge<now.actionAge&&r.epoch===now.epoch):null;
  const dt=prior?now.actorTime-prior.actorTime:0;if(!prior||!(dt>0&&dt<=2)||!valid(witness?.point)||Math.hypot(...now.rootWorld.map((v,i)=>v-prior.rootWorld[i]))>80)return base;
  const u=clamp(((witness.point[0]-now.joint[0])*dx+(witness.point[1]-now.joint[1])*dy)/(length*length||1),0,1),at=(r,k)=>r.joint[k]+(r.tip[k]-r.joint[k])*u;
  if(![d.x,d.px,d.y,d.py].every(Number.isFinite)||Math.hypot(d.x-d.px,d.y-d.py)>32)return base;
  const relativeVelocity=[(at(now,0)-at(prior,0))/dt-(d.x-d.px),(at(now,1)-at(prior,1))/dt-(d.y-d.py)],speed=Math.hypot(...relativeVelocity);
  return speed>1e-6?{...base,incoming:relativeVelocity.map(x=>x/speed),relativeVelocity,evidence:'sectionVelocity',continuous:true}:base;
 }
 INK.StrikeTrace=Object.freeze({sample,capture,stage,contactMotion});
})();
