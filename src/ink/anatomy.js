/* FLOW 06 · coherent 2.5D articulation.
 * Author-space IK -> torso-local turn -> actor-space sockets -> SVG.
 * A turn projects the whole solved limb, NEVER just its root. Projected elbows
 * are not solved again, so foreshortening cannot reverse a knee or fold an arm.
 * The legacy battle solver is retained separately as Rig.solveCombat.
 * No wall clock, previous rendered frame, or mutable pose is used here.
 */
'use strict';
(() => {
 const {Rig,mat,vec,clamp,rad,lerp}=INK;
 const legacySolve=Rig.solveAnimation,legacySockets=Rig.sockets;
 const parts=['rearArm','frontArm','rearLeg','frontLeg'];
 const binding=[mat.compose(0,-191),mat.compose(0,-246),mat.compose(0,-295)];
 const inverseBind=binding.map(mat.inverse);
 const settings={enabled:true,softReach:true};
 const weights=q=>{const y=q[1];if(y>=-246){const t=INK.easing(clamp((-191-y)/55));return [1-t,t,0];}const t=INK.easing(clamp((-246-y)/49));return [0,1-t,t];};
 const yaw=(p,part)=>INK.Turn.angle(p,part==='leg'?'pelvis':part==='head'?'head':'body');
 function lengths(c){return c.rigLengths||[c.id==='iori'?67:c.female?64:68,c.id==='iori'?76:c.female?67:71,c.id==='chun'?100:96,98];}
 const frameCache=new WeakMap(),frameKeys=['lean','bob','chest','pelvis','yaw','turn','chestYaw','pelvisYaw','headYaw'];
 function frameInfo(p){
  const old=frameCache.get(p);let equal=!!old;
  if(old)for(let i=0;i<frameKeys.length;i++)if(old.signature[i]!==p[frameKeys[i]]){equal=false;break;}
  if(equal)return old;const signature=frameKeys.map(k=>p[k]);
  const source=Rig.torsoMatrices(p),body=INK.bodyMatrix(p),invBody=mat.inverse(body);
  const frame={source,body,invBody,inverse:source.map(mat.inverse),signature};frameCache.set(p,frame);return frame;
 }
 // The unturned source bones remain constant length. Exponential soft reach
 // approaches extension continuously; minimum reach limits elbow/knee folding.
 function chain(root,target,l1,l2,side,leg=false){
  const dx=target[0]-root[0],dy=target[1]-root[1],distance=Math.hypot(dx,dy);
  const maxFlex=rad(leg?153:157),minimum=Math.sqrt(l1*l1+l2*l2+2*l1*l2*Math.cos(maxFlex));
  const maximum=l1+l2-.02,zone=leg?7:5;
  let d=distance;if(settings.softReach&&d>maximum-zone)d=maximum-zone*Math.exp(-(d-maximum+zone)/zone);
  d=clamp(d,minimum,maximum);
  const u=distance>1e-8?[dx/distance,dy/distance]:[side<0?-1:1,0];
  const at=[root[0]+u[0]*d,root[1]+u[1]*d];
  return INK.twoBone(root,at,l1,l2,side,0);
 }
 // A small depth offset gives separate front/back joints at profile. A solved
 // limb is a plane in the torso frame; its virtual depth is continuous in x.
 // It does NOT change the source IK bone lengths or any collision geometry.
 function projectLocal(q,angle,z=0,rootX=0,depthSlope=0){
  const a=rad(angle),c=Math.cos(a),s=Math.sin(a),depth=z+(q[0]-rootX)*depthSlope;
  return [q[0]*c+depth*s,q[1]];
 }
 function projectedPoint(p,q,bone=2,z=0){
  const f=frameInfo(p),local=mat.point(f.inverse[bone],q);
  return mat.point(f.source[bone],projectLocal(local,yaw(p,bone===0?'leg':'arm'),z));
 }
 function skinMatrices(p){
  const f=frameInfo(p);
  if(f.skin)return f.skin;
  return f.skin=f.source.map((m,i)=>{
   const angle=i===0?yaw(p,'leg'):i===2?yaw(p,'arm'):lerp(yaw(p,'leg'),yaw(p,'arm'),.5);
   const a=rad(angle),c=Math.cos(a),s=Math.sin(a),thickness=i===0?.62:.64;
   const width=Math.sqrt(c*c+thickness*thickness*s*s);
   return mat.multiply(m,[width,0,0,1,0,0]);
  });
 }
 function skinPoint(p,q){
  const f=frameInfo(p),matrices=f.deforms||(f.deforms=skinMatrices(p).map((m,i)=>mat.multiply(m,inverseBind[i]))),w=weights(q),out=[0,0];
  for(let i=0;i<3;i++){const v=mat.point(matrices[i],q);out[0]+=w[i]*v[0];out[1]+=w[i]*v[1];}
  return out;
 }
 function sourceRig(c,p,rawOnly=false){
  const f=frameInfo(p),l=lengths(c),as=c.female?35:43;
  const rear=c.rigRearShoulder||[-as,-292],front=c.rigFrontShoulder||[as,-290],half=(c.rigHipWidth||52)/2;
  const shoulder=q=>mat.point(mat.multiply(f.invBody,f.source[2]),[q[0],q[1]+295]);
  const r={};
  for(const name of parts){
   const leg=name.includes('Leg'),isRear=name.startsWith('rear'),key=leg?(isRear?'ra':'fa'):(isRear?'rw':'fw');
   const root=leg?mat.point(f.source[0],[isRear?-half:half,0]):shoulder(isRear?rear:front);
   const k=clamp(p[name+'Projection']??1,.12,1),index=leg?2:0;
   const side=p[name+'Pole']??(name==='frontLeg'?-1:1);
   r[name]=chain(root,p[key],l[index]*k,l[index+1]*k,side,leg);
  }
  return !rawOnly&&INK.Articulation?INK.Articulation.stabilize(c,p,r):r;
 }
 // Read-only surface measurements derived AFTER projection. They never feed IK.
 function surfaceInfo(character,original,projected,depth,angle){
  const length=(points,i)=>Math.hypot(points[i+1][0]-points[i][0],points[i+1][1]-points[i][1]);
  const ratio=[0,1].map(i=>{const before=length(original,i);return before>1e-8?clamp(length(projected,i)/before,0,1.25):1;});
  const direction=i=>{const d=length(projected,i);return d>1e-8?[(projected[i+1][0]-projected[i][0])/d,(projected[i+1][1]-projected[i][1])/d]:[0,0];};
  const u=direction(0),v=direction(1),a=rad(angle);
  return Object.freeze({character,foreshortening:Object.freeze(ratio),depth:Object.freeze(depth.slice()),segmentDepth:Object.freeze([(depth[0]+depth[1])*.5,(depth[1]+depth[2])*.5]),turn:Object.freeze({angle,cos:Math.cos(a),sin:Math.sin(a)}),bend:Object.freeze({cross:u[0]*v[1]-u[1]*v[0],dot:clamp(u[0]*v[0]+u[1]*v[1],-1,1)})});
 }
 function solve(c,p,{force=false}={}){
  if(!settings.enabled&&!force)return legacySolve(c,p);
  const source=sourceRig(c,p),f=frameInfo(p),r={},sockets={},depth={},turns={},projectors={};
  for(const name of parts){
   const leg=name.includes('Leg'),rear=name.startsWith('rear'),bone=leg?0:2;
   const bodyAngle=yaw(p,leg?'leg':'arm'),offset=leg?0:clamp(Number.isFinite(p[name+'Yaw'])?p[name+'Yaw']:0,-160,160),angle=bodyAngle+offset,sign=rear?-1:1,z=sign*(leg?5:8);
   // Legs turn about the gravity axis so a planted ankle stays at its
   // authored height. Arms turn in the chest frame, including torso lean.
   const basis=leg?mat.compose(f.source[0][4],f.source[0][5]):f.source[bone],inverse=mat.inverse(basis);
   const original=source[name].map(q=>leg?q:mat.point(f.body,q));
   const local=original.map(q=>mat.point(inverse,q));
   const rootX=local[0][0],slope=sign*(leg?.12:.2),a=rad(angle),cs=Math.cos(a),sn=Math.sin(a);
   // Arms can abduct out of the chest plane while their shoulder stays at
   // the original torso projection. Zero offset is exactly the legacy plane.
   const ba=rad(bodyAngle),rootProjected=rootX*Math.cos(ba)+z*Math.sin(ba),k=cs+slope*sn;
   const projector=mat.multiply(basis,mat.multiply([k,0,0,1,rootProjected-rootX*k,0],inverse));
   projectors[name]=projector;
   const world=original.map(q=>mat.point(projector,q));
   // Arms retain the documented body-local compatibility representation. All
   // downstream users read world sockets from this same result, exactly once.
   r[name]=world.map(q=>leg?q:mat.point(f.invBody,q));sockets[name]=world;
   const rootDepth=-rootX*Math.sin(ba)+z*Math.cos(ba);
   depth[name]=local.map(q=>rootDepth+(q[0]-rootX)*(-sn+slope*cs));
   turns[name]=angle;
  }
  // Head, neckline, belt and hair anchors share the skinned torso frame.
  sockets.pelvis=skinPoint(p,[0,-191]);sockets.chest=skinPoint(p,[0,-292]);
  sockets.neck=skinPoint(p,[5,-324]);
  const h=c.rigHeadOffset||[6,-46];sockets.head=skinPoint(p,[h[0],-295+h[1]]);
  const anatomy={version:6,source,sockets,depth,turns,projectors};
  // Most solver consumers only need joints. Material measurements are made
  // once, on the first surface read; subsequent reads share the frozen value.
  let surfaces=null;
  Object.defineProperty(anatomy,'surfaces',{enumerable:true,get(){
   if(!surfaces){const measured={};for(const name of parts){
    const original=source[name].map(q=>name.includes('Leg')?q:mat.point(f.body,q));
    measured[name]=surfaceInfo(c.id,original,sockets[name],depth[name],turns[name]);
   }surfaces=Object.freeze(measured);}return surfaces;
  }});
  Object.defineProperties(r,{profile:{value:c},anatomy:{value:anatomy}});
  return r;
 }
 function sockets(p,r){return r.anatomy?r.anatomy.sockets:legacySockets(p,r);}
 function handMatrix(p,r,c,rear=false){
  const name=rear?'rearArm':'frontArm',pts=sockets(p,r)[name],at=pts[2],scale=c.female?.7:c.id==='luke'?.88:.82;
  if(r.anatomy){
   const src=r.anatomy.source[name].map(q=>mat.point(INK.bodyMatrix(p),q)),d=vec.sub(src[2],src[1]);
   const angle=Math.atan2(d[1],d[0])*180/Math.PI;
   // Project the complete hand + fan basis. A profile view foreshortens it
   // continuously instead of normalizing a zero vector into a 180-degree snap.
   return mat.multiply(r.anatomy.projectors[name],mat.compose(src[2][0],src[2][1],angle,scale,scale));
  }
  const d=vec.sub(at,pts[1]);return mat.compose(at[0],at[1],Math.atan2(d[1],d[0])*180/Math.PI,scale,scale);
 }
 function footMatrix(p,r,c,rear=false){
  const pts=sockets(p,r)[rear?'rearLeg':'frontLeg'],at=pts[2];
  // 0 degrees is authored flat. It is not an absent value.
  const authored=rear?p.rfoot:p.ffoot,rot=Number.isFinite(authored)?authored:0;
  const s=c.female?.79:.88;
  return mat.compose(at[0],at[1],rot,s,s);
 }
 function inverseTarget(p,world,name,c){
  // Editor drag and planted-foot correction invert the same visual projection.
  // At edge-on yaw, horizontal dragging is geometrically underdetermined: keep
  // its authored local x instead of dividing by a nearly singular cosine.
  const leg=name.includes('Leg'),rear=name.startsWith('rear'),f=frameInfo(p),bone=leg?0:2;
  const basis=leg?mat.compose(f.source[0][4],f.source[0][5]):f.source[bone],inverse=mat.inverse(basis);
  const q=mat.point(inverse,world),bodyAngle=yaw(p,leg?'leg':'arm'),offset=leg?0:clamp(Number.isFinite(p[name+'Yaw'])?p[name+'Yaw']:0,-160,160),angle=bodyAngle+offset,a=rad(angle),sign=rear?-1:1;
  const z=sign*(leg?5:8),slope=sign*(leg?.12:.2),k=Math.cos(a)+slope*Math.sin(a);
  const source=sourceRig(c,p),root=mat.point(inverse,leg?source[name][0]:mat.point(f.body,source[name][0]));
  const key=leg?(rear?'ra':'fa'):(rear?'rw':'fw');
  const prev=mat.point(inverse,leg?p[key]:mat.point(f.body,p[key]));
  const ba=rad(bodyAngle),rootProjected=root[0]*Math.cos(ba)+z*Math.sin(ba);
  const x=Math.abs(k)>.18?root[0]+(q[0]-rootProjected)/k:prev[0];
  const actor=mat.point(basis,[x,q[1]]);
  return leg?actor:mat.point(f.invBody,actor);
 }
 Rig.solveCombat=legacySolve;Rig.solveAnimation=solve;Rig.sockets=sockets;
 INK.Anatomy={version:'6.0.0',settings,solve,sourceRig,surfaceInfo,chain,skinPoint,skinMatrices,weights,frameInfo,projectLocal,projectedPoint,handMatrix,footMatrix,inverseTarget,lengths};
})();
