'use strict';
(() => {
 const $=id=>document.getElementById(id);
 function init(){if(!window.INKDuel?.ready||!$('air-coach')){requestAnimationFrame(init);return;}
  const box=document.createElement('section');box.id='pursuit-coach';box.style.cssText='border-top:1px solid #536d89;padding:16px 0';
  box.innerHTML='<div class="air-head"><strong>挑空追击 · 确认之后再投入</strong><label><input id="pursuit-enabled" type="checkbox" checked> 付费追空</label></div><p>蹲重拳击飞后，前方向 + F 花费 1.5 斗气追空。起跳后选择一次空中普通技；没有无敌，挥空也不退款，落地要重新站稳。</p><div class="air-buttons"><button id="pursuit-practice">练挑空：蹲重拳</button><button id="pursuit-go">前 + F · 追空 1.5</button><button data-pursuit-move="aMP">K · 空中中拳</button><button data-pursuit-move="aHK">O · 空中重脚</button></div><p id="pursuit-cue">先用 S + L 蹲重拳击飞，再决定是否追击。</p>';
  $('air-coach').after(box);$('pursuit-enabled').onchange=e=>{INK.AirPursuit.settings.enabled=e.target.checked;};
  $('pursuit-practice').onclick=async()=>{await INKDuel.start('training');const A=SVG_FIGHTER;A.teleport(0,560);A.teleport(1,720);$('dummy').value='idle';A.inputMove(0,'cHP');$('stage-wrap').focus({preventScroll:true});};
  $('pursuit-go').onclick=()=>{SVG_FIGHTER.inputMove(0,'AIR_CHASE');$('stage-wrap').focus({preventScroll:true});};
  for(const button of box.querySelectorAll('[data-pursuit-move]'))button.onclick=()=>{SVG_FIGHTER.inputMove(0,button.dataset.pursuitMove);$('stage-wrap').focus({preventScroll:true});};
  let old='';function paint(){const A=SVG_FIGHTER,f=A.fighters[0];if(f){const q=f._inkPursuit,gate=INK.AirPursuit.decision(f,'AIR_CHASE',A.state),text=!INK.AirPursuit.active()?'追空已关闭。':q?.phase==='windup'?'正在压身起跳 · 仍可能被打断。':q?.phase==='flight'?(q.attackUsed?'追击已出手 · 准备承担落地恢复。':'空中只选一击 · K 中拳，O 重脚。'):q?.phase==='landing'?'落地恢复 · 追空的代价。':gate.ok||gate.code==='hitstop'?'击飞已确认 · 前 + F 追空，或留在地面。':'先用 S + L 蹲重拳击飞，再决定是否追击。';if(text!==old){$('pursuit-cue').textContent=text;old=text;}}
   requestAnimationFrame(paint);
  }paint();window.INKPursuitLab={ready:true};
 }
 init();
})();
