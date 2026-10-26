/* FLOW 05 — same-frame, real-asset engine inspector. No pre-rendered animation.
 * Reference is the current base track with new presentation layers disabled,
 * not an assertion that the entire previous release is running in the left pane.
 */
'use strict';
(() => {
  const $=id=>document.getElementById(id),F=()=>globalThis.INKForge;
  const choices=[['ryuuenbu-heavy','龙炎舞 · 扇势与支撑脚'],['hishou-ryuuenjin-heavy','飞翔龙炎阵 · 升空与弹簧链'],['hissatsu-shinobi-bachi-heavy','必杀忍蜂 · 旋转与高速拖尾'],['sHP','回身扇 · 躯干反向扭转'],['sHK','重脚 · 支撑与释放'],['kagerou-no-mai','阳炎之舞 · 分层火焰'],['enbu-ada-zakura','炎舞仇樱 · 多阶段事件']];
  const local={enabled:true,layers:true,contacts:true,springs:true};
  let modal,left,right,fx,record,clip,frame=0,playing=false,speed=.5,dir=1,stamp=0,focus=null,savedPause=null,current=null;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function stage(id,label,description) {
    return `<section class="engine5-pane ${id==='engine5-new'?'flow':''}"><div class="engine5-pane-head"><b>${label}</b><small>${id==='engine5-new'?'GRAPH OUTPUT':'BASE CLIP'}</small></div><svg id="${id}-svg" viewBox="0 0 420 490" role="img" aria-label="${label}"><defs><pattern id="${id}-grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="#5e8070" stroke-width=".5" opacity=".15"/></pattern></defs><path d="M0 0H420V490H0Z" fill="url(#${id}-grid)"/><circle cx="210" cy="260" r="164" fill="none" stroke="#6d8c74" opacity=".2"/><path d="M0 432H420M210 34V452" fill="none" stroke="#657e6a" opacity=".33"/><ellipse cx="210" cy="437" rx="91" ry="6" fill="#516e59" opacity=".13"/><g id="${id}-root"></g></svg><div class="engine5-pane-foot">${description}</div></section>`;
  }
  function timeline() {
    const d=record.clip.duration,b=record.binding,graph=record.clip.meta?.motion5;
    const span=(start,length,kind,title)=>`<span class="${kind}" style="left:${start/d*100}%;width:${length/d*100}%" title="${esc(title)}"></span>`;
    $('engine5-time-tracks').innerHTML=`<span class="engine5-track-label">招式阶段</span><div class="engine5-track">${span(0,b.startup,'startup','起手')}${span(b.startup,b.active,'active','有效')}${span(b.startup+b.active,b.recovery,'recovery','收势')}<i></i></div><span class="engine5-track-label">支撑脚窗口</span><div class="engine5-track">${(graph?.contacts||[]).map(c=>span(c.start,c.end-c.start,'contact',c.socket)).join('')}<i></i></div><span class="engine5-track-label">特效事件</span><div class="engine5-track">${record.fx.map(e=>span(e.frame,e.duration,'event',e.id+' / '+e.socket)).join('')}<i></i></div>`;
  }
  function select(key) {
    if(!choices.some(x=>x[0]===key))throw Error('Unknown engine study move');
    record=F().store.getMove('mai',key);clip=F().store.clip(record);
    frame=Math.min(record.clip.duration,record.binding.startup+Math.min(7,record.binding.active*.4));
    $('engine5-move').value=key;$('engine5-seek').max=record.clip.duration;timeline();paint();
  }
  function paint() {
    if(!record||!right)return;
    const profile=F().store.profile('mai'),base=clip.sample(frame),pose=INK.MotionGraph.compose(record,frame,base,profile,null,local);
    const baseRig=INK.Rig.solveAnimation(profile,base),rig=INK.Rig.solveAnimation(profile,pose);
    const secondary=INK.SecondaryDynamics.sample(record.clip,frame,local.springs),expr=frame>=record.binding.startup&&frame<record.binding.startup+record.binding.active?'power':'rest';
    const transform=p=>`translate(210 430) scale(${dir*.91*(p.depth||1)} .91) translate(${p.rootShift||0} ${p.floor||0}) rotate(${p.spin||0} 0 -180)`;
    $('engine5-base-root').setAttribute('transform',transform(base));$('engine5-new-root').setAttribute('transform',transform(pose));
    left.render(base,{rig:baseRig,frame,secondary:false,expression:expr});right.render(pose,{rig,frame,secondary:local.springs,motion:secondary,expression:expr});
    fx.graphOptions=local;fx.visible=$('engine5-fx').checked;fx.render(record,frame,pose,rig);
    const baseFan=INK.Runtime.socket(base,baseRig,'fanTip'),newFan=INK.Runtime.socket(pose,rig,'fanTip');
    const diff=Math.hypot(baseFan[0]-newFan[0],baseFan[1]-newFan[1]);
    const cfg=record.clip.meta?.motion5,activeContacts=(cfg?.contacts||[]).filter(c=>frame>=c.start&&frame<c.end);
    current={move:record.key,frame,base,pose,secondary,fanDelta:diff,contacts:activeContacts.length,layers:local.layers?(cfg?.layers?.length||0):0,particles:fx.stats.active,options:{...local}};
    $('engine5-frame').textContent=frame.toFixed(1)+' / '+record.clip.duration+' F';$('engine5-seek').value=frame;
    $('engine5-layer-count').textContent=current.layers+' layers';$('engine5-contact-count').textContent=local.contacts?activeContacts.length+' active':'disabled';
    $('engine5-chain').textContent=secondary.hairChain.map(n=>n.toFixed(1)).join(' / ');
    $('engine5-velocity').textContent=secondary.velocity.hair.toFixed(2)+' °/F';$('engine5-particles').textContent=fx.stats.active+' / 144';$('engine5-difference').textContent=diff.toFixed(2)+' px';
    modal.querySelectorAll('.engine5-track i').forEach(n=>n.style.left=frame/record.clip.duration*100+'%');
  }
  function open(key='ryuuenbu-heavy') {
    focus=document.activeElement;playing=false;stamp=performance.now();
    const A=SVG_FIGHTER;savedPause={paused:A.state.paused,screen:A.state.screen,fighter:A.fighters[0]};if(A.state.screen==='battle')A.state.paused=true;
    $('engine5-play').textContent='▶ 播放';modal.showModal();select(key);$('engine5-play').focus();
  }
  function restore() {
    const A=SVG_FIGHTER;if(savedPause&&savedPause.screen===A.state.screen&&savedPause.fighter===A.fighters[0])A.state.paused=savedPause.paused;
    savedPause=null;INK.EngineClock.reset();playing=false;focus?.focus({preventScroll:true});
  }
  function close() {if(modal.open)modal.close();}
  function seek(value) {if(!Number.isFinite(value))throw TypeError('Finite engine preview frame required');frame=INK.clamp(value,0,record.clip.duration);playing=false;$('engine5-play').textContent='▶ 播放';paint();}
  function setOptions(values) {
    for(const [k,v]of Object.entries(values)){if(!['layers','contacts','springs'].includes(k)||typeof v!=='boolean')throw TypeError('Boolean graph toggle required');local[k]=v;$('engine5-'+k).checked=v;}
    paint();
  }
  function init() {
    if(!F()?.ready||!globalThis.INKMaiShowcase){requestAnimationFrame(init);return;}
    const launch=document.createElement('section');launch.className='engine5-launch';launch.innerHTML='<div><span class="engine5-kicker">FLOW 05 / ENGINE ITERATION</span><h3>分层控制动作，按时序发射特效。</h3><p>基础轨与新动作图同帧对照；检查支撑脚、三段弹簧链和真实挂点发射。</p></div><button id="engine5-open">打开引擎检视 ↗</button>';
    document.querySelector('.mai-feature').after(launch);
    const nav=document.createElement('button');nav.id='engine5-nav';nav.textContent='引擎检视';document.querySelector('.f-top nav').appendChild(nav);
    modal=document.createElement('dialog');modal.className='engine5-dialog';modal.id='engine5-inspector';modal.setAttribute('aria-labelledby','engine5-title');
    modal.innerHTML=`<header class="engine5-head"><div><span class="engine5-kicker">FLOW 05 / MOTION GRAPH + EMITTER RUNTIME</span><h2 id="engine5-title">同一帧，两条求值路径。</h2><p>左侧是当前资产的基础关键帧参考，并非另跑旧版程序。右侧调用实战使用的动作图、弹簧链与发射器内核；这里仅预览，不生成伤害。</p></div><button class="engine5-close" id="engine5-close" aria-label="关闭引擎检视">×</button></header>
    <div class="engine5-grid">${stage('engine5-base','基础轨参考','关闭新的分层、支撑脚修正与附件动力学。基础轨仍负责战斗判定。')}${stage('engine5-new','FLOW 05 输出','分层求值、接触约束和弹簧链，作用于最终 SVG；火焰沿实际扇尖发射。')}
    <aside class="engine5-controls"><div><label class="engine5-select-label" for="engine5-move">不知火舞 / 真实动作资产</label><select id="engine5-move">${choices.map(([k,n])=>`<option value="${k}">${n}</option>`).join('')}</select><h3>逐项检查 / 局部预览开关</h3>${[['layers','分层动作'],['contacts','支撑脚约束'],['springs','弹簧链'],['fx','粒子与轨迹']].map(([k,n])=>`<label class="engine5-toggle">${n}<input type="checkbox" id="engine5-${k}" checked></label>`).join('')}<button id="engine5-mirror">⇄ 镜像</button><button class="engine5-edit" id="engine5-edit">在动作工坊编辑此招 ↗</button></div>
    <div><h3>采样结果 / LIVE VALUES</h3><dl>${[['layer-count','分层轨道'],['contact-count','当前接触'],['chain','发辫三段 / °'],['velocity','末端角速度'],['difference','扇尖位移差'],['particles','局部粒子']].map(([k,n])=>`<div><dt>${n}</dt><dd id="engine5-${k}">—</dd></div>`).join('')}</dl><p>左/右帧号始终一致。关闭开关只作用于此窗口，不改资源、不改伤害，也不会覆盖保存的招式。</p><p>叠加权重、弹簧参数、距离间距和速度继承，均可在动作工坊保存到 JSON。</p></div></aside></div>
    <div class="engine5-transport"><button id="engine5-play">▶ 播放</button><button id="engine5-step">+ 1F</button><select id="engine5-speed" aria-label="预览速度"><option value=".25">0.25×</option><option value=".5" selected>0.5×</option><option value="1">1×</option></select><input id="engine5-seek" type="range" min="0" max="100" step=".1" value="0" aria-label="引擎同帧比较时间轴"><span id="engine5-frame" class="engine5-frame"></span></div>
    <div class="engine5-timeline" id="engine5-time-tracks"></div><footer class="engine5-bottom"><div class="engine5-pipeline">60 Hz SIMULATION → BASE CLIP → MOTION LAYERS → FOOT CONTACT → IK → SOCKETS → EMITTERS → SVG</div>快进、暂停和反向拖动只做随机访问采样，不回放特效事件、不补发命中。实战发射器由模拟帧推进，取消后停止发射，已出生的粒子与拖尾继续衰减。</footer>`;
    document.body.appendChild(modal);
    const profile=F().store.profile('mai');left=new INK.Renderer($('engine5-base-root'),profile);right=new INK.Renderer($('engine5-new-root'),profile);fx=new INK.Effects($('engine5-new-root'));
    $('engine5-new-root').insertBefore(fx.backRoot,right.group);left.setStyle(profile.previewStyle||{});right.setStyle(profile.previewStyle||{});
    $('engine5-open').onclick=()=>open();nav.onclick=()=>open();$('engine5-close').onclick=close;modal.addEventListener('close',restore);
    $('engine5-move').onchange=()=>select($('engine5-move').value);$('engine5-seek').oninput=()=>seek(Number($('engine5-seek').value));
    $('engine5-play').onclick=()=>{playing=!playing;stamp=performance.now();$('engine5-play').textContent=playing?'Ⅱ 暂停':'▶ 播放';};
    $('engine5-step').onclick=()=>seek(Math.min(record.clip.duration,Math.floor(frame)+1));$('engine5-speed').onchange=()=>speed=Number($('engine5-speed').value);
    for(const key of ['layers','contacts','springs'])$('engine5-'+key).onchange=()=>setOptions({[key]:$('engine5-'+key).checked});$('engine5-fx').onchange=paint;
    $('engine5-mirror').onclick=()=>{dir*=-1;paint();};$('engine5-edit').onclick=async()=>{const key=record.key;close();await F().loadMove('mai',key);await F().route('studio');};
    if(document.body.classList.contains('forge-player'))$('engine5-edit').hidden=true;
    F().store.on(()=>{const p=F().store.profile('mai');left.destroy();right.destroy();left=new INK.Renderer($('engine5-base-root'),p);right=new INK.Renderer($('engine5-new-root'),p);left.setStyle(p.previewStyle||{});right.setStyle(p.previewStyle||{});$('engine5-new-root').insertBefore(fx.backRoot,right.group);$('engine5-new-root').appendChild(fx.root);if(modal.open)select(record.key);});
    const telemetry=document.createElement('div');telemetry.id='engine5-telemetry';telemetry.className='engine5-telemetry';document.querySelector('#flow-instruments')?.appendChild(telemetry);
    let lastMetric=0;
    requestAnimationFrame(function tick(now){requestAnimationFrame(tick);if(modal.open&&playing&&!document.hidden){const dt=Math.min(80,now-stamp);frame=(frame+dt*.06*speed)%record.clip.duration;paint();}stamp=now;
      if(now-lastMetric>500&&F().state.route==='battle'){lastMetric=now;const c=INK.EngineClock.inspect();telemetry.innerHTML=`<span>ENGINE <strong>05 / 60 Hz</strong></span><span>STEP <strong>${c.lastSteps}</strong></span><span>ALPHA <strong>${c.alpha.toFixed(2)}</strong></span><span>PARTICLES <strong>${INK.VFX.stats.active}/320</strong></span><span>RIBBONS <strong>${INK.VFX.trailStats.active}/64</strong></span><span>DROP <strong>${c.discardedSteps}</strong></span>`;}
    });
    globalThis.INKEngineLab={version:'5.0.0',open,close,select,seek,setOptions,paint,snapshot:()=>structuredClone(current),get record(){return record;},get actor(){return right;},get effects(){return fx;}};
  }
  init();
})();
