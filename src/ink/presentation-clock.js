/* FLOW 08 — simulation-owned presentation history.
 * A rendered subframe is a pure view of two completed simulation states. Walking,
 * jump velocity, landing phase, state clips and projectiles use the SAME alpha.
 * No render mutates a fighter, projectile, RNG, input buffer or combat clock.
 */
'use strict';
(() => {
 const {clamp}=INK;
 const settings={interpolate:true,stateBlends:true,landingResponse:true};
 const scalar=['y','vy','walkT','landT','stateAge','jumpPre','_inkVisualClock'];
 function key(f){return f.attack?'attack:'+f.attack.m.id:INK.State.id(f)||'idle';}
 function snapshot(f){
  const s={...f};s.attack=f.attack?{...f.attack}:null;s._inkState=f._inkState?{...f._inkState}:null;
  s._inkHistory=null;s._inkPrevView=null;
  return s;
 }
 const Clock={version:'9.0.0',settings,
  bindControl(G,actors){let paused=!!G.paused;Object.defineProperty(G,'paused',{enumerable:true,configurable:false,get(){return paused;},set(value){const next=!!value;if(next&&!paused)for(const f of actors())f._inkHoldAction=G.actionTick;paused=next;}});},
  boundary(G,fighters,active=true){const key=G.screen+'|'+!!G.paused+'|'+!!active;if(this.boundaryKey!==key){this.boundaryKey=key;for(const f of fighters)f._inkHoldAction=G.actionTick;}},
  stats:{steps:0,views:0,projectileViews:0},key,snapshot,
  begin(G,fighters){
   this.stats.steps++;
   for(const f of fighters){f._inkPrevView=snapshot(f);f._inkHistory={key:key(f),dir:f.dir,attack:f.attack};f._inkVisualClock=(f._inkVisualClock||0)+1;}
  },
  finish(fighters){for(const f of fighters){const previous=f._inkPrevView;if(!previous)continue;f._inkPoseVelocity=Object.fromEntries(['x',...scalar].filter(k=>Number.isFinite(f[k])&&Number.isFinite(previous[k])).map(k=>[k,f[k]-previous[k]]));}},
  previous(f,dt=.25){const v=Object.create(f),velocity=f._inkPoseVelocity||{};for(const k of ['x','y','vy','walkT','landT'])if(Number.isFinite(f[k]))v[k]=f[k]-(velocity[k]||0)*dt;v.landT=Math.max(0,v.landT||0);v.stateAge=Math.max(0,(f.stateAge||0)-dt);v._inkVisualClock=Math.max(0,(f._inkVisualClock||0)-dt);if(f.attack)v.attack={...f.attack,t:Math.max(0,f.attack.t-dt)};if(f._inkState)v._inkState={...f._inkState,age:Math.max(0,f._inkState.age-dt)};return v;},
  beginProjectiles(G){for(const s of G.shots||[])s._inkPrevious={x:s.x,y:s.y,age:s.age||0,dir:s.dir};},
  view(f,alpha,hold=false){
   if(!Number.isFinite(alpha))throw TypeError('Finite presentation fraction required');
   alpha=clamp(alpha);const prev=f._inkPrevView,h=f._inkHistory;
   if(hold||!settings.interpolate||alpha===1||!prev||!h||h.key!==key(f)||h.dir!==f.dir||h.attack!==f.attack)return f;
   const v=Object.create(f);
   for(const k of scalar){const a=prev[k],b=f[k];if(Number.isFinite(a)&&Number.isFinite(b))v[k]=a+(b-a)*alpha;}
   if(f.attack)v.attack={...f.attack,t:prev.attack.t+(f.attack.t-prev.attack.t)*alpha};
   if(f._inkState&&prev._inkState?.id===f._inkState.id)v._inkState={...f._inkState,age:prev._inkState.age+(f._inkState.age-prev._inkState.age)*alpha};
   // Coupled throws keep their existing grip solver. Interpolating one body in
   // isolation would violate that constraint; the production throw path owns it.
   if(f.throwAction)return f;
   this.stats.views++;return v;
  },
  projectiles(G,alpha=1){
   const frozen=G.paused||G.hitstop>0||G._inkStepFrozen||INK.VFX?.frozen;
   for(const s of G.shots||[]){
    const prev=s._inkPrevious,u=frozen||!settings.interpolate||!prev||prev.dir!==s.dir?1:clamp(alpha);
    const x=prev?prev.x+(s.x-prev.x)*u:s.x,y=prev?prev.y+(s.y-prev.y)*u:s.y,age=prev?prev.age+((s.age||0)-prev.age)*u:s.age||0;
    INK.SVG.assign(s.node,'transform',`translate(${x.toFixed(3)} ${y.toFixed(3)}) scale(${s.dir} 1)`);
    if(s.spin)INK.SVG.assign(s.spin,'transform',s.spinKind==='energy'?`rotate(${age*10})`:`rotate(${age*27}) translate(-47 0)`);
    INK.ProjectileFlow?.renderShot(s,x,y,age);
    this.stats.projectileViews++;
   }
  },
  set(values){if(!values||typeof values!=='object'||Array.isArray(values))throw TypeError('Presentation settings object required');for(const [k,v]of Object.entries(values)){if(!(k in settings)||typeof v!=='boolean')throw TypeError('Invalid presentation setting: '+k);}Object.assign(settings,values);return{...settings};},
  reset(f){INK.HitBody?.reset(f);INK.FacingMotion?.reset(f);f._inkFrameTransition=null;f.intentDir=f.dir;f._inkVisualClock=0;f._inkPoseVelocity=null;f._inkHistory=null;f._inkPrevView=null;f._inkLanding=null;f._inkStateVisualBlend=null;}
 };
 INK.Presentation=Clock;
})();
