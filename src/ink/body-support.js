/* BODY SUPPORT: simulation-owned support contacts, sampled as a bounded visual
 * correction. Combat roots, collision poses and authored attack timing stay authoritative. */
'use strict';
(() => {
 const settings={enabled:true},clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
 const profiles={
  ryu:{style:'rooted',stride:62,lock:32,lift:8,load:1,drive:.72,brake:12,settle:10,turn:7},
  ken:{style:'pursuit',stride:72,lock:36,lift:11,load:.9,drive:1.1,brake:9,settle:8,turn:10},
  chun:{style:'alternating',stride:58,lock:32,lift:12,load:.76,drive:.82,brake:9,settle:7,turn:11},
  cammy:{style:'spiral',stride:78,lock:40,lift:15,load:.68,drive:1.15,brake:8,settle:7,turn:12},
  luke:{style:'boxing',stride:54,lock:30,lift:7,load:1.08,drive:.9,brake:10,settle:8,turn:8},
  juri:{style:'single-leg',stride:76,lock:36,lift:17,load:.7,drive:1,brake:8,settle:7,turn:14},
  mai:{style:'fan-dance',stride:68,lock:35,lift:11,load:.66,drive:.9,brake:10,settle:9,turn:15},
  iori:{style:'low-claw',stride:70,lock:38,lift:6,load:1.18,drive:.94,brake:13,settle:11,turn:9}
 };
 const keys=['rear','front'],part=k=>k==='rear'?'rearLeg':'frontLeg',target=k=>k==='rear'?'ra':'fa';
 const active=f=>!!(settings.enabled&&INK.Kinetic?.settings.enabled&&INK.Runtime?.enabled&&profiles[f?.ch?.id]);
 const supported=f=>f.y===0&&!f.captured&&!f.airLock&&!['down','rise','ko','win','tumble','captured','throwing'].includes(f.state)&&(!f.attack||f.attack.m.category==='normal'&&!f.attack.m.air&&!f.attack.m.throw);
 function root(f,world){return{x:world?.x??f.x,y:665+(world?.y??f.y),scale:world?.scale||f.renderScale||f.ch.scale||1,facing:world?.dir??f.dir};}
 function matrix(p,w){return INK.mat.multiply(INK.mat.compose(w.x,w.y,0,w.scale*w.facing*(p.depth||1),w.scale),INK.mat.multiply(INK.mat.compose(p.rootShift||0,(p.floor||0)-180,p.spin||0),INK.mat.compose(0,180)));}
 function feet(f,p,world){const r=INK.Runtime.visualRig(f,p),w=root(f,world);return Object.fromEntries(keys.map(k=>[k,INK.Rig.world(p,INK.Runtime.socket(p,r,k+'Foot'),w)]));}
 // Intersect the projected fixed-length reach disk with the ground line.
 // The seven-unit reserve leaves bend room; no inverse is needed at profile.
 function groundReach(f,p,world,groundY){
  const moving3D=!f.attack&&!f.crouch&&!f.jumpPre&&f.y===0&&['idle','dash','rush'].includes(f.state);
  if(moving3D){
   const c=INK.Runtime.profile(f.ch.id),raw=INK.Anatomy.sourceRig(c,p),w=root(f,world),heading=INK.FacingMotion?.sample(f,f._inkVisualClock||0,world)?.pelvis??(f.dir<0?Math.PI:0),cs=Math.cos(heading),sn=Math.sin(heading),out={};
   for(const k of keys){const chain=raw[part(k)],z=k==='rear'?-5:5,hip=[cs*chain[0][0]+sn*z,chain[0][1],-sn*chain[0][0]+cs*z],endZ=(-sn*chain[2][0]+cs*z)*w.scale,targetZ=f._inkLocomotion?.feet[k]?.z??endZ;
    const radius=Math.max(1,Math.hypot(chain[1][0]-chain[0][0],chain[1][1]-chain[0][1])+Math.hypot(chain[2][0]-chain[1][0],chain[2][1]-chain[1][1])-3),dy=(groundY-w.y)/w.scale-hip[1],dz=targetZ/w.scale-hip[2],available=radius*radius-dy*dy-dz*dz;
    if(available<0){out[k]=null;continue;}const extent=Math.sqrt(available)*w.scale,center=w.x+hip[0]*w.scale;out[k]=[center-extent,center+extent];
   }return out;
  }
  const rig=INK.Runtime.visualRig(f,p);if(!rig.anatomy)return null;
  const rootM=matrix(p,root(f,world)),out={};
  for(const k of keys){const name=part(k),chain=rig.anatomy.source[name],m=INK.mat.multiply(rootM,rig.anatomy.projectors[name]),r=INK.mat.point(m,chain[0]);
   const radius=Math.max(1,Math.hypot(chain[1][0]-chain[0][0],chain[1][1]-chain[0][1])+Math.hypot(chain[2][0]-chain[1][0],chain[2][1]-chain[1][1])-7),yn=Math.hypot(m[1],m[3]),d=groundY-r[1];
   if(yn<1e-8||Math.abs(d/yn)>radius){out[k]=null;continue;}
   const x=d*m[1]/(yn*yn),y=d*m[3]/(yn*yn),center=r[0]+m[0]*x+m[2]*y,spread=Math.abs((-m[0]*m[3]+m[2]*m[1])/yn)*Math.sqrt(Math.max(0,radius*radius-(d/yn)**2));
   out[k]=[center-spread,center+spread];
  }return out;
 }
 function reset(f){f._inkSupport=null;INK.Locomotion?.reset(f);}
 function basePose(f){const view=Object.create(f);view._inkRawVisual=true;view._inkSupport=null;view._inkLocomotion=null;const p=globalThis.SVG_FIGHTER?.pose(view);return p?INK.Runtime.visual(view,p,{x:f.x,y:f.y,dir:f.dir,scale:f.renderScale||f.ch.scale||1}):null;}
 function step(f,G){
  if(!active(f)){reset(f);return;}
  const time=f._inkVisualClock||0,old=f._inkSupport;if(old?.time===time)return;
  const on=supported(f),profile=profiles[f.ch.id],p=on?basePose(f):null;
  if(!p){INK.Locomotion?.reset(f);f._inkSupport={time,x:f.x,dir:f.dir,velocity:0,drive:0,brake:0,turn:0,distance:0,mode:'free',contacts:null};return;}
  const current=feet(f,p),fresh=!old?.contacts||old.dir!==f.dir||Math.abs(f.x-old.x)>80;
  const defending=!!f._inkDefense&&f._inkDefense.age<f._inkDefense.duration&&['block','recovery'].includes(f.state);
  const delta=fresh?0:f.x-old.x,moving=!f.attack&&['idle','dash','rush'].includes(f.state)&&!f.crouch&&Math.abs(delta)>.15;
  const previousVelocity=old?.velocity||0,velocity=moving||defending?delta:0,drive=clamp(velocity/Math.max(1,f.ch.speed),-1.5,1.5);
  const stopping=!moving&&!defending&&Math.abs(previousVelocity)>.15,reversing=moving&&previousVelocity*velocity<0;
  const brake=stopping||reversing?clamp(previousVelocity/Math.max(1,f.ch.speed),-1.5,1.5):(old?.brake||0)*(1-1/profile.brake);
  const turn=reversing?Math.sign(velocity):(old?.turn||0)*.78,distance=(fresh?0:old.distance||0)+(moving||defending?Math.abs(delta):0),phase=(distance/profile.stride)%1;
  const support=defending?(f._inkDefense.age<f._inkDefense.duration*.5?'front':'rear'):phase<(profile.style==='alternating'?.38:profile.style==='boxing'?.62:.5)?'rear':'front',kick=f.attack&&(f.attack.m.contactPart==='foot'||f.attack.m.pose==='kick');
  const mode=f.attack?'strike':defending?'defend':moving?'step':stopping||Math.abs(brake)>.08?'brake':['hit','block','stun','parry'].includes(f.state)?'absorb':'stand';
  const groundY=fresh?Math.max(current.rear[1],current.front[1]):old.groundY,contacts={};
  const gaitEligible=!f.attack&&!f.crouch&&!f.jumpPre&&['idle','dash','rush'].includes(f.state);
  const scale=f.renderScale||f.ch.scale||1,planning=INK.copy(p),load=INK.Locomotion?.bodyLoad(f,{dx:delta,scale,profile});
  INK.Articulation.inherit(p,planning);planning.bob=(planning.bob||0)+(load?.drop||0)*profile.load;
  const reach=gaitEligible&&(Math.abs(delta)>.08*scale||f._inkLocomotion)?groundReach(f,planning,null,groundY):null;
  let startFeet=null;
  if(gaitEligible&&(!f._inkLocomotion||f._inkLocomotion.releaseStart!==null)&&Math.abs(delta)>.08*scale){
   const previous=f._inkPrevView;
   if(previous&&previous.dir===f.dir){const wp={x:previous.x,y:previous.y,dir:previous.dir,scale},base=globalThis.SVG_FIGHTER?.pose(previous);if(base)startFeet=feet(previous,INK.Runtime.visual(previous,base,wp),wp);}
  }
  INK.Locomotion?.step(f,G,{startFeet,groundY,baseFeet:Object.fromEntries(keys.map(k=>[k,[current[k][0],groundY]])),scale,actualdx:delta,grounded:f.y===0,eligible:gaitEligible,dir:f.dir,actionclock:time,profile,reach});
  const reaction=f._inkReaction,age=time-(reaction?.actorBirth||0),retreatFoot=!defending&&reaction?.contact&&!reaction.parry&&age>=0&&age<reaction.duration*.75?(reaction.worldDir*f.dir<0?'rear':'front'):null;
  for(const k of keys){
   const previous=fresh?null:old.contacts[k];let desired=kick?(k==='rear'?1:0):moving||defending?(k===support?1:0):1;
   // Support patterns are actor-specific: a boxing/pursuit punch transfers to
   // its lead foot, Juri preserves her authored lifted guard leg, Mai pivots.
   if(!moving&&!defending&&!kick&&!f.crouch){
    const punching=f.attack&&f.attack.m.category==='normal',released=punching&&f.attack.t>=f.attack.m.startup;
    if((profile.style==='pursuit'||profile.style==='boxing')&&punching)desired=k===(released?'front':'rear')?1:(profile.style==='boxing'?.35:.55);
    if(profile.style==='single-leg'&&!punching&&f.state==='idle')desired=k==='rear'?1:0;
    if(profile.style==='fan-dance'&&(f.state==='idle'||punching))desired=k==='rear'?1:.65;
    if(profile.style==='low-claw'&&f.state==='idle')desired=k==='rear'?1:.8;
   }
   if(k===retreatFoot)desired=0;
   const change=previous?clamp(desired-previous.weight,-.35,.35):0,weight=previous?previous.weight+change:desired;
   let anchor=previous?.anchor?.slice()||current[k].slice(),age=(previous?.age||0)+1;
   // A newly loaded foot takes its actual solved location as contact. An
   // exhausted reach re-plants instead of dragging an indefinitely fixed foot.
   if(!previous||previous.weight<=.01&&desired>0||Math.abs(anchor[0]-current[k][0])>profile.lock*1.8){anchor=[current[k][0],groundY];age=0;}
   if(desired===0&&weight<=.01){anchor=[current[k][0],groundY];age=0;}
   contacts[k]={anchor,weight:clamp(weight),age};
  }
  f._inkSupport={time,x:f.x,dir:f.dir,velocity,drive:mix(old?.drive||0,drive,.4),brake,turn,distance,phase,mode,defenseProgress:defending?clamp(f._inkDefense.age/Math.max(1,f._inkDefense.duration)):0,groundY,contacts,previous:old?.contacts?{time:old.time,contacts:old.contacts}:null};
  // A stopped gait transfers to ONE measured ordinary pose, never to a
  // reanchoring target that changes underneath the bounded unload.
  const release=f._inkLocomotion?.releaseStart;
  if(gaitEligible&&!moving&&!fresh){
   if(old?.handoff)f._inkSupport.handoff=old.handoff;
   else if(release!==null&&release!==undefined){
    const ordinary=Object.create(f);ordinary._inkLocomotion=null;
    const base=globalThis.SVG_FIGHTER?.pose(ordinary);
    if(base){const destination=feet(ordinary,INK.Runtime.visual(ordinary,base,{x:f.x,y:f.y,dir:f.dir,scale}));
     const gait=INK.Locomotion.sample(f,time),distance=Math.max(...keys.map(k=>Math.hypot(destination[k][0]-gait.feet[k][0],destination[k][1]-gait.feet[k][1]))),duration=clamp(Math.ceil(1.5*distance/(12*scale)),5,24);
     f._inkSupport.handoff=Object.freeze({born:time,duration,feet:Object.freeze(Object.fromEntries(keys.map(k=>[k,Object.freeze(destination[k].slice())])))});
     f._inkLocomotion=Object.freeze({...f._inkLocomotion,releaseDuration:duration});
    }
   }
   if(f._inkSupport.handoff)for(const k of keys)contacts[k].anchor=f._inkSupport.handoff.feet[k].slice();
  }

 }
 function pose(f,source,world=null){
  const q=f._inkSupport;if(!active(f)||!supported(f)||!q?.contacts)return source;
  const profile=profiles[f.ch.id],p=INK.copy(source),m=f.attack?.m,t=f.attack?.t||0;
  const add=(key,value)=>p[key]=(p[key]||0)+value,shift=(key,x,y)=>{if(Array.isArray(p[key]))p[key]=[p[key][0]+x,p[key][1]+y];};
  const visualHeading=INK.VisualFrame&&!f._inkRawVisual?INK.FacingMotion?.sample(f,f._inkVisualClock||0,world)?.heading:null;
  const direction=visualHeading==null?f.dir:Math.cos(visualHeading),localDrive=q.drive*direction,localBrake=q.brake*direction;
  const gait=!m&&!f.crouch&&!f.jumpPre&&['idle','dash','rush'].includes(f.state)?INK.Locomotion?.sample(f,f._inkVisualClock||0,world):null;
  if(gait){add('lean',gait.body.lean*direction);add('bob',gait.body.bob*profile.load);add('pelvisYaw',gait.body.pelvisYaw);add('pelvis',gait.brake*3);shift('rw',-localDrive*4,-gait.brake*3);}
  else{add('lean',localDrive*4.5*profile.drive-localBrake*4);add('pelvis',-localDrive*2.5+localBrake*3);add('bob',Math.abs(q.brake)*3.5*profile.load);shift('rw',-localDrive*4,-Math.abs(q.brake)*3);}
  if(!gait){add('chestYaw',q.turn*f.dir*profile.turn);add('pelvisYaw',-q.turn*f.dir*profile.turn*.55);}
  // Attack loading belongs exclusively to StrikeMotion. Support owns locomotion.
  const traveling=!gait&&(q.mode==='step'||q.mode==='defend'),guarding=['block','parry'].includes(f.state),quiet=!m&&!['hit','stun'].includes(f.state);
  if(q.mode==='defend'){const u=q.defenseProgress||0;add('bob',Math.sin(Math.PI*u)*3*profile.load);add('lean',-2*profile.load);shift('rw',4,-5);}
  switch(profile.style){
   case 'pursuit':if(!gait)add('lean',Math.max(0,localDrive)*2);if(guarding){add('lean',2);shift('rw',3,-5);}break;
   case 'alternating':add('pelvisYaw',traveling?(q.contacts.front.weight-q.contacts.rear.weight)*4:0);if(quiet){add('chest',-2);add('open',.08);}break;
   case 'spiral':if(!gait){add('chestYaw',q.turn*f.dir*3);add('pelvisYaw',-q.turn*f.dir*4);}if(traveling)add('head',-Math.abs(localDrive)*2);break;
   case 'boxing':if(quiet||guarding){shift('rw',12,-13);add('head',-3);add('chest',-2);}if(!gait)add('headYaw',-q.turn*f.dir*7);if(traveling)add('bob',2*(1-Math.abs(q.contacts.front.weight-q.contacts.rear.weight)));break;
   case 'single-leg':if(quiet&&!f.crouch){add('pelvisYaw',5);add('chestYaw',-4);shift('rw',-5,3);}break;
   case 'fan-dance':if(!gait)add('chestYaw',q.turn*f.dir*3);if(quiet){add('turn',.025);add('fanAngle',q.turn*f.dir*9);shift('rw',-3,-3);}break;
   case 'low-claw':if(quiet&&!f.crouch){add('bob',5);add('lean',3);add('pelvis',-2);shift('rw',-4,7);}break;
  }
  return INK.Articulation.inherit(source,p);
 }
 function constrainFeet(f,source,world=null){
  const q=f._inkSupport;if(!active(f)||!supported(f)||!q?.contacts)return source;
  const profile=profiles[f.ch.id],m=f.attack?.m,now=f._inkVisualClock||0;
  const gait=!m&&!f.crouch&&!f.jumpPre&&['idle','dash','rush'].includes(f.state)?INK.Locomotion?.sample(f,now,world):null;
  // Handoff feet are committed by step; the same targets survive the last
  // unload frame so idle support cannot snap back to a stale anchor.
  const p=INK.copy(source);INK.Articulation.inherit(source,p);
  const w=root(f,world),inverse=INK.mat.inverse(matrix(p,w)),character=INK.Runtime.profile(f.ch.id);
  // Start from the FINAL bridge-resolved skeleton. Re-solving only its loaded
  // legs then attaching that frame's angles prevents a later authored/joint
  // bridge from pulling a planted ankle away again. Arms keep their solved angles.
  const rig=INK.Runtime.visualRig(f,p),actual=Object.fromEntries(keys.map(k=>[k,INK.Rig.world(p,INK.Runtime.socket(p,rig,k+'Foot'),w)]));
  if(!rig.anatomy)return p;
  const solved=rig.anatomy.source,angles=Object.fromEntries(Object.entries(solved).map(([k,v])=>[k,INK.Articulation.angles(v)]));
  for(const k of keys){
   if(k==='front'&&m&&(m.contactPart==='foot'||m.pose==='kick'))continue;
   const handoff=!m&&!f.crouch&&!f.jumpPre&&f.state==='idle'?q.handoff:null;
   if((gait||handoff)&&INK.FootConstraint){
    const name=part(k),desired=gait?.feet[k]||handoff.feet[k],fallback=handoff?.feet[k]||actual[k],blend=gait?.blend??0,target=fallback.map((v,i)=>mix(v,desired[i],blend));
    const local=INK.mat.point(inverse,target),fit=INK.FootConstraint.solve(solved[name],rig.anatomy.projectors[name],local);
    angles[name]=INK.Articulation.angles(fit.chain);
    const footKey=k==='rear'?'rfoot':'ffoot';p[footKey]=mix(p[footKey]||0,-Math.sign(q.velocity||0)*f.dir*(1-(gait?.weights[k]??1))*12,gait?.blend??0);
    continue;
   }
   const c=q.contacts[k],prev=q.previous?.contacts[k],u=q.previous&&q.time>q.previous.time?clamp((now-q.previous.time)/(q.time-q.previous.time)):1;
   const weight=prev?mix(prev.weight,c.weight,u):c.weight,anchor=prev?[mix(prev.anchor[0],c.anchor[0],u),mix(prev.anchor[1],c.anchor[1],u)]:c.anchor;
   const dx=clamp(anchor[0]-actual[k][0],-profile.lock,profile.lock)*weight,dy=clamp(anchor[1]-actual[k][1],-16,16)*weight;
   const swing=q.mode==='step'||q.mode==='defend'?(1-weight)*Math.sin(Math.PI*((q.phase*2)%1))*profile.lift:0;
   if(Math.abs(dx)+Math.abs(dy)+Math.abs(swing)<1e-7)continue;
   const local=INK.mat.point(inverse,[actual[k][0]+dx,actual[k][1]+dy-swing]),name=part(k),chain=solved[name];
   const aim=INK.Anatomy.inverseTarget(p,local,name,character),len=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
   const adjusted=INK.Anatomy.chain(chain[0],aim,len(chain[1],chain[0]),len(chain[2],chain[1]),p[name+'Pole']??(k==='rear'?1:-1),true);
   angles[name]=INK.Articulation.angles(adjusted);
   if(weight>.5)p[k==='rear'?'rfoot':'ffoot']=mix(p[k==='rear'?'rfoot':'ffoot']||0,0,weight*.8);
  }
  return INK.Articulation.attachSnapshot(p,angles);
 }

 function inspect(f){const q=f?._inkSupport;return q?{enabled:active(f),style:profiles[f.ch.id]?.style||'neutral',mode:q.mode,phase:q.phase||0,velocity:q.velocity,drive:q.drive,brake:q.brake,turn:q.turn,contacts:q.contacts?Object.fromEntries(keys.map(k=>[k,{anchor:q.contacts[k].anchor.slice(),weight:q.contacts[k].weight}])):null}:null;}
 INK.BodySupport={settings,profiles,active,reset,step,pose,constrainFeet,inspect,groundReach};
})();
