/* Combat-owned contact facts. Captured before mutations; no presentation
 * energy, display gain or sampled visual body enters this record. */
'use strict';
(()=>{
 const pair=p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const unit=(p,fallback)=>{if(!pair(p))return fallback.slice();const n=Math.hypot(p[0],p[1]);return n>1e-8?[p[0]/n,p[1]/n]:fallback.slice();};
 const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
 const id=x=>typeof x==='string'||Number.isFinite(x)?x:null;
 function region(witness,height){
  const hurtID=String(witness?.hurtID||''),part=String(witness?.hurtPart||'');
  if(hurtID==='hurt.head'||part==='head')return {zone:'head',region:'head',leg:null};
  for(const key of ['front','rear'])if(hurtID.startsWith('hurt.'+key+'Leg.')||part===key+'-leg')return {zone:'leg',region:hurtID.includes('.lower.')?'shin':'leg',leg:key};
  for(const key of ['front','rear'])if(hurtID.startsWith('hurt.'+key+'Arm.')||part===key+'-arm')return {zone:'arm',region:key+'Arm',leg:null};
  for(const key of ['chest','abdomen','pelvis'])if(hurtID==='hurt.'+key)return {zone:'body',region:key,leg:null};
  return {zone:'body',region:'unknown',leg:null};
 }
 function create(G,a,d,m,context={}){
  const time=d?._inkVisualClock,point=context.point||context.witness?.point;
  if(!Number.isInteger(time)||time<0||!pair(point)||![d?.x,d?.y,d?.ch?.scale].every(Number.isFinite)||d.ch.scale<=0)return null;
  const direction=context.direction===-1?-1:context.direction===1?1:a?.dir===-1?-1:1,w=context.witness||{},incoming=[direction,0],normal=unit(w.normal,[direction,0]);
  // AABB witness normals are inward. Horizontal side comes from the committed
  // attack, not a late render direction; preserve purely vertical normals.
  if(normal[0]*direction<0){normal[0]*=-1;normal[1]*=-1;}
  const hits=Math.max(1,Math.floor(Number.isFinite(m?.hits)?m.hits:1)),hitIndex=clamp(Math.floor(Number.isFinite(context.hitIndex)?context.hitIndex:0),0,hits-1),last=context.last??hitIndex===hits-1;
  const sourceID=id(context.sourceAttack?.combatID),projectileID=id(context.projectileID),action=Number.isInteger(G?.actionTick)?G.actionTick:0;
  const model=context.ruleSource?.carrier?.model||(INK.HitRule?.owns(d)?INK.HitRule.sample(d)?.model:null),anchor=model?.joints3D?.[/^hurt\.(?:abdomen|pelvis|.*Leg)/.test(w.hurtID||'')?'pelvis':'chest'];
  const lever=anchor?[(point[0]-d.x)/d.ch.scale*d.dir-anchor[0],(point[1]-665-d.y)/d.ch.scale-anchor[1]]:null,leverTau=lever?clamp((lever[0]*normal[1]-lever[1]*normal[0]*d.dir)/80,-1,1):0;
  return freeze({version:1,time,action,contactID:[sourceID??'contact',projectileID??'',action,a?.index??'',d?.index??'',hitIndex,'hit'].join(':'),sourceID,projectileID,
   character:d.ch.id,attacker:a?.ch?.id||null,move:m?.id||null,level:clamp(Number.isFinite(m?.level)?m.level:1,1,3),hits,hitIndex,last:!!last,counter:context.counter===true,punish:context.punish===true,
   point:point.slice(0,2),incoming,normal,world:{x:d.x,y:d.y,dir:d.dir===-1?-1:1,scale:d.ch.scale},
   hurtID:id(w.hurtID),hurtPart:typeof w.hurtPart==='string'?w.hurtPart:null,hitID:id(w.hitID),hitPart:typeof w.hitPart==='string'?w.hitPart:null,leverTau,sourceDir:direction,...region(w,m?.height),
   evidence:{point:pair(w.point)?'witness':'contact-fallback',normal:pair(w.normal)&&Math.hypot(...w.normal.slice(0,2))>1e-8?'witness':'attack-direction-fallback'}});
 }
 INK.HitRuleFacts=Object.freeze({create,region});
})();
