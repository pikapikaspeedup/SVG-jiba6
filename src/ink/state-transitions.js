/* FLOW 08 — state/locomotion transactions and velocity-driven landing response.
 * Captures come from the evaluator, NEVER from the last rendered f.pose.
 * Presentation-only: no hitbox, physical root, stun, landing lock or meter write.
 */
'use strict';
(() => {
 const {Rig,Motion,clamp,copy}=INK;
 const duration={idle:5,recovery:5,rise:7,down:6,tumble:4,ko:6,win:8,land:4,jump:3,crouch:4,'walk-forward':4,'walk-back':4,dash:3,rush:3,parry:3,stance:4,hit:3,block:2,stun:4};
 const immediateBody=new Set(['lean','bob','head','chest','pelvis','yaw','turn','spin','floor','headYaw','chestYaw','pelvisYaw']);
 const excluded=f=>f.state==='throwing'||f.state==='captured'||f.captureKind==='throw';
 const world=f=>({x:f.x,y:f.y,dir:f.dir,scale:f.renderScale||f.ch.scale||1});
 function capture(f){
  if(!INK.Runtime.enabled||!INK.Runtime.store||excluded(f)||!globalThis.SVG_FIGHTER)return null;
  const A=SVG_FIGHTER,R=INK.Runtime,ctx=INK.State.contextForFX(f),p=R.visual(f,A.pose(f),world(f));
  const dt=.25,previous=INK.Presentation.previous(f,dt);
  const q=R.visual(previous,A.pose(previous),world(previous));
  return{pose:p,previous:q,frame:INK.FrameBridge?.capture(f,p),secondary:R.presentation(f,ctx?.record,ctx?.frame||0,f.attack?.t||0),state:f.state,key:INK.Presentation.key(f),dir:f.dir,dt};
 }
 function cleanView(f){const v=Object.create(f);v._inkNoHitEpisode=true;v._inkHitEpisode=null;v._inkStateVisualBlend=null;v._inkStateBlend=null;v._inkVisualTransition=null;v._inkJointTransition=null;v._inkTransition=null;v._inkFrameTransition=null;return v;}
 function bind(f,from,{next=f.state,kind=next,age=0,override=null}={}){
  if(!from||!INK.Presentation.settings.stateBlends||!INK.Runtime.enabled||excluded(f))return null;
  // A super can catch an airborne opponent and immediately reposition its
  // combat root. Give the displayed body time to follow that handoff.
  const airborneSuper=kind==='hit'&&from.state==='tumble'&&f.captureKind==='super',handoff=airborneSuper?10:duration[kind]??5;
  INK.FrameBridge?.begin(f,from.frame,{state:next,duration:handoff,impact:!airborneSuper&&['hit','block','stun'].includes(kind),guard:kind==='block'});
  if(from.dir!==f.dir)return null;
  const A=SVG_FIGHTER,R=INK.Runtime,view=cleanView(f);if(override)Object.assign(view,override);
  const dt=from.dt||.25,n=handoff,profile=R.profile(f.ch.id);
  const target=R.visual(view,A.pose(view),world(view));view.stateAge=(view.stateAge||0)+dt;view._inkVisualClock=(view._inkVisualClock||0)+dt;
  if(view._inkState)view._inkState={...view._inkState,age:view._inkState.age+dt};
  const following=R.visual(view,A.pose(view),world(view));
  const poseBridge=Motion.bridge(from.pose,Motion.velocity(from.previous,from.pose,dt),target,Motion.velocity(target,following,dt),n);
  // The torso registers a strike immediately. Only the limbs/weapon catch up;
  // delaying all recoil until hitstop expires would make a hit feel unresponsive.
  const impact=!airborneSuper&&['hit','block','stun'].includes(kind);
  if(impact)for(const k of immediateBody){delete poseBridge.offsets[k];delete poseBridge.velocities[k];}
  // The lead forearm must already defend at contact, including the held frame.
  // Rear protection and legs keep their ordinary transition ownership.
  if(kind==='block'&&INK.GuardBody?.active())for(const k of ['fw','fe']){delete poseBridge.offsets[k];delete poseBridge.velocities[k];}
  const incoming=Motion.apply(target,poseBridge,0),incomingNext=Motion.apply(following,poseBridge,dt);
  const jointBridge=INK.Articulation.bridge(Rig.solveAnimation(profile,from.pose),Rig.solveAnimation(profile,from.previous),Rig.solveAnimation(profile,incoming),Rig.solveAnimation(profile,incomingNext),n,dt);
  if(kind==='block'&&INK.GuardBody?.active()){jointBridge.offsets.frontArm=[0,0];jointBridge.velocities.frontArm=[0,0];}
  const bridge={to:next,kind,duration:n,start:f._inkVisualClock||0,poseBridge,jointBridge,secondaryFrom:from.secondary,impact};
  f._inkStateVisualBlend=bridge;
  Transitions.events.push({clock:bridge.start,actor:f.index,from:from.key,to:kind,duration:n,impact});
  if(Transitions.events.length>160)Transitions.events.shift();
  return bridge;
 }
 const Transitions={version:'8.0.0',duration,events:[],capture,bind,
  change(f,next,presentationFrom=undefined){
   if(!INK.Runtime.enabled||!INK.Runtime.store)return;
   if(INK.HitEpisode?.pending(f)){f._inkStateBlend=null;f._inkStateVisualBlend=null;f._inkFrameTransition=null;return;}
   const from=presentationFrom!==undefined?presentationFrom:(f.state!==next||['hit','block','stun'].includes(next))?capture(f):null;
   if(next!=='hit')INK.HitEpisode?.release(f);
   if(presentationFrom===null)f._inkFrameTransition=null;
   f._inkStateBlend=null;f._inkStateVisualBlend=null;if(next==='attack')f._inkLanding=null;
   const poseState={state:next,stateAge:0,attack:null,move:0,_inkState:null};
   if(['hit','tumble','down','rise','captured','throwing','stun','ko'].includes(next))Object.assign(poseState,{crouch:false,jumpPre:0});
   if(from&&!['attack','captured','throwing'].includes(next))bind(f,from,{next,kind:next,override:poseState});
  },
  clipChanged(f,oldKey,key){
   if(f.attack||oldKey===key||excluded(f)||f._inkStateVisualBlend?.start===(f._inkVisualClock||0))return;
   const bridge=f._inkStateVisualBlend;
   if(f.captureKind==='super'&&bridge?.kind==='hit'&&this.elapsed(f,bridge)<bridge.duration)return;
   const previous=f._inkPrevView;
   if(!previous||excluded(previous))return;
   // A facing sign change is not a body crossfade. Do not produce a singular
   // scale or interpolate an arm through the opponent while switching sides.
   const from=capture(previous);if(from)bind(f,from,{kind:key||'idle'});
  },
  land(f,from,speed){
   if(!Number.isFinite(speed)||speed<0)throw RangeError('Finite non-negative landing speed required');
   f._inkLanding={start:f._inkVisualClock||0,speed:Math.min(speed,40),duration:22,down:['down','ko'].includes(f.state)};
   if(from)bind(f,from,{kind:f._inkLanding.down?'down':'land'});
   this.events.push({clock:f._inkVisualClock||0,actor:f.index,from:from?.key||'air',to:'ground-contact',speed:Math.min(speed,40)});if(this.events.length>160)this.events.shift();
  },
  elapsed(f,bridge=f._inkStateVisualBlend){return Math.max(0,(f._inkVisualClock||0)-(bridge?.start||0));},
  apply(f,p){
   const tr=f._inkStateVisualBlend,t=this.elapsed(f,tr);
   if(INK.Presentation.settings.stateBlends&&tr&&f.state===tr.to&&t<tr.duration){p=Motion.apply(p,tr.poseBridge,t);INK.Articulation.attachTransition(p,tr.jointBridge,t);}
   return p;
  },
  compression(f,p){
   const e=f._inkLanding,t=(f._inkVisualClock||0)-(e?.start||0);
   if(!INK.Presentation.settings.landingResponse||!e||e.down||t<0||t>=e.duration||f.y<0||['hit','block','tumble','captured','throwing','down','ko'].includes(f.state))return p;
   // A new attack owns its startup. Do not carry landing compression into an
   // active strike: the normal landing lock is still enforced by combat.
   if(f.attack)return p;
   const value=INK.SecondaryDynamics.stepSpring(0,clamp(e.speed*.36,0,5.5),0,.48,.72,t).position;
   const out=copy(p),q=clamp(value,0,7);out.bob=(out.bob||0)+q;out.chest=(out.chest||0)-q*.22;out.head=(out.head||0)+q*.32;
   return INK.Articulation.inherit(p,out);
  },
  secondary(f,value){
   const tr=f._inkStateVisualBlend,t=this.elapsed(f,tr);let out=value;
   if(INK.Presentation.settings.stateBlends&&tr?.secondaryFrom&&f.state===tr.to&&t<tr.duration+3)out=Motion.blendSecondary(tr.secondaryFrom,out,t,tr.duration+3);
   const e=f._inkLanding,age=(f._inkVisualClock||0)-(e?.start||0);
   if(!INK.Presentation.settings.landingResponse||!e||age<0||age>=22||!INK.MotionGraph.settings.springs||INK.VFX?.settings.reducedMotion)return out;
   out=copy(out);for(const [key,k]of [['hairChain',1],['clothChain',.75]]){
    out[key]=(out[key]||[0,0,0]).map((v,i)=>{const q=INK.SecondaryDynamics.stepSpring(0,Math.min(e.speed,20)*.38*k,0,.4/(1+i*.22),.58,Math.max(0,age-i*.6));return clamp(v+q.position,-40,40);});
   }
   out.hair=out.hairChain[2];out.cloth=out.clothChain[2];return out;
  },
  clear(){this.events=[];}
 };
 INK.StateTransitions=Transitions;
})();
