/* PROJECTILE FLOW: all shots move from one shared snapshot, then resolve
 * continuous contacts in time order. Presentation samples committed events. */
'use strict';
(() => {
 const settings={enabled:true},clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
 let events=[],serial=0,root=null,slots=[],visuals=new WeakMap();
 const active=()=>settings.enabled&&INK.Kinetic?.settings.enabled;
 function prepare(s){if(s._flowEnergy!==undefined)return;s._flowEnergy=s._flowInitial=s.m.super?4:Math.max(s.clashDurability||1,s.m.od?2:1);s._flowClashes=0;}
 function damageScale(s){return active()&&s? .5+.5*((s._flowEnergy??1)/(s._flowInitial??1)):1;}
 function boxTime(a,b,box,r){let lo=0,hi=1;for(const [k,min,max]of [[0,box.x-r,box.x+box.w+r],[1,box.y-r,box.y+box.h+r]]){const v=b[k]-a[k];if(Math.abs(v)<1e-9){if(a[k]<min||a[k]>max)return null;}else{let p=(min-a[k])/v,q=(max-a[k])/v;if(p>q)[p,q]=[q,p];lo=Math.max(lo,p);hi=Math.min(hi,q);if(lo>hi)return null;}}return lo;}
 function pairTime(a,b){const x=a.from[0]-b.from[0],y=a.from[1]-b.from[1],dx=a.to[0]-a.from[0]-b.to[0]+b.from[0],dy=a.to[1]-a.from[1]-b.to[1]+b.from[1],r=a.s.r+b.s.r,c=x*x+y*y-r*r;if(c<=0)return 0;const v=dx*dx+dy*dy,k=2*(x*dx+y*dy),d=k*k-4*v*c;if(v<1e-9||d<0)return null;const t=(-k-Math.sqrt(d))/(2*v);return t>=0&&t<=1?t:null;}
 const point=(r,t)=>r.from.map((v,i)=>v+(r.to[i]-v)*t);
 function impact(G,a,b,x,y){
  const e={id:++serial,time:INK.VFX.time,x,y,color:a.owner.ch.color,other:b.owner.ch.color,energy:Math.min(a._flowInitial,b._flowInitial),survivor:a.life>0?a.owner.ch.id:b.life>0?b.owner.ch.id:null};events.push(e);if(events.length>16)events.shift();
  const pool=INK.VFX.mount();if(pool&&INK.VFX.settings.enabled){const material=INK.Particles.materials[a.owner.ch.id];pool.emit({x,y,frame:e.time,seed:INK.Particles.hash(a.combatID+':'+b.combatID),count:INK.VFX.settings.reducedMotion?3:12,material,angle:-90,spread:300,speed:5,life:22,size:2,priority:3});}
 }
 function update(G,api){
  const rows=[],queue=[];
  for(const s of G.shots){if(s.life<=0)continue;prepare(s);s.cool=Math.max(0,s.cool-1);const d=api.enemy(s.owner),from=[s.x,s.y];
   if(s.lockedTarget&&(!d||d.hp<=0||d.captured||d.invuln>0||['down','rise','ko'].includes(d.state)))s.lockedTarget=null;
   if(SF6Mai.moveShot(s)){}else if(s.lockedTarget){s.x=d.x-s.dir*32;s.y=s.lockY+d.y;}else s.x+=s.dir*s.v;
   const distance=Math.abs(s.x-from[0]),remaining=Math.max(0,(s.maxDistance||Infinity)-(s.travelled||0)),fraction=distance>remaining?remaining/distance:1;
   s.x=from[0]+(s.x-from[0])*fraction;s.y=from[1]+(s.y-from[1])*fraction;s.travelled=(s.travelled||0)+distance*fraction;
   const r={s,from,to:[s.x,s.y],expire:fraction<1||s.life===1};rows.push(r);
   if(s.life<=0)continue;
   if(d&&s.vulnerable&&SF6Mai.destroyByStrike(s,api.geometry(d),api.overlap)){api.burst(s.x,s.y,'#e3bd7a',5);continue;}
   if(d&&s.cool===0&&d.hp>0){const dx=d.x-(d.px??d.x),dy=d.y-(d.py??d.y),start=[from[0]+dx,from[1]+dy];let first=null;
    for(const box of api.geometry(d).hurt){const t=boxTime(start,r.to,box,s.r);if(t!==null&&(first===null||t<first))first=t;}
    if(first!==null)queue.push({kind:'hit',t:first,a:r,d});
   }
  }
  for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){const a=rows[i],b=rows[j];if(a.s.owner===b.s.owner||a.s.life<=0||b.s.life<=0)continue;const t=pairTime(a,b);if(t!==null)queue.push({kind:'clash',t,a,b});}
  queue.sort((a,b)=>a.t-b.t||(a.kind==='clash'?-1:1)-(b.kind==='clash'?-1:1)||a.a.s.combatID.localeCompare(b.a.s.combatID));
  for(const e of queue){const s=e.a.s;if(s.life<=0||e.a.stopAt!==undefined&&e.t>e.a.stopAt+1e-8)continue;
   if(e.kind==='clash'){
    const o=e.b.s;if(o.life<=0||e.b.stopAt!==undefined&&e.t>e.b.stopAt+1e-8)continue;const p=point(e.a,e.t),q=point(e.b,e.t),spent=Math.min(s._flowEnergy,o._flowEnergy);
    if(!SF6Mai.clash(s,o)){s._flowEnergy-=spent;o._flowEnergy-=spent;s.clashDurability=s._flowEnergy;o.clashDurability=o._flowEnergy;if(s._flowEnergy<=0)s.life=0;if(o._flowEnergy<=0)o.life=0;}
    s._flowClashes++;o._flowClashes++;impact(G,s,o,(p[0]*o.r+q[0]*s.r)/(s.r+o.r),(p[1]*o.r+q[1]*s.r)/(s.r+o.r));api.sound('block');
    const survivor=s.life>0?s:o.life>0?o:null;if(survivor)api.notify(survivor.owner,'穿波 · 剩余能量 '+survivor._flowEnergy+'/'+survivor._flowInitial);
   }else{
    const p=point(e.a,e.t),result=api.contact(s.owner,e.d,s.m,s.m.hits-s.hits,s,{point:p});
    if(result&&!['immune','miss'].includes(result)){e.a.stopAt=e.t;s.hits--;s.cool=s.m.super?7:8;if(s.hits<=0){s.life=0;s.lockedTarget=null;}else{s.lockedTarget=e.d;s.lockY=s.y-e.d.y;s.x=e.d.x-s.dir*32;}SF6Mai.bounce(s,e.d);}
   }
  }
  for(const r of rows){const s=r.s;s.life--;if(r.expire||s.x<-200||s.x>1640)s.life=0;}
  G.shots=G.shots.filter(s=>{if(s.life<=0){s.node.remove();return false;}s.node.setAttribute('transform',`translate(${s.x} ${s.y}) scale(${s.dir} 1)`);return true;});
 }
 function renderShot(s,x,y,age){
  let n=visuals.get(s);if(!n){n=INK.SVG.node('g',{'data-projectile-energy':'true','pointer-events':'none'},s.node);n.ring=INK.SVG.node('path',{fill:'none','stroke-width':2},n);n.wake=INK.SVG.node('path',{fill:'none','stroke-width':1.2},n);visuals.set(s,n);}
  const assign=INK.SVG.assign,on=active()&&INK.VFX.settings.enabled;assign(n,'display',on?'inline':'none');if(!on)return;
  const energy=s._flowEnergy??1,initial=s._flowInitial??1,r=s.r+5;
  let d='';for(let i=0;i<initial;i++){const a=(i/initial+.05)*Math.PI*2,b=(i/initial+.05+.65/initial)*Math.PI*2;if(i<energy)d+=`M${Math.cos(a)*r} ${Math.sin(a)*r}A${r} ${r} 0 0 1 ${Math.cos(b)*r} ${Math.sin(b)*r}`;}
  assign(n.ring,'d',d);assign(n.ring,'stroke',s.owner.ch.color);assign(n.ring,'opacity',.45*INK.VFX.settings.intensity);
  assign(n.wake,'d',`M-20 ${-s.r*.7}Q-65 ${-s.r-4*Math.sin(age*.3)} ${-70-s.v*4} ${-s.r*.45}M-20 ${s.r*.7}Q-65 ${s.r+4*Math.sin(age*.3)} ${-70-s.v*4} ${s.r*.45}`);assign(n.wake,'stroke',s.owner.ch.color);assign(n.wake,'opacity',INK.VFX.settings.reducedMotion?0:.35*INK.VFX.settings.intensity);
 }
 function render(G,alpha=1){
  if(!root?.isConnected){const parent=document.getElementById('impact-fx');if(!parent)return;root=INK.SVG.node('g',{'data-projectile-clashes':'true','pointer-events':'none'},parent);slots=Array.from({length:8},()=>({a:INK.SVG.node('path',{fill:'none','stroke-width':3},root),b:INK.SVG.node('path',{fill:'none','stroke-width':3},root)}));}
  const t=G.paused||G.hitstop||INK.VFX.frozen?INK.VFX.time:INK.VFX.time-1+clamp(alpha),live=active()&&INK.VFX.settings.enabled?events.filter(e=>t>=e.time&&t-e.time<20).slice(-8):[],assign=INK.SVG.assign;
  slots.forEach((s,i)=>{const e=live[i];for(const p of [s.a,s.b])assign(p,'display',e?'inline':'none');if(!e)return;const age=t-e.time,r=22+age*(INK.VFX.settings.reducedMotion?1:3),fade=(1-age/20)**2;[s.a,s.b].forEach((p,j)=>{const sign=j?1:-1;assign(p,'d',`M${e.x+sign*r*.4} ${e.y-r}Q${e.x-sign*r} ${e.y} ${e.x+sign*r*.4} ${e.y+r}`);assign(p,'stroke',j?e.other:e.color);assign(p,'opacity',fade*INK.VFX.settings.intensity);});});
 }
 function clear(){events=[];serial=0;root?.remove();root=null;slots=[];visuals=new WeakMap();}
 INK.ProjectileFlow={settings,active,update,damageScale,renderShot,render,clear,boxTime,pairTime,inspect:()=>events.map(e=>({...e}))};
})();
