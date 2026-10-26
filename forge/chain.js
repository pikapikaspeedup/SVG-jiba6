'use strict';
(() => {
 const $=id=>document.getElementById(id),keys={LP:'J',MP:'K',HP:'L',LK:'U',MK:'I',HK:'O'};
 function init(){if(!window.INKKineticLab?.ready){requestAnimationFrame(init);return;}
  const panel=document.createElement('div');panel.id='chain-coach';panel.innerHTML='<div class="chain-heading"><strong id="chain-name">角色连携</strong><button id="chain-close">贴近练连</button><label><input id="chain-enabled" type="checkbox" checked> 开启角色连携</label></div><div id="chain-steps"></div><p id="chain-cue" aria-live="polite"></p>';
  $('kinetic-note').before(panel);$('chain-close').onclick=()=>{const A=SVG_FIGHTER;A.reset();A.teleport(0,560);A.teleport(1,720);$('stage-wrap').focus({preventScroll:true});};$('chain-enabled').onchange=e=>{INK.FlowChain.settings.enabled=e.target.checked;};
  let character=null;const write=(id,text)=>{if($(id).textContent!==text)$(id).textContent=text;};
  function paint(){const A=SVG_FIGHTER,f=A.fighters[0],G=A.state;if(!f){requestAnimationFrame(paint);return;}const info=INK.FlowChain.inspect(f,G);
   if(character!==f.ch.id){character=f.ch.id;$('chain-steps').replaceChildren();for(const [i,id]of info.route.entries()){const m=A.getMove(f,id),b=document.createElement('button');b.dataset.step=i;b.textContent=`${i+1} · ${m.name}  ${keys[m.button]||''}`;b.onclick=()=>{A.inputMove(0,id);$('stage-wrap').focus({preventScroll:true});};$('chain-steps').append(b);}write('chain-name',info.name+' · 命中确认连携');}
   const active=INK.FlowChain.settings.enabled&&INK.Kinetic.settings.enabled&&INK.CombatFlow.settings.rules==='flow';
   for(const b of $('chain-steps').children){const i=Number(b.dataset.step);b.classList.toggle('chain-current',active&&i===info.step);b.classList.toggle('chain-ready',active&&i===info.step+1&&!!info.gate?.ok);}
   let cue='按第一击起手，确认接触后再接下一击。点击招式或使用键盘；不会自动替你出招。';
   if(!active)cue='角色连携已关闭，使用原有取消规则。';
   else if(info.step===2)cue=f.attack.hitConfirmed?'三段命中！可以收手，或尝试原有必杀取消。':'终结击正在出招；注意距离，不保证命中。';
   else if(info.gate?.ok)cue=G.hitstop>0?'接触确认 · 定格中可预输入下一击，解冻后执行。':`现在可接下一击 · 还剩 ${Math.ceil(info.gate.remaining)} 动作帧`;
   else if(info.gate?.code==='hitOnly')cue='第二击被防御：第三击不可接。收手，或选择合法必杀取消。';
   else if(info.gate?.code==='window')cue='连携窗口已过，等收势结束再组织进攻。';
   else if(info.step>=0)cue='等待真实命中或防御确认；挥空不能取消。';
   write('chain-cue',cue);requestAnimationFrame(paint);
  }paint();
 }
 init();
})();
