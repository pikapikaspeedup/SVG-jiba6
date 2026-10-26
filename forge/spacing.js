/* A playable spacing lesson driven by the real 60 Hz combat loop. */
'use strict';
(() => {
 const $=id=>document.getElementById(id);let lesson=null,ready=false,marker=null;
 const text=(id,value)=>{const e=$(id);if(e&&e.textContent!==value)e.textContent=value;};
 const focus=()=>$('stage-wrap').focus({preventScroll:true});
 const A=()=>globalThis.SVG_FIGHTER;
 function stop(){lesson=null;}
 function beforeStep(G){
  if(!lesson)return;
  if(G.screen!=='battle'||G.mode!=='training'||!INK.Spacing.settings.enabled){stop();return;}
  const t=G.actionTick-lesson.start;
  if(t===lesson.delay){lesson.attack=A().tryMove(1,lesson.move);if(!lesson.attack)lesson.error='对手未能出招，请重新开始。';}
  if(lesson.demo&&t===lesson.delay+6)A().retreat(0);
  if(lesson.demo&&A().fighters[0]._inkRetreat?.ready)A().inputMove(0,'sMP');
 }
 function afterStep(G){
  if(!lesson)return;
  if(lesson.done)return;
  const [a,b]=A().fighters,t=G.actionTick-lesson.start;
  if(a.hp<10000)lesson.result='退晚了，或站得太近。短撤没有无敌帧。';
  const reentry=INK.Spacing.events.find(e=>e.type==='reentry'&&e.player===0),hit=INK.Spacing.events.find(e=>e.type==='contact'&&e.attacker===0&&e.result==='hit'&&e.serial===reentry?.serial);
  if(b.hp<10000){lesson.result=reentry&&hit?.punish?'反入确反！提前结束短撤，抓住了对手收招。':reentry?'反入命中，但对手已结束收招。换更快的招或调整距离。':'普通命中：未用反入，或反击晚于对手收招。';lesson.success=!!reentry&&!!hit?.punish;}
  if(t>=lesson.delay+60&&!lesson.result)lesson.result=INK.Spacing.events.some(e=>e.type==='near-miss')?'擦身成功，反击没赶上。下次看到金色提示就按 K。':'这次没有擦身。过早退远或未短撤，都不会获得反入。';
  if(lesson.result)lesson.done=true;
 }
 async function start(demo=false,config=null){
  const choice=config||{distance:Number($('s10-distance').value),delay:Number($('s10-delay').value),move:$('s10-move').value};
  if(![250,270,310].includes(choice.distance)||![60,78].includes(choice.delay)||!['sHK','sHP'].includes(choice.move))throw TypeError('无效练习配置');
  stop();await INKForge.route('battle');A().start('ryu','ryu','training','classic');
  const G=A().state;INK.Spacing.set(true);INK.Spacing.reset();G.paused=false;
  $('dummy').value='idle';$('autohp').checked=false;$('infinite').checked=false;
  const [a,b]=A().fighters;a.x=a.px=500;b.x=b.px=500+choice.distance;
  lesson={...choice,demo,start:G.actionTick,success:false,result:null};$('s10-panel').hidden=false;paint();focus();
 }
 function paint(){
  if(!ready)return;const G=A().state,a=A().fighters[0],r=a?._inkRetreat,enabled=INK.Spacing.settings.enabled;
  $('s10-enabled').checked=enabled;$('s10-reward').checked=INK.Spacing.settings.reentry;text('s10-mode',enabled?'计算对抗 · 实验规则已开启':'经典规则');
  $('s10-retreat').disabled=!enabled;$('s10-counter').disabled=!enabled;
  const near=INK.Spacing.events.findLast(e=>e.type==='near-miss');
  text('s10-gap',near?near.distance.toFixed(1)+' 单位':'—');
  if(marker){const show=enabled&&G.screen==='battle'&&near&&G.actionTick-near.frame<45;marker.style.display=show?'':'none';if(show){const [x,y]=near.pointB;marker.querySelector('text').setAttribute('x',x);marker.querySelector('text').setAttribute('y',y-20);marker.querySelector('text').textContent='擦身 '+near.distance.toFixed(1);marker.querySelector('path').setAttribute('d',`M${near.pointA[0]} ${near.pointA[1]}L${x} ${y}`);}}
  const usable=a&&INK.Spacing.canCancel(a,A().getMove(a,'sMP'));
  const state=usable?'可反入 · K 快拳 / L 重拳':r?.ready&&!INK.Spacing.settings.reentry?'擦身成立 · 取消奖励关闭':r?.ready?'擦身成立 · 可预输入 K / L':a?.state==='evade'?'短撤收势中 · 等整段攻击挥空':'X 短撤 → 擦身 → K 中拳';
  text('s10-state',state);$('s10-state').classList.toggle('s10-ready',!!usable);
  let note='短撤 24 动作帧；前 8 帧退 56 单位。近失 ≤18 单位且整招无接触，才允许在最后 4 帧提前接中拳或重拳；可提前输入缓冲。';
  if(lesson){const t=G.actionTick-lesson.start;note=(lesson.demo?'示范 · ':'亲自挑战 · ')+(lesson.error||lesson.result||(t<lesson.delay?`对手将在 ${lesson.delay-t} 帧后出招。看起手，按 X 短撤。`:'对手正在出招：先 X，再选 K 快拳或 L 重拳。'));}
  text('s10-note',note);text('s10-source',lesson?.demo?'示范使用真实输入与判定；不计为你的挑战成绩。':'WASD 调整距离 · X 短撤 · K 中拳 / L 重拳 · P 暂停 · N 单步。P2 短撤：小键盘减号。');
 }
 function init(){
  if(!globalThis.INKFluidLab?.ready){requestAnimationFrame(init);return;}
  const home=document.createElement('section');home.className='s10-launch';home.innerHTML=`<div><span>COMPUTATION → PLAY / 计算对抗实验</span><h3>让一拳，差一点。</h3><p>看准来招，短撤擦身；用省下的收势时间，打回去。距离由动作几何计算，反击由你决定。</p></div><button id="s10-open" class="f-primary">挑战「擦身反入」 ↗</button>`;
  document.querySelector('.f9-launch').before(home);
  const panel=document.createElement('section');panel.id='s10-panel';panel.hidden=true;panel.setAttribute('aria-label','擦身反入练习');panel.innerHTML=`<div class="s10-head"><div><span id="s10-mode">计算对抗</span><h3 id="s10-state">X 短撤 → 擦身 → K 中拳</h3></div><div class="s10-gap"><strong id="s10-gap">—</strong><span>最近擦身距离</span></div></div><div class="s10-options"><label>距离<select id="s10-distance"><option value="250">贴近 · 250</option><option value="270" selected>边缘 · 270</option><option value="310">偏远 · 310</option></select></label><label>对手<select id="s10-move"><option value="sHK">重脚 · 长起手</option><option value="sHP">重拳 · 短起手</option></select></label><label>节奏<select id="s10-delay"><option value="60">固定出手</option><option value="78">延迟出手</option></select></label><label>练习速度<select id="s10-speed"><option value="1">1×</option><option value="0.5">0.5× 慢练</option></select></label><small>更改距离、对手、节奏后点「重新挑战」。奖励开关保留几何与擦身反馈，可比较确反窗口。</small></div><p id="s10-note" role="status"></p><div class="s10-actions"><button id="s10-retreat">X · 短撤</button><button id="s10-counter">K · 中拳</button><button id="s10-heavy">L · 重拳</button><button id="s10-retry">重新挑战</button><button id="s10-demo">看一次示范</button><button id="s10-export">导出接触记录</button><label><input id="s10-reward" type="checkbox" checked>擦身取消奖励</label><label><input id="s10-enabled" type="checkbox">启用实验规则</label><button id="s10-hide" aria-label="收起擦身练习">收起</button></div><small id="s10-source"></small>`;
  $('f-battle-mount').before(panel);
  const toggle=document.createElement('button');toggle.id='s10-battle';toggle.textContent='计算对抗';toggle.onclick=()=>{panel.hidden=!panel.hidden;paint();};document.querySelector('.f-battle-head').append(toggle);
  const run=fn=>()=>Promise.resolve().then(fn).catch(e=>{INKForge.toast(e.message,true);console.error(e);});
  $('s10-open').onclick=run(()=>start(false));$('s10-retry').onclick=run(()=>start(false));$('s10-demo').onclick=run(()=>start(true));
  $('s10-retreat').onclick=()=>{A().retreat(0);focus();paint();};$('s10-counter').onclick=()=>{A().inputMove(0,'sMP');focus();paint();};
  $('s10-speed').onchange=e=>{INKRhythmLab.setSettings({speed:Number(e.target.value)});focus();};
  $('s10-heavy').onclick=()=>{A().inputMove(0,'sHP');focus();paint();};
  $('s10-reward').onchange=e=>{INK.Spacing.setReward(e.target.checked);paint();};
  $('s10-hide').onclick=()=>{panel.hidden=true;focus();};
  $('s10-enabled').onchange=e=>{stop();INK.Spacing.set(e.target.checked);try{localStorage.setItem(INKForge.store.id+'/spacing',JSON.stringify({enabled:e.target.checked}));}catch{}paint();};
  $('s10-export').onclick=()=>INK.Portable.download('INK-spacing-contacts.json',JSON.stringify({kind:'ink-spacing-contacts',version:1,...INK.Spacing.inspect()},null,2),'application/json');
  const load=data=>{if(!data||typeof data.enabled!=='boolean'||data.reentry!==undefined&&typeof data.reentry!=='boolean')throw TypeError('无效计算对抗设置');INK.Spacing.set(data.enabled);if(data.reentry!==undefined)INK.Spacing.setReward(data.reentry);};
  try{const seed=INKForge.store.embedded?.spacingSettings;if(seed)load(seed);}catch(e){INKForge.toast(e.message,true);}
  try{const local=JSON.parse(localStorage.getItem(INKForge.store.id+'/spacing')||'null');if(local)load(local);}catch{}

  marker=INK.SVG.node('g',{'aria-hidden':'true','pointer-events':'none'},$('camera'));INK.SVG.node('path',{stroke:'#f8d791','stroke-width':3},marker);INK.SVG.node('text',{fill:'#ffe2a6','font-size':17,'text-anchor':'middle'},marker);
  INK.Spacing.training={beforeStep,afterStep,stop,authority:()=>lesson};
  globalThis.INKSpacingLab={ready:true,start,stop,paint,get lesson(){return lesson?{...lesson}:null;}};ready=true;paint();requestAnimationFrame(function refresh(){if(A().state.screen==='battle')paint();requestAnimationFrame(refresh);});
 }
 init();
})();
