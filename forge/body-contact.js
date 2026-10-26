'use strict';
(() => {
 const $=id=>document.getElementById(id);
 function init(){if(!window.INKDuel?.ready){requestAnimationFrame(init);return;}
  const box=document.createElement('section');box.id='body-contact-coach';box.style.cssText='padding:16px 0;border-top:1px solid #536d89';box.innerHTML='<div class="air-head"><strong>身体与接触 · 隆 / 嘉米</strong><div><label><input id="body-support-enabled" type="checkbox" checked> 支撑与发力</label> <label><input id="contact-response-enabled" type="checkbox" checked> 方向性接触</label></div></div><p>隆扎稳支撑、沉肩发力；嘉米迅速换脚、转髋接近。移动、急停、重拳和防御时感受两种身体语言。</p><div class="air-buttons"><button data-body-character="ryu">用隆练习</button><button data-body-character="cammy">用嘉米练习</button><button data-body-spacing="close">贴近</button><button data-body-spacing="tip">拳端距离</button><button data-body-punch>重拳</button><label><input id="body-guard" type="checkbox"> 对手防御</label><button id="body-duel" class="f-primary">隆 × 嘉米实战</button></div><small>WASD 进退与跳跃 · L 重拳。距离和接近方向改变受击退让，招式伤害与出招时机保持原规则。</small>';
  $('kinetic-panel').prepend(box);
  const note=document.createElement('span');note.className='body-sample-note';note.style.cssText='font-size:12px;color:#c9d8a8';note.textContent='本轮身体样板：隆 · 嘉米';document.querySelector('.fight-actions').append(note);
  const run=fn=>()=>Promise.resolve().then(fn).catch(e=>INKForge.toast(e.message,true));
  function position(kind='close'){const A=SVG_FIGHTER;A.reset();$('dummy').value=$('body-guard').checked?'guard':'idle';A.teleport(0,500);A.teleport(1,kind==='tip'?755:680);$('stage-wrap').focus({preventScroll:true});}
  for(const b of box.querySelectorAll('[data-body-character]'))b.onclick=run(async()=>{$('fight-player').value=b.dataset.bodyCharacter;$('fight-opponent').value=b.dataset.bodyCharacter==='ryu'?'cammy':'ryu';$('fight-control').value='classic';await INKDuel.start('training');position();});
  for(const b of box.querySelectorAll('[data-body-spacing]'))b.onclick=()=>position(b.dataset.bodySpacing);
  box.querySelector('[data-body-punch]').onclick=()=>{SVG_FIGHTER.inputMove(0,'sHP');$('stage-wrap').focus({preventScroll:true});};
  $('body-guard').onchange=e=>{$('dummy').value=e.target.checked?'guard':'idle';};
  $('body-support-enabled').onchange=e=>{INK.BodySupport.settings.enabled=e.target.checked;for(const f of SVG_FIGHTER.fighters)INK.BodySupport.reset(f);};$('contact-response-enabled').onchange=e=>INK.ContactResponse.settings.enabled=e.target.checked;
  $('body-duel').onclick=run(async()=>{$('fight-player').value='ryu';$('fight-opponent').value='cammy';await INKDuel.start('cpu');});
  $('fight-opponent').value='cammy';
  window.INKBodyContactLab={ready:true};
 }
 init();
})();
