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
  if(!active())return false;const age=now-r.actorBirth;if(age<0||age>r.duration)return true;
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
   if(!r.parry){
    const retreat=Math.sin(Math.PI*clamp(age/r.duration))*end*power*contact.step*(r.guard?.55:1);
    const stepping=sign<0?'ra':'fa',bracing=sign<0?'fa':'ra';
    shift(stepping,sign*20*retreat,-7*retreat);shift(bracing,-sign*3*retreat,0);
    add('bob',3*retreat);add('pelvis',sign*4*retreat);
   }
  }
  return true;
 }
 function audio(m,type,zone,context={},x=720){
  const multi=(m.hits||1)>1&&!context.last,heavy=m.level>=3||m.super&&context.last,guard=type==='block',parry=type==='parry',throwing=type==='throw';
  const tier=parry?'parry':guard?'block':throwing?'land':m.super?(context.last?'superfinish':'superhit'):heavy?'heavy':'hit';
  const f=zone==='head'?230:zone==='leg'?110:145,level=multi?.64:heavy?1.1:.85;
  let plan=parry?[['tone',context.perfect?1050:800,1500,.13,'sine',.045],['tone',1750,1200,.16,'sine',.022,.012]]:guard?[['noise',.045,1900,.042],['tone',430,210,.065,'triangle',.052]]:throwing?[['tone',80,28,.23,'sine',.13],['noise',.13,1050,.07]]:[['tone',heavy?f*.7:f,heavy?35:55,heavy?.18:.095,zone==='head'?'triangle':'sine',heavy?.12:.085],['noise',heavy?.095:.055,zone==='head'?4200:zone==='leg'?1500:2300,heavy?.08:.055]];
  if(!guard&&!parry&&!throwing&&heavy)plan.push(['tone',f*1.8,f*.8,.07,'triangle',.025,.008]);
  if(!guard&&!parry&&m.category!=='normal'&&!multi)plan.push(['noise',.08,3200,.018,.012]);
  return {type:tier,strength:level*(context.punish?1.15:context.counter?1.07:1),pan:clamp((x-720)/900,-.65,.65),plan,zone,multi};
 }
 function commit(G,a,d,m,type,damage,context,play){if(!active())return;context=context||{};const z=d._inkReaction?.zone||zone(d,m,type,context.point),x=context.point?.[0]??d.x,q=audio(m,type,z,context,x);play(q.type,q.strength,q);
  events.push({tick:G.tick,actorTick:d._inkVisualClock||0,zone:z,type,tier:q.type,pan:q.pan,multi:q.multi,damage,move:m.id});if(events.length>32)events.shift();
 }
 INK.StrikeFeel={settings,active,zone,response,audio,commit,clear:()=>{events=[];},inspect:()=>events.map(e=>({...e}))};
})();
