/* KINETIC generation: one committed contact drives body response, material FX
 * and local screen composition. Sampling never advances simulation or RNG. */
'use strict';
(() => {
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
 const settings={enabled:true,motion:1,impact:1};
 let events=[],serial=0,layer=null,slots=[],trails=new Map(),trailNodes=[];
 const envelope=(t,d)=>t<0||t>d?0:Math.exp(-5*t/d)*(1+5*t/d)*(1-t/d);
 const strength=m=>clamp((m?.level||1)*.25+(m?.super?.55:0)+(m?.od?.2:0),.3,1.5);
 const contactArt={
  ki:'M-38 0Q-18-28 12-18L42 0 12 18Q-18 28-38 0M-18 0L25 0',
  heat:'M-35 16L-21-8-23-31 2-15 17-39 20-9 42 4 14 12-1 30-9 12Z',
  silk:'M-42 12Q-8-38 37-12Q6-20-25 15Q5 34 42 8Q13 48-42 12Z',
  air:'M-43 4Q-19-40 26-21Q52-5 26 22Q-1 43-32 19Q5 25 25 5Q17-18-11-14Z',
  shock:'M-40-12L-9-12 4-31 9-9 42-4 14 6 8 29-6 11-40 12Z',
  violet:'M-44 22Q-8-41 36-31L20-7 45 7Q2 0-28 29L-7 8Z',
  ember:'M-38 18L-25-28Q0-48 30-20L43 11 5 3-4 31-12 4Z',
  'dark-flame':'M-38 27Q-8-19 30-32L12-5-19 30ZM-15 33Q9-8 42-15L27 7 4 33ZM-45 6Q-13-37 13-38L-7-10Z'
 };
 function visibleContacts(G,alpha=1){
  const time=G.paused||G.hitstop||INK.VFX.frozen?INK.VFX.time:INK.VFX.time-1+clamp(alpha),counts=new Map();
  // Keep the latest readable contact for each body, with one fading echo.
  // This is a composition budget, not a change to events or particle density.
  return events.filter(e=>time>=e.birth&&time<e.birth+e.life).reverse().filter(e=>{const key=e.type==='landing'?'ground'+e.defender:e.defender,n=counts.get(key)||0;counts.set(key,n+1);return n<2;}).reverse();
 }
 function contact(G,a,d,m,type,damage,context=null){
  if(!settings.enabled||!['hit','block','parry','throw'].includes(type))return;
  const point=context?.point,dir=context?.direction??a.dir,guard=type==='block'||type==='parry',multi=(m.hits||1)>1&&!context?.last,energy=strength(m)*(guard?.48:1)*(multi?.6:1)*(context?.punish?1.25:context?.counter?1.12:1),birth=INK.VFX.time;
  const zone=guard?'guard':context?.response?.zone||(INK.StrikeFeel?.active()?INK.StrikeFeel.zone(d,m,type,point):(point?.[1]??665+d.y-250)<665+d.y-295?'head':m.height==='low'||(point?.[1]??0)>665+d.y-165?'leg':'body');
  const e={contact:context?.response||null,zone,id:++serial,birth,life:guard?13:m.super?27:21,type,energy,attacker:a.index,defender:d.index,dir,x:point?.[0]??d.x-a.dir*27,y:point?.[1]??665+d.y-(m.height==='low'?95:d.crouch?190:270),color:type==='parry'?'#d4b9ff':guard?'#9edfff':a.ch.color,move:m.id,super:!!m.super,damage,finish:!!context?.last,counter:!!context?.counter,punish:!!context?.punish};
  events.push(e);if(events.length>32)events.shift();
  // Recoil is local to the evaluated body. Root motion remains combat-owned.
  const previous=d._inkReaction,residual=previous?envelope((d._inkVisualClock||0)-previous.actorBirth,previous.duration)*previous.energy*.3:0;
  d._inkReaction={birth,actorBirth:d._inkVisualClock||0,energy:Math.min(1.8,energy+residual),worldDir:dir,contact:context?.response||null,zone,height:m.height,guard,parry:type==='parry',duration:guard?13:23};
  a._inkRecoil={birth,actorBirth:a._inkVisualClock||0,energy:energy*(guard?.8:.35),duration:12};
 }
 function land(f,speed){
  if(!settings.enabled)return;
  const energy=clamp(speed/14,.15,1.5),heavy=['down','ko'].includes(f.state);
  f._inkWeight={actorBirth:f._inkVisualClock||0,energy,duration:heavy?23:16,heavy};
  if(speed<5)return;
  events.push({id:++serial,birth:INK.VFX.time,life:heavy?24:18,type:'landing',zone:'ground',energy,attacker:f.index,defender:f.index,dir:f.dir,x:f.x,y:665,color:f.ch.color});if(events.length>32)events.shift();
 }
 function pose(f,source){
  if(!settings.enabled||!INK.Runtime.enabled)return source;
  const p=INK.copy(source),m=f.attack?.m,t=f.attack?.t||0,motion=settings.motion;
  const add=(k,v)=>{p[k]=(p[k]||0)+v*motion;};
  const shift=(k,x,y)=>{if(Array.isArray(p[k]))p[k]=[p[k][0]+x*motion,p[k][1]+y*motion];};
  // Authored clips retain contact timing. Loading peaks before startup ends;
  // the extension phase opens shoulders, then weight settles into recovery.
  if(m&&!m.throw&&!['captured','throwing'].includes(f.state)){
   const s=Math.max(1,m.startup),end=s+m.active,recovery=Math.max(1,m.recovery),power=strength(m);
   const load=t<s?Math.sin(Math.PI*clamp(t/s))**2:0;
   const release=t>=s?envelope(t-s,Math.min(m.active+8,18)):0;
   const settle=t>end?Math.sin(Math.PI*clamp((t-end)/recovery))*Math.exp(-2*(t-end)/recovery):0;
   const kick=m.contactPart==='foot'||m.pose==='kick',air=f.y<-2;
   add('lean',power*(-5.5*load+3.5*release-2*settle));add('chestYaw',power*(-9*load+12*release));add('pelvisYaw',power*(5*load-6*release));
   add('bob',air?0:power*(3.5*load+2*settle));add('head',power*(2*load-2*release));
   shift('rw',-8*load*power,4*load*power);if(!kick)shift('fw',-18*load*power,6*load*power);
   else {add('chest',-4*release*power);shift('rw',-12*release*power,-5*release*power);}
  }
  const now=f._inkVisualClock||0,r=f._inkReaction,recoil=f._inkRecoil,weight=f._inkWeight;
  if(r&&!['down','ko','captured','throwing'].includes(f.state)&&!INK.StrikeFeel?.response(f,p,r,now,motion)){
   const age=now-r.actorBirth,w=envelope(age,r.duration)*r.energy*settings.impact,sign=r.worldDir*f.dir;
   // The first held contact pose already contains compression; after hitstop,
   // a short opposing overshoot resolves into the authored recovery pose.
   const spring=age<0?0:Math.sin(age*.5)*Math.exp(-age*.2)*r.energy;
   const response={head:[9,14,3,1],body:[13,5,13,3],leg:[5,2,4,6],guard:[4,2,3,1.5]}[r.zone];
   add('lean',sign*response[0]*w-sign*spring*2);add('head',-sign*response[1]*w);
   add('chest',-response[2]*w);add('chestYaw',sign*7*w);add('bob',response[3]*w);if(r.zone==='leg')add('pelvis',sign*7*w);
   shift('fw',sign*(r.guard?5:12)*w,-3*w);shift('rw',sign*6*w,2*w);
  }
  if(recoil&&f.attack){const w=envelope(now-recoil.actorBirth,recoil.duration)*recoil.energy*settings.impact;add('lean',-3*w);shift('fw',-8*w,1*w);}
  if(weight&&!weight.heavy&&f.y===0){
   const age=now-weight.actorBirth,compression=Math.max(0,Math.sin(Math.PI*clamp(age/weight.duration)))*Math.exp(-2*age/weight.duration)*weight.energy;
   add('bob',9*compression);add('pelvis',-4*compression);add('lean',3*compression);shift('rw',0,-7*compression);shift('fw',0,-7*compression);
  }
  return INK.Articulation.inherit(source,p);
 }
 function advance(fighters){
  if(!settings.enabled){trails.clear();return;}
  const now=INK.VFX.time;
  for(const f of fighters){
   const a=f.attack,m=a?.m;let h=trails.get(f.index);
   if(!a||m.throw||m.kind.includes('projectile')){if(h&&now-h.last>8)trails.delete(f.index);continue;}
   if(!h||h.attack!==a){h={attack:a,rows:[],last:now,color:f.ch.color,foot:m.contactPart==='foot'||m.pose==='kick'};trails.set(f.index,h);}
   if(a.t<Math.max(0,m.startup-3)||a.t>m.startup+m.active+4)continue;
   if(h.rows.at(-1)?.time===now)continue;
   const p=SVG_FIGHTER.visualPose(f),rig=INK.Runtime.visualRig(f,p),q=INK.Runtime.socket(p,rig,h.foot?'frontFoot':'frontHand'),w=INK.Rig.world(p,q,{x:f.x,y:665+f.y,scale:f.renderScale||f.ch.scale||1,facing:f.dir});
   const last=h.rows.at(-1),speed=last?Math.hypot(w[0]-last.x,w[1]-last.y):0;
   h.rows.push({x:w[0],y:w[1],time:now,width:clamp(speed*.2,1.5,h.foot?13:9)});if(h.rows.length>12)h.rows.shift();h.last=now;
  }
 }
 function mount(){
  if(layer?.isConnected)return;
  const parent=document.getElementById('impact-fx');if(!parent)return;
  trailNodes=[];layer=INK.SVG.node('g',{'data-kinetic-layer':'contacts','pointer-events':'none'},parent);slots=[];
  for(let i=0;i<2;i++)trailNodes.push({ribbon:INK.SVG.node('path',{fill:'none'},layer),core:INK.SVG.node('path',{fill:'none','stroke-width':1.4},layer)});
  for(let i=0;i<12;i++){const root=INK.SVG.node('g',{display:'none'},layer),defs=INK.SVG.node('defs',{},root),gradient=INK.SVG.node('radialGradient',{id:'kinetic-contact-light-'+i},defs),lightColor=INK.SVG.node('stop',{offset:'0%','stop-color':'#ffcc99','stop-opacity':'.65'},gradient);INK.SVG.node('stop',{offset:'100%','stop-color':'#ffcc99','stop-opacity':'0'},gradient);slots.push({root,lightColor,light:INK.SVG.node('ellipse',{fill:'url(#kinetic-contact-light-'+i+')'},root),halo:INK.SVG.node('ellipse',{fill:'none'},root),core:INK.SVG.node('path',{},root),rays:Array.from({length:7},()=>INK.SVG.node('path',{fill:'none','stroke-linecap':'round'},root))});}
 }
 function render(G,alpha=1){
  mount();if(!layer)return;
  const assign=INK.SVG.assign,enabled=settings.enabled&&INK.VFX.settings.enabled;
  const time=G.paused||G.hitstop||INK.VFX.frozen?INK.VFX.time:INK.VFX.time-1+clamp(alpha);
  const active=enabled?visibleContacts(G,alpha):[];
  const reduced=INK.VFX.settings.reducedMotion,intensity=INK.VFX.settings.intensity*settings.impact;
  trailNodes.forEach((n,i)=>{
   const h=trails.get(i),points=enabled&&!reduced&&h?h.rows.filter(p=>time-p.time<7):[];
   if(points.length<2){assign(n.ribbon,'d','');assign(n.core,'d','');return;}
   const left=[],right=[];points.forEach((p,j)=>{const a=points[Math.max(0,j-1)],b=points[Math.min(points.length-1,j+1)],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,width=p.width*(j+1)/points.length;left.push([p.x-dy/len*width,p.y+dx/len*width]);right.push([p.x+dy/len*width,p.y-dx/len*width]);});
   const path='M'+left.map(p=>p.join(',')).join('L')+'L'+right.reverse().map(p=>p.join(',')).join('L')+'Z';
   assign(n.ribbon,'d',path);assign(n.ribbon,'fill',h.color);assign(n.ribbon,'opacity',.26*clamp(1-(time-h.last)/8)*intensity);
   assign(n.core,'d','M'+points.map(p=>p.x+','+p.y).join('L'));assign(n.core,'stroke','#fff0cf');assign(n.core,'opacity',.5*clamp(1-(time-h.last)/8)*intensity);
  });
  for(let i=0;i<slots.length;i++){
   const s=slots[i],e=active[i];assign(s.root,'display',e?'inline':'none');if(!e)continue;
   const age=time-e.birth,u=clamp(age/e.life),fade=(1-u)**2,ground=e.type==='landing',guard=e.type==='block'||e.type==='parry',radius=(guard?32:45)+e.energy*(guard?14:35)+age*(guard?1:2.8);
   const contact=INK.ContactResponse?.active()?e.contact:null,turn=contact?clamp(contact.turn*20,-20,20):0,quality=contact?.quality??1;
   const newer=active.some(q=>q.defender===e.defender&&q.id>e.id&&q.type!=='landing'),focus=newer?.28:contact?.multi?.68:1;
   assign(s.root,'opacity',focus);assign(s.root,'data-contact-style',contact?.material||'physical');assign(s.root,'data-contact-result',e.type);
   assign(s.root,'transform',`translate(${e.x} ${e.y}) scale(${e.dir} 1) rotate(${ground?0:turn})`);
   assign(s.lightColor,'stop-color',e.color);assign(s.light,'rx',ground?radius*1.6:radius*1.5);assign(s.light,'ry',ground?12:radius*1.1);assign(s.light,'opacity',fade*(reduced?.08:.2)*e.energy*intensity);
   assign(s.halo,'rx',radius*(ground?1.4:guard?.4:1));assign(s.halo,'ry',radius*(ground?.1:guard?1:.55));assign(s.halo,'stroke',e.color);assign(s.halo,'stroke-width',guard?3:1.3);assign(s.halo,'opacity',fade*(guard?.8:.32)*intensity);
   const core=guard?'M-5-30Q28 0-5 30L1 18Q16 0 1-18Z':contactArt[contact?.material]||'M-7-5L-26-23-4-12 6-33 9-9 43-5 14 3 25 21 4 11-6 29-10 9-38 6Z';
   assign(s.core,'d',core);assign(s.core,'fill',e.type==='parry'?'#fff5ff':'#fff4da');assign(s.core,'transform',`scale(${(1+e.energy*.6)*(1+u*.3)})`);assign(s.core,'opacity',ground?0:Math.max(0,1-age/5)*.9*intensity);
   s.rays.forEach((ray,j)=>{
    const angle=(j-3)*(guard?.33:.22),near=radius*.65,far=near+(reduced?12:40+e.energy*70*(.72+.28*quality))*(1-u),c=Math.cos(angle),sn=Math.sin(angle);
    assign(ray,'d',`M${c*near} ${sn*near}L${c*far} ${sn*far}`);assign(ray,'stroke',j%2?e.color:'#fff3d7');assign(ray,'stroke-width',j===3?2.8:1.2);assign(ray,'opacity',reduced||ground?0:fade*(guard?.35:.55)*intensity);
   });
  }
 }
 function clear(){INK.StrikeFeel?.clear();trails.clear();events=[];serial=0;layer?.remove();layer=null;slots=[];for(const f of globalThis.SVG_FIGHTER?.fighters||[]){f._inkReaction=null;f._inkRecoil=null;f._inkWeight=null;}}
 INK.Kinetic={settings,contact,land,pose,advance,render,clear,visibleContacts,contactArt,inspect:()=>({events:events.map(e=>({...e})),slots:slots.length}),set(enabled){settings.enabled=!!enabled;clear();}};
})();
