/* INK 2 runtime boundary. Combat owns world motion, damage and meter.
 * A single sampled pose and solved skeleton feed both SVG and collision.
 * Only explicitly edited timing/boxes replace the original rules.
 */
'use strict';
(() => {
 const {mat,vec,Rig,clamp}=INK;
 function phaseMap(t,from,to){for(let i=0;i<3;i++)if(t<=from[i+1]||i===2)return to[i]+clamp((t-from[i])/Math.max(.001,from[i+1]-from[i]))*(to[i+1]-to[i]);return to[3];}
 function socket(p,rig,name){const r=Rig.sockets(p,rig),lut={frontHand:['frontArm',2],rearHand:['rearArm',2],frontElbow:['frontArm',1],rearElbow:['rearArm',1],frontFoot:['frontLeg',2],rearFoot:['rearLeg',2],frontKnee:['frontLeg',1],rearKnee:['rearLeg',1]};if(name==='root')return[0,0];if(lut[name])return r[lut[name][0]][lut[name][1]];return r[name]||r.chest;}
 const Runtime={enabled:true,store:null,eventLog:[],profileCache:new Map(),
  install(store){this.store=store;store.on(()=>{this.profileCache.clear();for(const f of globalThis.SVG_FIGHTER?.fighters||[]){f._poseSimulationFrame=null;f._floorCache=null;f._renderSignature=null;if(f.inkRenderer){f.inkRenderer.destroy();f.inkRenderer=null;}if(f.inkFX){f.inkFX.destroy();f.inkFX=null;}}});return this;},
  get revision(){return this.store?.revision||0;},
  profile(id){if(!this.profileCache.has(id))this.profileCache.set(id,this.store.profile(id));return this.profileCache.get(id);},
  record(f,m){return this.store?.byGame(f.ch.id,m?.id||'@idle')||null;},
  clipFrame(record,m,t){const b=record.binding;return phaseMap(t,[0,m.startup,m.startup+m.active,m.total],[0,b.startup,b.startup+b.active,record.clip.duration]);},
  sample(f,m,t,base){if(!this.enabled||!this.store)return null;const record=this.record(f,m);if(!record)return null;const p=this.store.clip(record).sample(this.clipFrame(record,m,t),base);delete p.rootX;delete p.rootY;return p;},
  neutral(f,time,base){if(!this.enabled||!this.store)return null;const rec=this.store.byGame(f.ch.id,'@idle');if(!rec)return null;return this.store.clip(rec).sample((time*60+(f.index||0)*13)%rec.clip.duration,base);},
  rig(f,p){if(!this.enabled||!this.store)return null;return Rig.solveAnimation(this.profile(f.ch.id),p);},
  prepare(f,m){if(!this.enabled||!this.store||!m)return m;const record=this.record(f,m);if(!record?.binding.retimed)return m;const b=record.binding;return{...m,startup:b.startup,active:b.active,recovery:b.recovery,total:record.clip.duration};},
  geometry(f,original,p,rig,world){if(!this.enabled||!f.attack)return original;const a=f.attack,rec=this.record(f,a.m);if(!rec||rec.boxes.mode!=='custom')return original;const t=this.clipFrame(rec,a.m,a.t),out={...original};const hit=[],hurt=[];
   for(const b of rec.boxes.items){if(t<b.start||t>=b.end)continue;const q=socket(p,rig,b.socket),pts=[[b.x,b.y],[b.x+b.w,b.y],[b.x+b.w,b.y+b.h],[b.x,b.y+b.h]].map(x=>world([q[0]+x[0],q[1]+x[1]],false)),xs=pts.map(x=>x[0]),ys=pts.map(x=>x[1]),x=Math.min(...xs),y=Math.min(...ys);const box={x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y,part:'ink-'+b.kind+':'+b.id};(b.kind==='hit'?hit:hurt).push(box);}
   if(!a.m.throw&&!a.m.kind.includes('projectile'))out.hit=hit;
   if(rec.boxes.items.some(b=>b.kind==='hurt'))out.hurt=hurt;return out;
  },
  tick(f,gameTick){const a=f.attack;if(!this.enabled||!a||!this.store)return;const rec=this.record(f,a.m);if(!rec)return;const t=this.clipFrame(rec,a.m,a.t);if(a._inkCursor==null)a._inkCursor=-1;if(t<a._inkCursor)a._inkCursor=-1;for(const e of rec.fx){if(e.frame>a._inkCursor&&e.frame<=t){this.eventLog.push({tick:gameTick,character:f.ch.id,move:a.m.id,event:e.id,frame:e.frame,type:e.type});}}a._inkCursor=t;if(this.eventLog.length>160)this.eventLog.splice(0,this.eventLog.length-160);},
  socket,
  setEnabled(value){this.enabled=!!value;this.profileCache.clear();for(const f of globalThis.SVG_FIGHTER?.fighters||[]){f._poseSimulationFrame=null;f._floorCache=null;}},
  phaseMap
 };
 INK.Runtime=Runtime;
})();
