/* State animation assets. Simulation, not rendering, advances transition ages.
 * Walking is phase-locked to the movement cycle; jumps to vertical velocity.
 * Coupled throws keep the existing two-character grip and release constraints.
 */
'use strict';
(()=>{
 const {clamp}=INK;
 function id(f){if(f.state==='throwing'||f.state==='captured')return null;if(['tumble','down','ko','rise','win'].includes(f.state))return f.state;if(['hit','stun'].includes(f.state))return f.hitHeight==='low'?'hit-low':'hit-high';if(f.state==='block')return f.crouch?'block-low':'block-high';if(f.attack)return null;if(f.state==='rush')return'drive-rush';if(['dash','parry','stance'].includes(f.state))return f.state;if(f.jumpPre>0)return null;if(f.y<0)return'jump';if(f.landT>0)return'land';if(f.crouch)return'crouch';if(Math.abs(f.move||0)>.05)return(f.move*f.dir<0)?'walk-back':'walk-forward';return null;}
 function frame(f,r,key){const d=r.clip.duration,age=f._inkState?.id===key?f._inkState.age:0;if(key.startsWith('walk'))return(((f.walkT||0)/(Math.PI*2)%1)+1)%1*d;if(key==='jump')return clamp(((f.vy||0)+14)/28)*d;if(key==='land')return clamp(1-f.landT/Math.max(1,f.landMax||6))*d;if(['parry','stance'].includes(key))return age%d;if(['hit-high','hit-low','block-high','block-low','rise','win','down','ko','tumble'].includes(key))return Math.min(f.stateAge||0,d);return Math.min(age,d);}
 const State={id,frame,
  tick(f,tick){const key=id(f),old=f._inkState;if(!old||old.id!==key)f._inkState={id:key,age:0};else f._inkState.age++;},
  context(f){if(!INK.Runtime.enabled||!INK.Runtime.store)return null;const key=id(f);if(!key)return null;const r=INK.Runtime.store.byGame(f.ch.id,'@'+key);return r?{record:r,frame:frame(f,r,key)}:null;},
  sample(f,base){const ctx=this.context(f);if(!ctx)return null;let p=INK.Runtime.store.clip(ctx.record).sample(ctx.frame,base);if(ctx.record.gameId==='@jump'){const weight=f.vy<0?clamp(-f.y/110):clamp(-f.y/65);p=INK.blend(base,p,weight);}return p;},
  throwContext(f){const a=f.throwAction;if(!INK.Runtime.enabled||!INK.Runtime.store||!a||a.owner!==f)return null;const r=INK.Runtime.store.byGame(f.ch.id,a.back?'@throw-back-sequence':'@throw-forward-sequence');if(!r)return null;const b=r.binding,t=INK.Runtime.phaseMap(a.t,[0,18,a.release+5,a.duration],[0,b.startup,b.startup+b.active,r.clip.duration]);return{record:r,frame:t};},
  throwPose(f,base){const ctx=this.throwContext(f);return ctx?INK.Runtime.store.clip(ctx.record).sample(ctx.frame,base):null;},
  contextForFX(f){if(f.attack){const r=INK.Runtime.record(f,f.attack.m);return r?{record:r,frame:INK.Runtime.clipFrame(r,f.attack.m,f.attack.t)}:null;}return this.throwContext(f)||this.context(f);}
 };INK.State=State;
})();
