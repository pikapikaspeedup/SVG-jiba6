/* Fixed-native-length presentation contact constraint. */
'use strict';
(()=>{
 const names=['rearArm','frontArm','rearLeg','frontLeg'],diagnostics=new WeakMap();
 const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 // Invertible attachment frames use rotation + signed QR factors; unlike
 // thin compatibility projectors these must never cross a zero determinant.
 function attachmentMix(a,b,w){
  const decompose=m=>{const x=Math.max(1e-6,Math.hypot(m[0],m[1])),angle=Math.atan2(m[1],m[0]),c=Math.cos(angle),s=Math.sin(angle);return {angle,x,shear:c*m[2]+s*m[3],y:(m[0]*m[3]-m[1]*m[2])/x};};
  const x=decompose(a),y=decompose(b),parity=x.y<0?-1:1;
  // An explicit template-basis reflection, never an interpolated reflection.
  if((y.y<0?-1:1)!==parity){b=[-b[0],-b[1],b[2],b[3],b[4],b[5]];Object.assign(y,decompose(b));}
  const angle=x.angle+Math.atan2(Math.sin(y.angle-x.angle),Math.cos(y.angle-x.angle))*w,c=Math.cos(angle),s=Math.sin(angle),sx=x.x+(y.x-x.x)*w,sy=parity*Math.max(1e-6,Math.abs(x.y)+(Math.abs(y.y)-Math.abs(x.y))*w),h=x.shear+(y.shear-x.shear)*w;
  return [c*sx,s*sx,c*h-s*sy,s*h+c*sy,a[4]+(b[4]-a[4])*w,a[5]+(b[5]-a[5])*w];
 }
 function apply(f,frame,{combatPose,weight=1}={}){
  const w=Number.isFinite(weight)?Math.max(0,Math.min(1,weight)):0,m=f.attack?.m;if(!frame||!combatPose||!m||!w)return frame;
  const I=INK,M=I.mat,c=frame.rig.profile,leg=m.contactPart==='foot'||m.pose==='kick',name=leg?'frontLeg':'frontArm',spec=frame.carrierSpec;
  const reject=reason=>{diagnostics.set(frame,Object.freeze({unsupported:reason,name}));return frame;};
  if(!spec?.nativeChains||!spec.forwardBindings)return reject('missing-native-binding');
  if(!['ryu','ken','chun','cammy','luke','juri','mai','iori'].includes(f.ch.id)||!['sMP','sHP','cMK'].includes(m.id))return reject('unsupported-move');
  const source=spec.nativeChains[name],L=[distance(source[0],source[1]),distance(source[1],source[2])],cr=I.Runtime.rig(f,combatPose),C=cr[name],ratios=[distance(C[0],C[1])/L[0],distance(C[1],C[2])/L[1]];
  if(!ratios.every(Number.isFinite)||ratios[0]<=0||Math.abs(ratios[0]-ratios[1])>1e-6)return reject('nonuniform-combat-scale');
  const canonical=I.Anatomy.lengths(c),expected=leg?canonical.slice(2,4):canonical.slice(0,2);
  if(L.some((v,i)=>Math.abs(v-expected[i])>1e-6))return reject('nonstandard-native-length');
  const lambda=ratios[0],H=C[0],N=C.map(q=>q.map((v,j)=>H[j]+(v-H[j])/lambda)),outer=M.multiply(M.compose(0,0,0,f.dir*(combatPose.depth||1),1),M.multiply(M.compose(combatPose.rootShift||0,(combatPose.floor||0)-180,combatPose.spin||0),M.compose(0,180))),body=leg?M.identity():I.bodyMatrix(combatPose),combatBasis=M.multiply(outer,body);
  const targetBinding=M.multiply(combatBasis,M.multiply(M.compose(H[0],H[1],0,lambda,lambda),M.compose(-H[0],-H[1]))),oldBinding=spec.forwardBindings[name],mix=(a,b)=>a.map((v,j)=>v+(b[j]-v)*w),short=x=>((x+180)%360+360)%360-180;
  const a=I.Articulation.angles(source),b=I.Articulation.angles(N),angle=a.map((v,j)=>(v+short(b[j]-v)*w)*Math.PI/180),root=mix(source[0],H),joint=[root[0]+Math.cos(angle[0])*L[0],root[1]+Math.sin(angle[0])*L[0]],end=[joint[0]+Math.cos(angle[0]+angle[1])*L[1],joint[1]+Math.sin(angle[0]+angle[1])*L[1]],native=w===1?N:[root,joint,end],binding=mix(oldBinding,targetBinding),points=native.map(q=>M.point(binding,q));
  const nativeChains={...spec.nativeChains,[name]:native},forwardBindings={...spec.forwardBindings,[name]:binding},old=frame.rig.anatomy,depth={...old.depth},joints3D={...frame.joints3D,[name]:points.map((q,j)=>[...q,old.depth[name][j]])},sockets={...old.sockets,[name]:points},surfaces={...old.surfaces,[name]:I.Anatomy.surfaceInfo(c.id,native,points,depth[name],old.turns[name])},projectors={...old.projectors,[name]:binding},rig={...frame.rig,[name]:points};
  Object.defineProperties(rig,{profile:{value:c},anatomy:{value:{...old,source:nativeChains,sockets,depth,surfaces,projectors}}});
  const direction=Math.atan2(C[2][1]-C[1][1],C[2][0]-C[1][0])*180/Math.PI,scale=leg?(c.female?.79:.88):(c.female?.7:c.id==='luke'?.88:.82),rawEnd=M.multiply(combatBasis,M.compose(C[2][0],C[2][1],leg?(combatPose.ffoot||0):direction,scale,scale)),targetEnd=frame.surfaceMode==='persistent-facing'?M.multiply(rawEnd,[-1,0,0,1,0,0]):rawEnd,endFrames={...frame.endFrames,[name]:attachmentMix(frame.endFrames[name],targetEnd,w)},fanFrames={...frame.fanFrames};endFrames[name][4]=points[2][0];endFrames[name][5]=points[2][1];
  if(c.id==='mai'&&!leg){const fan=Math.max(.07,Math.min(1,combatPose.fan??.84)),hand=f.ch.handScale||.76,targetFan=M.multiply(combatBasis,M.multiply(M.compose(C[2][0],C[2][1],direction,hand,hand),M.multiply(M.compose(16,0,(1-fan)*9),M.compose(-16,0))));const from=frame.fanFrames[name],oldWrist=frame.joints3D[name][2],targetWrist=M.point(combatBasis,C[2]);fanFrames[name]=mix(from,targetFan);for(let j=0;j<2;j++)fanFrames[name][4+j]=points[2][j]+(from[4+j]-oldWrist[j])*(1-w)+(targetFan[4+j]-targetWrist[j])*w;}
  const worldFeet={...frame.worldFeet};if(leg){const scale=f.renderScale||f.ch.scale||1;worldFeet.front=[f.x+points[2][0]*scale,665+f.y+points[2][1]*scale,joints3D[name][2][2]*scale];}
  // legacyRig describes the pre-adapter pose; consumers must use carrierSpec.
  const out={...frame,rig,joints3D,endFrames,fanFrames,worldFeet,nativeChains,forwardBindings,carrierSpec:{...spec,representation:'legacyProjected',nativeChains,forwardBindings},contactOwnedChains:[name],contactCompatibility:{name,lambda,legacyRigIsReference:true}};
  const targets=C.map(q=>M.point(combatBasis,q)),residual=Math.max(...points.map((q,j)=>distance(q,targets[j])));
  diagnostics.set(out,Object.freeze({name,weight:w,lambda,residual,unsupported:null,lengths:Object.freeze(L),targets:Object.freeze(targets.map(Object.freeze))}));return out;
 }
 INK.StrikeContact={apply,inspect:p=>diagnostics.get(p)||null};
})();
