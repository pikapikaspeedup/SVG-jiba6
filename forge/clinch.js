'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 function init(){if(!window.INKDuel?.ready||!$('pursuit-coach')){requestAnimationFrame(init);return;}
  const box=document.createElement('section');box.id='clinch-coach';box.style.cssText='border-top:1px solid #536d89;padding:16px 0';
  box.innerHTML='<div class="air-head"><strong>贴身交锋 · 打、投、退</strong></div><p>V 普通投，后方向 + V 背投。抓取瞬间按 V 可拆普通投；指令投无法拆解。后退或跳跃能让投技落空，再抓住对方收手的破绽。</p><div class="air-buttons"><button id="clinch-practice">进入近身练习</button><button id="clinch-throw">V · 投 / 拆投</button><button id="clinch-back">后 + V · 背投</button></div><p id="clinch-cue">投技扑空也要收手，按键预判需要承担出招风险。</p>';
  $('pursuit-coach').after(box);
  $('clinch-practice').onclick=async()=>{await INKDuel.start('training');const A=SVG_FIGHTER;A.teleport(0,560);A.teleport(1,690);$('dummy').value='idle';$('stage-wrap').focus({preventScroll:true});};
  $('clinch-throw').onclick=()=>{const A=SVG_FIGHTER;A.press(0,'THROW');A.release(0,'THROW');$('stage-wrap').focus({preventScroll:true});};
  $('clinch-back').onclick=()=>{const A=SVG_FIGHTER,f=A.fighters[0];if(!f)return;const key=f.dir===1?'left':'right',held=f.input.held.has(key);A.press(0,key);A.press(0,'THROW');A.release(0,'THROW');if(!held)A.release(0,key);$('stage-wrap').focus({preventScroll:true});};
  let last='';function paint(){const A=SVG_FIGHTER,f=A.fighters[0],e=f?._inkClinchOutcome,age=e?A.state.actionTick-e.at:Infinity;
   const text=f?.captureKind==='throw'?(f.throwAction?.m.commandThrow?'指令投已抓住 · 下次用后撤、跳跃或先出招应对。':'被抓住 · 抓取瞬间按 V 拆投。'):age<60?(e.result==='tech'?'双方拆开 · 重新争取距离。':e.result==='whiff'?'投技落空 · 收手前无法再次行动。':e.result==='grab'?'抓握确认 · 用身体转移对方重心。':'投掷落地 · 准备下一次起身攻防。'):'投技扑空也要收手，按键预判需要承担出招风险。';if(text!==last){$('clinch-cue').textContent=text;last=text;}requestAnimationFrame(paint);
  }paint();window.INKClinchLab={ready:true};
 }init();
})();
