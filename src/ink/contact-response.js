/* BODY CONTACT: bounded, authored normal-strike response. This describes an
 * already-confirmed contact; it never tests/expands hitboxes or changes damage.
 * Read only shared pre-contact root samples, static move data and witness data. */
'use strict';
(() => {
 const settings={enabled:true},clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),finite=(x,fallback=0)=>Number.isFinite(x)?x:fallback;
 const profiles=Object.freeze({ryu:Object.freeze({drive:.035,brace:.96,compression:1.12,twist:.82,step:.85}),cammy:Object.freeze({drive:-.025,brace:1.04,compression:.88,twist:1.22,step:1.18})});
 // Authored root-distance bands, calibrated from production active-frame boxes.
 // These shape the response only; they never grant contact or stand in for reach.
 const bands=Object.freeze({ryu:Object.freeze({sLP:[165,270],sMP:[165,270],sHP:[150,250],sLK:[205,345],sMK:[180,300],sHK:[150,250],cLP:[205,345],cMP:[205,345],cLK:[210,350],cMK:[210,350]}),cammy:Object.freeze({sLP:[150,250],sMP:[190,315],sHP:[180,305],sLK:[195,325],sMK:[210,350],sHK:[130,215],cLP:[190,320],cMP:[190,320],cLK:[195,330],cMK:[195,330]})});
 const neutral=Object.freeze({drive:0,brace:1,compression:1,twist:1,step:1});
 const active=()=>settings.enabled&&!!INK.Kinetic?.settings.enabled;
 function continuous(f){return f&&[f.x,f.px,f.y].every(Number.isFinite)&&Math.abs(f.x-f.px)<=32&&!f.captured&&!f.airLock&&Math.abs(f.y)<.01;}
 function supports(a,d,m,projectile=false){return active()&&!!profiles[a?.ch?.id]&&!!bands[a?.ch?.id]?.[m?.id]&&!!m&&m.category==='normal'&&(m.hits??1)===1&&!m.air&&!m.throw&&!m.super&&!m.launch&&!m.knockdown&&!projectile&&!String(m.kind||'').includes('projectile')&&continuous(a)&&continuous(d);}
 function describe(a,d,m,context={}){
  if(context.discontinuous||!supports(a,d,m,context.projectile))return null;
  const dir=context.direction===-1?-1:context.direction===1?1:a.dir===-1?-1:1,as=profiles[a.ch.id],ds=profiles[d.ch.id]||neutral;
  const ax=finite(a.x),dx=finite(d.x),point=Array.isArray(context.point)?context.point:context.witness?.point;
  const x=finite(point?.[0],dx-dir*36),y=finite(point?.[1],665+finite(d.y)-(m.height==='low'?83:259));
  const witness=context.witness?.normal,nx=finite(witness?.[0],dir),ny=finite(witness?.[1]),length=Math.hypot(nx,ny)||1;
  // AABB edge normals are only a bounded shape cue, not a full limb-velocity
  // measurement. Default contacts use a horizontal cue without claiming TOI.
  const normal=[nx/length,ny/length],[dNear,dFar]=bands[a.ch.id][m.id],distance=Math.abs(dx-ax),extension=clamp((distance-dNear)/(dFar-dNear),0,1);
  const tip=extension*extension*(3-2*extension),crowded=clamp((dNear*.55-distance)/(dNear*.55),0,1),oblique=Math.abs(normal[1]);
  const quality=clamp(1-.38*tip-.12*crowded-.14*oblique,.48,1);
  // Root displacement belongs to this simulation step. Never use visual
  // velocity, defender input or post-contact push/reaction state.
  const av=clamp(ax-finite(a.px,ax),-12,12),dv=clamp(dx-finite(d.px,dx),-12,12),closing=clamp((av-dv)*dir,-12,12),approach=clamp(closing/8,-1,1);
  const hitScale=clamp((.84+.22*quality+.13*approach+as.drive)*ds.brace,.82,1.22),blockScale=clamp((.89+.15*quality+.10*approach+as.drive*.5)*ds.brace,.86,1.16);
  const turn=clamp((y-(665+finite(d.y)-230))/135*.55+normal[1]*.45,-1,1);
  const hitPart=context.hitPart||context.witness?.hitPart||null,hurtPart=context.hurtPart||context.witness?.hurtPart||null,zone=context.zone||(hurtPart==='head'?'head':hurtPart?.includes('leg')?'leg':'body');
  const normalGeom=Object.freeze(normal),responseDir=Object.freeze([dir,0]);
  return Object.freeze({version:2,attacker:a.ch.id,defender:d.ch.id,direction:dir,responseDir,point:Object.freeze([x,y]),normal:normalGeom,normalGeom,hitPart,hurtPart,zone,distance,dNear,dFar,extension,quality,closing,turn,hitScale,blockScale,compression:ds.compression,twist:ds.twist,step:ds.step,kind:tip>.55?'tip':approach>.35?'drive':oblique>.5?'oblique':'solid'});
 }
 function apply(d,type,response){
  if(!active()||!response||!['hit','block'].includes(type)||!Number.isFinite(d.push))return false;
  const scale=type==='block'?response.blockScale:response.hitScale;
  if(!Number.isFinite(scale))return false;
  d.push*=clamp(scale,type==='block'?.86:.82,type==='block'?1.16:1.22);return true;
 }
 function inspect(f){const r=f?._inkReaction?.contact;return r?{...r,point:[...r.point],normal:[...r.normal],normalGeom:[...r.normalGeom],responseDir:[...r.responseDir]}:null;}
 INK.ContactResponse={settings,profiles,bands,active,supports,describe,apply,inspect};
})();
