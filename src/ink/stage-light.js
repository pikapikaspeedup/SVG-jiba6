/* STAGE LIGHT: retained SVG light fields and body masks. Pure presentation:
 * light sources are sampled from committed combat, never spawned by a draw. */
'use strict';
(() => {
 const settings={enabled:true},clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
 const environments={neon:{name:'雨夜霓虹',key:'#73cce9',fill:'#b685d8',ground:'#5998b4',x:180,y:140,wash:.12},courtyard:{name:'庭院暖光',key:'#ffd6a0',fill:'#9abdc3',ground:'#e5b76d',x:460,y:30,wash:.09},rooftop:{name:'天台月光',key:'#acccff',fill:'#8988c5',ground:'#809bd9',x:440,y:230,wash:.14}};
 let root=null,floor=null,field=[],actors=new Map(),serial=0,ambient=null;
 const active=()=>settings.enabled&&INK.Kinetic?.settings.enabled&&INK.VFX.settings.enabled;
 const environment=G=>environments[G.stage]||environments.neon;
 const time=(G,alpha)=>G.paused||G.hitstop||INK.VFX.frozen?INK.VFX.time:INK.VFX.time-1+clamp(alpha);
 function sources(G,alpha=1){
  const t=time(G,alpha),out=[];
  for(const s of G.shots||[]){if(s.life<=0)continue;const p=s._inkPrevious,u=G.paused||G.hitstop||INK.VFX.frozen?1:clamp(alpha);out.push({x:p?p.x+(s.x-p.x)*u:s.x,y:p?p.y+(s.y-p.y)*u:s.y,color:s.owner.ch.color,power:(s.m.super?1.3:.6)*INK.ProjectileFlow.damageScale(s),radius:s.m.super?310:210});}
  const contacts=INK.Kinetic.visibleContacts(G,alpha);
  for(const e of contacts){const age=t-e.birth;if(age<0||age>e.life||e.type==='landing')continue;const echo=contacts.some(q=>q.defender===e.defender&&q.id>e.id)? .28:1,guard=e.type==='block'||e.type==='parry';out.push({x:e.x,y:e.y,color:e.color,power:e.energy*(1-age/e.life)**2*echo,radius:e.super?230:130+e.energy*30,incoming:e.incoming||[e.dir,0],aspect:guard?.85:.48,defender:e.defender});}
  for(const e of INK.ProjectileFlow.inspect()){const age=t-e.time;if(age<0||age>20)continue;out.push({x:e.x,y:e.y,color:e.color,power:.8*(1-age/20)**2,radius:250});}
  for(const f of globalThis.SVG_FIGHTER?.fighters||[]){const a=f.attack;if(a&&a.t<a.m.startup&&(a.m.kind.includes('projectile')||a.m.super))out.push({x:f.x+f.dir*75,y:665+f.y-250,color:f.ch.color,power:.4*a.t/a.m.startup,radius:170});}
  return out.sort((a,b)=>b.power-a.power).slice(0,6);
 }
 function radial(defs,id,color){const g=INK.SVG.node('radialGradient',{id},defs),stop=INK.SVG.node('stop',{offset:0,'stop-color':color,'stop-opacity':1},g);INK.SVG.node('stop',{offset:1,'stop-color':color,'stop-opacity':0},g);return {g,stop};}
 function mount(){
  if(root?.isConnected)return;
  const bg=document.getElementById('background'),camera=document.getElementById('camera');if(!bg||!camera)return;
  root=INK.SVG.node('g',{'data-stage-light':'environment','pointer-events':'none'});camera.insertBefore(root,document.getElementById('ground-fx'));floor=INK.SVG.node('g',{'data-stage-light':'ground','pointer-events':'none'},document.getElementById('ground-fx'));
  const defs=INK.SVG.node('defs',{},root),wash=radial(defs,'stage-light-wash','#7ccfff'),horizon=radial(defs,'stage-light-horizon','#7ccfff');ambient={wash,horizon,sky:INK.SVG.node('ellipse',{fill:'url(#stage-light-wash)',rx:850,ry:530},root),ground:INK.SVG.node('ellipse',{cx:720,cy:670,rx:850,ry:135,fill:'url(#stage-light-horizon)'},floor)};
  field=Array.from({length:6},(_,i)=>{const grad=radial(defs,'stage-light-'+i,'#fff');return {grad,wall:INK.SVG.node('ellipse',{fill:`url(#stage-light-${i})`},root),ground:INK.SVG.node('ellipse',{fill:`url(#stage-light-${i})`},floor)};});
 }
 function actor(f,p,world,G,alpha=1,solvedRig=null){
  if(!globalThis.SVG_FIGHTER?.fighters.includes(f)||!f.inkRenderer)return;
  const r=f.inkRenderer;let row=actors.get(r);
  if(!row){const id='stage-body-'+(++serial);r.art.id=id;const defs=INK.SVG.node('defs',{},r.group),mask=INK.SVG.node('mask',{id:id+'-mask',maskUnits:'userSpaceOnUse',x:-500,y:-700,width:1000,height:1100,style:'mask-type:alpha'},defs);INK.SVG.node('use',{href:'#'+id},mask);
   const grad=INK.SVG.node('linearGradient',{id:id+'-key',x1:0,y1:0,x2:1,y2:1},defs),key=INK.SVG.node('stop',{offset:0,'stop-color':'#fff','stop-opacity':.25},grad);INK.SVG.node('stop',{offset:.65,'stop-color':'#fff','stop-opacity':0},grad);const fill=INK.SVG.node('stop',{offset:1,'stop-color':'#fff','stop-opacity':.06},grad);
   const overlay=INK.SVG.node('g',{'data-stage-body-light':f.index,mask:`url(#${id}-mask)`,'pointer-events':'none'},r.group),rim=INK.SVG.node('rect',{x:-400,y:-600,width:800,height:900,fill:`url(#${id}-key)`},overlay);
   const lights=Array.from({length:2},(_,i)=>{const g=radial(defs,id+'-point-'+i,'#fff');return {g,node:INK.SVG.node('ellipse',{rx:190,ry:190,fill:`url(#${id}-point-${i})`},overlay)};});
   const feet=f.shadow?[0,1].map(()=>INK.SVG.node('ellipse',{'data-foot-contact':'true',fill:'#020813'},f.shadow)):[];
   row={id,r,defs,key,fill,grad,overlay,rim,lights,feet,f};actors.set(r,row);
  }
  const assign=INK.SVG.assign,on=active()&&r.mode==='skin';assign(row.overlay,'display',on?'inline':'none');for(const n of row.feet)assign(n,'display',on?'inline':'none');if(!on){if(f.shadow){const n=f.shadow.children;assign(n[0],'cx',0);assign(n[0],'cy',8);assign(n[0],'rx',107);assign(n[0],'ry',17);assign(n[0],'opacity',.7);assign(n[1],'opacity',.55);}return;}
  const env=environment(G),lights=sources(G,alpha),s=world.scale||1;
  const facing=INK.VisualFrame?.get(p)?INK.mat.identity():INK.mat.multiply(INK.mat.compose(0,0,0,f.dir*(p.depth||1),1),INK.mat.multiply(INK.mat.compose(p.rootShift||0,p.floor||0),INK.mat.multiply(INK.mat.compose(0,-180,p.spin||0),INK.mat.compose(0,180))));
  const inverse=INK.mat.inverse(facing),local=(x,y)=>INK.mat.point(inverse,[(x-world.x)/s,(y-665-world.y)/s]);
  const key=local(env.x,env.y);assign(row.key,'stop-color',env.key);assign(row.fill,'stop-color',env.fill);assign(row.key,'stop-opacity',.16);assign(row.grad,'x1',key[0]<0?0:1);assign(row.grad,'y1',0);assign(row.grad,'x2',key[0]<0?1:0);assign(row.grad,'y2',1);
  const ranked=lights.map(l=>({...l,score:l.power*(l.defender===f.index?1:Math.max(0,1-Math.hypot(l.x-world.x,l.y-(665+world.y-220))/l.radius))})).sort((a,b)=>b.score-a.score);
  row.lights.forEach((n,i)=>{const l=ranked[i];assign(n.node,'display',l&&l.score>.005?'inline':'none');if(!l)return;const q=local(l.x,l.y),axis=l.incoming?local(l.x+l.incoming[0],l.y+l.incoming[1]):[q[0]+1,q[1]],angle=Math.atan2(axis[1]-q[1],axis[0]-q[0])*180/Math.PI;assign(n.node,'cx',q[0]);assign(n.node,'cy',q[1]);assign(n.node,'transform',`rotate(${angle} ${q[0]} ${q[1]})`);assign(n.node,'rx',l.radius/s);assign(n.node,'ry',l.radius/s*(l.aspect||1));assign(n.g.stop,'stop-color',l.color);assign(n.node,'opacity',Math.min(.32,l.power*.27)*(INK.VFX.settings.reducedMotion?.5:1));});
  if(f.shadow){const height=Math.max(0,-world.y),lying=['down','ko'].includes(f.state),n=f.shadow.children;assign(f.shadow,'transform',`translate(${world.x} 665)`);assign(f.shadow,'opacity',1);assign(n[0],'cx',(world.x-env.x)*.035);assign(n[0],'cy',9);assign(n[0],'rx',(lying?132:88)+height*.10);assign(n[0],'ry',15+height*.025);assign(n[0],'opacity',clamp(.48-height*.001,.12,.48));assign(n[1],'opacity',0);
   const rig=solvedRig||INK.Runtime.visualRig(f,p);['frontFoot','rearFoot'].forEach((name,i)=>{const q=INK.Runtime.socket(p,rig,name),w=INK.Rig.world(p,q,{x:world.x,y:665+world.y,scale:s,facing:f.dir}),distance=Math.abs(665-w[1]);assign(row.feet[i],'cx',w[0]-world.x);assign(row.feet[i],'cy',3);assign(row.feet[i],'rx',26+distance*.04);assign(row.feet[i],'ry',5);assign(row.feet[i],'opacity',lying?0:clamp(1-distance/55)*.55);});
  }
 }
 function render(G,alpha=1){mount();if(!root)return;const assign=INK.SVG.assign,on=active();assign(root,'display',on?'inline':'none');assign(floor,'display',on?'inline':'none');if(!on)return;
  const env=environment(G);assign(ambient.wash.stop,'stop-color',env.key);assign(ambient.sky,'cx',env.x);assign(ambient.sky,'cy',env.y);assign(ambient.sky,'opacity',env.wash);assign(ambient.horizon.stop,'stop-color',env.ground);assign(ambient.ground,'opacity',.12);
  const lights=sources(G,alpha);field.forEach((n,i)=>{const l=lights[i];for(const p of [n.wall,n.ground])assign(p,'display',l?'inline':'none');if(!l)return;assign(n.grad.stop,'stop-color',l.color);assign(n.wall,'cx',l.x);assign(n.wall,'cy',l.y);assign(n.wall,'rx',l.radius);assign(n.wall,'ry',l.radius*.75);assign(n.wall,'opacity',l.power*.11);assign(n.ground,'cx',l.x);assign(n.ground,'cy',671);assign(n.ground,'rx',l.radius*.9);assign(n.ground,'ry',30);assign(n.ground,'opacity',l.power*.3*clamp(1-Math.abs(665-l.y)/420));});
 }
 function clear(){root?.remove();floor?.remove();root=floor=null;field=[];for(const row of actors.values()){row.overlay.remove();row.defs.remove();row.r.art.removeAttribute('id');for(const n of row.feet)n.remove();}actors.clear();}
 INK.StageLight={settings,actor,render,clear,sources,environments,inspect:()=>({actors:actors.size,fields:field.length})};
})();
