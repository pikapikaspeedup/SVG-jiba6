'use strict';
(() => {
 function init(){if(!window.INKKineticLab?.ready){requestAnimationFrame(init);return;}
  const box=document.createElement('div');box.id='strike-coach';box.style.cssText='padding:14px 0;border-top:1px solid #536d89';box.innerHTML='<div class="air-head"><strong>STRIKE FEEL · 接触有层次</strong><label><input type="checkbox" checked> 分部位回弹与接触音色</label></div><div class="air-buttons"><button data-strike="sLP">试轻拳</button><button data-strike="sHP">试重拳</button><button data-strike="cMK">试下段</button><button data-sound>开启 / 关闭音效</button></div><small>开启声音后，比较轻重、身体部位和防御的音色；命中仍遵循真实距离与硬直。</small>';
  document.getElementById('kinetic-note').before(box);box.querySelector('input').onchange=e=>{INK.StrikeFeel.settings.enabled=e.target.checked;};box.querySelector('[data-sound]').onclick=()=>document.getElementById('sound-btn').click();for(const b of box.querySelectorAll('[data-strike]'))b.onclick=()=>{SVG_FIGHTER.inputMove(0,b.dataset.strike);document.getElementById('stage-wrap').focus({preventScroll:true});};
 }
 init();
})();
