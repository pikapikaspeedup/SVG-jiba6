/* PROJECTILE FLOW: all shots move from one shared snapshot, then resolve
 * continuous contacts in time order. Presentation samples committed events. */
'use strict';
(() => {
 const settings={enabled:true},clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
 let events=[],serial=0,root=null,slots=[],visuals=new WeakMap();
 const active=()=>settings.enabled;
 const visualActive=()=>active()&&INK.Kinetic?.settings.enabled!==false;
 function prepare(s){if(s._flowEnergy!==undefined)return;s._flowEnergy=s._flowInitial=s.m.super?4:Math.max(s.clashDurability||1,s.m.od?2:1);s._flowClashes=0;}
 function damageScale(s){return active()&&s? .5+.5*((s._flowEnergy??1)/(s._flowInitial??1)):1;}
 function boxTime(a,b,box,r){let lo=0,hi=1;for(const [k,min,max]of [[0,box.x-r,box.x+box.w+r],[1,box.y-r,box.y+box.h+r]]){const v=b[k]-a[k];if(Math.abs(v)<1e-9){if(a[k]<min||a[k]>max)return null;}else{let p=(min-a[k])/v,q=(max-a[k])/v;if(p>q)[p,q]=[q,p];lo=Math.max(lo,p);hi=Math.min(hi,q);if(lo>hi)return null;}}return lo;}
 function pairTime(a,b){const x=a.from[0]-b.from[0],y=a.from[1]-b.from[1],dx=a.to[0]-a.from[0]-b.to[0]+b.from[0],dy=a.to[1]-a.from[1]-b.to[1]+b.from[1],r=a.s.r+b.s.r,c=x*x+y*y-r*r;if(c<=0)return 0;const v=dx*dx+dy*dy,k=2*(x*dx+y*dy),d=k*k-4*v*c;if(v<1e-9||d<0)return null;const t=(-k-Math.sqrt(d))/(2*v);return t>=0&&t<=1?t:null;}
 const point=(r,t)=>r.from.map((v,i)=>v+(r.to[i]-v)*t);
 function impact(G,a,b,x,y){
  const e={id:++serial,time:INK.VFX.time,x,y,color:a.owner.ch.color,other:b.owner.ch.color,energy:Math.min(a._flowInitial,b._flowInitial),survivor:a.life>0?a.owner.ch.id:b.life>0?b.owner.ch.id:null};events.push(e);if(events.length>16)events.shift();
  const pool=visualActive()&&INK.VFX.settings.enabled?INK.VFX.mount():null;if(pool){const material=INK.Particles.materials[a.owner.ch.id];pool.emit({x,y,frame:e.time,seed:INK.Particles.hash(a.combatID+':'+b.combatID),count:INK.VFX.settings.reducedMotion?3:12,material,angle:-90,spread:300,speed:5,life:22,size:2,priority:3});}
 }
 function update(G,api){
  const rows=[],queue=[],geometries=new Map(),invalidDefenders=new Set();
  const geometry=d=>{if(!geometries.has(d)){const g=api.geometry(d),copy=list=>Object.freeze((list||[]).map(b=>Object.freeze({...b})));geometries.set(d,Object.freeze({...g,hit:copy(g?.hit),hurt:copy(g?.hurt)}));}return geometries.get(d);};
  const valid=d=>!invalidDefenders.has(d)&&(!api.snapshotValid||api.snapshotValid(d));
  for(const s of G.shots){if(s.life<=0)continue;prepare(s);s.cool=Math.max(0,s.cool-1);const d=api.enemy(s.owner),from=[s.x,s.y];
   if(s.lockedTarget&&(!d||d.hp<=0||d.captured||d.invuln>0||['down','rise','ko'].includes(d.state)))s.lockedTarget=null;
   if(SF6Mai.moveShot(s)){}else if(s.lockedTarget){s.x=d.x-s.dir*32;s.y=s.lockY+d.y;}else s.x+=s.dir*s.v;
   const distance=Math.abs(s.x-from[0]),remaining=Math.max(0,(s.maxDistance||Infinity)-(s.travelled||0)),fraction=distance>remaining?remaining/distance:1;
   s.x=from[0]+(s.x-from[0])*fraction;s.y=from[1]+(s.y-from[1])*fraction;s.travelled=(s.travelled||0)+distance*fraction;
   const r={s,from,to:[s.x,s.y],expire:fraction<1||s.life===1};rows.push(r);
   if(s.life<=0)continue;
   if(d&&s.vulnerable&&SF6Mai.destroyByStrike(s,geometry(d),api.overlap)){api.burst(s.x,s.y,'#e3bd7a',5);continue;}
   if(d&&s.cool===0&&d.hp>0){const dx=d.x-(d.px??d.x),dy=d.y-(d.py??d.y),start=[from[0]+dx,from[1]+dy];let first=null,chosen=null;
    for(const box of [...geometry(d).hurt].sort((a,b)=>String(a.id??a.part).localeCompare(String(b.id??b.part)))){const t=boxTime(start,r.to,box,s.r);if(t!==null&&(first===null||t<first)){first=t;chosen=box;}}
    if(first!==null)queue.push({kind:'hit',t:first,a:r,d,box:chosen,rootDelta:[dx,dy]});
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
    if(!valid(e.d)){invalidDefenders.add(e.d);continue;}
    const p=point(e.a,e.t),relativeVelocity=[e.a.to[0]-e.a.from[0]-e.rootDelta[0],e.a.to[1]-e.a.from[1]-e.rootDelta[1]],speed=Math.hypot(...relativeVelocity),motion=!s.lockedTarget&&speed>1e-6?{incoming:relativeVelocity.map(v=>v/speed),relativeVelocity,evidence:'projectile',surface:'none',continuous:true,channel:'projectile',epoch:0}:null;
    const box=e.box,bx=box.x-e.rootDelta[0]*(1-e.t),by=box.y-e.rootDelta[1]*(1-e.t),contactPoint=[clamp(p[0],bx,bx+box.w),clamp(p[1],by,by+box.h)],delta=contactPoint.map((v,i)=>v-p[i]),length=Math.hypot(...delta),normal=length>1e-8?delta.map(v=>v/length):speed>1e-8?relativeVelocity.map(v=>v/speed):[s.dir,0];
    const witness={point:contactPoint,motion,normal,hurtPart:box.part,hurtID:box.id??box.part,hitPart:'projectile',hitID:s.combatID,time:e.t,swept:true},result=api.contact(s.owner,e.d,s.m,s.m.hits-s.hits,s,witness);
    if(!valid(e.d))invalidDefenders.add(e.d);
    if(result&&!['immune','miss'].includes(result)){e.a.stopAt=e.t;s.hits--;s.cool=s.m.super?7:8;if(s.hits<=0){s.life=0;s.lockedTarget=null;}else{s.lockedTarget=e.d;s.lockY=s.y-e.d.y;s.x=e.d.x-s.dir*32;}SF6Mai.bounce(s,e.d);}
   }
  }
  for(const r of rows){const s=r.s;s.life--;if(r.expire||s.x<-200||s.x>1640)s.life=0;}
  G.shots=G.shots.filter(s=>{if(s.life<=0){s.node.remove();return false;}s.node.setAttribute('transform',`translate(${s.x} ${s.y}) scale(${s.dir} 1)`);return true;});
 }
 function renderShot(s,x,y,age){
  let n=visuals.get(s);if(!n){n=INK.SVG.node('g',{'data-projectile-energy':'true','pointer-events':'none'},s.node);n.ring=INK.SVG.node('path',{fill:'none','stroke-width':2},n);n.wake=INK.SVG.node('path',{fill:'none','stroke-width':1.2},n);visuals.set(s,n);}
  const assign=INK.SVG.assign,on=visualActive()&&INK.VFX.settings.enabled;assign(n,'display',on?'inline':'none');if(!on)return;
  const energy=s._flowEnergy??1,initial=s._flowInitial??1,r=s.r+5;
  let d='';for(let i=0;i<initial;i++){const a=(i/initial+.05)*Math.PI*2,b=(i/initial+.05+.65/initial)*Math.PI*2;if(i<energy)d+=`M${Math.cos(a)*r} ${Math.sin(a)*r}A${r} ${r} 0 0 1 ${Math.cos(b)*r} ${Math.sin(b)*r}`;}
  assign(n.ring,'d',d);assign(n.ring,'stroke',s.owner.ch.color);assign(n.ring,'opacity',.45*INK.VFX.settings.intensity);
  assign(n.wake,'d',`M-20 ${-s.r*.7}Q-65 ${-s.r-4*Math.sin(age*.3)} ${-70-s.v*4} ${-s.r*.45}M-20 ${s.r*.7}Q-65 ${s.r+4*Math.sin(age*.3)} ${-70-s.v*4} ${s.r*.45}`);assign(n.wake,'stroke',s.owner.ch.color);assign(n.wake,'opacity',INK.VFX.settings.reducedMotion?0:.35*INK.VFX.settings.intensity);
  if(s.isMaiFan){
   if(!n.mai){const a=INK.SVG.node('path',{'data-mai-projectile':'wake'},n),b=INK.SVG.node('path',{},n),c=INK.SVG.node('path',{},n),petals=Array.from({length:4},()=>INK.SVG.node('path',{},n));n.mai={a,b,c,petals};}
   const {a,b,c,petals}=n.mai,charged=s.fanCharged||s.m.flameEnhanced,reduced=INK.VFX.settings.reducedMotion,phase=reduced?0:age*.15,reach=charged?136:105,wave=Math.sin(phase)*6;
   assign(a,'d',`M-20 -18 Q-58 ${-31+wave} ${-reach} -12 Q-70 -10 -25 0 Q-61 13 ${-reach-15} 21 Q-50 29 -20 15Z`);assign(a,'fill',charged?'#f2674d':'#e9868b');assign(a,'stroke','none');assign(a,'opacity',charged?.34:.22);
   assign(b,'d',`M-26 -15 Q-70 ${-29+wave} ${-reach} -13 M-26 15 Q-69 ${26-wave} ${-reach-10} 20`);assign(b,'fill','none');assign(b,'stroke',charged?'#ffe1a6':'#ffdbcb');assign(b,'stroke-width',charged?2.4:1.5);assign(b,'opacity',.7);
   assign(c,'d','M-45 -26 Q-12 -46 17 -23 M-45 25 Q-12 46 17 23');assign(c,'fill','none');assign(c,'stroke',charged?'#ffb46d':'#fff0d6');assign(c,'stroke-width',1.2);assign(c,'opacity',.5);
   petals.forEach((p,i)=>{const t=reduced?i/4:((age*.035+i*.27)%1),px=-25-t*reach,py=(i%2?1:-1)*(13+12*t)+Math.sin(phase+i)*5;assign(p,'d','M-5 0 Q-3 -6 2 -5 Q6 -2 3 3 Q-1 5 -5 0Z');assign(p,'transform',`translate(${px} ${py}) rotate(${i*60+(reduced?0:age*3)}) scale(${.5+.25*(i%2)})`);assign(p,'fill',i%2?'#fff0d0':'#f7a8aa');assign(p,'opacity',(.25+.45*Math.sin(Math.PI*t))*(reduced?.5:1));});
  }
 }
 function render(G,alpha=1){
  if(!root?.isConnected){const parent=document.getElementById('impact-fx');if(!parent)return;root=INK.SVG.node('g',{'data-projectile-clashes':'true','pointer-events':'none'},parent);slots=Array.from({length:8},()=>({a:INK.SVG.node('path',{fill:'none','stroke-width':3},root),b:INK.SVG.node('path',{fill:'none','stroke-width':3},root)}));}
  const t=G.paused||G.hitstop||INK.VFX.frozen?INK.VFX.time:INK.VFX.time-1+clamp(alpha),live=visualActive()&&INK.VFX.settings.enabled?events.filter(e=>t>=e.time&&t-e.time<20).slice(-8):[],assign=INK.SVG.assign;
  slots.forEach((s,i)=>{const e=live[i];for(const p of [s.a,s.b])assign(p,'display',e?'inline':'none');if(!e)return;const age=t-e.time,r=22+age*(INK.VFX.settings.reducedMotion?1:3),fade=(1-age/20)**2;[s.a,s.b].forEach((p,j)=>{const sign=j?1:-1;assign(p,'d',`M${e.x+sign*r*.4} ${e.y-r}Q${e.x-sign*r} ${e.y} ${e.x+sign*r*.4} ${e.y+r}`);assign(p,'stroke',j?e.other:e.color);assign(p,'opacity',fade*INK.VFX.settings.intensity);});});
 }
 function clear(){events=[];serial=0;root?.remove();root=null;slots=[];visuals=new WeakMap();}
 INK.ProjectileFlow={settings,active,update,damageScale,renderShot,render,clear,boxTime,pairTime,inspect:()=>events.map(e=>({...e}))};
})();
