'use strict';
(() => {
 const $=id=>document.getElementById(id),keys={LP:'J',MP:'K',HP:'L',LK:'U',MK:'I',HK:'O'};
 function init(){if(!window.INKKineticLab?.ready){requestAnimationFrame(init);return;}
  const panel=document.createElement('div');panel.id='chain-coach';panel.innerHTML='<div class="chain-heading"><strong id="chain-name">角色连携</strong><button id="chain-close">贴近练连</button><label><input id="chain-enabled" type="checkbox" checked> 开启角色连携</label></div><div id="chain-steps"></div><div id="chain-branches" style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0"></div><p id="chain-cue" aria-live="polite"></p>';
  let positioningNote='';
  $('kinetic-note').before(panel);$('chain-close').onclick=()=>{const A=SVG_FIGHTER;A.reset();const f=A.fighters[0],d=A.fighters[1],route=INK.FlowChain.routes[f.ch.id],choices=route.map(id=>{const move=INK.Runtime.prepare(f,A.getMove(f,id));return {move,reach:INK.DuelReach.sample(f,move,A.geometry)};}),placement=INK.DuelReach.placement(f,d,choices,A.geometry);positioningNote=placement?'已按当前招式空间摆位，连续命中仍取决于推离与对手动作。':'这组招式没有共同的静态命中距离，需要步法或追距衔接。';if(placement){A.teleport(0,560);A.teleport(1,560+placement.distance);}$('stage-wrap').focus({preventScroll:true});};$('chain-enabled').onchange=e=>{INK.FlowChain.settings.enabled=e.target.checked;};
  let character=null;const write=(id,text)=>{if($(id).textContent!==text)$(id).textContent=text;};
  function paint(){const A=SVG_FIGHTER,f=A.fighters[0],G=A.state;if(!f){requestAnimationFrame(paint);return;}const info=INK.FlowChain.inspect(f,G);
   if(character!==f.ch.id){character=f.ch.id;$('chain-steps').replaceChildren();for(const [i,id]of info.route.entries()){const m=A.getMove(f,id),b=document.createElement('button');b.dataset.step=i;b.textContent=`${i+1} · ${m.name}  ${keys[m.button]||''}`;b.onclick=()=>{A.inputMove(0,id);$('stage-wrap').focus({preventScroll:true});};$('chain-steps').append(b);}$('chain-branches').replaceChildren();for(const option of info.branches){const m=A.getMove(f,option.id),b=document.createElement('button');b.dataset.branch=option.kind;b.style.cssText='flex:1;min-width:150px;white-space:normal';b.textContent=`${option.kind==='pursuit'?'命中追距':'防后再压'} · ${keys[m.button]||''} · ${option.driveCost}斗气`;b.title=`${option.label}：最多前移${option.travel}，仍需真实碰撞命中`;b.onclick=()=>{A.inputMove(0,option.id);$('stage-wrap').focus({preventScroll:true});};$('chain-branches').append(b);}write('chain-name',info.name+' · 接触后选择');}
   const active=INK.FlowChain.settings.enabled&&INK.CombatFlow.settings.rules==='flow';
   for(const b of $('chain-steps').children){const i=Number(b.dataset.step);b.classList.toggle('chain-current',active&&i===info.step);b.classList.toggle('chain-ready',active&&i===info.step+1&&!!info.gate?.ok);}
   for(const b of $('chain-branches').children){const option=info.branches.find(x=>x.kind===b.dataset.branch),ready=active&&!!option?.gate?.ok;b.style.borderColor=ready?'#b7e88c':'#60716b';b.style.background=ready?'#2c4b36':'';b.setAttribute('aria-label',b.textContent+(ready?'，可以发动':'，需先完成前两击确认'));}
   let cue='先打前两击；命中可免费收尾或花1格追距，被防御可花1.5格再压。使用相应普通技按键选择，不自动出招。';
   if(!active)cue='角色连携已关闭，使用原有取消规则。';
   else if(info.selected)cue=info.selected==='pursuit'?'追距收尾：前移有上限，伤害较低；此目标连携已结束。':'付费再压：保留至少4帧可行动作空隙，对方可以抢招或脱压；此目标连携已结束。';
   else if(info.step===2)cue=f.attack.hitConfirmed?'三段命中！可以收手，或尝试原有必杀取消。':'终结击正在出招；注意距离，不保证命中。';
   else if(info.gate?.ok)cue=G.hitstop>0?'接触确认 · 定格中可预输入下一击，解冻后执行。':`现在可接下一击 · 还剩 ${Math.ceil(info.gate.remaining)} 动作帧`;
   else if(info.gate?.code==='hitOnly')cue='第二击被防御：免费第三击不可接。可收手，或用下方再压技花1.5格继续进攻；再压存在防守空隙。';
   else if(info.gate?.code==='window')cue='连携窗口已过，等收势结束再组织进攻。';
   else if(info.step>=0)cue='等待真实命中或防御确认；挥空不能取消。';
   if(info.step===1&&f.attack.hitConfirmed)cue+=' 近身可用原第三击收尾；距离拉开可选择追距，消耗1格并降低伤害。';
   if(positioningNote)cue+=' '+positioningNote;write('chain-cue',cue);requestAnimationFrame(paint);
  }paint();
 }
 init();
})();
