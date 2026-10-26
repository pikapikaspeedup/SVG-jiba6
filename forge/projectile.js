'use strict';
(() => {
 function init(){if(!window.INKKineticLab?.ready){requestAnimationFrame(init);return;}
  const box=document.createElement('div');box.id='projectile-coach';box.style.cssText='padding:14px 0;border-top:1px solid #536d89';box.innerHTML='<div class="air-head"><strong>PROJECTILE FLOW · 对波与跟进</strong><label><input type="checkbox" checked> 连续对冲与能量消耗</label></div><p>普通波 1 格、OD 波 2 格、超级波 4 格。对冲消耗能量，剩余波继续前进但伤害下降。用弧线读剩余能量。</p><div class="air-buttons"><button data-duel="normal">隆对练 · 双普通波</button><button data-duel="od">隆对练 · OD 穿普通波</button><button data-duel="manual">隆对练 · 你来迎波</button></div><small>进入迎波练习后，可发波、招架或跳入；对冲不会冻结角色移动。</small>';
  document.getElementById('kinetic-note').before(box);box.querySelector('input').onchange=e=>{INK.ProjectileFlow.settings.enabled=e.target.checked;};
  for(const b of box.querySelectorAll('button'))b.onclick=()=>{
   const A=SVG_FIGHTER;A.start('ryu','ryu','training','classic');document.getElementById('kinetic-character').value='ryu';document.getElementById('kinetic-dummy').value='idle';document.getElementById('dummy').value='idle';document.getElementById('infinite').checked=false;A.teleport(0,240);A.teleport(1,1200);
   const normal=A.moves.ryu.find(m=>m.kind==='projectile'&&m.strength===1&&!m.od),od=A.moves.ryu.find(m=>m.kind==='projectile'&&m.od);
   if(b.dataset.duel!=='manual')A.inputMove(0,b.dataset.duel==='od'?od.id:normal.id);A.inputMove(1,normal.id);document.getElementById('stage-wrap').focus({preventScroll:true});
  };
 }
 init();
})();
