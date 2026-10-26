'use strict';
(() => {
 const $=id=>document.getElementById(id);
 function init(){if(!window.INKDuel?.ready||!$('air-coach')){requestAnimationFrame(init);return;}
  const box=document.createElement('section');box.id='wake-coach';box.style.cssText='border-top:1px solid #536d89;padding:16px 0';
  box.innerHTML='<div class="air-head"><strong>倒地之后 · 改变下一次交锋</strong><label><input id="wake-enabled" type="checkbox" checked> 起身选择</label></div><p>倒地按 F 延迟起身；Q 花费 1 斗气受身，A/D 决定方向。起身按 E 花费 1.5 斗气迎击，启动有一次短暂护甲，被投或被防住仍有风险。</p><div class="air-buttons"><button id="wake-practice">练习起身：迎接扫腿</button><button data-wake="WAKE_DELAY">倒地 F · 延迟</button><button data-wake="WAKE_STRIKE">起身 E · 迎击 1.5</button><label><input id="ground-contact-enabled" type="checkbox" checked> 地面接触反馈</label></div><p id="wake-cue" aria-live="polite">守住、延迟、方向受身或迎击；倒地后仍有下一步。</p>';
  $('air-coach').after(box);$('wake-enabled').onchange=e=>{INK.WakeFlow.settings.enabled=e.target.checked;};
  $('ground-contact-enabled').onchange=e=>{INK.GroundContact.settings.enabled=e.target.checked;};
  $('wake-practice').onclick=async()=>{await INKDuel.start('training');const A=SVG_FIGHTER;A.teleport(0,560);A.teleport(1,720);$('dummy').value='idle';A.inputMove(1,'cHK');$('stage-wrap').focus({preventScroll:true});};
  for(const b of box.querySelectorAll('[data-wake]'))b.onclick=()=>{SVG_FIGHTER.inputMove(0,b.dataset.wake);$('stage-wrap').focus({preventScroll:true});};
  let old='';function paint(){const f=SVG_FIGHTER.fighters[0];if(f){const q=f._inkWake,text=!INK.WakeFlow.active()?'使用原有起身规则。':f.attack?.m.wakeStrike?'迎击已承诺 · 投技、连续打击与后摇惩罚可以应对。':f.state==='down'?(q?.delayed?'已延迟 · 等待起身，也可花斗气受身。':'已倒地 · F 延迟，Q 方向受身。'):f.state==='rise'?'正在起身 · E 迎击，或保持后方向准备防御。':'守住、延迟、方向受身或迎击；倒地后仍有下一步。';if(text!==old){$('wake-cue').textContent=text;old=text;}}requestAnimationFrame(paint);}paint();window.INKWakeLab={ready:true};
 }
 init();
})();
