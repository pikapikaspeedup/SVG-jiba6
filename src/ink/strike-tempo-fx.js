/* Held heavy attacks: simulation owns time; this layer only scores the body. */
'use strict';
(() => {
 const settings={enabled:true},clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
 const profiles=Object.freeze({ryu:'root',ken:'drive',chun:'fold',cammy:'coil',luke:'shell',juri:'pivot',mai:'arc',iori:'stalk'});
 const active=()=>settings.enabled&&INK.Kinetic?.settings.enabled;
 function phase(f){
  const a=f.attack,q=a?.tempo;
  if(f.state==='attack'&&q){const gate=a.m.startup-3,entry=smooth((a.t-gate+2)/2),depth=smooth((q.age||0)/12),release=q.phase==='released'?1-smooth((a.t-gate)/3):1;
   return {kind:'load',weight:entry*release,depth,kick:a.m.id==='sHK',age:q.age||0};}
  const v=f._inkTempo;if(f.state==='recovery'&&v?.phase==='feint'){const age=clamp(v.age||0,0,12);return {kind:'feint',weight:smooth(age/2)*(1-smooth((age-3)/9)),depth:1,kick:v.move==='sHK',age};}
  return null;
 }
 function pose(f,source){
  if(!active())return source;const q=phase(f);if(!q||q.weight<=0)return source;
  const p=INK.copy(source),w=q.weight*(INK.Kinetic.settings.motion??1),d=q.depth,style=profiles[f.ch.id]||'root';
  const add=(k,v)=>p[k]=(p[k]||0)+v*w;
  const shift=(k,x,y)=>{if(Array.isArray(p[k]))p[k]=[p[k][0]+x*w,p[k][1]+y*w];};
  if(q.kind==='feint'){
   // Capture carries the old loaded pose. This bounded return arc grows from zero,
   // then resolves to the ordinary idle pose without retaining a second snapshot.
   shift('fw',-16,-8);shift('fe',-8,5);shift('rw',3,-8);add('chestYaw',-7);add('pelvisYaw',4);add('bob',3);
   if(q.kick)shift('fk',-9,4);add('head',-2);
  }else{
   // Monotone progress, no oscillator: hips settle first and shoulders wind later.
   const hips=.35+.65*d,shoulders=.25+.75*smooth((d-.15)/.85);
   add('bob',5+9*hips);add('pelvis',-4*hips);add('pelvisYaw',-9*hips);add('chestYaw',13*shoulders);add('lean',-3*shoulders);
   shift('rk',-9*hips,-3*hips);shift('fk',q.kick?-13*hips:6*hips,q.kick?-12*hips:2*hips);
   // The striking endpoint remains authored; only the rear protection hand moves.
   shift('rw',-4,-8*shoulders);shift('re',-6*shoulders,2*hips);
   switch(style){
    case 'root':add('pelvis',-5*hips);shift('rk',-9*hips,4*hips);add('head',3*shoulders);break;
    case 'drive':add('lean',8*hips);add('chestYaw',-8*hips);shift('re',12*shoulders,-9*shoulders);break;
    case 'fold':add('pelvisYaw',14*hips);add('chestYaw',-19*shoulders);shift('fk',-11*hips,-9*hips);shift('re',-13*shoulders,-8*shoulders);break;
    case 'coil':add('turn',-.075*hips);add('pelvisYaw',-14*hips);add('chestYaw',9*shoulders);shift('rk',15*hips,-7*hips);break;
    case 'shell':add('head',-7*shoulders);add('chest',-7*shoulders);shift('rw',12,-12*shoulders);shift('re',14*shoulders,9*hips);break;
    case 'pivot':add('pelvisYaw',23*hips);add('chestYaw',-27*shoulders);shift('fk',-20*hips,-18*hips);add('lean',5*shoulders);break;
    case 'arc':add('turn',.085*hips);add('chestYaw',-17*shoulders);shift('re',-21*shoulders,-15*shoulders);shift('rw',-8,-4*shoulders);break;
    case 'stalk':add('bob',8*hips);add('lean',10*shoulders);add('chest',-6*shoulders);shift('re',-12*shoulders,15*hips);shift('rk',-8*hips,5*hips);break;
   }
  }
  return INK.Articulation.inherit(source,p);
 }
 INK.StrikeTempoFX={settings,profiles,active,phase,pose};
})();
