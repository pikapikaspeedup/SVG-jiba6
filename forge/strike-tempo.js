'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 function init(){if(!window.INKClinchLab?.ready){requestAnimationFrame(init);return;}
  const box=document.createElement('section');box.id='tempo-coach';box.style.cssText='border-top:1px solid #536d89;padding:16px 0';
  box.innerHTML='<div class="air-head"><strong>重击蓄势 · 改变出手节奏</strong></div><p>轻点 L / O 正常出拳、出脚。站立起手时按住重击可短暂蓄势，松开出击；蓄势中后方向 + F 花费 0.5 斗气收招，随后有 12 帧破绽。蓄势不会增加伤害，也挡不住对方的攻击。</p><div class="air-buttons"><button id="tempo-practice">进入牵制练习</button><button id="tempo-hp">按住 · 重拳 L</button><button id="tempo-hk">按住 · 重脚 O</button><button id="tempo-feint">后 + F · 收招</button></div><p id="tempo-cue">用身体蓄势诱导对手，再选择出击或收手。</p>';
  $('clinch-coach').after(box);
  $('tempo-practice').onclick=async()=>{await INKDuel.start('training');const A=SVG_FIGHTER;A.teleport(0,540);A.teleport(1,835);$('dummy').value='idle';$('stage-wrap').focus({preventScroll:true});};
  for(const [id,key]of [['tempo-hp','HP'],['tempo-hk','HK']]){
   const el=$(id),source='tempo-'+key;let pointer=null,keyHeld=false;
   const update=()=>SVG_FIGHTER.panelInput(source,pointer!==null||keyHeld?[key]:[]);
   el.onpointerdown=e=>{if(e.button!==0||pointer!==null)return;e.preventDefault();pointer=e.pointerId;el.setPointerCapture(pointer);update();};
   const release=e=>{if(pointer!==e.pointerId)return;pointer=null;update();};el.onpointerup=release;el.onpointercancel=release;el.onlostpointercapture=release;
   el.onkeydown=e=>{if(![' ','Enter'].includes(e.key))return;e.preventDefault();if(!keyHeld){keyHeld=true;update();}};
   el.onkeyup=e=>{if(![' ','Enter'].includes(e.key))return;e.preventDefault();keyHeld=false;update();};
   const clear=()=>{pointer=null;keyHeld=false;update();};el.onblur=clear;window.addEventListener('blur',clear);
  }
  $('tempo-feint').onclick=()=>{const A=SVG_FIGHTER,f=A.fighters[0];if(!f)return;const back=f.dir===1?'left':'right';A.panelInput('tempo-feint',[back,'RUSH']);A.panelInput('tempo-feint',[]);};
  let last='';function paint(){const f=SVG_FIGHTER.fighters[0],q=f?.attack?.tempo,v=f?._inkTempo,text=q?.phase==='holding'?'身体正在蓄势 · 松开重击出招，后 + F 收招。':v?.phase==='feint'&&f.state==='recovery'?'收势中 · 此时仍可能被对手抓住破绽。':q?.phase==='released'?'已经出手 · 命中后再决定是否继续连携。':'用身体蓄势诱导对手，再选择出击或收手。';if(text!==last){$('tempo-cue').textContent=text;last=text;}requestAnimationFrame(paint);}paint();window.INKTempoLab={ready:true};
 }init();
})();
