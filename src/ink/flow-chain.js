/* Character target chains: contact-gated alternatives with bounded progression.
 * Decisions describe one atomic request; game.js owns payment and simulation. */
'use strict';
(() => {
 const routes={ryu:['sLP','sMP','sHP'],ken:['sLP','sMP','sHK'],chun:['sLP','sLK','sMK'],cammy:['sLP','sMP','sHK'],luke:['sLP','sMP','sHP'],juri:['sLK','sMK','sHK'],mai:['sLP','sMP','sHK'],iori:['sLP','sHP','sHK']};
 const names={ryu:'拳心三连',ken:'拳脚追击',chun:'轻灵连踢',cammy:'突击连段',luke:'爆发三拳',juri:'连环踢',mai:'扇舞追击',iori:'爪击追身'};
 const branches={
  ryu:{pursuit:{move:'sMK',travel:28,label:'踏步中脚'},pressure:{move:'sLK',travel:8,label:'轻脚再压'}},
  ken:{pursuit:{move:'sHP',travel:38,label:'进身重拳'},pressure:{move:'sMK',travel:14,label:'中脚再压'}},
  chun:{pursuit:{move:'sMP',travel:32,label:'进步掌击'},pressure:{move:'sLP',travel:10,label:'轻掌再压'}},
  cammy:{pursuit:{move:'sHP',travel:44,label:'突进重拳'},pressure:{move:'sLK',travel:16,label:'轻脚再压'}},
  luke:{pursuit:{move:'sHK',travel:24,label:'踏步重脚'},pressure:{move:'sLK',travel:8,label:'轻脚再压'}},
  juri:{pursuit:{move:'sHP',travel:38,label:'切入重拳'},pressure:{move:'sMP',travel:14,label:'中拳再压'}},
  mai:{pursuit:{move:'sHP',travel:26,label:'进步扇击'},pressure:{move:'sLK',travel:10,label:'轻脚再压'}},
  iori:{pursuit:{move:'sMP',travel:40,label:'追身爪击'},pressure:{move:'sLK',travel:12,label:'轻脚再压'}}
 };
 for(const route of Object.values(routes))Object.freeze(route);Object.freeze(routes);
 for(const row of Object.values(branches)){for(const value of Object.values(row))Object.freeze(value);Object.freeze(row);}Object.freeze(branches);
 const settings={enabled:true,branches:true};
 function enabled(){return settings.enabled&&INK.Kinetic?.settings.enabled&&INK.CombatFlow.settings.rules==='flow';}
 function branchDecision(f,m,G){
  const a=f.attack,step=a?.targetChain?.step,profile=branches[f.ch.id];
  if(!settings.branches||!profile||step!==1||a.targetChain.terminal||f.install>0)return null;
  const kind=Object.keys(profile).find(k=>profile[k].move===m.id);if(!kind)return null;
  const choice=profile[kind],age=INK.CombatFlow.age(G,a),remaining=Math.max(0,10-age),driveCost=kind==='pursuit'?1:1.5;
  const opponent=globalThis.SVG_FIGHTER?.fighters?.find(d=>d!==f&&d.index!==f.index),distance=opponent?Math.abs(opponent.x-f.x):Infinity;
  const band=INK.ContactResponse?.bands?.[f.ch.id]?.[m.id],dFar=band?.dFar??band?.[1],maxDistance=Number.isFinite(dFar)?dFar+choice.travel:0;
  const contact=a._inkContact,blockAge=contact?Math.max(0,G.actionTick-contact.actionTick):age,remainingBlock=contact?.result==='block'?Math.max(0,contact.blockstun-blockAge):null;
  let code=!a.confirmed?'confirm':age>10||a.t>=a.m.total?'window':kind==='pursuit'&&!a.hitConfirmed?'hitOnly':kind==='pressure'&&(a.hitConfirmed||a.contactResult!=='block'||remainingBlock===null)?'blockOnly':f.y!==0||opponent?.y!==0?'ground':!opponent||!maxDistance||distance>maxDistance||(opponent.x-f.x)*f.dir<=0?'distance':'ready';
  return {ok:code==='ready',code,kind:'pressure-branch',branch:kind,driveCost,remaining,edge:f.ch.id+':'+kind,chainDepth:2,routeStep:2,label:choice.label,distance,maxDistance,
   adjustment:{damageScale:kind==='pursuit'?.78:.62,travelBudget:choice.travel,recoveryAdd:kind==='pursuit'?2:4,startupFloor:kind==='pressure'?remainingBlock+4:0},
   reason:code==='blockOnly'?'再压只允许第二击被防御后选择':code==='distance'?'距离超出此分支的前移范围':undefined};
 }
 function decision(f,m,G){
  const a=f.attack,route=routes[f.ch.id],step=a?.targetChain?.step;
  if(!enabled()||!a||!route||!Number.isInteger(step)||a.targetChain.terminal||step>=route.length-1||f.y<0||a.m.category!=='normal'||m.category!=='normal')return null;
  const alternate=branchDecision(f,m,G);if(alternate)return alternate;
  if(m.id!==route[step+1])return null;
  const age=INK.CombatFlow.age(G,a),remaining=Math.max(0,10-age);
  let code=!a.confirmed?'confirm':step>0&&!a.hitConfirmed?'hitOnly':age>10||a.t>=a.m.total?'window':'ready';
  return {ok:code==='ready',code,kind:'target-chain',remaining,edge:f.ch.id+':'+(step+1),chainDepth:step+1,routeStep:step+1,label:names[f.ch.id]};
 }
 // Called after runtime timing overrides, BEFORE visual capture, so the exact
 // same startup/recovery drives incoming bridges and the committed attack.
 function prepare(f,m,decision){
  if(!enabled()||decision.kind!=='pressure-branch')return m;
  const q=decision.adjustment,startup=Math.max(m.startup,q.startupFloor||0),recovery=m.recovery+q.recoveryAdd,steps=startup+m.active-Math.max(1,startup-5);
  return {...m,startup,recovery,total:startup+m.active+recovery,damage:Math.round(m.damage*q.damageScale),travel:q.travelBudget/Math.max(1,steps),cancel:decision.branch==='pressure'?false:m.cancel,pressureBranch:decision.branch,pressureTravel:q.travelBudget};
 }
 function commit(f,previous,decision){
  const a=f.attack,route=routes[f.ch.id];if(!enabled()||!route)return;
  if(decision.kind==='pressure-branch'){a.targetChain={step:2,route:f.ch.id,terminal:true,branch:decision.branch};return;}
  if(decision.kind==='target-chain')a.targetChain={step:previous.targetChain.step+1,route:f.ch.id};
  else if(a.m.id===route[0]&&(!previous||decision.kind==='neutral'||decision.kind==='link'))a.targetChain={step:0,route:f.ch.id};
  if(a.targetChain?.step>0)a.m={...a.m,damage:Math.round(a.m.damage*(a.targetChain.step===1?.92:.84))};
 }
 function inspect(f,G){
  const a=f.attack,route=routes[f.ch.id];if(!route)return null;const step=a?.targetChain?.step??-1,next=route[step+1];
  const options=Object.entries(branches[f.ch.id]).map(([kind,c])=>{const m=globalThis.SVG_FIGHTER?.getMove?.(f,c.move)||{id:c.move,category:'normal'};const offered=step===1?decision(f,m,G):null,gate=offered&&globalThis.SVG_FIGHTER?.decide?globalThis.SVG_FIGHTER.decide(f.index,c.move):offered;return {kind,branch:kind,id:c.move,label:c.label,driveCost:kind==='pursuit'?1:1.5,travel:c.travel,gate};});
  return {name:names[f.ch.id],route:route.slice(),step,next,gate:step>=0&&next?decision(f,{id:next,category:'normal'},G):null,branches:options,selected:a?.targetChain?.branch||null,terminal:!!a?.targetChain?.terminal};
 }
 INK.FlowChain={settings,routes,names,branches,decision,prepare,commit,inspect};
})();
