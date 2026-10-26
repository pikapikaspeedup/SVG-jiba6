/* MATERIAL FLOW: analytical transport of action ribbons. Every point keeps its
 * emission time and velocity; drawing can neither emit nor consume gameplay RNG. */
'use strict';
(() => {
 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
 const settings={enabled:true};
 const profiles={
  ryu:{name:'压缩气劲',mode:'wave',lift:-.035,drag:.12,curl:1.8,lanes:3},
  ken:{name:'上卷烈焰',mode:'fire',lift:-.21,drag:.075,curl:6,lanes:4},
  chun:{name:'流线气带',mode:'silk',lift:-.035,drag:.10,curl:2.8,lanes:3},
  cammy:{name:'高速切风',mode:'cut',lift:0,drag:.18,curl:.5,lanes:3},
  luke:{name:'脉冲气压',mode:'pressure',lift:.025,drag:.22,curl:1.2,lanes:3},
  juri:{name:'扭转涡流',mode:'vortex',lift:-.025,drag:.08,curl:5.5,lanes:4},
  mai:{name:'扇面火流',mode:'fan',lift:-.15,drag:.07,curl:3.5,lanes:4},
  iori:{name:'三爪苍炎',mode:'claw',lift:-.13,drag:.09,curl:4.5,lanes:3}
 };
 const active=()=>settings.enabled&&INK.Kinetic?.settings.enabled;
 const path=pts=>'M'+pts.map(p=>p.map(v=>v.toFixed(2)).join(' ')).join('L');
 function style(character,event={}){const mode=character==='mai'&&['flame','pillar'].includes(event.type)?'fire':profiles[character]?.mode||'wave';return {character,type:event.type||'wave',mode};}
 function geometry(rows,time,style={}){
  const profile=profiles[style.character]||profiles.ryu,mode=style.mode||profile.mode;
  const memory=style.memory||12,width=clamp(style.width||16,1,85),base=INK.Particles.materials[style.character]||INK.Particles.materials.ryu;
  const color=style.color||base.color,core=style.core||base.core;
  const valid=rows.filter(r=>r.time<=time+1e-6&&time-r.time<memory+8);
  if(valid.length<2)return [];
  const points=valid.map((r,i)=>{
   const age=clamp(time-r.time,0,24),a=valid[Math.max(0,i-1)],b=valid[Math.min(valid.length-1,i+1)],dt=b.time-a.time;
   const vx=clamp(dt?(b.point[0]-a.point[0])/dt:0,-30,30),vy=clamp(dt?(b.point[1]-a.point[1])/dt:0,-30,30),len=Math.hypot(vx,vy)||1;
   const transport=(1-Math.exp(-profile.drag*age))/profile.drag*.13;
   const curl=profile.curl*Math.sin(age*.36+r.time*.19)*Math.sin(Math.PI*clamp(age/(memory+8)));
   return [r.point[0]+vx*transport-vy/len*curl,r.point[1]+vy*transport+profile.lift*age*age+vx/len*curl];
  });
  const pts=INK.Motion.resample(points,24),left=[],right=[],lanes=Array.from({length:profile.lanes},()=>[]),middle=[];
  let last=[0,1];
  for(let i=0;i<pts.length;i++){
   const u=i/(pts.length-1),a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;
   let n=[-dy/len,dx/len];if(n[0]*last[0]+n[1]*last[1]<0)n=n.map(v=>-v);last=n;
   const velocity=clamp(Math.hypot(points.at(-1)[0]-points[0][0],points.at(-1)[1]-points[0][1])/Math.max(1,valid.at(-1).time-valid[0].time),0,35);
   const envelope=Math.sin(Math.PI*(.015+.97*u))**.7;
   const pulse=mode==='pressure'?(.6+.4*Math.max(0,Math.sin(u*22-time*.5))):mode==='fire'||mode==='claw'?1+.3*Math.sin(u*23-time*.47):1;
   const w=width*(.42+velocity*.014)*envelope*pulse*(mode==='cut'?.38:1);
   const p=pts[i];left.push([p[0]+n[0]*w,p[1]+n[1]*w]);right.push([p[0]-n[0]*w,p[1]-n[1]*w]);middle.push(p);
   lanes.forEach((lane,j)=>{
    const spread=j-(lanes.length-1)/2;
    const oscillation=mode==='vortex'?Math.sin(u*12-time*.3+j*1.6)*w:mode==='fan'?spread*w*(1-u)*1.9:mode==='claw'?spread*w*1.25:mode==='silk'?spread*w*.7+Math.sin(u*9-time*.16+j)*w*.3:spread*w*.62;
    lane.push([p[0]+n[0]*oscillation,p[1]+n[1]*oscillation]);
   });
  }
  const body=path(left)+'L'+right.reverse().map(p=>p.map(v=>v.toFixed(2)).join(' ')).join('L')+'Z';
  const out=[{d:body,fill:color,opacity:['cut','claw'].includes(mode)?.12:.30,width:0}];
  lanes.forEach((pts,j)=>out.push({d:path(pts),fill:'none',stroke:j===1?core:color,width:mode==='cut'?1.1:mode==='claw'?2.8:mode==='fire'?3.4:1.8,opacity:j===1?.82:.52}));
  if(mode==='wave'||mode==='pressure')out.push({d:path(middle),fill:'none',stroke:core,width:mode==='pressure'?3.5:2,opacity:.8,dash:mode==='pressure'?'13 8':'none'});
  return out;
 }
 function particle(p,birth,event,record){
  if(!active()||record.category==='normal')return p;
  const q=profiles[record.character]||profiles.ryu,mode=style(record.character,event).mode,rnd=i=>INK.Particles.random(birth.seed,i);
  p.drag=q.drag;p.gravity=q.lift;p.curlX=q.curl*.7;p.curlY=q.curl*.3;
  p.vx+=clamp(birth.velocity[0]*.12,-4,4);p.vy+=clamp(birth.velocity[1]*.12,-4,4);
  p.species={fire:'ember',wave:'ring',silk:'fleck',cut:'shard',pressure:'thrust',vortex:'slash',fan:'petal',claw:'slash'}[mode];
  p.stretch=mode==='cut'?6:mode==='pressure'?4:1;
  p.spin=mode==='vortex'?8:mode==='fan'?(rnd(5)-.5)*12:p.spin;
  p.size*=mode==='wave'?1.3:mode==='claw'?1.5:1;
  p.heat=mode==='fire';p.opacity=Math.min(p.opacity,.7);
  return p;
 }
 // Contact changes the material's release direction. Guard reflects a compact
 // spray; a hit transports it through the target. Never spawned on whiff.
 function contact(pool,{x,y,frame,owner,m,result,dir,last,reduced,G}){
  if(!active()||!owner||!m||m.category==='normal'||m.throw)return false;
  const profile=profiles[owner.ch.id]||profiles.ryu,base=INK.Particles.materials[owner.ch.id],guard=['block','parry'].includes(result),multi=(m.hits||1)>1&&!last;
  const count=reduced?2:multi?3:guard?5:9,seed=INK.Particles.hash([G.tick,owner.index,m.id,result,'material'].join(':'));
  for(let i=0;i<count;i++){
   const angle=((i/(count-1||1)-.5)*(guard?150:85)-20)*Math.PI/180,speed=guard?3.5:5.5;
   const birth={seed:seed+i,velocity:[dir*speed,0]},p={x,y,birth:frame,life:guard?12:22,vx:Math.cos(angle)*speed*dir*(guard?-1:1),vy:Math.sin(angle)*speed,gravity:0,drag:.1,size:guard?2:3.6,angle:angle*180/Math.PI,color:i%3?base.color:base.core,species:base.species,stretch:1,opacity:guard?.52:.7,priority:2,phase:i};
   pool.add(particle(p,birth,{}, {character:owner.ch.id,category:m.category}));
  }
  return true;
 }
 INK.MaterialFlow={settings,profiles,active,style,geometry,particle,contact};
})();
