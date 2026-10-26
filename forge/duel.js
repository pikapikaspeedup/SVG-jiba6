'use strict';
(() => {
 const $=id=>document.getElementById(id);
 function init(){if(!$('super-coach')){requestAnimationFrame(init);return;}
  const bar=document.createElement('section');bar.id='fight-bar';bar.innerHTML='<div class="fight-select"><label>你的角色<select id="fight-player"></select></label><span>VS</span><label>对手<select id="fight-opponent"></select></label><label>难度<select id="fight-difficulty"><option value="easy">入门</option><option value="normal" selected>标准</option><option value="hard">挑战</option></select></label><label>操作<select id="fight-control"><option value="assist">辅助</option><option value="classic">经典</option></select></label></div><div class="fight-actions"><button id="fight-cpu" class="f-primary">开始格斗</button><button id="fight-versus">本地双人</button><button id="fight-practice">自由练习</button><span id="fight-status" role="status">确认距离，抓住破绽。</span></div>';
  const mount=$('f-battle-mount');mount.before(bar);
  for(const id of ['fight-player','fight-opponent'])for(const c of SVG_FIGHTER.characters){const o=document.createElement('option');o.value=c.id;o.textContent=c.name;$(id).append(o);}$('fight-opponent').value='ken';
  const lab=document.createElement('details');lab.id='fight-lab';const summary=document.createElement('summary');summary.textContent='练习与引擎设置 · 连携 / 空战 / 特效 / 打击反馈';lab.append(summary,$('kinetic-panel'));mount.after(lab);
  async function start(mode='cpu'){
   INK.Combo.stop();INK.Spacing.training?.stop();SVG_FIGHTER.experience?.exitLessons();await INKForge.route('battle');
   INK.CombatFlow.set({rhythm:'fluid',speed:1});$('difficulty').value=$('fight-difficulty').value;
   SVG_FIGHTER.start($('fight-player').value,$('fight-opponent').value,mode,$('fight-control').value);
   $('kinetic-character').value=$('fight-player').value;$('dummy').value=$('kinetic-dummy').value='idle';$('infinite').checked=false;$('autohp').checked=mode==='training';
   lab.open=mode==='training';$('fight-status').textContent=mode==='training'?'自由练习 · 下方展开各项动作训练':mode==='versus'?'本地双人 · 双方共用正式战斗规则':'电脑对战 · 连携、空战与对波策略已启用';
   $('stage-wrap').focus({preventScroll:true});mount.scrollIntoView({block:'start',behavior:'instant'});
  }
  const run=mode=>()=>start(mode).catch(e=>INKForge.toast(e.message,true));$('fight-cpu').onclick=run('cpu');$('fight-versus').onclick=run('versus');$('fight-practice').onclick=run('training');
  const home=document.querySelector('.kinetic-launch');home.querySelector('span').textContent='计算等于游戏性 / INK FIGHT';home.querySelector('h3').textContent='每一拳，都有下一步。';home.querySelector('p').textContent='确认连携、空中变速、对波争夺与方向受身。八位角色，在真实交锋里寻找机会。';home.querySelector('button').textContent='开始格斗 ↗';home.querySelector('button').onclick=run('cpu');
  window.INKDuel={ready:true,start};
 }
 init();
})();
