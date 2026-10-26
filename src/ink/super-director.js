/* SUPER DIRECTOR: composition follows real startup, contacts and recovery.
 * It never moves the camera, fighters, hitboxes or simulation clock. */
'use strict';
(() => {
 const settings={enabled:true},clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));let entries=new Map(),history=[],root=null,back=null,ui=[],focus=null,focusGradient=null,finish=[];
 const active=()=>settings.enabled&&INK.Kinetic?.settings.enabled;
 function mount(){if(root?.isConnected)return;const game=document.getElementById('game'),camera=document.getElementById('camera');if(!game||!camera)return;
  back=INK.SVG.node('g',{'data-super-composition':'back','pointer-events':'none'});camera.insertBefore(back,document.getElementById('ground-fx'));const defs=INK.SVG.node('defs',{},back);focusGradient=INK.SVG.node('radialGradient',{id:'super-focus-field',gradientUnits:'userSpaceOnUse',cx:0,cy:0,r:1},defs);for(const [offset,opacity]of [[0,0],[.62,0],[1,1]])INK.SVG.node('stop',{offset,'stop-color':'#070d19','stop-opacity':opacity},focusGradient);focus=INK.SVG.node('path',{d:'M0 150H1440V720H0Z',fill:'url(#super-focus-field)'},back);
  root=INK.SVG.node('g',{'data-super-composition':'front','pointer-events':'none'},game);game.insertBefore(root,document.getElementById('announce'));
  ui=Array.from({length:2},(_,i)=>{const g=INK.SVG.node('g',{transform:`translate(${i?780:160} 173)`},root);INK.SVG.node('path',{d:'M0 0H500L487 54H0Z',fill:'#0c1524',opacity:.88},g);return {g,line:INK.SVG.node('path',{d:'M0 0H500',fill:'none','stroke-width':2},g),crest:INK.SVG.node('g',{transform:'translate(27 27) scale(.32)'},g),title:INK.SVG.node('text',{x:55,y:22,fill:'#fff3e1','font-size':18,'font-weight':700},g),status:INK.SVG.node('text',{x:55,y:42,fill:'#bed4dd','font-size':11,'letter-spacing':1},g),meter:INK.SVG.node('path',{fill:'none','stroke-width':2},g)};});
  finish=Array.from({length:2},()=>({g:INK.SVG.node('g',{},root),paths:[]}));for(const f of finish)f.paths=Array.from({length:4},()=>INK.SVG.node('path',{fill:'none','stroke-linecap':'round'},f.g));
 }
 function start(G,f,m,crest){if(!active())return false;mount();entries.set(f.index,{actor:f.index,attack:f.attack,m:{id:m.id,name:m.name,super:m.super,hits:m.hits,kind:m.kind,ca:m.ca},color:f.ch.color,character:f.ch.id,birth:G.tick,lastTick:G.tick,hits:0,blocks:0,parries:0,crest,finish:null,end:null});history.push({kind:'start',tick:G.tick,actor:f.index,move:m.id});if(history.length>32)history.shift();if(ui[f.index])ui[f.index].crest.innerHTML=crest;return true;}
 function contact(G,a,d,m,type,damage,ctx){if(!active()||!m.super)return;const e=entries.get(a.index);if(!e||e.m.id!==m.id)return;ctx=ctx||{};if(ctx.sourceAttack&&ctx.sourceAttack!==e.attack)return;e.lastTick=G.tick;e.lastType=type;if(type==='hit')e.hits++;if(type==='block')e.blocks++;if(type==='parry')e.parries++;
  if(type==='hit'&&ctx.last)e.finish={x:ctx.point?.[0]??d.x,y:ctx.point?.[1]??665+d.y-240,dir:ctx.direction??a.dir,time:INK.VFX.time};
  history.push({kind:type,tick:G.tick,actor:a.index,move:m.id,last:!!ctx.last,damage});if(history.length>32)history.shift();
 }
 function phase(e,G){const f=SVG_FIGHTER.fighters[e.actor],same=f?.attack===e.attack,shot=G.shots.some(s=>s.owner===f&&s.sourceAttack===e.attack&&s.life>0);
  if(e.finish&&INK.VFX.time-e.finish.time<26)return 'finish';
  if(e.end!==null)return e.hits?'recover':e.blocks||e.parries?'guarded':e.m.kind==='install'?'install':e.interrupted?'interrupt':'whiff';
  if(same&&f.attack.t<e.attack.m.startup)return 'start';if(shot)return 'flight';return e.lastType==='block'||e.lastType==='parry'?'guarded':same?'strike':'recover';
 }
 function step(G){for(const [i,e]of entries){const f=SVG_FIGHTER.fighters[i],same=f?.attack===e.attack,shot=G.shots.some(s=>s.owner===f&&s.sourceAttack===e.attack&&s.life>0);if(!same&&!shot&&e.end===null){e.end=G.tick;e.interrupted=!!f&&['hit','tumble','captured','down','ko'].includes(f.state);}if(e.end!==null&&G.tick-e.end>40)entries.delete(i);}}
 function render(G,alpha=1){mount();if(!root)return;const assign=INK.SVG.assign,on=active()&&INK.VFX.settings.enabled;assign(root,'display',on?'inline':'none');assign(back,'display',on?'inline':'none');if(!on)return;
  const fighters=SVG_FIGHTER.fighters,states=[...entries.values()].map(e=>({e,phase:phase(e,G)})),reduced=INK.VFX.settings.reducedMotion;
  const power=states.reduce((v,s)=>Math.max(v,s.phase==='finish'?.32:s.phase==='start'?.23:['strike','flight'].includes(s.phase)?.14:0),0);
  const left=Math.min(...fighters.map(f=>f.x))-155,right=Math.max(...fighters.map(f=>f.x))+155,cx=(left+right)/2,cy=440,rx=Math.max(280,(right-left)/2),ry=280;
  assign(focusGradient,'gradientTransform',`translate(${cx} ${cy}) scale(${rx} ${ry})`);assign(focus,'opacity',power*(reduced?.35:1));
  for(let i=0;i<2;i++){const item=states.find(s=>s.e.actor===i),u=ui[i],f=finish[i];assign(u.g,'display',item?'inline':'none');assign(f.g,'display',item?.phase==='finish'&&!reduced?'inline':'none');if(!item)continue;const {e,phase:p}=item,age=G.tick-e.birth,end=e.end===null?1:clamp(1-(G.tick-e.end)/40);
   assign(u.g,'opacity',end*(age<65?.92:.58));assign(u.line,'stroke',e.color);assign(u.meter,'stroke',e.color);const title=(e.m.ca?'CA':'SA '+e.m.super)+' · '+e.m.name.replace('CRITICAL ART · ','');if(u.title.textContent!==title)u.title.textContent=title;
   const labels={start:'发动',strike:'交锋',flight:'飞行压制',finish:'终结命中',recover:'收势',guarded:e.parries?'被招架':'被防住',whiff:'落空 · 留意反击',interrupt:'被中断',install:'强化启动'};const status=labels[p]+`  /  命中 ${e.hits} · 防御 ${e.blocks+e.parries}`;if(u.status.textContent!==status)u.status.textContent=status;
   assign(u.meter,'d',`M55 49H${55+Math.min(400,400*e.hits/Math.max(1,e.m.hits))}`);
   if(p==='finish'&&e.finish){const q=e.finish,t=G.paused||G.hitstop||INK.VFX.frozen?INK.VFX.time:INK.VFX.time-1+clamp(alpha),age=Math.max(0,t-q.time),fade=clamp(1-age/26)**2,mode=INK.MaterialFlow.profiles[e.character]?.mode;
    assign(f.g,'transform',`translate(${q.x} ${q.y}) scale(${q.dir} 1)`);assign(f.g,'opacity',fade*.65*INK.VFX.settings.intensity);
    f.paths.forEach((n,j)=>{const offset=(j-1.5)*18,reach=90+age*3+j*12;let d=mode==='claw'?`M-75 ${offset+40}Q0 ${offset-70} ${reach} ${offset-30}`:mode==='fan'?`M-30 0Q${reach*.4} ${offset*4} ${reach} ${offset*2}`:mode==='vortex'?`M-${reach} ${offset}Q0 ${offset-75} ${reach} ${offset}Q0 ${offset+75} -${reach} ${offset}`:`M-65 ${offset}Q15 ${offset+Math.sin(j+age*.16)*22} ${reach} ${offset*.4}`;assign(n,'d',d);assign(n,'stroke',j===1?'#fff2d4':e.color);assign(n,'stroke-width',j===1?2.7:1.2);});
   }
  }
 }
 function clear(){entries.clear();history=[];root?.remove();back?.remove();root=back=null;ui=[];finish=[];}
 INK.SuperDirector={settings,active,start,contact,step,render,clear,inspect:G=>({entries:[...entries.values()].map(e=>({actor:e.actor,move:e.m.id,phase:phase(e,G),hits:e.hits,blocks:e.blocks,parries:e.parries})),events:history.map(e=>({...e}))})};
})();
