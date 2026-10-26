/* STRIKE FEEL: contact-owned body impulses and contextual audio. No damage or
 * frame-data mutation; visual response is sampled on the actor's held clock. */
'use strict';
(() => {
 const settings={enabled:true},clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));let events=[];
 const active=()=>settings.enabled&&INK.Kinetic?.settings.enabled;
 function zone(d,m,type,point){
  if(type==='block'||type==='parry')return 'guard';if(m.height==='low')return 'leg';if(!point)return 'body';
  const p=SVG_FIGHTER.pose(d),rig=INK.Runtime.visualRig(d,p),sockets=INK.Rig.sockets(p,rig),world=q=>INK.Rig.world(p,q,{x:d.x,y:665+d.y,scale:d.renderScale||d.ch.scale||1,facing:d.dir});
  const head=world(sockets.head),hip=world(sockets.pelvis);
  return Math.hypot(point[0]-head[0],point[1]-head[1])<70?'head':point[1]>hip[1]+18?'leg':'body';
 }
 function response(f,p,r,now,motion=1){
  if(!active())return false;if(INK.GuardBody?.response(f,p,r,now,motion))return true;if(INK.HitBody?.response(f,p,r,now,motion))return true;const age=now-r.actorBirth;if(age<0||age>r.duration)return true;
  const end=clamp(1-age/r.duration),power=Math.min(1.6,r.energy)*INK.Kinetic.settings.impact*motion,sign=r.worldDir*f.dir;
  const pulse=(delay,rate,damp)=>{const t=Math.max(0,age-delay);return (age<delay?1:Math.cos(t*rate))*Math.exp(-damp*t)*end*end;};
  const fast=pulse(0,.25,.13)*power,lag=pulse(3,.22,.095)*power,weight=Math.sin(Math.PI*clamp(age/r.duration))*end*power;
  const add=(k,v)=>p[k]=(p[k]||0)+v,shift=(k,x,y)=>{if(Array.isArray(p[k]))p[k]=[p[k][0]+x,p[k][1]+y];};
  if(r.zone==='head'){
   add('head',-sign*19*fast);add('headYaw',sign*12*fast);add('lean',sign*6*lag);add('chestYaw',sign*8*lag);add('chest',-3*lag);
   shift('fw',sign*5*lag,-7*fast);shift('rw',sign*8*lag,-5*fast);
  }else if(r.zone==='leg'){
   add('pelvis',sign*11*fast);add('pelvisYaw',-sign*10*fast);add('bob',7*Math.abs(fast)+6*weight);add('chest',-5*lag);add('lean',sign*5*lag);add('head',-sign*4*lag);
   shift('fa',-16*fast,-10*Math.abs(fast));shift('ra',6*weight,0);shift('fw',-sign*8*lag,-5*lag);
  }else if(r.zone==='guard'){
   const hard=r.parry?.4:1;add('lean',sign*5*fast*hard);add('chest',-4*fast*hard);add('chestYaw',sign*7*lag*hard);shift('fw',sign*9*fast*hard,2*fast);shift('rw',sign*5*lag*hard,0);add('bob',2*Math.abs(fast));
  }else{
   add('chest',-16*fast);add('chestYaw',sign*13*fast);add('lean',sign*12*lag);add('head',-sign*8*lag);add('pelvis',-sign*4*weight);add('bob',4*Math.abs(fast)+3*weight);
   shift('fw',sign*15*fast,-2*lag);shift('rw',sign*10*lag,4*fast);
  }
  const contact=INK.ContactResponse?.active()?r.contact:null;
  if(contact){
   // Local body/step response reads the contact snapshot. No feet or root
   // positions are written back to combat, including during repeated renders.
   const turn=contact.turn*sign*contact.twist,solid=contact.quality*contact.compression;
   add('chestYaw',turn*15*fast);add('pelvisYaw',-turn*7*lag);add('headYaw',turn*5*lag);
   add('lean',sign*(solid-1)*8*fast);add('chest',-(solid-1)*7*fast);
   switch(contact.defenderStyle){
    case 'pursuit':add('lean',-sign*2*lag);shift('rw',-sign*4*lag,-3*lag);break;
    case 'alternating':add('pelvisYaw',-sign*4*lag);add('head',-2*lag);break;
    case 'boxing':add('chest',-3*fast);add('head',-3*fast);shift('rw',6*lag,-8*lag);break;
    case 'single-leg':add('pelvisYaw',sign*6*fast);add('chestYaw',-sign*4*lag);break;
    case 'fan-dance':add('chestYaw',sign*5*lag);shift('rw',-sign*9*lag,-4*lag);break;
    case 'low-claw':add('bob',4*Math.abs(fast));add('lean',-sign*3*lag);shift('rw',-3*lag,5*lag);break;
   }
   if(!r.parry&&!contact.airborne&&!contact.throwing){
    const retreat=Math.sin(Math.PI*clamp(age/r.duration))*end*power*contact.step*(r.guard?.55:1);
    const stepping=sign<0?'ra':'fa',bracing=sign<0?'fa':'ra';
    shift(stepping,sign*20*retreat,-7*retreat);shift(bracing,-sign*3*retreat,0);
    add('bob',3*retreat);add('pelvis',sign*4*retreat);
   }
  }
  return true;
 }
 // Contact snapshots are already in world coordinates. The normal supplies
 // obliqueness, not a replacement direction or an extra facing transform.
 function contactSound(context={}){
  const r=context.response,vector=(q,f)=>Array.isArray(q)&&q.length>=2&&q.slice(0,2).every(Number.isFinite)&&Math.hypot(q[0],q[1])>1e-6?q.slice(0,2).map(v=>v/Math.hypot(q[0],q[1])):f;
  const incoming=vector(context.incoming,vector(r?.responseDir,[context.direction===-1?-1:1,0])),normal=vector(r?.normalGeom||r?.normal,incoming),measured=r?.affectsPush===true;
  const quality=measured?clamp(Number.isFinite(r.quality)?r.quality:1):.85,closing=measured?clamp(Number.isFinite(r.closing)?r.closing:0,-12,12):0,alignment=Math.abs(incoming[0]*normal[0]+incoming[1]*normal[1]),oblique=1-alignment;
  const mode=oblique>.42?'slice':measured&&quality<.72?'glance':'solid',body=clamp((.45+.55*quality)*(1+closing*.018)*(1-.48*oblique),.25,1.18);
  return {measured,quality,closing,alignment,oblique,mode,body,incoming,normal};
 }
 function audio(m,type,zone,context={},x=720){
  const multi=(m.hits||1)>1&&!context.last,heavy=m.level>=3||m.super&&context.last,guard=type==='block',parry=type==='parry',armor=type==='armor',throwing=type==='throw';
  const tier=armor?'armor':parry?'parry':guard?'block':throwing?'land':m.super?(context.last?'superfinish':'superhit'):heavy?'heavy':'hit',contact=contactSound(context),style=context.response?.style||'neutral',part=context.response?.part||m.contactPart||'';
  const material={rooted:[1700,.9],pursuit:[3100,1.03],alternating:[2800,1.08],spiral:[3600,1.12],boxing:[1900,.8],'single-leg':[4100,1.18],'fan-dance':[4700,1.25],'low-claw':[1200,.78]}[style]||[2300,1];
  const f=zone==='head'?210:zone==='leg'?100:130,brightness=zone==='head'?4100:zone==='leg'?1400:2100,slice=contact.mode==='slice',glance=contact.mode==='glance',body=contact.body,tail=multi?.48:1;
  // Three layers share one bounded voice: contact transient, delayed mass,
  // material release. Intermediate hits shorten their tail instead of stacking.
  let plan;
  if(parry)plan=[['tone',context.perfect?1050:800,1500,.11,'sine',.045],['tone',1750,1200,.12,'sine',.022,.012],['noise',.025,4300,.012,.018]];
  else if(guard)plan=[['noise',.025,2500,.04],['tone',430,210,.055,'triangle',.04*body,.009],['noise',.045*tail,material[0],.014,.025]];
  else if(armor)plan=[['noise',.022,1600,.04],['tone',105,57,.085,'triangle',.065*body,.006],['noise',.04*tail,1100,.015,.025]];
  else if(throwing)plan=[['noise',.035,1050,.06],['tone',80,28,.20,'sine',.12,.008],['noise',.08,800,.025,.04]];
  else plan=[['noise',slice?.045:glance?.021:.028,brightness*(slice?1.25:1),glance?.034:.05],['tone',f*material[1]*(heavy?.8:1),zone==='head'?60:32, multi?.06:heavy?.15:.10,zone==='head'?'triangle':'sine',(.06+(heavy?.025:0))*body,zone==='head'?.006:zone==='leg'?.016:.011],['noise',(slice?.075:.045)*tail,material[0],(slice?.025:.014)*(glance?.75:1),multi?.018:.028]];
  return {type:tier,strength:(multi?.64:heavy?1.1:.85)*(context.punish?1.15:context.counter?1.07:1),pan:clamp((x-720)/900,-.65,.65),plan,zone,multi,style,part,contact};
 }

 function commit(G,a,d,m,type,damage,context,play){if(!active()||!['hit','block','parry','throw','armor'].includes(type))return;context=context||{};const z=d._inkReaction?.zone||zone(d,m,type,context.point),x=context.point?.[0]??d.x,q=audio(m,type,z,context,x);play(q.type,q.strength,q);
  events.push({tick:G.tick,actorTick:d._inkVisualClock||0,zone:z,type,contact:q.contact,tier:q.type,pan:q.pan,multi:q.multi,style:q.style,part:q.part,damage,move:m.id});if(events.length>32)events.shift();
 }
 INK.StrikeFeel={settings,active,zone,response,contactSound,audio,commit,clear:()=>{events=[];},inspect:()=>events.map(e=>({...e}))};
})();
