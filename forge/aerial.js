'use strict';
(() => {
 const $=id=>document.getElementById(id);
 function init(){if(!window.INKKineticLab?.ready){requestAnimationFrame(init);return;}
  const panel=document.createElement('div');panel.id='air-coach';panel.innerHTML='<div class="air-head"><strong>AIR FLOW · 落点由你选择</strong><label><input id="air-enabled" type="checkbox" checked> 空中操控与受身</label></div><p>轻点 W 短跳，按住 W 高跳；空中 A/D 微调，下降时 S 快落。快落需承担 11 帧落地硬直。</p><div class="air-buttons"><button id="air-hold">按住高跳</button><button id="air-down">按住快落</button><button id="air-drill">练受身：迎接扫腿</button><button id="air-recover">倒地后 Q · 受身（1 斗气）</button></div><small id="air-cue">倒地后按 A/D + Q 可选择滑步方向；无方向则原地快速起身。</small>';
  $('kinetic-note').before(panel);$('air-enabled').onchange=e=>{INK.Aerial.settings.enabled=e.target.checked;};
  function hold(id,key){const b=$(id),press=()=>{SVG_FIGHTER.panelInput(id,[key]);},release=()=>SVG_FIGHTER.panelInput(id,[]);b.onpointerdown=e=>{b.setPointerCapture(e.pointerId);press();};b.onpointerup=release;b.onpointercancel=release;b.onlostpointercapture=release;b.onkeydown=e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();press();}};b.onkeyup=e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();release();}};b.onblur=release;}
  hold('air-hold','up');hold('air-down','down');
  $('air-recover').onclick=()=>{SVG_FIGHTER.panelInput('air-recover',['PAR']);SVG_FIGHTER.panelInput('air-recover',[]);$('stage-wrap').focus({preventScroll:true});};
  $('air-drill').onclick=()=>{const A=SVG_FIGHTER;A.reset();A.teleport(0,560);A.teleport(1,720);$('dummy').value='idle';A.inputMove(1,'cHK');$('stage-wrap').focus({preventScroll:true});};
  function paint(){const A=SVG_FIGHTER,f=A.fighters[0];if(f){const q=INK.Aerial.inspect(f,A.state),labels={rise:'上升 · 松开 W 可收短跳跃',apex:'顶点 · 决定继续滞空或按 S 快落',fall:'下坠 · A/D 小幅修正落点',fast:'快落已承诺 · 不能再次跳起',landing:`落地承重 · ${q.recovery} 帧后恢复出招`,ground:'站稳 · 轻点短跳，按住高跳'};let text=!q.enabled?'使用原有跳跃与起身规则。':f.state==='down'?'已倒地：Q 花费 1 斗气快速受身，A/D 选择方向。':f._inkRecovery?'受身中 · 位移结束后仍有可被惩罚的恢复。':labels[q.phase];if($('air-cue').textContent!==text)$('air-cue').textContent=text;}requestAnimationFrame(paint);}paint();
 }
 init();
})();
