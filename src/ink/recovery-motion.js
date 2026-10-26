/* Result-aware recovery presentation. Simulation and attack targets stay owned
 * by combat. No caches, clocks, roots, random numbers or persistent writes. */
'use strict';
(()=>{
 const settings={enabled:true,amount:1},clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
 const profiles=Object.freeze({ryu:'rooted',ken:'pursuit',chun:'alternating',cammy:'spiral',luke:'boxing',juri:'single-leg',mai:'fan-dance',iori:'low-claw'});
 const active=()=>settings.enabled&&!!INK.Kinetic?.settings.enabled;
 function inspect(f){
  const a=f?.attack,m=a?.m;if(!active()||!m||!profiles[f.ch?.id]||m.throw||m.super||m.air||m.launch||f.captured||f.airLock||f.y<-.01||['captured','throwing','tumble','down','ko'].includes(f.state)||String(m.kind||'').includes('projectile')||['upper','dive','install','stance'].includes(m.kind))return null;
  const start=m.startup+m.active,duration=m.recovery,t=a.t-start;
  if(!Number.isFinite(t)||!Number.isFinite(duration)||duration<=0||t<=0||t>=duration)return null;
  const u=clamp(t/duration),kind=a.contactResult==='block'?'block':a.contactResult==='hit'||a.hitConfirmed?'hit':'whiff';
  // Squared sine supplies zero position and velocity at both ends. Hit returns
  // to guard sooner; block has a recoil followed by a smaller counter motion.
  const window=kind==='hit'?.72:1,v=clamp(u/window),weight=Math.sin(Math.PI*v)**2*(kind==='hit'?.72:kind==='block'?.92:1);
  const counter=kind==='block'?Math.cos(Math.PI*u*.95):kind==='whiff'?1-.65*u:1;
  return {style:profiles[f.ch.id],kind,progress:u,weight,counter,power:clamp((m.level||1)/3,.35,1),kick:m.contactPart==='foot'||m.pose==='kick'};
 }
 function pose(f,source){
  const q=inspect(f);if(!q||q.weight<1e-9)return source;
  const p=INK.copy(source),w=q.weight*q.power*clamp(settings.amount,0,1.5),rebound=q.kind==='block'?-q.counter:q.kind==='whiff'?.8*q.counter:-.35,add=(k,v)=>p[k]=(p[k]||0)+v*w,hand=(x,y)=>{if(Array.isArray(p.rw))p.rw=[p.rw[0]+x*w,p.rw[1]+y*w];};
  // Only torso/head and the non-striking rear guard hand. Front limb targets,
  // feet, bone lengths, timing, facing and physical root are never changed.
  switch(q.style){
   case 'rooted':add('lean',2.5*rebound);add('chestYaw',-3*q.counter);add('pelvisYaw',1.5*q.counter);add('bob',1.8);hand(3,-4);break;
   case 'pursuit':add('lean',5*rebound);add('chestYaw',-5*q.counter);add('pelvisYaw',2*q.counter);hand(q.kind==='whiff'?-4:5,-4);break;
   case 'alternating':add('chestYaw',q.kick?4:-3);add('pelvisYaw',q.kick?-4:2);add('head',-1.5);hand(2,-5);break;
   case 'spiral':add('lean',3*rebound);add('chestYaw',-6*q.counter);add('pelvisYaw',4*q.counter);add('head',-2*q.counter);hand(4,-5);break;
   case 'boxing':add('lean',2*rebound);add('chestYaw',-4*q.counter);add('head',-2);hand(8,-8);break;
   case 'single-leg':add('chestYaw',q.kick?5:-4);add('pelvisYaw',q.kick?-5:3);add('head',2*q.counter);hand(-4,-3);break;
   case 'fan-dance':add('chestYaw',-7*q.counter);add('pelvisYaw',4*q.counter);add('lean',2*rebound);hand(-7,-5);break;
   case 'low-claw':add('bob',3);add('lean',4*rebound);add('chestYaw',5*q.counter);add('pelvisYaw',-3*q.counter);hand(-6,3);break;
  }
  if(q.kind==='block'){add('chest',-2*q.counter);add('head',1.5*q.counter);}return INK.Articulation.inherit(source,p);
 }
 INK.RecoveryMotion={settings,profiles,active,inspect,pose};
})();
