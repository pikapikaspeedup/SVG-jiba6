/* Character target chains: authored routes, contact gates, bounded progression.
 * Only the ordinary move-request path can commit a link. No scripted attacks. */
'use strict';
(() => {
 const routes={ryu:['sLP','sMP','sHP'],ken:['sLP','sMP','sHK'],chun:['sLP','sLK','sMK'],cammy:['sLP','sMP','sHK'],luke:['sLP','sMP','sHP'],juri:['sLK','sMK','sHK'],mai:['sLP','sMP','sHK'],iori:['sLP','sHP','sHK']};
 const names={ryu:'拳心三连',ken:'拳脚追击',chun:'轻灵连踢',cammy:'突击连段',luke:'爆发三拳',juri:'连环踢',mai:'扇舞追击',iori:'爪击追身'};
 for(const route of Object.values(routes))Object.freeze(route);Object.freeze(routes);
 const settings={enabled:true};
 function enabled(){return settings.enabled&&INK.Kinetic?.settings.enabled&&INK.CombatFlow.settings.rules==='flow';}
 function decision(f,m,G){
  const a=f.attack,route=routes[f.ch.id],step=a?.targetChain?.step;
  if(!enabled()||!a||!route||!Number.isInteger(step)||step>=route.length-1||m.id!==route[step+1]||f.y<0||a.m.category!=='normal'||m.category!=='normal')return null;
  const age=INK.CombatFlow.age(G,a),remaining=Math.max(0,10-age);
  let code=!a.confirmed?'confirm':step>0&&!a.hitConfirmed?'hitOnly':age>10||a.t>=a.m.total?'window':'ready';
  return {ok:code==='ready',code,kind:'target-chain',remaining,edge:f.ch.id+':'+(step+1),chainDepth:step+1,routeStep:step+1,label:names[f.ch.id]};
 }
 function commit(f,previous,decision){
  const a=f.attack,route=routes[f.ch.id];if(!enabled()||!route)return;
  if(decision.kind==='target-chain')a.targetChain={step:previous.targetChain.step+1,route:f.ch.id};
  else if(a.m.id===route[0]&&(!previous||decision.kind==='neutral'||decision.kind==='link'))a.targetChain={step:0,route:f.ch.id};
  if(a.targetChain?.step>0)a.m={...a.m,damage:Math.round(a.m.damage*(a.targetChain.step===1?.92:.84))};
 }
 function inspect(f,G){const a=f.attack,route=routes[f.ch.id];if(!route)return null;const step=a?.targetChain?.step??-1,next=route[step+1];return {name:names[f.ch.id],route:route.slice(),step,next,gate:step>=0&&next?decision(f,{id:next,category:'normal'},G):null};}
 INK.FlowChain={settings,routes,names,decision,commit,inspect};
})();
