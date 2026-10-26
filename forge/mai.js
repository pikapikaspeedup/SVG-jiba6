/* FLOW 06 · a preview of the REAL editable Mai assets, not a separate movie. */
'use strict';
(() => {
 const $=id=>document.getElementById(id),F=()=>globalThis.INKForge;
 const choices=[['ryuuenbu-heavy','龙炎舞','214P','折扇展开 · 扇尖焰弧'],['hishou-ryuuenjin-heavy','飞翔龙炎阵','623K','腿部升焰 · 发辫滞后'],['hissatsu-shinobi-bachi-heavy','必杀忍蜂','236K','翻身入势 · 肘部彗尾'],['kagerou-no-mai','阳炎之舞','SA1','前后层炎柱 · 余烬上升'],['enbu-ada-zakura','炎舞仇樱','SA3','八段扇势 · 花瓣收束']];
 let modal,actor,fx,record,clip,frame=0,playing=true,stamp=0,lastPaint=0,returnedFocus=null,dir=1,speed=.65;
 function select(key){const entry=choices.find(x=>x[0]===key);if(!entry)return;record=F().store.getMove('mai',key);if(!record)throw Error('Mai preview asset missing: '+key);clip=F().store.clip(record);frame=Math.min(record.binding.startup+4,clip.data.duration);$('mai-preview-name').textContent=entry[1];$('mai-preview-detail').textContent=entry[2]+' / '+entry[3];$('mai-seek').max=record.clip.duration;$('mai-seek').value=frame;modal.querySelectorAll('[data-mai-key]').forEach(n=>{const selected=n.dataset.maiKey===key;n.classList.toggle('is-active',selected);n.setAttribute('aria-pressed',String(selected));});paint();}
 function paint(){if(!record||!actor)return;const profile=F().store.profile('mai'),p=INK.MotionGraph.compose(record,frame,clip.sample(frame),profile),rig=INK.Rig.solveAnimation(profile,p),motion=INK.Motion.secondary(record.clip,frame,!INK.VFX.settings.reducedMotion);
  $('mai-preview-root').setAttribute('transform',`translate(355 481) scale(${dir} 1) scale(${p.depth||1} 1) translate(${p.rootShift||0} ${p.floor||0}) rotate(${p.spin||0} 0 -180)`);
  actor.render(p,{rig,frame,secondary:!INK.VFX.settings.reducedMotion,motion,expression:frame>=record.binding.startup&&frame<record.binding.startup+record.binding.active?'power':'rest'});fx.render(record,frame,p,rig);
  $('mai-seek').value=frame;$('mai-preview-frame').textContent=frame.toFixed(1)+' / '+record.clip.duration+' F';$('mai-preview-phase').textContent=frame<record.binding.startup?'蓄力 / STARTUP':frame<record.binding.startup+record.binding.active?'发力 / ACTIVE':'收势 / RECOVERY';
 }
 function close(){modal.close();document.body.classList.remove('mai-dialog-open');returnedFocus?.focus({preventScroll:true});}
 function open(key=choices[0][0]){returnedFocus=document.activeElement;modal.showModal();document.body.classList.add('mai-dialog-open');if(INK.VFX.settings.reducedMotion)playing=false;$('mai-preview-play').textContent=playing?'Ⅱ 暂停':'▶ 播放';select(key);stamp=performance.now();lastPaint=stamp;$('mai-preview-play').focus();}
 function init(){if(!F()?.ready||!globalThis.INKComboUI){requestAnimationFrame(init);return;}
  const banner=document.createElement('section');banner.className='mai-feature';banner.innerHTML=`<div class="mai-feature-mark" aria-hidden="true">舞<span>05</span></div><div><span class="f-eyebrow">MAI / FLOWER & FLAME</span><h2>扇起有风，收势留焰。</h2><p>分层动作图 · 支撑脚约束 · 弹簧链 · 距离发射器</p></div><div class="mai-feature-actions"><button id="mai-showcase-open">查看动作演武 <span>↗</span></button><button id="mai-combo" class="f-primary">舞 · 14 HIT 实战连段</button></div>`;
  document.querySelector('.f-home-top').after(banner);
  modal=document.createElement('dialog');modal.id='mai-showcase';modal.setAttribute('aria-labelledby','mai-dialog-title');modal.innerHTML=`
   <header class="mai-dialog-head"><div><span class="f-eyebrow">FLOW 06 / LIVE SVG MOTION</span><h2 id="mai-dialog-title">不知火舞 <small>花焰演武</small></h2></div><button id="mai-preview-close" aria-label="关闭动作演武">✕</button></header>
   <div class="mai-preview-layout"><div class="mai-preview-stage"><div class="mai-stage-label"><span>SHIRANUI / MOTION STUDY</span><b id="mai-preview-phase"></b></div>
    <svg id="mai-preview-svg" viewBox="0 0 720 560" role="img" aria-label="由真实关键帧驱动的不知火舞动作预览"><defs><pattern id="mai-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#8a7264" stroke-width=".4" opacity=".18"/></pattern><radialGradient id="mai-stage-glow"><stop stop-color="#f4ede0"/><stop offset="1" stop-color="#dcd9ca"/></radialGradient></defs><path d="M0 0H720V560H0Z" fill="url(#mai-stage-glow)"/><path d="M0 0H720V560H0Z" fill="url(#mai-grid)"/><circle cx="355" cy="285" r="193" fill="none" stroke="#947968" opacity=".17"/><path d="M0 482H720M355 80V516" fill="none" stroke="#809383" stroke-width="1" opacity=".4"/><ellipse cx="355" cy="487" rx="101" ry="7" fill="#526859" opacity=".15"/><g id="mai-preview-root"></g></svg>
    <div class="mai-preview-scrub"><button id="mai-preview-play" aria-label="播放或暂停动作">Ⅱ 暂停</button><input id="mai-seek" type="range" min="0" max="100" step=".1" value="0" aria-label="逐帧查看舞的动作"><span id="mai-preview-frame"></span></div>
   </div><aside class="mai-preview-info"><span class="f-eyebrow">CHOOSE A MOTION / 招式</span><div class="mai-tabs">${choices.map((x,i)=>`<button data-mai-key="${x[0]}" aria-pressed="false"><small>0${i+1}</small><span>${x[1]}<em>${x[2]}</em></span><i>↗</i></button>`).join('')}</div>
    <h3 id="mai-preview-name"></h3><p id="mai-preview-detail"></p><div class="mai-preview-tools"><button id="mai-preview-mirror" aria-pressed="false">⇄ 镜像</button><label>速度<select id="mai-preview-speed" aria-label="动作预览速度"><option value=".35">0.35×</option><option value=".65" selected>0.65×</option><option value="1">1×</option></select></label></div>
    <p class="mai-preview-note">直接采样可编辑动作资产。拖动可反向检视；这里不生成命中或伤害，连段请进入实战验证。</p><button id="mai-preview-edit">在动作工坊编辑 ↗</button><button id="mai-preview-combo" class="f-primary">观看舞的 14 HIT 连段</button>
   </aside></div>`;document.body.append(modal);
  const root=$('mai-preview-root');fx=new INK.Effects(root);actor=new INK.Renderer(root,F().store.profile('mai'));root.append(fx.root);actor.setMode('skin');
  $('mai-showcase-open').onclick=()=>open();$('mai-preview-close').onclick=close;modal.addEventListener('cancel',e=>{e.preventDefault();close();});modal.addEventListener('click',e=>{if(e.target===modal)close();});
  modal.querySelectorAll('[data-mai-key]').forEach(b=>b.onclick=()=>select(b.dataset.maiKey));
  $('mai-preview-play').onclick=()=>{playing=!playing;$('mai-preview-play').textContent=playing?'Ⅱ 暂停':'▶ 播放';};
  $('mai-seek').oninput=()=>{playing=false;$('mai-preview-play').textContent='▶ 播放';frame=Number($('mai-seek').value);paint();};
  $('mai-preview-mirror').onclick=()=>{dir=-dir;$('mai-preview-mirror').setAttribute('aria-pressed',String(dir===-1));paint();};$('mai-preview-speed').onchange=()=>speed=Number($('mai-preview-speed').value);
  async function combo(){if(modal.open)close();INKComboUI.select('mai-extended');await INKComboUI.show();}
  $('mai-combo').onclick=combo;$('mai-preview-combo').onclick=combo;$('mai-preview-edit').onclick=async()=>{const key=record.key;close();await F().loadMove('mai',key);await F().route('studio');};
  F().store.on(()=>{if(modal.open)select(record?.key||choices[0][0]);});
  requestAnimationFrame(function tick(now){requestAnimationFrame(tick);if(!modal.open||document.hidden||!playing){stamp=now;return;}if(now-lastPaint<15)return;const dt=Math.min(.06,(now-stamp)/1000);stamp=now;lastPaint=now;frame=(frame+dt*60*speed)%record.clip.duration;paint();});
  document.querySelectorAll('.f-page-foot span').forEach(n=>{if(n.textContent.includes('INK FLOW / 3.0'))n.textContent='INK FLOW / 7.0 · RHYTHM';});
  globalThis.INKMaiShowcase={open,close,select,paint,get frame(){return frame;},seek(t){if(!Number.isFinite(t))throw TypeError('Finite frame required');frame=INK.clamp(t,0,record.clip.duration);playing=false;$('mai-preview-play').textContent='▶ 播放';paint();},get record(){return record;},get actor(){return actor;},get fx(){return fx;}};
 }
 init();
})();
