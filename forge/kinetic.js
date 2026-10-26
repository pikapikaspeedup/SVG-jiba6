'use strict';
(() => {
 const $=id=>document.getElementById(id);
 function init(){if(!window.INKSpacingLab?.ready){requestAnimationFrame(init);return;}
  const panel=document.createElement('section');panel.id='kinetic-panel';panel.innerHTML=`<div class="kinetic-title"><div><span>KINETIC / 格斗表现升级</span><h3>出拳有动势，命中有回响。</h3></div><label><input id="kinetic-enabled" type="checkbox" checked> 新一代动作与打击表现</label></div><p>肩胯发力 · 速度驱动轨迹 · 接触压缩与回弹 · 分层冲击。切换开关，直接比较同一招。</p><div class="kinetic-actions"><label>角色<select id="kinetic-character"></select></label><button id="kinetic-play" class="f-primary">进入自由对练</button><button data-kinetic-move="sLP">轻拳</button><button data-kinetic-move="sHP">重拳</button><button data-kinetic-move="sHK">重脚</button><button data-kinetic-move="cMK">下段</button><button data-kinetic-move="special">必杀技</button><button id="kinetic-jump">跳跃落地</button><label>木桩<select id="kinetic-dummy"><option value="idle">挨打</option><option value="guard">防御</option><option value="cpu">对战</option></select></label><button id="kinetic-reset">重置距离</button></div><small id="kinetic-note">WASD 移动 · J/K/L 拳 · U/I/O 脚 · Q 招架 · F 迸发。按键仍遵循硬直、资源与取消窗口。</small>`;
  $('f-battle-mount').before(panel);for(const c of SVG_FIGHTER.characters){const option=document.createElement('option');option.value=c.id;option.textContent=c.name;$('kinetic-character').append(option);}
  const home=document.createElement('section');home.className='kinetic-launch';home.innerHTML='<div><span>格斗体验 / KINETIC</span><h3>这一拳，有分量。</h3><p>重心、拳路、身体反应与命中画面一起升级。进入练习，亲手试轻拳、重击和防御。</p></div><button class="f-primary">体验格斗升级 ↗</button>';document.querySelector('.f9-launch').before(home);
  async function start(){INK.Combo.stop();SVG_FIGHTER.experience?.exitLessons();INK.Spacing.training?.stop();await INKForge.route('battle');INK.CombatFlow.set({rhythm:'fluid',speed:1});SVG_FIGHTER.start($('kinetic-character').value,'ken','training','classic');$('dummy').value=$('kinetic-dummy').value;$('infinite').checked=false;$('autohp').checked=true;reset();}
  function reset(){const A=SVG_FIGHTER;if(A.state.screen!=='battle')return;A.reset();A.teleport(0,560);A.teleport(1,765);$('dummy').value=$('kinetic-dummy').value;$('stage-wrap').focus({preventScroll:true});}
  const run=fn=>()=>Promise.resolve().then(fn).catch(e=>INKForge.toast(e.message,true));
  home.querySelector('button').onclick=run(start);$('kinetic-play').onclick=run(start);$('kinetic-reset').onclick=reset;
  $('kinetic-enabled').onchange=e=>{INK.Kinetic.set(e.target.checked);$('stage-wrap').focus({preventScroll:true});};
  $('kinetic-character').onchange=run(start);$('kinetic-jump').onclick=()=>{const A=SVG_FIGHTER,f=A.fighters[0],tick=A.state.tick;A.state.paused=false;A.panelInput('jump-tap',['up']);requestAnimationFrame(function release(){if(f!==A.fighters[0])return;if(A.state.tick>tick||A.state.paused||A.state.screen!=='battle'){A.panelInput('jump-tap',[]);return;}requestAnimationFrame(release);});$('stage-wrap').focus({preventScroll:true});};
  $('kinetic-dummy').onchange=e=>{$('dummy').value=e.target.value;$('stage-wrap').focus({preventScroll:true});};
  for(const b of panel.querySelectorAll('[data-kinetic-move]'))b.onclick=()=>{const A=SVG_FIGHTER,f=A.fighters[0],id=b.dataset.kineticMove;if(A.state.screen!=='battle')return;const m=id==='special'?A.moves[f.ch.id].find(m=>m.category==='special'&&m.strength===1):A.getMove(f,id);if(!m){INKForge.toast('此角色没有这项示范招式',true);return;}A.inputMove(0,m.id);$('stage-wrap').focus({preventScroll:true});};
  window.INKKineticLab={ready:true,start};
 }
 init();
})();
