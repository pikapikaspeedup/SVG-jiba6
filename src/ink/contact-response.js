/* Shared contact description for eight characters. Only explicitly supported
 * grounded normals alter existing push; other contacts are presentation-only.
 * Geometry, authored timing, damage and trajectories remain combat-owned. */
'use strict';
(() => {
 const settings={enabled:true},clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),finite=(x,fallback=0)=>Number.isFinite(x)?x:fallback;
 const profiles=Object.freeze(Object.fromEntries(Object.entries({
  ryu:{style:'rooted',material:'ki',drive:.035,brace:.96,compression:1.12,twist:.82,step:.85},
  ken:{style:'pursuit',material:'heat',drive:.03,brace:1,compression:1.02,twist:1.08,step:1.02},
  chun:{style:'alternating',material:'silk',drive:0,brace:.98,compression:.9,twist:.96,step:.94},
  cammy:{style:'spiral',material:'air',drive:-.025,brace:1.04,compression:.88,twist:1.22,step:1.18},
  luke:{style:'boxing',material:'shock',drive:.04,brace:.95,compression:1.14,twist:.86,step:.82},
  juri:{style:'single-leg',material:'violet',drive:0,brace:1.04,compression:.9,twist:1.18,step:1.08},
  mai:{style:'fan-dance',material:'ember',drive:-.015,brace:1.03,compression:.86,twist:1.25,step:1.12},
  iori:{style:'low-claw',material:'dark-flame',drive:.025,brace:.97,compression:1.06,twist:1.12,step:.92}
 }).map(([id,p])=>[id,Object.freeze(p)])));
 // Authored root-distance bands, calibrated from production active-frame boxes.
 // They shape a confirmed contact, never grant it. m.range is deliberately unused.
 const rawBands={"ryu":{"sLP":{"dNear":165,"dFar":270},"sMP":{"dNear":165,"dFar":270},"sHP":{"dNear":150,"dFar":250},"sLK":{"dNear":205,"dFar":345},"sMK":{"dNear":180,"dFar":300},"sHK":{"dNear":150,"dFar":250},"cLP":{"dNear":205,"dFar":345},"cMP":{"dNear":205,"dFar":345},"cLK":{"dNear":210,"dFar":350},"cMK":{"dNear":210,"dFar":350}},"ken":{"sLP":{"dNear":160,"dFar":265},"sMP":{"dNear":200,"dFar":335},"sHP":{"dNear":140,"dFar":230},"sLK":{"dNear":205,"dFar":345},"sMK":{"dNear":170,"dFar":285},"sHK":{"dNear":130,"dFar":220},"cLP":{"dNear":205,"dFar":345},"cMP":{"dNear":205,"dFar":345},"cLK":{"dNear":205,"dFar":345},"cMK":{"dNear":205,"dFar":345}},"chun":{"sLP":{"dNear":145,"dFar":245},"sMP":{"dNear":200,"dFar":335},"sHP":{"dNear":135,"dFar":225},"sLK":{"dNear":200,"dFar":335},"sMK":{"dNear":220,"dFar":365},"sHK":{"dNear":140,"dFar":235},"cLP":{"dNear":190,"dFar":320},"cMP":{"dNear":190,"dFar":320},"cLK":{"dNear":205,"dFar":340},"cMK":{"dNear":205,"dFar":340}},"cammy":{"sLP":{"dNear":150,"dFar":250},"sMP":{"dNear":190,"dFar":315},"sHP":{"dNear":180,"dFar":305},"sLK":{"dNear":195,"dFar":325},"sMK":{"dNear":210,"dFar":350},"sHK":{"dNear":130,"dFar":215},"cLP":{"dNear":190,"dFar":320},"cMP":{"dNear":190,"dFar":320},"cLK":{"dNear":195,"dFar":330},"cMK":{"dNear":195,"dFar":330}},"luke":{"sLP":{"dNear":170,"dFar":285},"sMP":{"dNear":215,"dFar":360},"sHP":{"dNear":195,"dFar":325},"sLK":{"dNear":205,"dFar":345},"sMK":{"dNear":225,"dFar":375},"sHK":{"dNear":145,"dFar":240},"cLP":{"dNear":215,"dFar":355},"cMP":{"dNear":210,"dFar":350},"cLK":{"dNear":210,"dFar":350},"cMK":{"dNear":210,"dFar":350}},"juri":{"sLP":{"dNear":200,"dFar":330},"sMP":{"dNear":190,"dFar":320},"sHP":{"dNear":180,"dFar":300},"sLK":{"dNear":200,"dFar":335},"sMK":{"dNear":215,"dFar":355},"sHK":{"dNear":205,"dFar":345},"cLP":{"dNear":190,"dFar":320},"cMP":{"dNear":190,"dFar":320},"cLK":{"dNear":200,"dFar":330},"cMK":{"dNear":200,"dFar":330}},"mai":{"sLP":{"dNear":215,"dFar":355},"sMP":{"dNear":165,"dFar":275},"sHP":{"dNear":215,"dFar":360},"sLK":{"dNear":200,"dFar":335},"sMK":{"dNear":215,"dFar":355},"sHK":{"dNear":140,"dFar":235},"cLP":{"dNear":215,"dFar":355},"cMP":{"dNear":215,"dFar":355},"cLK":{"dNear":200,"dFar":335},"cMK":{"dNear":200,"dFar":335}},"iori":{"sLP":{"dNear":220,"dFar":370},"sMP":{"dNear":220,"dFar":365},"sHP":{"dNear":195,"dFar":325},"sLK":{"dNear":215,"dFar":355},"sMK":{"dNear":185,"dFar":305},"sHK":{"dNear":215,"dFar":360},"cLP":{"dNear":205,"dFar":340},"cMP":{"dNear":205,"dFar":340},"cLK":{"dNear":215,"dFar":360},"cMK":{"dNear":215,"dFar":360}}};
 const bands=Object.freeze(Object.fromEntries(Object.entries(rawBands).map(([id,moves])=>[id,Object.freeze(Object.fromEntries(Object.entries(moves).map(([move,b])=>[move,Object.freeze(b)])))])));
 const neutral=Object.freeze({style:'neutral',material:'physical',drive:0,brace:1,compression:1,twist:1,step:1});
 const active=()=>settings.enabled;
 function continuous(f){return f&&[f.x,f.px,f.y].every(Number.isFinite)&&Math.abs(f.x-f.px)<=32&&!f.captured&&!f.airLock&&Math.abs(f.y)<.01;}
 function supports(a,d,m,projectile=false){return active()&&!!profiles[a?.ch?.id]&&!!bands[a?.ch?.id]?.[m?.id]&&!!m&&m.category==='normal'&&(m.hits??1)===1&&!m.air&&!m.throw&&!m.super&&!m.launch&&!m.knockdown&&!projectile&&!String(m.kind||'').includes('projectile')&&continuous(a)&&continuous(d);}
 function canDescribe(a,d,m){return active()&&!!profiles[a?.ch?.id]&&!!d&&!!m&&[a.x,a.y,d.x,d.y].every(Number.isFinite);}
 // Consumes only the common pre-contact geometry snapshot and its witness.
 // AABB overlap is a proxy: u locates that witness on the canonical section.
 function sectionPosition(geometry,witness){
  const point=witness?.point,id=witness?.hitID,finitePoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
  if(!finitePoint(point)||typeof id!=='string'||!Array.isArray(geometry?.strikeSections))return null;
  const matches=geometry.strikeSections.filter(s=>s.hitID===id);if(matches.length!==1)return null;
  const s=matches[0];let u;
  if(s.kind==='segment'){
   if(!finitePoint(s.start)||!finitePoint(s.end))return null;const x=s.end[0]-s.start[0],y=s.end[1]-s.start[1],square=x*x+y*y;if(square<1e-10)return null;
   u=((point[0]-s.start[0])*x+(point[1]-s.start[1])*y)/square;
  }else if(s.kind==='radial'){
   const m=s.matrix;if(!Array.isArray(m)||m.length!==6||!m.every(Number.isFinite)||!Number.isFinite(s.radius)||s.radius<=0)return null;
   const det=m[0]*m[3]-m[1]*m[2],norm=Math.max(...m.slice(0,4).map(Math.abs));if(norm===0||Math.abs(det)<1e-7*norm*norm)return null;
   const x=point[0]-m[4],y=point[1]-m[5],localX=(m[3]*x-m[2]*y)/det,localY=(-m[1]*x+m[0]*y)/det;u=Math.hypot(localX,localY)/s.radius;
  }else return null;
  return Number.isFinite(u)?Object.freeze({u:clamp(u,0,1),hitID:id,part:s.part||null,model:s.kind}):null;
 }
 const smooth=(lo,hi,v)=>{const t=clamp((v-lo)/(hi-lo),0,1);return t*t*(3-2*t);};
 function describe(a,d,m,context={}){
  if(!canDescribe(a,d,m))return null;
  const affectsPush=!context.discontinuous&&supports(a,d,m,context.projectile)&&!['throw','parry','armor'].includes(context.type),dir=context.direction===-1?-1:context.direction===1?1:a.dir===-1?-1:1,as=profiles[a.ch.id],ds=profiles[d.ch.id]||neutral;
  const ax=a.x,dx=d.x,point=Array.isArray(context.point)?context.point:context.witness?.point,x=finite(point?.[0],dx-dir*36),y=finite(point?.[1],665+d.y-(m.height==='low'?83:259));
  const witness=context.witness?.normal,nx=finite(witness?.[0],dir),ny=finite(witness?.[1]),length=Math.hypot(nx,ny)||1,normal=[nx/length,ny/length];
  const native=Number.isFinite(context.nativeExtension),limbExtension=native?clamp(context.nativeExtension,0,1):null,band=native?null:bands[a.ch.id]?.[m.id],distance=Math.abs(dx-ax),dNear=band?.dNear??null,dFar=band?.dFar??null,extension=native?clamp((limbExtension-.72)/.26,0,1):band?clamp((distance-dNear)/(dFar-dNear),0,1):0;
  const section=native?sectionPosition(context.attackerGeometry,context.witness):null,contactU=section?.u??null;
  const tip=native?(section?smooth(.80,.98,limbExtension)*smooth(.55,.95,contactU):0):extension*extension*(3-2*extension),crowded=native?(section?1-smooth(.20,.55,contactU):0):band?clamp((dNear*.55-distance)/(dNear*.55),0,1):0,oblique=Math.abs(normal[1]);
  const quality=affectsPush?clamp(1-.38*tip-.12*crowded-.14*oblique,.48,1):.9;
  // Do not turn a special's authored travel, capture or teleport into momentum.
  const av=affectsPush?clamp(ax-a.px,-12,12):0,dv=affectsPush?clamp(dx-d.px,-12,12):0,closing=clamp((av-dv)*dir,-12,12),approach=clamp(closing/8,-1,1);
  const hitScale=affectsPush?clamp((.84+.22*quality+.13*approach+as.drive)*ds.brace,.82,1.22):1,blockScale=affectsPush?clamp((.89+.15*quality+.10*approach+as.drive*.5)*ds.brace,.86,1.16):1;
  const turn=clamp((y-(665+d.y-230))/135*.55+normal[1]*.45,-1,1),hitPart=context.hitPart||context.witness?.hitPart||null,hurtPart=context.hurtPart||context.witness?.hurtPart||null,zone=context.zone||(hurtPart==='head'?'head':hurtPart?.includes('leg')?'leg':m.height==='low'?'leg':'body');
  const projectile=!!context.projectile||String(m.kind||'').includes('projectile'),part=hitPart||m.contactPart||(m.throw?'grip':projectile?'projectile':m.pose==='kick'?'foot':'fist');
  const finish=context.last===true,multi=(m.hits||1)>1&&!finish,tier=m.super?(finish?'superfinish':'super'):m.od?'od':m.level>=3?'heavy':m.level===2?'medium':'light';
  const presentationSign=normal[0]*dir<0?-1:1,presentationClosing=!context.discontinuous&&[a.x,a.px,a.y,a.py,d.x,d.px,d.y,d.py].every(Number.isFinite)&&Math.hypot(a.x-a.px,a.y-a.py)<=32&&Math.hypot(d.x-d.px,d.y-d.py)<=32?clamp((((a.x-a.px)-(d.x-d.px))*normal[0]+((a.y-a.py)-(d.y-d.py))*normal[1])*presentationSign,-12,12):null;
  const normalGeom=Object.freeze(normal),responseDir=Object.freeze([dir,0]);
  return Object.freeze({version:3,affectsPush,defenderOriginX:d.x,defenderOriginY:d.y,presentationClosing,presentationMotionSource:Number.isFinite(presentationClosing)?'relative-root-proxy':'unavailable',geometryMeasured:Array.isArray(context.witness?.normal)&&context.witness.normal.length>=2&&context.witness.normal.slice(0,2).every(Number.isFinite)&&Math.hypot(...context.witness.normal.slice(0,2))>1e-8&&Array.isArray(point)&&point.slice(0,2).every(Number.isFinite),character:a.ch.id,style:as.style,material:as.material,defenderStyle:ds.style,part,tier,multi,finish,hitIndex:Math.max(0,finite(context.hitIndex)),projectile,throwing:!!m.throw,airborne:a.y<-.01||d.y<-.01,attacker:a.ch.id,defender:d.ch.id,direction:dir,responseDir,point:Object.freeze([x,y]),normal:normalGeom,normalGeom,hitPart,hurtPart,zone,distance,dNear,dFar,extension,limbExtension,contactU,contactSection:section,qualityModel:native?(section?'native-section':'native-unmeasured'):'distance-band',quality,closing,turn,hitScale,blockScale,compression:ds.compression,twist:ds.twist,step:ds.step,kind:!affectsPush?'presentation':tip>.55?'tip':approach>.35?'drive':oblique>.5?'oblique':'solid'});
 }
 function apply(d,type,response){
  if(!active()||response?.affectsPush!==true||!['hit','block'].includes(type)||!Number.isFinite(d.push))return false;
  const scale=type==='block'?response.blockScale:response.hitScale;if(!Number.isFinite(scale))return false;
  d.push*=clamp(scale,type==='block'?.86:.82,type==='block'?1.16:1.22);return true;
 }
 function inspect(f){const r=f?._inkReaction?.contact;return r?{...r,point:[...r.point],normal:[...r.normal],normalGeom:[...r.normalGeom],responseDir:[...r.responseDir]}:null;}
 INK.ContactResponse={settings,profiles,bands,active,supports,canDescribe,describe,sectionPosition,apply,inspect};
})();
