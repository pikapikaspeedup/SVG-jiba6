/* INK FLOW runtime boundary. Combat owns world motion, damage and meter.
 * The compiled base pose feeds collision; a separate motion graph feeds SVG.
 * Display-only layers/contacts/secondary dynamics never alter combat geometry.
 * Only explicitly edited timing/boxes replace the original rules.
 */
'use strict';
(() => {
 const {mat,vec,Rig,clamp}=INK;
 function phaseMap(t,from,to){for(let i=0;i<3;i++)if(t<=from[i+1]||i===2)return to[i]+clamp((t-from[i])/Math.max(.001,from[i+1]-from[i]))*(to[i+1]-to[i]);return to[3];}
 function contactWeight(f){
  if(!INK.StrikeScore?.supports(f)&&!(f.ch.id==='mai'&&f.attack?.m.id==='bHK'))return 0;
  const {m,t}=f.attack,end=m.startup+m.active,handoff=Math.min(2,Math.max(0,m.startup-1)),lead=Math.min(3,Math.max(.001,m.startup-handoff)),tail=Math.min(5,m.recovery/3);
  const u=clamp(t<m.startup?(t-m.startup+lead)/lead:t<=end?1:1-(t-end)/Math.max(.001,tail));
  return u*u*(3-2*u);
 }
 function socket(p,rig,name){if(name==='fanGrip'||name==='fanTip')return INK.Motion.fanSocket(p,rig,name);const r=Rig.sockets(p,rig),lut={frontHand:['frontArm',2],rearHand:['rearArm',2],frontElbow:['frontArm',1],rearElbow:['rearArm',1],frontFoot:['frontLeg',2],rearFoot:['rearLeg',2],frontKnee:['frontLeg',1],rearKnee:['rearLeg',1]};if(name==='root')return[0,0];if(lut[name])return r[lut[name][0]][lut[name][1]];return r[name]||r.chest;}
 const Runtime={enabled:true,sourceStore:null,sessionStore:null,get store(){return this.sessionStore||this.sourceStore;},eventLog:[],profileCache:new Map(),lifecycleLog:[],actionSerial:0,
  install(store){this.sourceStore=store;store.on(()=>{if(!this.sessionStore)this.invalidate();});return this;},
  useSessionStore(store){this.sessionStore=store;this.invalidate();},
  invalidate(){INK.StageLight?.clear();INK.Replay?.stop();INK.SceneFeedback?.clear();this.profileCache.clear();INK.MotionGraph.clear();INK.Articulation?.clear();INK.SecondaryDynamics.clear();INK.VFX?.bank?.clear();for(const f of globalThis.SVG_FIGHTER?.fighters||[]){INK.Spacing?.invalidate(f);if(INK.AirStrike?.owns(f)){delete f.attack.airStrikeContext;delete f.attack.airStrikeSupportPlan;}else if(INK.StrikeModel?.owns(f)){globalThis.SVG_FIGHTER.setState(f,f.y<0?'recovery':'idle');}INK.Presentation?.reset(f);INK.BodySupport?.reset(f);f._poseSimulationFrame=null;f._floorCache=null;f._renderSignature=null;if(f.inkRenderer){f.inkRenderer.destroy();f.inkRenderer=null;}if(f.inkFX){f.inkFX.destroy();f.inkFX=null;}}},
  get revision(){return this.store?.revision||0;},
  profile(id){if(!this.profileCache.has(id))this.profileCache.set(id,this.store.profile(id));return this.profileCache.get(id);},
  record(f,m){const original=this.store?.byGame(f.ch.id,m?.wakeStrike?'sMP':m?.id||'@idle')||null;
   if(original&&f.ch.id==='mai'&&m?.base==='kachosen'&&m.od&&m.fanCharged&&m.id!=='midare'&&!this.store.modified?.('mai',original.key))return this.store.byGame('mai','@kachosen-od-held')||original;
   return original;
  },
  clipFrame(record,m,t){const b=record.binding;return phaseMap(t,[0,m.startup,m.startup+m.active,m.total],[0,b.startup,b.startup+b.active,record.clip.duration]);},
  capture(f,m,outgoing=null){
   const source=outgoing||f;
   if(!this.store)return;const A=globalThis.SVG_FIGHTER,from=A?.pose(source),rec=this.record(f,m);if(!from||!rec)return;
   const profile=this.profile(f.ch.id),world={x:f.x,y:f.y,dir:f.dir,scale:f.renderScale||f.ch.scale||1},oldWorld={x:source.x,y:source.y,dir:source.dir,scale:source.renderScale||source.ch.scale||1},visualFrom=this.visual(source,from,oldWorld);
   let previous=from,visualPrevious=visualFrom,dt=.25;
   if(source.attack&&source.attack.t>0){dt=Math.min(.25,source.attack.t);const nativeAir=INK.AirStrike?.owns(source),historical=nativeAir?INK.Presentation?.attackAt(source,source.attack.t-dt):null,view=historical||Object.create(source);if(!historical){if(nativeAir)dt=0;view.attack={...source.attack,t:source.attack.t-dt};}previous=A.pose(view);visualPrevious=this.visual(view,previous,{x:view.x,y:view.y,dir:view.dir,scale:view.renderScale||view.ch.scale||1});}else if(INK.Presentation){const view=INK.Presentation.previous(source,dt);previous=A.pose(view);visualPrevious=this.visual(view,previous,{x:view.x,y:view.y,dir:view.dir,scale:view.renderScale||view.ch.scale||1});}
   // Sample the real incoming game pose with clean transition ownership.
   // Falling back to the outgoing pose for absent channels fabricated a yaw
   // target which the incoming Runtime.sample would never actually produce.
   const incomingView=Object.create(f);Object.assign(incomingView,{_inkNoHitEpisode:true,_inkHitEpisode:null,state:'attack',stateAge:0,crouch:m.normalState==='c',move:0,jumpPre:0,attack:{m,t:0},_inkTransition:null,_inkVisualTransition:null,_inkJointTransition:null,_inkStateBlend:null,_inkFrameTransition:null});
   const target=A.pose(incomingView);incomingView.attack={m,t:.25};const next=A.pose(incomingView);
   const oldCtx=INK.State.contextForFX(source);
   const oldSecondary=this.presentation(source,oldCtx?.record,oldCtx?.frame||0,source.attack?.t||0);
   f._inkActionOrigin={x:f.x,y:f.y,dir:f.dir,scale:f.renderScale||f.ch.scale||1,t:0};
   const scoredIncoming=INK.StrikeScore?.supports(incomingView),deadline=Math.min(5,Math.max(0,m.startup-1)),visualDeadline=scoredIncoming?Math.min(2,deadline):deadline;
   f._inkTransition={id:m.id,bridge:INK.Motion.bridge(from,INK.Motion.velocity(previous,from,dt),target,INK.Motion.velocity(target,next),deadline),secondary:oldSecondary};
   // A separate visual bridge preserves a cancelled layer's displacement and
   // derivative. It does not replace the battle-owned incoming base bridge.
   if(!scoredIncoming){
   const graphAt=(p,t)=>{const view=Object.create(incomingView);view.attack={m,t};return this.composeLayers(view,INK.Motion.apply(p,f._inkTransition.bridge,t),world,{record:rec,frame:this.clipFrame(rec,m,t)});};
   const visualTarget=graphAt(target,0),visualNext=graphAt(next,.25);
   f._inkVisualTransition={id:m.id,bridge:INK.Motion.bridge(visualFrom,INK.Motion.velocity(visualPrevious,visualFrom,dt),visualTarget,INK.Motion.velocity(visualTarget,visualNext),visualDeadline)};
   // A pose-value bridge alone cannot preserve a compiled skeleton: the next
   // clip owns a different angular trajectory. Carry actual joint rotations
   // and their derivatives, then expire before the first active frame.
   let incoming=INK.Motion.apply(visualTarget,f._inkVisualTransition.bridge,0),incomingNext=INK.Motion.apply(visualNext,f._inkVisualTransition.bridge,.25);
   const constrained=(p,t)=>{const view=Object.create(incomingView);view.attack={m,t};return INK.BodySupport?.constrainFeet(view,p,world)||p;};incoming=constrained(incoming,0);incomingNext=constrained(incomingNext,.25);
   f._inkJointTransition={id:m.id,...INK.Articulation.bridge(Rig.solveAnimation(profile,visualFrom),Rig.solveAnimation(profile,visualPrevious),Rig.solveAnimation(profile,incoming),Rig.solveAnimation(profile,incomingNext),visualDeadline,dt)};
   }else{
    // One world-frame handoff owns scored entries. Do not also accumulate
    // the older pose-value and angular residual bridges on the same limb.
    f._inkVisualTransition=null;f._inkJointTransition=null;
   }
   // Aim the short contact-limb handoff at its actual deadline pose. Chasing
   // each moving startup pose left most of a cross-side punch for the last frame.
   incomingView.attack={m,t:visualDeadline};incomingView._inkVisualClock=(f._inkVisualClock||0)+visualDeadline;
   const deadlinePose=this.visual(incomingView,A.pose(incomingView),world);
   INK.FrameBridge?.begin(f,INK.FrameBridge.capture(source,visualFrom),{state:'attack',attack:m.id,duration:visualDeadline,deadlineFrame:INK.VisualFrame?.get(deadlinePose),carry:m.movementStrike?.budget||0});
  },
  sample(f,m,t,base){
   if(!this.enabled||!this.store)return null;const record=this.record(f,m);if(!record)return null;
   let p=this.store.clip(record).sample(this.clipFrame(record,m,t),base);delete p.rootX;delete p.rootY;
   const tr=f._inkTransition;if(tr?.id===m.id)p=INK.Motion.apply(p,tr.bridge,t);return p;
  },
  presentation(f,record,frame,simulationFrame=f.attack?.t||0){const v=INK.Motion.secondary(record?.clip,frame);const tr=f._inkTransition;const out=f.attack&&tr?.id===f.attack.m.id?INK.Motion.blendSecondary(tr.secondary,v,simulationFrame,8):v;return INK.StateTransitions?INK.StateTransitions.secondary(f,out):out;},
  clock(f,fallback=0){return Number.isFinite(f._inkVisualClock)?f._inkVisualClock:Number.isFinite(f._inkPreviewClock)?f._inkPreviewClock:fallback;},
  neutral(f,time,base){if(!this.enabled||!this.store)return null;const rec=this.store.byGame(f.ch.id,'@idle');if(!rec)return null;return this.store.clip(rec).sample((this.clock(f,time*60)+(f.index||0)*13)%rec.clip.duration,base);},
  rig(f,p){const native=INK.AirStrike?.rig(f,p)||INK.StrikeModel?.rig(f,p);if(native)return native;if(!this.enabled||!this.store)return null;return (Rig.solveCombat||Rig.solveAnimation)(this.profile(f.ch.id),p);},
  visualRig(f,p){return INK.VisualFrame?.get(p)?.rig||Rig.solveAnimation(this.store?this.profile(f.ch.id):INK.assets.byID[f.ch.id],p);},
  prepare(f,m){if(!this.enabled||!this.store||!m)return m;const record=this.record(f,m);if(!record?.binding.retimed)return m;const b=record.binding;return{...m,startup:b.startup,active:b.active,recovery:b.recovery,total:record.clip.duration};},
  geometry(f,original,p,rig,world,closing=false){if(!this.enabled||!f.attack)return original;const a=f.attack,rec=this.record(f,a.m);if(!rec||rec.boxes.mode!=='custom')return original;const t=this.clipFrame(rec,a.m,a.t),out={...original};const hit=[],hurt=[];
   for(const b of rec.boxes.items){if(closing?t<=b.start||t>b.end:t<b.start||t>=b.end)continue;const q=socket(p,rig,b.socket),pts=[[b.x,b.y],[b.x+b.w,b.y],[b.x+b.w,b.y+b.h],[b.x,b.y+b.h]].map(x=>world([q[0]+x[0],q[1]+x[1]],false)),xs=pts.map(x=>x[0]),ys=pts.map(x=>x[1]),x=Math.min(...xs),y=Math.min(...ys);const box={x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y,part:'ink-'+b.kind+':'+b.id};(b.kind==='hit'?hit:hurt).push(box);}
   if(!a.m.throw&&!a.m.kind.includes('projectile'))out.hit=hit;
   if(rec.boxes.items.some(b=>b.kind==='hurt'))out.hurt=hurt;return out;
  },
  tick(f,gameTick){
   const a=f.attack;if(!this.enabled||!a||!this.store)return;
   const rec=this.record(f,a.m);if(!rec)return;const t=this.clipFrame(rec,a.m,a.t);
   if(a._inkCursor==null||!a._inkTimeline)a._inkTimeline=new INK.EventTimeline(rec.fx,{instance:++this.actionSerial});
   if(t<a._inkTimeline.cursor)a._inkTimeline.seek(t);
   a._inkEdges=a._inkTimeline.advance(t);
   for(const e of a._inkEdges) {
    const item={tick:gameTick,character:f.ch.id,move:a.m.id,event:e.event.id,frame:e.frame,type:e.event.type,kind:e.kind,instance:e.instance,serial:e.serial};
    this.lifecycleLog.push(item);if(e.kind==='start')this.eventLog.push(item);
   }
   a._inkCursor=t;
   if(this.eventLog.length>160)this.eventLog.splice(0,this.eventLog.length-160);
   if(this.lifecycleLog.length>256)this.lifecycleLog.splice(0,this.lifecycleLog.length-256);
  },
  stateChange(f,next,presentationFrom=undefined){
   if(!this.enabled||!this.store)return;
   const old=f.attack;INK.StateTransitions.change(f,next,presentationFrom);
   if(old){INK.VFX?.flushStrike?.(f);INK.VFX?.bank?.cancel(f.index,INK.VFX.time,'state:'+next);}
   if(old?._inkTimeline)for(const e of old._inkTimeline.cancel('state:'+next))this.lifecycleLog.push({character:f.ch.id,move:old.m.id,event:e.event.id,frame:e.frame,kind:e.kind,instance:e.instance,serial:e.serial});
   if(this.lifecycleLog.length>256)this.lifecycleLog.splice(0,this.lifecycleLog.length-256);
  },
  composeLayers(f,base,world=null,override=null){
   const ctx=override||INK.State.contextForFX(f)||(()=>{const r=this.store.byGame(f.ch.id,'@idle');return r?{record:r,frame:(this.clock(f,f.stateAge||0)+(f.index||0)*13)%r.clip.duration}:null;})();
   let p=base;
   if(!ctx)return p;
   const context=world?{...world,history:f._inkTrail?.rows,origin:f._inkActionOrigin,airborne:f.y<-2}:null;
   const authored=!!ctx.record?.clip.meta?.maiChoreography;
   const scored=!authored&&INK.StrikeScore?.supports(f);
   // Score owns the authored body/guard/fan tracks. Preserve independent
   // secondary dynamics, but do not add the old motion5 score a second time.
   p=scored?INK.copy(p):INK.MotionGraph.compose(ctx.record,ctx.frame,p,this.profile(f.ch.id),context);
   p=INK.Kinetic?.pose(f,p)||p;
   p=INK.GuardBody?.pose(f,p)||p;
   p=scored?INK.StrikeScore.sample(f,p):authored?p:INK.StrikeMotion?.pose(f,p)||p;
   p=INK.StrikeTempoFX?.pose(f,p)||p;
   if(!scored&&!authored)p=INK.RecoveryMotion?.pose(f,p)||p;
   p=INK.Aerial?.pose(f,p)||p;
   p=INK.AirPursuitFX?.pose(f,p)||p;
   p=INK.WakeFlow?.pose(f,p)||p;
   p=INK.BodySupport?.pose(f,p,world)||p;
   p=INK.ThrowBody?.pose(f,p)||p;
   return p;
  },
  visual(f,base,world=null,skipThrowConstraint=false){
   const hit=INK.HitRule?.sample(f,{world:world||{x:f.x,y:f.y,dir:f.dir,scale:f.ch.scale||1},time:this.clock(f)});if(hit)return INK.VisualFrame.attach(hit.pose,this.combatView(f,hit.frame));
   const airView=world?Object.assign(Object.create(f),{x:world.x??f.x,y:world.y??f.y}):f,airStrike=INK.AirStrike?.sample(airView);if(airStrike){const p=INK.copy(airStrike.pose),frame={...INK.StrikeModelFrame.build(f,airStrike,{world:world||{}}),mode:'air-strike'};return INK.VisualFrame.attach(p,this.combatView(f,frame));}
   const air=INK.AirBody?.owns(f)&&INK.AirBody.sample(f,{world:world||{x:f.x,y:f.y,dir:f.dir,scale:f.ch.scale||1},time:this.clock(f)});if(air)return INK.VisualFrame.attach(INK.copy(air.pose),this.combatView(f,air.frame));
   const native=INK.StrikeModel?.sample(f);if(native){const p=INK.copy(native.pose),frame=INK.StrikeModelFrame.build(f,native,{world:world||{}});return INK.VisualFrame.attach(p,this.combatView(f,frame));}
   const rule=!f._inkRawVisual&&INK.RulePose?.sample(f,{world:world||{x:f.x,y:f.y,dir:f.dir,scale:f.ch.scale||1},time:this.clock(f)});if(rule)return INK.VisualFrame.attach(rule.pose,this.combatView(f,rule.frame));
   if(!this.enabled||!this.store)return base;
   if(INK.HitEpisode?.owns(f)){const p=INK.HitEpisode.sample(f,world||{x:f.x,y:f.y,dir:f.dir,scale:f.renderScale||f.ch.scale||1},this.clock(f));return INK.VisualFrame.attach(p,this.combatView(f,INK.VisualFrame.get(p)));}
   const movingFrame=INK.VisualFrame&&!f._inkRawVisual&&!f.attack&&!f.crouch&&!f.jumpPre&&f.y===0&&['idle','dash','rush'].includes(f.state);
   let display=f;
   if(movingFrame){
    // A persistent stance model supplies body proportions and guard targets.
    // World-foot plans own gait, instead of switching two authored walk clips
    // at the instant that controls acquire a different logical facing.
    display=Object.create(f);Object.assign(display,{state:'idle',move:0,_inkState:null,_inkStateVisualBlend:null,_inkStateBlend:null});
    base=globalThis.SVG_FIGHTER.pose(display);
   }
   let p=this.composeLayers(display,base,world);
   const visualTransition=f._inkVisualTransition;
   if(INK.MotionGraph.settings.enabled&&f.attack&&visualTransition?.id===f.attack.m.id)p=INK.Motion.apply(p,visualTransition.bridge,f.attack.t);
   if(f.attack&&f._inkJointTransition?.id===f.attack.m.id)INK.Articulation.attachTransition(p,f._inkJointTransition,f.attack.t);
   p=INK.StateTransitions.compression(display,p);
   p=INK.StateTransitions.apply(display,p);
   // The light Shinobi-bachi's authored full turn was compressed into a few
   // frames by its shorter combat startup. Spread the same rotation across
   // the startup for presentation; the combat pose remains untouched.
   if(f.ch.id==='mai'&&f.attack?.m.id==='shinobibachi_0'&&!this.record(f,f.attack.m)?.clip.meta?.maiChoreography){
    const u=clamp(f.attack.t/f.attack.m.startup),q=INK.Articulation.inherit(p,INK.copy(p));
    q.spin=-360*u*u*(3-2*u);p=q;
   }
   const strikeWeight=contactWeight(f);
   if(strikeWeight){
    const q=INK.Articulation.inherit(p,INK.copy(p)),kick=f.attack.m.contactPart==='foot'||f.attack.m.pose==='kick';
    const keys=['lean','bob','pelvis','pelvisYaw','turn','yaw','spin','floor','rootShift','depth',...(kick?[]:['chest','chestYaw']),...(f.ch.id==='mai'?['fan','fanAngle']:[])];
    for(const key of keys){const fallback=key==='depth'?1:0,from=p[key]??fallback,to=base[key]??fallback;q[key]=from+(to-from)*strikeWeight;}p=q;
   }
   if(!movingFrame)p=INK.BodySupport?.constrainFeet(f,p,world)||p;
   if(!skipThrowConstraint)p=this.throwGrip(f,p,world);
   if(INK.VisualFrame&&!f._inkRawVisual){
    // Each evaluation owns its frame; never attach to a cached authored pose.
    const final=INK.copy(p);INK.Articulation.inherit(p,final);
    const built=INK.VisualFrame.build(f,p,{world,time:this.clock(f),facing:INK.FacingMotion?.sample(f,this.clock(f),world)}),handed=INK.FrameBridge?.apply(f,built,{world,time:this.clock(f)})||built;
    const frame=strikeWeight&&INK.StrikeContact?.apply?INK.StrikeContact.apply(f,handed,{combatPose:base,weight:strikeWeight}):handed;
    p=INK.VisualFrame.attach(final,this.combatView(f,frame));
   }
   return p;
  },
  combatView(f,frame){const result=INK.CombatView?.apply(f,frame)||frame;if(!result.combatView?.active)return result;return {...result,combatView:{...result.combatView,mood:INK.CombatExpression?.sample(f,this.clock(f))||{}}};},
  throwGrip(f,p,world=null){
   const action=f.throwAction,phase=INK.ThrowBody?.phase(action);
   if(!INK.ThrowBody?.active()||!phase||action.owner!==f||phase.released||phase.grip<=0)return p;
   const target=action.target;if(!target||target.throwAction!==action||target.captureKind!=='throw')return p;
   // One-way sampling: the target never requests the owner's pose. Both use
   // the same simulation-owned throw time, independent of drawing order.
   const root=(actor,w)=>({x:w?.x??actor.x,y:665+(w?.y??actor.y),scale:w?.scale||actor.renderScale||actor.ch.scale||1,facing:w?.dir??actor.dir});
   const targetWorld={x:target.x,y:target.y,dir:target.dir,scale:target.renderScale||target.ch.scale||1};
   const q=this.visual(target,SVG_FIGHTER.pose(target),targetWorld,true),targetRig=this.visualRig(target,q),s=Rig.sockets(q,targetRig);
   const collar=name=>vec.mix(s[name][0],s.chest,.3),tw=root(target,targetWorld);
   const anchors={front:Rig.world(q,collar('rearArm'),tw),rear:Rig.world(q,collar('frontArm'),tw)},w=root(f,world),rig=this.visualRig(f,p);
   const surface=name=>[[s[name][0],s[name][1]],[s[name][0],s.chest],[s.chest,vec.mix(s.chest,s.pelvis,.55)]].map(segment=>segment.map(point=>Rig.world(q,point,tw)));
   const regions={front:surface('rearArm'),rear:surface('frontArm')};
   const matrix=mat.multiply(mat.compose(w.x,w.y,0,w.scale*w.facing*(p.depth||1),w.scale),mat.multiply(mat.compose(p.rootShift||0,(p.floor||0)-180,p.spin||0),mat.compose(0,180))),inverse=mat.inverse(matrix);
   return INK.ThrowBody.constrain(f,p,{rig,anchors,regions,character:this.profile(f.ch.id),toWorld:point=>Rig.world(p,point,w),toLocal:point=>mat.point(inverse,point)});
  },
  visualSample(f,record,frame,root){
   const m=f.attack.m,b=record.binding,gameFrame=phaseMap(frame,[0,b.startup,b.startup+b.active,record.clip.duration],[0,m.startup,m.startup+m.active,m.total]);
   const native=INK.AirStrike?.owns(f),sampled=native?INK.Presentation?.attackAt(f,gameFrame):null;if(native&&!sampled)return null;
   const view=Object.create(sampled||f);if(!native){view.attack={...f.attack,t:gameFrame};view.x=root.x;view.y=root.y;}else root={...root,x:view.x,y:view.y,dir:view.dir};
   const base=globalThis.SVG_FIGHTER.pose(view),p=this.visual(view,base,root),rig=this.visualRig(view,p);
   return {pose:p,rig};
  },
  socket,
  setEnabled(value){this.enabled=!!value;this.profileCache.clear();for(const f of globalThis.SVG_FIGHTER?.fighters||[]){f._poseSimulationFrame=null;f._floorCache=null;}},
  phaseMap
 };
 INK.Runtime=Runtime;
})();
