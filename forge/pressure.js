'use strict';
(() => {
 const $=id=>document.getElementById(id);
 function init(){if(!window.INKDuel?.ready){requestAnimationFrame(init);return;}
  const box=document.createElement('section');box.id='pressure-coach';box.style.cssText='border-top:1px solid #536d89;padding:16px 0';
  box.innerHTML='<div class="air-head"><strong>攻防选择 · 退让 / 脱压 / 反击</strong><label><input id="pressure-enabled" type="checkbox" checked> 防守分支</label></div><p>第二击接触后，在上方连携区选择收尾、追距或再压。防守中：后方向 + F 退让（0.5斗气）；后方向 + Q 脱压（1.5斗气）；前方向 + E 反击（2斗气）。</p><div class="air-buttons"><button id="pressure-practice">近身防守练习</button><label><input id="pressure-hold" type="checkbox"> 保持后方向防御</label><button id="pressure-opponent">对手中拳</button><button data-defense="YIELD">退让 · 0.5</button><button data-defense="ESCAPE">脱压 · 1.5</button><button data-defense="REV">反击 · 2</button></div><p id="pressure-status" aria-live="polite">退让延长硬直并让出距离；脱压有20帧恢复，投技和延迟追击可以抓。角落没有额外后退空间。</p>';
  $('chain-coach').after(box);
  $('pressure-enabled').onchange=e=>{INK.PressureFlow.settings.enabled=e.target.checked;};
  $('pressure-practice').onclick=async()=>{await INKDuel.start('training');const A=SVG_FIGHTER;A.teleport(0,500);A.teleport(1,680);$('dummy').value='idle';$('pressure-hold').checked=true;A.panelInput('pressure-guard',['left']);$('stage-wrap').focus({preventScroll:true});};
  $('pressure-hold').onchange=e=>{const f=SVG_FIGHTER.fighters[0];SVG_FIGHTER.panelInput('pressure-guard',e.target.checked?[f.dir===1?'left':'right']:[]);};
  $('pressure-opponent').onclick=()=>{SVG_FIGHTER.inputMove(1,'sMP');$('stage-wrap').focus({preventScroll:true});};
  for(const b of box.querySelectorAll('[data-defense]'))b.onclick=()=>{SVG_FIGHTER.inputMove(0,b.dataset.defense);$('stage-wrap').focus({preventScroll:true});};
  window.INKPressureLab={ready:true};
 }
 init();
})();
