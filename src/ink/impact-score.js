/* One immutable presentation score per resolved contact. No battle mutations. */
'use strict';
(()=>{
 const finite=(v,d=0)=>Number.isFinite(v)?v:d,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),valid=p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite),unit=(p,f=[1,0])=>{if(!valid(p))return f.slice();const n=Math.hypot(p[0],p[1]);return n>1e-8?[p[0]/n,p[1]/n]:f.slice();},freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
 function create(G,a,d,m,type,context={}){
  const r=context.response||{},witness=context.witness||{},dir=context.direction===-1?-1:context.direction===1?1:a?.dir===-1?-1:1;
  const point=valid(context.point)?context.point:valid(r.point)?r.point:[finite(r.defenderOriginX,finite(d?.x,720)),665+finite(r.defenderOriginY,finite(d?.y))-230],incoming=unit(context.motion?.incoming,unit(context.incoming,unit(r.responseDir,[dir,0]))),normal=unit(witness.normal||r.normalGeom||r.normal,unit(r.responseDir,[dir,0])),tangent=[-incoming[1],incoming[0]];
  // Solver normal is inward along the selected AABB separating axis. Keep
  // vertical witness signs; horizontal orientation uses committed attack side,
  // never current material velocity (which may already be separating).
  const side=unit(r.responseDir,[dir,0]),normalFlipped=normal[0]*side[0]+normal[1]*side[1]<0;
  if(normalFlipped){normal[0]*=-1;normal[1]*=-1;}
  // tangentWorld is the incoming-path tangent, not the surface tangent.
  const measured=r.geometryMeasured===true||valid(witness.normal)&&Math.hypot(...witness.normal.slice(0,2))>1e-8&&valid(witness.point),confidence=measured?1:valid(context.incoming)&&valid(context.point)?.65:.25;
  const supplied=context.motion,motion=valid(supplied?.relativeVelocity)&&supplied.continuous===true&&['sectionVelocity','projectile'].includes(supplied.evidence)&&!context.discontinuous?supplied.relativeVelocity:null,reliableMotion=!!motion&&Math.hypot(...motion)>1e-8,incidence=reliableMotion?unit(motion):incoming;
  const forceWorld=reliableMotion&&incidence[0]*normal[0]+incidence[1]*normal[1]>.05?unit([.75*incidence[0]+.25*normal[0],.75*incidence[1]+.25*normal[1]]):normal.slice();
  const geometryEvidence={point:valid(witness.point)?'witness':valid(r.point)?'response-snapshot':valid(context.point)?'contact-point':'defender-origin-fallback',normal:measured?'witness-inward':'attack-side-fallback',incoming:supplied?.evidence|| (valid(context.incoming)?'committed-direction':'facing-fallback'),motion:reliableMotion?supplied.evidence:context.projectile?'unavailable':Number.isFinite(r.presentationClosing)?'relative-root-proxy':'unavailable',surface:supplied?.surface||'none',continuous:reliableMotion,normalFlipped};
  const part=witness.hurtPart||r.hurtPart||'',zone=part==='head'?'head':/leg|foot|shin/.test(part)?'leg':['head','body','leg'].includes(r.zone)?r.zone:m.height==='low'?'leg':'body';
  const hits=Math.max(1,Math.floor(finite(m.hits,1))),hitIndex=clamp(Math.floor(finite(context.hitIndex)),0,hits-1),finish=context.last??hitIndex===hits-1,intermediate=hits>1&&!finish;
  const alignment=Math.abs(incoming[0]*normal[0]+incoming[1]*normal[1]),oblique=1-alignment,quality=measured?.72+.28*alignment:.85,level=clamp(finite(m.level,1),1,3);
  const deltaMeasured=[a?.x,a?.px,a?.y,a?.py,d?.x,d?.px,d?.y,d?.py].every(Number.isFinite)&&!context.discontinuous&&Math.hypot(a.x-a.px,a.y-a.py)<=32&&Math.hypot(d.x-d.px,d.y-d.py)<=32;
  const closing=context.projectile?0:context.response?clamp(finite(r.presentationClosing),-12,12):deltaMeasured?clamp(((a.x-a.px)-(d.x-d.px))*normal[0]+((a.y-a.py)-(d.y-d.py))*normal[1],-12,12):0,momentum=1+clamp(closing/12,-1,1)*.08;
  const energy=clamp(momentum*(.48+level*.24+(m.super&&finish?.35:0))*(.65+.35*quality)*(1-.25*oblique)*(intermediate?.64:1)*(type==='block'?.72:type==='parry'?.62:type==='armor'?.82:1)*(context.punish?1.12:context.counter?1.06:1),.2,1.6);
  const height=clamp((point[1]-(665+finite(r.defenderOriginY,finite(d?.y))-230))/135,-1,1),torque=clamp(height*incoming[0]+normal[1]*.35,-1,1)*energy;
  const hitPart=witness.hitPart||r.hitPart||m.contactPart,channel=context.projectile?'projectile':supplied?.channel||(hitPart==='fan'?'fanTip':hitPart==='elbow'?'frontElbow':hitPart==='rear-kick'?'rearFoot':['foot','shin'].includes(hitPart)||m.pose==='kick'?'frontFoot':'frontHand'),epoch=Number.isFinite(supplied?.epoch)?supplied.epoch:0;
  const sourceID=context.sourceAttack?.combatID||null,projectileID=context.projectileID||null,contactID=context.contactID??context.id??[sourceID||'contact',projectileID||'',finite(G.actionTick),a?.index??'',d?.index??'',hitIndex,type].join(':');
  return freeze({version:1,contactID,sourceID,projectileID,channel,epoch,result:type,pointWorld:point.slice(0,2),incomingWorld:incoming,normalWorld:normal,forceWorld,tangentWorld:tangent,surfaceTangentWorld:[-normal[1],normal[0]],geometryEvidence,category:m.super?'super':m.category==='normal'||/^[sca][LMH][PK]$/.test(m.id||'')?'normal':'special',zone,material:r.material||'neutral',style:r.style||'neutral',part:r.part||m.contactPart||'',geometryConfidence:confidence,energy,force:{normal:energy*alignment,tangent:energy*oblique,torque},rhythm:{hitIndex,intermediate,finish:!!finish},envelope:{attack:1,compression:zone==='head'?1:zone==='leg'?3:2,rebound:intermediate?3:5,tail:intermediate?5:level>=3?12:8},audio:{body:clamp(energy*(1-.3*oblique),.2,1.5),brightness:zone==='head'?1.2:zone==='leg'?.75:1,tail:intermediate?.48:1},presentationClosing:closing,mode:oblique>.42?'slice':'solid',birth:{action:finite(G.actionTick),actor:finite(d?._inkVisualClock),vfx:finite(INK.VFX?.time)}});
 }
 INK.ImpactScore=Object.freeze({create});
})();
