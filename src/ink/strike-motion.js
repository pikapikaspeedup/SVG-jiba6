/* One visual body score for every authored strike window. No combat writes. */
'use strict';
(() => {
 const settings={enabled:true},clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
 const profiles=Object.freeze({ryu:{path:'root',lag:.17},ken:{path:'drive',lag:.12},chun:{path:'alternate',lag:.2},cammy:{path:'spiral',lag:.14},luke:{path:'box',lag:.1},juri:{path:'pivot',lag:.24},mai:{path:'arc',lag:.22},iori:{path:'claw',lag:.15}});
 const active=()=>settings.enabled&&INK.Kinetic?.settings.enabled&&INK.Runtime?.enabled;
 function phase(f,t=f.attack?.t||0){
  const m=f.attack?.m;if(!m||m.throw||!(m.damage>0)||!Number.isFinite(t))return null;
  const startup=Math.max(1,m.startup),duration=Math.max(1,m.active),hits=Math.max(1,Math.floor(m.hits||1)),width=duration/hits,end=startup+duration;
  const profile=profiles[f.ch.id]||profiles.ryu,power=clamp((m.level||2)/3,.3,1),fade=t<=end?1:1-smooth((t-end)/3),entry=smooth(t/Math.min(startup,2));
  const sample=lag=>{let load=0,release=0,signedLoad=0,signedRelease=0;for(let i=0;i<hits;i++){
   // Melee chooses floor((t-startup)/(active/hits)) on integer ticks:
   // ceil(i*width) is the first eligible contact tick for each hit window.
   const hit=startup+Math.ceil(i*width),lead=Math.min(2,width*.28),tail=Math.min(6,Math.max(1.25,width*.55));
   const span=i?Math.min(width*.65,5):startup*(.42+.42*power),offset=lag*Math.min(3,width),local=t-offset;
   const loadEnd=hit-lead,u=(local-(loadEnd-span))/Math.max(.1,span);
   const loading=u>0&&u<1?Math.sin(Math.PI*u)**2:0;let releasing=0;
   // Torso force peaks AT the contact opportunity, not halfway through active.
   // A long single active window holds collision eligibility, not a slow windup.
   if(local>=hit-lead&&local<=hit)releasing=smooth((local-hit+lead)/Math.max(.01,lead));
   else if(local>hit&&local<hit+tail)releasing=1-smooth((local-hit)/tail);
   const sign=i%2?-1:1;load+=loading;release+=releasing;signedLoad+=sign*loading;signedRelease+=sign*releasing;

  }return {load:clamp(load),release:clamp(release),signedLoad:clamp(signedLoad,-1,1),signedRelease:clamp(signedRelease,-1,1)};};
  return {hip:sample(-profile.lag),chest:sample(0),off:sample(profile.lag),power,fade:fade*entry,index:Math.max(0,Math.min(hits-1,Math.floor((t-startup)/width))),hits,width,end,path:profile.path};
 }
 function pose(f,source){if(!active()||['captured','throwing','down','ko'].includes(f.state))return source;const q=phase(f);if(!q||q.fade<=0)return source;
  const p=INK.copy(source),gain=q.power*q.fade*(INK.Kinetic.settings.motion??1),h=q.hip.release-q.hip.load,c=q.chest.release-q.chest.load,o=q.off.release-q.off.load,kick=f.attack.m.contactPart==='foot'||f.attack.m.pose==='kick';
  const add=(key,value)=>p[key]=(p[key]||0)+value*gain;
  // Elbow guide only: authored wrists and ankles remain byte-for-byte intact.
  const elbow=(x,y)=>{if(Array.isArray(p.re))p.re=[p.re[0]+x*gain,p.re[1]+y*gain];};
  add('pelvisYaw',-5*h);add('chestYaw',8*c);add('lean',2*c);add('bob',f.y<0?0:2*q.hip.load);add('head',-c);
  switch(q.path){
   case 'root':add('pelvis',-3*q.hip.load+2*q.hip.release);elbow(-5*o,-2*q.off.release);break;
   case 'drive':add('lean',4*q.hip.release-2*q.chest.load);add('chest',-2*q.off.load);elbow(5*q.off.release,-6*q.off.release);break;
   case 'alternate':{const signed=v=>v.signedRelease-v.signedLoad;add('pelvisYaw',5*signed(q.hip));add('chestYaw',-4*signed(q.chest));add('open',.06*q.chest.release);elbow(6*signed(q.off),-4*q.off.load);break;}
   case 'spiral':add('turn',.045*h);add('chestYaw',6*c);add('pelvisYaw',-7*h);elbow(-7*q.off.load,5*o);break;
   case 'box':add('headYaw',-5*o);add('chest',-3*q.chest.load);add('lean',3*q.hip.release);elbow(8*q.off.release,-8*q.off.release);break;
   case 'pivot':add('pelvisYaw',(kick?10:4)*h);add('chestYaw',(kick?-13:-5)*c);add('head',3*q.off.release);elbow(-9*q.off.release,-5*o);break;
   case 'arc':add('turn',.06*c);add('open',.09*q.off.release);add('chestYaw',4*h);elbow(-8*o,-8*Math.sin(Math.PI*clamp(q.off.release)));break;
   case 'claw':add('bob',f.y<0?0:4*q.hip.load-2*q.chest.release);add('lean',5*c);add('chestYaw',-15*c);elbow(-7*q.off.load,6*q.off.release);break;
  }
  return INK.Articulation.inherit(source,p);
 }
 INK.StrikeMotion={settings,profiles,active,phase,pose};
})();
