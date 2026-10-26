'use strict';
(() => {
 function init(){if(!window.INKKineticLab?.ready){requestAnimationFrame(init);return;}
  const box=document.createElement('div');box.id='stage-light-coach';box.className='air-head';box.style.cssText='padding:14px 0;flex-wrap:wrap';box.innerHTML='<label><input type="checkbox" checked> STAGE LIGHT · 战场光影</label><select aria-label="光影场景"><option value="neon">雨夜霓虹</option><option value="courtyard">庭院暖光</option><option value="rooftop">天台月光</option></select><small>环境染色 · 脚底接触影 · 波与命中的局部照明</small>';
  document.getElementById('kinetic-note').before(box);box.querySelector('input').onchange=e=>{INK.StageLight.settings.enabled=e.target.checked;SVG_FIGHTER.render();INK.VFX.render(SVG_FIGHTER.state,1);};box.querySelector('select').onchange=e=>SVG_FIGHTER.setStage(e.target.value);
 }
 init();
})();
