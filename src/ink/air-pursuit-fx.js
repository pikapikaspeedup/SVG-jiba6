/* Air pursuit presentation reads a simulation-owned phase/age snapshot.
 * No targeting, root displacement, flight integration or phase progression. */
'use strict';
(()=>{
 const settings={enabled:true,amount:1},clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
 const profiles=Object.freeze({ryu:'rooted',ken:'pursuit',chun:'alternating',cammy:'spiral',luke:'boxing',juri:'single-leg',mai:'fan-dance',iori:'low-claw'});
 const active=()=>settings.enabled&&!!INK.Kinetic?.settings.enabled;
 function inspect(f){
  const q=f?._inkPursuit;if(!active()||!q||q.spent!==true||!profiles[f.ch?.id]||f.captured||['hit','block','stun','captured','throwing','down','tumble','ko','win'].includes(f.state)||f.attack?.m.throw||f.attack?.m.super)return null;
  if(!['windup','flight','landing'].includes(q.phase)||!Number.isFinite(q.age)||q.age<0)return null;
  const duration=q.phase==='windup'?4:Number.isFinite(q.duration)&&q.duration>0?q.duration:q.phase==='landing'?10:24,u=clamp(q.age/duration);
  // Windup settles into launch; flight keeps a bounded mid-air silhouette.
  // Flight begins/end at zero so phase transitions do not add abrupt offsets.
  const weight=Math.sin(Math.PI*u)**2;
  return {phase:q.phase,progress:u,weight,style:profiles[f.ch.id],facing:q.dir===-1?-1:1};
 }
 function pose(f,source){
  const q=inspect(f);if(!q||q.weight<1e-9)return source;
  const p=INK.copy(source),w=q.weight*clamp(settings.amount,0,1.5),add=(k,v)=>p[k]=(p[k]||0)+v*w,hand=(x,y)=>{if(Array.isArray(p.rw))p.rw=[p.rw[0]+x*w,p.rw[1]+y*w];};
  if(q.phase==='windup'){
   add('bob',q.style==='low-claw'?9:q.style==='boxing'?6:7);add('pelvis',-4);add('chestYaw',-4);add('lean',-2);hand(-4,-3);
   if(q.style==='single-leg'||q.style==='alternating'){add('pelvisYaw',4);add('chestYaw',3);}
  }else if(q.phase==='flight'){
   switch(q.style){
    case 'rooted':add('lean',3);add('chestYaw',5);add('pelvisYaw',-3);hand(3,-5);break;
    case 'pursuit':add('lean',7);add('chestYaw',8);add('pelvisYaw',-4);hand(-6,-3);break;
    case 'alternating':add('chestYaw',-6);add('pelvisYaw',7);add('head',2);hand(-7,-6);break;
    case 'spiral':add('lean',5);add('chestYaw',10);add('pelvisYaw',-8);add('head',-2);hand(-8,-5);break;
    case 'boxing':add('lean',4);add('chestYaw',5);add('head',-3);hand(7,-9);break;
    case 'single-leg':add('lean',-2);add('chestYaw',-8);add('pelvisYaw',9);add('head',3);hand(-10,-3);break;
    case 'fan-dance':add('lean',3);add('chestYaw',11);add('pelvisYaw',-6);hand(-11,-7);break;
    case 'low-claw':add('lean',7);add('chestYaw',-8);add('pelvisYaw',5);add('head',-3);hand(-8,4);break;
   }
  }else{add('bob',q.style==='low-claw'?5:3);add('lean',-2);add('chestYaw',-3);hand(3,-4);}
  return INK.Articulation.inherit(source,p);
 }
 INK.AirPursuitFX={settings,profiles,active,inspect,pose};
})();
