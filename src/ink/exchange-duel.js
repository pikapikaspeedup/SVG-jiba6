/* Bounded probe/withdraw/observe episodes using delayed public facts only. */
'use strict';
(() => {
 const settings={enabled:true};
 const fallback={probe:.45,bait:.3,intercept:.5,press:.5,distance:240,rest:55};
 function update(f,b,obs,G,api){
  if(!settings.enabled)return false;const now=G.actionTick;
  const q=f._inkExchange||(f._inkExchange={plan:null,cooldown:0,memory:null,lastAction:-1,lastPunish:null,cycles:0});
  if(q.lastAction===now)return !!q.plan;q.lastAction=now;
  const profile=INK.DuelPersonality?.profile(f.ch.id)||fallback;
  if(obs)q.memory=INK.DuelPersonality?.observe(q.memory,obs,G,f)||q.memory;
  const bias=q.memory?.bias||{},prob=(value)=>Math.max(.15,Math.min(.85,value)),style={...profile,intercept:prob(.5*profile.intercept+(bias.intercept||0)),bait:prob(.45*profile.bait+(bias.bait||0)),press:prob(.5*profile.press+(bias.press||0)),probe:prob(.45*profile.probe+(bias.probe||0))};
  const danger=(obs?.projectiles||[]).some(s=>s.dir*(f.x-s.x)>0&&Math.abs(s.x-f.x)<420);
  const excluded=!obs||f.y!==0||f.state!=='idle'||f.attack||f.captured||f.jumpPre||f.airLock||f.landT>0||f._inkPursuit||obs.y!==0||['down','rise','captured','throwing','tumble','ko'].includes(obs.state)||danger;
  const near=!!obs&&Math.abs(obs.x-f.x)<=155;
  const release=()=>{q.plan=null;q.cooldown=Math.max(q.cooldown,now+Math.max(24,24+(style.rest||9)));return false;};
  if(excluded||near){if(q.plan)release();return false;}
  const age=Math.max(0,now-obs.action),attack=obs.attack,record=attack&&(obs.exchange?.records||[]).find(r=>r.combatID===attack.combatID&&r.result==='cleanMiss'&&r.activeClosed===true&&r.coverage==='complete'&&(!r.reason||r.reason==='natural'));
  const remaining=attack?attack.total-attack.t-(attack.holding?0:age):0;
  let choices=null;const moves=()=>choices||(choices=api.moves(f));
  const candidates=(left,maxWalk=6)=>INK.DuelWindow?.candidates(f,obs,G,moves(),{remaining:left,maxWalk,reserve:3})||[];
  const issue=(kind,frames,goal)=>{api.plan(f,kind,frames,{goal,low:attack?.height!=='overhead'});api.run(f,b);return true;};
  if(record&&!attack.holding&&remaining>3&&(q.lastPunish!==attack.combatID||q.plan?.phase==='chase'&&q.plan.sourceID===attack.combatID)){
   const pick=candidates(remaining)[0];
   if(pick){if(pick.walkFrames===0){q.lastPunish=attack.combatID;const accepted=api.attack(f,pick.move,'确认落空 · 有限窗口追击');release();return accepted;}
    if(q.plan?.phase!=='chase'||q.plan.sourceID!==attack.combatID){q.lastPunish=attack.combatID;q.plan={phase:'chase',sourceID:attack.combatID,until:now+Math.min(6,pick.walkFrames),cycleUntil:now+6};}
    if(now<q.plan.until)return issue('approach',1,'观察落空 · 短追身再判断');
    q.lastPunish=attack.combatID;return release();
   }
  }
  if(q.plan?.phase==='chase')return release();
  if(q.plan&&now>=q.plan.cycleUntil)return release();
  const threat=attack&&attack.category==='normal'&&!attack.throw&&attack.t+age<attack.startup+attack.active;
  if(threat&&!attack.holding&&q.lastIntercept!==attack.combatID){
   const window=attack.startup-(attack.t+age),pick=window>3?candidates(window,0)[0]:null;
   if(pick){q.lastIntercept=attack.combatID;if(api.random()<style.intercept){const accepted=api.attack(f,pick.move,'观察起手 · 快招截击');release();return accepted;}}
  }
  if(q.plan&&threat){
   if(q.plan.phase!=='react'){q.plan={...q.plan,phase:'react',until:now+6};const room=f.dir>0?f.x-105:1335-f.x;q.plan.choice=room>45&&api.random()<style.intercept?'retreat':'guard';}
   if(now<q.plan.until)return issue(q.plan.choice,1,q.plan.choice==='guard'?'试探遇招 · 守住':'试探遇招 · 撤步让招');return release();
  }
  if(!q.plan){
   if(now<q.cooldown||now<(b.nextDecision||0)||Math.abs(obs.x-f.x)>style.distance+110||Math.abs(obs.x-f.x)<=155||api.random()>=style.probe)return false;
   q.cycles++;q.plan={phase:'probe',until:now+2+Math.floor(api.random()*4),cycleUntil:now+30};
   // Hold/feint is decided before the opponent's next action exists.
   const heavy=candidates(80,0).find(c=>['sHP','sHK'].includes(c.move.id));
   if(heavy&&api.hold&&api.random()<style.bait){const accepted=api.hold(f,heavy.move.id,{hold:3+Math.floor(api.random()*4),feint:api.random()<style.bait},'蓄势试探 · 预先选择收放');release();return accepted;}
  }
  const p=q.plan;
  if(p.phase==='probe'){
   if(now<p.until)return issue('approach',1,'短步试探 · 争取距离');
   p.phase='withdraw';p.until=now+3+Math.floor(api.random()*4);
  }
  if(p.phase==='withdraw'){
   if(now<p.until){const room=f.dir>0?f.x-105:1335-f.x;return issue(room>25?'retreat':'guard',1,'回撤诱招 · 保留防守');}
   p.phase='observe';p.until=p.cycleUntil;p.review=now;
  }
  if(p.phase==='observe'){
   if(now>=p.until)return release();
   // If the opponent waits too, end the bait with a reachable ordinary poke
   // or yield to the broader planner; do not retreat indefinitely.
   if(now>=p.review){p.review=Math.min(p.until,now+3+Math.floor(api.random()*4));
   if(!attack){const poke=candidates(80,0)[0];if(poke&&api.random()<style.press){const accepted=api.attack(f,poke.move,'试探无应答 · 几何可达短打');release();return accepted;}}}
   return issue('guard',1,'观察收招 · 等待实际窗口');
  }
  return release();
 }
 INK.ExchangeDuel={settings,active:()=>settings.enabled!==false,update,reset:f=>{f._inkExchange=null;}};
})();
