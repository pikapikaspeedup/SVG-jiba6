/* BODY SUPPORT: simulation-owned support contacts, sampled as a bounded visual
 * correction. Combat roots, collision poses and authored attack timing stay authoritative. */
'use strict';
(() => {
 const settings={enabled:true},clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
 const profiles={
  ryu:{stride:62,lock:32,lift:8,load:1,drive:.72,brake:12,settle:10,turn:7},
  cammy:{stride:78,lock:40,lift:15,load:.68,drive:1.15,brake:8,settle:7,turn:12}
 };
 const keys=['rear','front'],part=k=>k==='rear'?'rearLeg':'frontLeg',target=k=>k==='rear'?'ra':'fa';
 const active=f=>!!(settings.enabled&&INK.Kinetic?.settings.enabled&&INK.Runtime?.enabled&&profiles[f?.ch?.id]);
 const supported=f=>f.y===0&&!f.captured&&!f.airLock&&!['down','rise','ko','win','tumble','captured','throwing'].includes(f.state)&&(!f.attack||f.attack.m.category==='normal'&&!f.attack.m.air&&!f.attack.m.throw);
 function root(f,world){return{x:world?.x??f.x,y:665+(world?.y??f.y),scale:world?.scale||f.renderScale||f.ch.scale||1,facing:world?.dir??f.dir};}
 function matrix(p,w){return INK.mat.multiply(INK.mat.compose(w.x,w.y,0,w.scale*w.facing*(p.depth||1),w.scale),INK.mat.multiply(INK.mat.compose(p.rootShift||0,(p.floor||0)-180,p.spin||0),INK.mat.compose(0,180)));}
 function feet(f,p,world){const r=INK.Runtime.visualRig(f,p),w=root(f,world);return Object.fromEntries(keys.map(k=>[k,INK.Rig.world(p,INK.Runtime.socket(p,r,k+'Foot'),w)]));}
 function reset(f){f._inkSupport=null;}
 function basePose(f){const view=Object.create(f);view._inkSupport=null;const p=globalThis.SVG_FIGHTER?.pose(view);return p?INK.Runtime.visual(view,p,{x:f.x,y:f.y,dir:f.dir,scale:f.renderScale||f.ch.scale||1}):null;}
 function step(f,G){
  if(!active(f)){reset(f);return;}
  const time=f._inkVisualClock||0,old=f._inkSupport;if(old?.time===time)return;
  const on=supported(f),profile=profiles[f.ch.id],p=on?basePose(f):null;
  if(!p){f._inkSupport={time,x:f.x,dir:f.dir,velocity:0,drive:0,brake:0,turn:0,distance:0,mode:'free',contacts:null};return;}
  const current=feet(f,p),fresh=!old?.contacts||old.dir!==f.dir||Math.abs(f.x-old.x)>80;
  const delta=fresh?0:f.x-old.x,moving=!f.attack&&f.state==='idle'&&!f.crouch&&Math.abs(delta)>.15;
  const previousVelocity=old?.velocity||0,velocity=moving?delta:0,drive=clamp(velocity/Math.max(1,f.ch.speed),-1.5,1.5);
  const stopping=!moving&&Math.abs(previousVelocity)>.15,reversing=moving&&previousVelocity*velocity<0;
  const brake=stopping||reversing?clamp(previousVelocity/Math.max(1,f.ch.speed),-1.5,1.5):(old?.brake||0)*(1-1/profile.brake);
  const turn=reversing?Math.sign(velocity):(old?.turn||0)*.78,distance=(fresh?0:old.distance||0)+(moving?Math.abs(delta):0),phase=(distance/profile.stride)%1;
  const support=phase<.5?'rear':'front',kick=f.attack&&(f.attack.m.contactPart==='foot'||f.attack.m.pose==='kick');
  const mode=f.attack?'strike':moving?'step':stopping||Math.abs(brake)>.08?'brake':['hit','block','stun','parry'].includes(f.state)?'absorb':'stand';
  const groundY=fresh?Math.max(current.rear[1],current.front[1]):old.groundY,contacts={};
  const reaction=f._inkReaction,age=time-(reaction?.actorBirth||0),retreatFoot=reaction?.contact&&!reaction.parry&&age>=0&&age<reaction.duration*.75?(reaction.worldDir*f.dir<0?'rear':'front'):null;
  for(const k of keys){
   const previous=fresh?null:old.contacts[k],desired=k===retreatFoot?0:kick?(k==='rear'?1:0):moving?(k===support?1:0):1;
   const change=previous?clamp(desired-previous.weight,-.35,.35):0,weight=previous?previous.weight+change:desired;
   let anchor=previous?.anchor?.slice()||current[k].slice(),age=(previous?.age||0)+1;
   // A newly loaded foot takes its actual solved location as contact. An
   // exhausted reach re-plants instead of dragging an indefinitely fixed foot.
   if(!previous||previous.weight<=.01&&desired>0||Math.abs(anchor[0]-current[k][0])>profile.lock*1.8){anchor=[current[k][0],groundY];age=0;}
   if(desired===0&&weight<=.01){anchor=[current[k][0],groundY];age=0;}
   contacts[k]={anchor,weight:clamp(weight),age};
  }
  f._inkSupport={time,x:f.x,dir:f.dir,velocity,drive:mix(old?.drive||0,drive,.4),brake,turn,distance,phase,mode,groundY,contacts,previous:old?.contacts?{time:old.time,contacts:old.contacts}:null};
 }
 function pose(f,source,world=null){
  const q=f._inkSupport;if(!active(f)||!supported(f)||!q?.contacts)return source;
  const profile=profiles[f.ch.id],p=INK.copy(source),m=f.attack?.m,t=f.attack?.t||0;
  const add=(key,value)=>p[key]=(p[key]||0)+value,shift=(key,x,y)=>{if(Array.isArray(p[key]))p[key]=[p[key][0]+x,p[key][1]+y];};
  const localDrive=q.drive*f.dir,localBrake=q.brake*f.dir;
  add('lean',localDrive*4.5*profile.drive-localBrake*4);add('pelvis',-localDrive*2.5+localBrake*3);add('chestYaw',q.turn*f.dir*profile.turn);add('pelvisYaw',-q.turn*f.dir*profile.turn*.55);
  add('bob',Math.abs(q.brake)*3.5*profile.load);shift('rw',-localDrive*4,-Math.abs(q.brake)*3);
  if(m&&m.category==='normal'){
   const startup=Math.max(1,m.startup),u=clamp(t/startup),load=t<startup?Math.sin(Math.PI*u):0,release=t>=startup?Math.exp(-(t-startup)/Math.max(3,m.active+3)):0;
   const heavy=clamp((m.level||1)/3,.33,1),kick=m.contactPart==='foot'||m.pose==='kick';
   add('pelvis',(-4*load+3*release)*profile.load*heavy);add('chestYaw',(-5*load+8*release)*profile.drive*heavy);add('pelvisYaw',(3*load-5*release)*profile.load*heavy);add('bob',3*load*profile.load*heavy);
   shift('rw',-5*load*heavy,-3*release*heavy);if(!kick)add('lean',(-2*load+3*release)*profile.drive*heavy);
  }
  return INK.Articulation.inherit(source,p);
 }
 function constrainFeet(f,source,world=null){
  const q=f._inkSupport;if(!active(f)||!supported(f)||!q?.contacts)return source;
  const profile=profiles[f.ch.id],m=f.attack?.m,p=INK.copy(source);INK.Articulation.inherit(source,p);
  const w=root(f,world),inverse=INK.mat.inverse(matrix(p,w)),character=INK.Runtime.profile(f.ch.id),now=f._inkVisualClock||0;
  // Start from the FINAL bridge-resolved skeleton. Re-solving only its loaded
  // legs then attaching that frame's angles prevents a later authored/joint
  // bridge from pulling a planted ankle away again. Arms keep their solved angles.
  const rig=INK.Runtime.visualRig(f,p),actual=Object.fromEntries(keys.map(k=>[k,INK.Rig.world(p,INK.Runtime.socket(p,rig,k+'Foot'),w)]));
  if(!rig.anatomy)return p;
  const solved=rig.anatomy.source,angles=Object.fromEntries(Object.entries(solved).map(([k,v])=>[k,INK.Articulation.angles(v)]));
  for(const k of keys){
   if(k==='front'&&m&&(m.contactPart==='foot'||m.pose==='kick'))continue;
   const c=q.contacts[k],prev=q.previous?.contacts[k],u=q.previous&&q.time>q.previous.time?clamp((now-q.previous.time)/(q.time-q.previous.time)):1;
   const weight=prev?mix(prev.weight,c.weight,u):c.weight,anchor=prev?[mix(prev.anchor[0],c.anchor[0],u),mix(prev.anchor[1],c.anchor[1],u)]:c.anchor;
   const dx=clamp(anchor[0]-actual[k][0],-profile.lock,profile.lock)*weight,dy=clamp(anchor[1]-actual[k][1],-16,16)*weight;
   const swing=q.mode==='step'?(1-weight)*Math.sin(Math.PI*((q.phase*2)%1))*profile.lift:0;
   if(Math.abs(dx)+Math.abs(dy)+Math.abs(swing)<1e-7)continue;
   const local=INK.mat.point(inverse,[actual[k][0]+dx,actual[k][1]+dy-swing]),name=part(k),chain=solved[name];
   const aim=INK.Anatomy.inverseTarget(p,local,name,character),len=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
   const adjusted=INK.Anatomy.chain(chain[0],aim,len(chain[1],chain[0]),len(chain[2],chain[1]),p[name+'Pole']??(k==='rear'?1:-1),true);
   angles[name]=INK.Articulation.angles(adjusted);
   if(weight>.5)p[k==='rear'?'rfoot':'ffoot']=mix(p[k==='rear'?'rfoot':'ffoot']||0,0,weight*.8);
  }
  return INK.Articulation.attachSnapshot(p,angles);
 }

 function inspect(f){const q=f?._inkSupport;return q?{enabled:active(f),mode:q.mode,phase:q.phase||0,velocity:q.velocity,drive:q.drive,brake:q.brake,turn:q.turn,contacts:q.contacts?Object.fromEntries(keys.map(k=>[k,{anchor:q.contacts[k].anchor.slice(),weight:q.contacts[k].weight}])):null}:null;}
 INK.BodySupport={settings,profiles,active,reset,step,pose,constrainFeet,inspect};
})();
