'use strict';
(() => {
 function init(){if(!window.INKKineticLab?.ready){requestAnimationFrame(init);return;}
  const box=document.createElement('div');box.id='super-coach';box.style.cssText='padding:14px 0;border-top:1px solid #536d89';box.innerHTML='<div class="air-head"><strong>SUPER DIRECTOR · 强度跟随交锋</strong><label><input type="checkbox" checked> 分阶段超级技演出</label></div><div class="air-buttons"><button data-super-close>贴近练超必杀</button><button data-super="SA1">SA 1</button><button data-super="SA2">SA 2</button><button data-super="SA3">SA 3</button></div><small>消耗真实超级能量；发动、命中、防御、终结与落空分别呈现，双方站位始终保留。</small>';
  document.getElementById('kinetic-note').before(box);box.querySelector('input').onchange=e=>INK.SuperDirector.settings.enabled=e.target.checked;box.querySelector('[data-super-close]').onclick=()=>{const A=SVG_FIGHTER;A.reset();A.teleport(0,560);A.teleport(1,720);document.getElementById('stage-wrap').focus({preventScroll:true});};for(const b of box.querySelectorAll('[data-super]'))b.onclick=()=>{SVG_FIGHTER.inputMove(0,b.dataset.super);document.getElementById('stage-wrap').focus({preventScroll:true});};
 }
 init();
})();
