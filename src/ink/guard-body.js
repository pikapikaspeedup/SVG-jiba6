/* Defensive body language: pure pose sampling, never combat authority. */
'use strict';
(() => {
 const settings={enabled:true},clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
 const profiles=Object.freeze({
  ryu:{path:'compact',front:'fist',rear:'fist'},ken:{path:'intercept',front:'guard',rear:'fist'},
  chun:{path:'palm',front:'guard',rear:'guard'},cammy:{path:'forearm',front:'fist',rear:'fist'},
  luke:{path:'boxing',front:'fist',rear:'fist'},juri:{path:'side',front:'guard',rear:'guard'},
  mai:{path:'fan',front:'grip',rear:'guard'},iori:{path:'claw',front:'claw',rear:'claw'}
 });
 const active=()=>settings.enabled&&INK.Kinetic?.settings.enabled;
 const add=(p,k,v)=>p[k]=(p[k]||0)+v;
 const shift=(p,k,x,y,w)=>{if(Array.isArray(p[k]))p[k]=[p[k][0]+x*w,p[k][1]+y*w];};
 function hands(p,profile,brace=false){p.handFront=profile.front;p.handRear=profile.rear;p.expression=brace?'brace':'guard';}
 function frame(f,p,low,w,profile){
  // Local deltas retain the authored standing/crouching root and limb lengths.
  // Lower defense moves the lead forearm; the rear hand continues guarding the head.
  shift(p,'fw',low?8:0,low?35:-8,w);shift(p,'fe',low?3:-5,low?18:-5,w);shift(p,'rw',-2,-7,w);shift(p,'re',-3,1,w);
  add(p,'chest',-2*w);add(p,'pelvis',low?-3*w:0);add(p,'bob',low?3*w:0);
  switch(profile.path){
   case 'compact':shift(p,'fw',-5,0,w);shift(p,'rw',3,-3,w);add(p,'chestYaw',-2*w);break;
   case 'intercept':shift(p,'fw',10,-2,w);shift(p,'fe',8,0,w);shift(p,'rw',-5,-3,w);add(p,'chestYaw',4*w);break;
   case 'palm':shift(p,'fw',5,-4,w);shift(p,'fe',-8,3,w);shift(p,'rw',-7,2,w);add(p,'pelvisYaw',3*w);break;
   case 'forearm':shift(p,'fw',-7,-5,w);shift(p,'fe',10,-6,w);shift(p,'rw',2,-6,w);add(p,'chestYaw',-4*w);break;
   case 'boxing':shift(p,'fw',-4,-9,w);shift(p,'rw',5,-10,w);shift(p,'re',8,-3,w);add(p,'head',-3*w);add(p,'chest',-2*w);break;
   case 'side':shift(p,'fw',12,3,w);shift(p,'rw',-9,-3,w);add(p,'pelvisYaw',7*w);add(p,'chestYaw',-7*w);break;
   case 'fan':shift(p,'fw',3,-3,w);shift(p,'rw',-11,-5,w);add(p,'turn',.025*w);add(p,'fanAngle',-6*w);break;
   case 'claw':shift(p,'fw',9,7,w);shift(p,'fe',-4,8,w);shift(p,'rw',-7,1,w);add(p,'lean',3*w);add(p,'chestYaw',-5*w);break;
  }
 }
 function response(f,p,r,now,motion=1){
  if(!active()||!(r?.guard||r?.parry||r?.armor))return false;
  if(r.armor&&['hit','tumble','captured','throwing','down','ko','stun'].includes(f.state))return true;
  if(!r.armor&&!['block','parry','idle'].includes(f.state))return true;
  const age=now-r.actorBirth,duration=Math.max(1,r.duration||13);if(age<0||age>=duration)return true;
  const profile=profiles[f.ch.id]||profiles.ryu,life=1-clamp(age/duration),gain=clamp(r.energy||.5,0,1.6)*(INK.Kinetic.settings.impact??1)*motion;
  const force=Math.exp(-age*.2)*life*life*gain,lag=(1-Math.exp(-age*.5))*Math.exp(-age*.13)*life*gain,sign=(r.worldDir||f.dir)*f.dir;
  if(r.armor)p.expression='brace';else hands(p,profile);
  if(r.armor){
   // Keep the attacking wrists, elbows, ankles and knees exactly authored.
   // Compression stays local; no retreat step or recoil interruption is implied.
   add(p,'chest',-4*force);add(p,'chestYaw',sign*3*force);add(p,'head',-sign*2*lag);add(p,'pelvis',-1.5*lag);return true;
  }
  const low=r.height==='low';frame(f,p,low,['block','parry'].includes(f.state)?1:life,profile);
  const point=r.contact?.point||r.point;if(Array.isArray(point)&&Number.isFinite(point[1])&&Array.isArray(p.fw)){const scale=f.renderScale||f.ch.scale||1,localY=(point[1]-(665+f.y))/scale;shift(p,'fe',0,clamp((localY-p.fw[1])*force,-8,8),1);}
  if(r.parry){
   shift(p,'fw',-sign*9*force,low?-4*force:-6*force,1);shift(p,'fe',-sign*5*force,2*force,1);add(p,'chestYaw',-sign*5*lag);add(p,'headYaw',sign*2*lag);return true;
  }
  shift(p,'fw',sign*7*force,low?3*force:1*force,1);shift(p,'fe',sign*4*force,0,1);
  // Lead arm receives impact first, torso and hip follow while the rear guard remains.
  add(p,'lean',sign*3.5*lag);add(p,'chest',-4*lag);add(p,'chestYaw',sign*5*lag);add(p,'pelvisYaw',-sign*2*lag);add(p,'bob',low?2*lag:lag);
  return true;
 }
 function pose(f,source){
  if(!active()||!['block','parry'].includes(f.state))return source;
  const r=f._inkReaction,now=f._inkVisualClock||0;if(r&&(r.guard||r.parry)&&now>=r.actorBirth&&now<r.actorBirth+r.duration)return source;
  const p=INK.copy(source),profile=profiles[f.ch.id]||profiles.ryu;frame(f,p,!!f.crouch,1,profile);hands(p,profile);return INK.Articulation.inherit(source,p);
 }
 INK.GuardBody={settings,profiles,active,response,pose};
})();
