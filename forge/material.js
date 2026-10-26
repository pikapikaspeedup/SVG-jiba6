'use strict';
(() => {
 function init(){if(!window.INKKineticLab?.ready){requestAnimationFrame(init);return;}
  const box=document.createElement('div');box.id='material-coach';box.className='air-head';box.style.cssText='padding:14px 0;flex-wrap:wrap';box.innerHTML='<label><input type="checkbox" checked> MATERIAL FLOW · 材质运动</label><button>试角色近身必杀</button><small></small>';
  document.getElementById('kinetic-note').before(box);
  box.querySelector('input').onchange=e=>{INK.MaterialFlow.settings.enabled=e.target.checked;};
  box.querySelector('button').onclick=()=>{const A=SVG_FIGHTER,f=A.fighters[0];if(A.state.screen!=='battle')return;const list=A.moves[f.ch.id],m=list.find(m=>m.category==='special'&&m.strength===1&&!m.air&&!m.throw&&!m.kind.includes('projectile'));if(m)A.inputMove(0,m.id);};
  let last='';function paint(){const id=SVG_FIGHTER.fighters[0]?.ch.id;if(id!==last){last=id;box.querySelector('small').textContent=(INK.MaterialFlow.profiles[id]?.name||'')+' · 挥空留轨，命中散开，防御反卷';}requestAnimationFrame(paint);}paint();
 }
 init();
})();
