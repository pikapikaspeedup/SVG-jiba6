/* INK FLOW runtime boundary. Combat owns world motion, damage and meter.
 * The compiled base pose feeds collision; a separate motion graph feeds SVG.
 * Display-only layers/contacts/secondary dynamics never alter combat geometry.
 * Only explicitly edited timing/boxes replace the original rules.
 */
'use strict';
(() => {
 const {mat,vec,Rig,clamp}=INK;
 function phaseMap(t,from,to){for(let i=0;i<3;i++)if(t<=from[i+1]||i===2)return to[i]+clamp((t-from[i])/Math.max(.001,from[i+1]-from[i]))*(to[i+1]-to[i]);return to[3];}
 function socket(p,rig,name){if(name==='fanGrip'||name==='fanTip')return INK.Motion.fanSocket(p,rig,name);const r=Rig.sockets(p,rig),lut={frontHand:['frontArm',2],rearHand:['rearArm',2],frontElbow:['frontArm',1],rearElbow:['rearArm',1],frontFoot:['frontLeg',2],rearFoot:['rearLeg',2],frontKnee:['frontLeg',1],rearKnee:['rearLeg',1]};if(name==='root')return[0,0];if(lut[name])return r[lut[name][0]][lut[name][1]];return r[name]||r.chest;}
 const Runtime={enabled:true,store:null,eventLog:[],profileCache:new Map(),lifecycleLog:[],actionSerial:0,
  install(store){this.store=store;store.on(()=>{this.profileCache.clear();INK.MotionGraph.clear();INK.SecondaryDynamics.clear();INK.VFX?.bank?.clear();for(const f of globalThis.SVG_FIGHTER?.fighters||[]){f._poseSimulationFrame=null;f._floorCache=null;f._renderSignature=null;if(f.inkRenderer){f.inkRenderer.destroy();f.inkRenderer=null;}if(f.inkFX){f.inkFX.destroy();f.inkFX=null;}}});return this;},
  get revision(){return this.store?.revision||0;},
  profile(id){if(!this.profileCache.has(id))this.profileCache.set(id,this.store.profile(id));return this.profileCache.get(id);},
  record(f,m){return this.store?.byGame(f.ch.id,m?.id||'@idle')||null;},
  clipFrame(record,m,t){const b=record.binding;return phaseMap(t,[0,m.startup,m.startup+m.active,m.total],[0,b.startup,b.startup+b.active,record.clip.duration]);},
  capture(f,m){
   if(!this.store)return;const A=globalThis.SVG_FIGHTER,from=A?.pose(f),rec=this.record(f,m);if(!from||!rec)return;
   const profile=this.profile(f.ch.id),world={x:f.x,y:f.y,dir:f.dir,scale:f.renderScale||f.ch.scale||1},visualFrom=this.visual(f,from,world);
   let previous=from,visualPrevious=visualFrom,dt=.25;
   if(f.attack&&f.attack.t>0){dt=Math.min(.25,f.attack.t);const view=Object.create(f);view.attack={...f.attack,t:f.attack.t-dt};previous=A.pose(view);visualPrevious=this.visual(view,previous,world);}
   const clip=this.store.clip(rec),target=clip.sample(0,from),next=clip.sample(this.clipFrame(rec,m,.25),from);
   const oldRec=f.attack?this.record(f,f.attack.m):null;
   const oldSecondary=INK.Motion.secondary(oldRec?.clip,f.attack&&oldRec?this.clipFrame(oldRec,f.attack.m,f.attack.t):f.stateAge||0);
   f._inkActionOrigin={x:f.x,y:f.y,dir:f.dir,scale:f.renderScale||f.ch.scale||1,t:0};
   const deadline=Math.min(5,Math.max(0,m.startup-1));
   f._inkTransition={id:m.id,bridge:INK.Motion.bridge(from,INK.Motion.velocity(previous,from,dt),target,INK.Motion.velocity(target,next),deadline),secondary:oldSecondary};
   // A separate visual bridge preserves a cancelled layer's displacement and
   // derivative. It does not replace the battle-owned incoming base bridge.
   const graphAt=(p,t)=>INK.MotionGraph.compose(rec,this.clipFrame(rec,m,t),INK.Motion.apply(p,f._inkTransition.bridge,t),profile,{...world,origin:world,airborne:f.y<-2});
   const visualTarget=graphAt(target,0),visualNext=graphAt(next,.25);
   f._inkVisualTransition={id:m.id,bridge:INK.Motion.bridge(visualFrom,INK.Motion.velocity(visualPrevious,visualFrom,dt),visualTarget,INK.Motion.velocity(visualTarget,visualNext),deadline)};
  },
  sample(f,m,t,base){
   if(!this.enabled||!this.store)return null;const record=this.record(f,m);if(!record)return null;
   let p=this.store.clip(record).sample(this.clipFrame(record,m,t),base);delete p.rootX;delete p.rootY;
   const tr=f._inkTransition;if(tr?.id===m.id)p=INK.Motion.apply(p,tr.bridge,t);return p;
  },
  presentation(f,record,frame,simulationFrame=f.attack?.t||0){const v=INK.Motion.secondary(record?.clip,frame);const tr=f._inkTransition;return f.attack&&tr?.id===f.attack.m.id?INK.Motion.blendSecondary(tr.secondary,v,simulationFrame,8):v;},
  neutral(f,time,base){if(!this.enabled||!this.store)return null;const rec=this.store.byGame(f.ch.id,'@idle');if(!rec)return null;return this.store.clip(rec).sample((time*60+(f.index||0)*13)%rec.clip.duration,base);},
  rig(f,p){if(!this.enabled||!this.store)return null;return Rig.solveAnimation(this.profile(f.ch.id),p);},
  prepare(f,m){if(!this.enabled||!this.store||!m)return m;const record=this.record(f,m);if(!record?.binding.retimed)return m;const b=record.binding;return{...m,startup:b.startup,active:b.active,recovery:b.recovery,total:record.clip.duration};},
  geometry(f,original,p,rig,world){if(!this.enabled||!f.attack)return original;const a=f.attack,rec=this.record(f,a.m);if(!rec||rec.boxes.mode!=='custom')return original;const t=this.clipFrame(rec,a.m,a.t),out={...original};const hit=[],hurt=[];
   for(const b of rec.boxes.items){if(t<b.start||t>=b.end)continue;const q=socket(p,rig,b.socket),pts=[[b.x,b.y],[b.x+b.w,b.y],[b.x+b.w,b.y+b.h],[b.x,b.y+b.h]].map(x=>world([q[0]+x[0],q[1]+x[1]],false)),xs=pts.map(x=>x[0]),ys=pts.map(x=>x[1]),x=Math.min(...xs),y=Math.min(...ys);const box={x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y,part:'ink-'+b.kind+':'+b.id};(b.kind==='hit'?hit:hurt).push(box);}
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
  stateChange(f,next){
   if(!this.enabled||!this.store)return;
   const old=f.attack;
   if(old)INK.VFX?.bank?.cancel(f.index,INK.VFX.time,'state:'+next);
   if(old?._inkTimeline)for(const e of old._inkTimeline.cancel('state:'+next))this.lifecycleLog.push({character:f.ch.id,move:old.m.id,event:e.event.id,frame:e.frame,kind:e.kind,instance:e.instance,serial:e.serial});
   if(this.lifecycleLog.length>256)this.lifecycleLog.splice(0,this.lifecycleLog.length-256);
   f._inkStateBlend=null;
   // Contact reactions snap immediately; only free recovery/idle handoffs blend.
   if(['idle','recovery'].includes(next)&&f.state!==next&&globalThis.SVG_FIGHTER){
    f._inkStateBlend={from:globalThis.SVG_FIGHTER.pose(f),to:next,duration:5};
   }
  },
  visual(f,base,world=null){
   if(!this.enabled||!this.store)return base;
   const ctx=INK.State.contextForFX(f)||(()=>{const r=this.store.byGame(f.ch.id,'@idle');return r?{record:r,frame:(f.stateAge||0)%r.clip.duration}:null;})();
   let p=base;const tr=f._inkStateBlend;
   if(tr&&f.state===tr.to&&(f.stateAge||0)<tr.duration){const bridge=INK.Motion.bridge(tr.from,{},base,{},tr.duration);p=INK.Motion.apply(base,bridge,f.stateAge||0);}
   if(!ctx)return p;
   const context=world?{...world,history:f._inkTrail?.rows,origin:f._inkActionOrigin,airborne:f.y<-2}:null;
   p=INK.MotionGraph.compose(ctx.record,ctx.frame,p,this.profile(f.ch.id),context);
   const visualTransition=f._inkVisualTransition;
   if(INK.MotionGraph.settings.enabled&&f.attack&&visualTransition?.id===f.attack.m.id)p=INK.Motion.apply(p,visualTransition.bridge,f.attack.t);
   return p;
  },
  visualSample(f,record,frame,root){
   const m=f.attack.m,b=record.binding,gameFrame=phaseMap(frame,[0,b.startup,b.startup+b.active,record.clip.duration],[0,m.startup,m.startup+m.active,m.total]);
   const view=Object.create(f);view.attack={...f.attack,t:gameFrame};view.x=root.x;view.y=root.y;
   const base=globalThis.SVG_FIGHTER.pose(view),p=this.visual(view,base,root),rig=this.rig(view,p);
   return {pose:p,rig};
  },
  socket,
  setEnabled(value){this.enabled=!!value;this.profileCache.clear();for(const f of globalThis.SVG_FIGHTER?.fighters||[]){f._poseSimulationFrame=null;f._floorCache=null;}},
  phaseMap
 };
 INK.Runtime=Runtime;
})();
