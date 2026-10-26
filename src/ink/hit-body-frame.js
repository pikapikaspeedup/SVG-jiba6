/* Fixed-length carrier deformation; lifecycle and impulse sampling live elsewhere. */
'use strict';
(() => {
 const rad=Math.PI/180,clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
 const vec=(q,fallback=[0,0,0])=>q?.length===3?q:fallback;
 const rotate=(v,z,y)=>{const c=Math.cos(y),s=Math.sin(y),x=v[0]*c+v[2]*s,depth=-v[0]*s+v[2]*c;return [x*Math.cos(z)-v[1]*Math.sin(z),x*Math.sin(z)+v[1]*Math.cos(z),depth];};
 const transform=(p,origin,target,z,y)=>add(target,rotate(sub(p,origin),z,y));
 const names=['rearArm','frontArm','rearLeg','frontLeg'];
 const copy=v=>Array.isArray(v)?v.map(copy):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).map(k=>[k,copy(v[k])])):v;
 const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
 function capture(frame){
  const resolved=copy(frame);resolved.rig.profile=copy(frame.rig.profile);resolved.rig.anatomy=copy(frame.rig.anatomy);
  const spec=frame.carrierSpec,projected=frame.mode!=='locomotion',nativeChains=copy(spec?.nativeChains),bindings=copy(spec?.forwardBindings),corrections={};let maximum=0;
  if(projected&&nativeChains&&bindings)for(const n of names){corrections[n]=nativeChains[n].map((p,i)=>{const q=INK.mat.point(bindings[n],p),actual=frame.joints3D[n][i];const d=[actual[0]-q[0],actual[1]-q[1]];maximum=Math.max(maximum,Math.hypot(...d));return d;});}
  const representation=!projected&&!frame.bridge?'spatial3D':nativeChains&&bindings&&maximum<=24?'legacyProjected':'resolvedSurfaceFallback';
  return freeze({representation,resolvedFrame:resolved,nativeChains,bindings,corrections,diagnostics:{bridge:!!frame.bridge,maxBindingCorrection:maximum,fixedNative:representation==='legacyProjected',fallback:representation==='resolvedSurfaceFallback'}});
 }
 // Damped forward Jacobian fitting in native joint angles. No projector inverse.
 function projectedChain(native,binding,target){
  const root=native[0],lens=[0,1].map(i=>Math.hypot(native[i+1][0]-native[i][0],native[i+1][1]-native[i][1])),angles=[0,1].map(i=>Math.atan2(native[i+1][1]-native[i][1],native[i+1][0]-native[i][0]));
  const fk=a=>{const j=[root[0]+lens[0]*Math.cos(a[0]),root[1]+lens[0]*Math.sin(a[0])];return [root.slice(),j,[j[0]+lens[1]*Math.cos(a[1]),j[1]+lens[1]*Math.sin(a[1])]];};
  for(let k=0;k<10;k++){const chain=fk(angles),end=INK.mat.point(binding,chain[2]),error=sub(target,end),jac=angles.map((a,i)=>{const x=-lens[i]*Math.sin(a),y=lens[i]*Math.cos(a);return [binding[0]*x+binding[2]*y,binding[1]*x+binding[3]*y];}),den=jac.flat().reduce((a,v)=>a+v*v,0)+80;for(let i=0;i<2;i++)angles[i]+=clamp((jac[i][0]*error[0]+jac[i][1]*error[1])/den,-.08,.08);}
  const chain=fk(angles);return {native:chain,projected:chain.map(p=>INK.mat.point(binding,p))};
 }
 function deform(source,sample={}, {world,dir=1,settleFrame=null,settle=0,footTargets=null}={}){
  const carrier=source.resolvedFrame?source:capture(source);source=carrier.resolvedFrame;
  const projected=carrier.representation!=='spatial3D';
  dir=dir<0?-1:1;
  const number=k=>clamp(Number.isFinite(sample[k])?sample[k]:0,-25,25),offset=k=>[dir*clamp(sample[k]?.[0]||0,-18,18),clamp(sample[k]?.[1]||0,-18,18),0];
  if(!projected&&settleFrame&&settle>0){
   const u=clamp(settle,0,1),mix=(a,b)=>a.map((v,i)=>v+(b[i]-v)*u),chains={},fixed=INK.FrameDeform.lengths(source),joints={};
   for(const name of ['rearArm','frontArm','rearLeg','frontLeg']){const a=source.joints3D[name],b=settleFrame.joints3D[name],root=mix(a[0],b[0]),end=mix(a[2],b[2]),pole=mix(sub(a[1],a[0]),sub(b[1],b[0]));chains[name]=INK.VisualFrame.twoBone3D(root,end,...fixed[name],pole).chain;}
   for(const k of ['pelvis','chest','neck','head']){const point=(f,k)=>f.joints3D[k]||[...f.rig.anatomy.sockets[k],0];joints[k]=mix(point(source,k),point(settleFrame,k));}
   // settleFrame must share source heading/material basis; lifecycle owns
   // that choice. A new facing is a separate transition, not matrix blending.
   source=INK.FrameDeform.apply(source,{chains,joints,skinMatrices:source.skinMatrices.map((m,i)=>mix(m,settleFrame.skinMatrices[i])),headMatrix:mix(source.headMatrix,settleFrame.headMatrix),world});
  }
  if(!footTargets&&!(projected&&settleFrame&&settle>0)&&!Object.entries(sample).some(([k,v])=>k!=='count'&&(Array.isArray(v)?v.some(x=>x!==0):Number.isFinite(v)&&v!==0)))return source;
  const j=source.joints3D,point=k=>vec(j[k],source.rig.anatomy.sockets[k]?[...source.rig.anatomy.sockets[k],0]:[0,0,0]),hip=point('pelvis'),chest=point('chest'),neck=point('neck'),head=point('head'),hipZ=number('pelvis')*.35*rad*dir,hipY=number('pelvisYaw')*rad*dir,chestZ=(number('lean')+number('chest')*.32)*rad*dir,chestY=number('chestYaw')*rad*dir;
  const newHip=add(hip,[number('pelvis')*.35*dir,number('bob'),0]);
  const hipMap=p=>transform(p,hip,newHip,hipZ,hipY),waist=hip.map((v,i)=>v+(chest[i]-v)*.38),newChest=transform(chest,waist,hipMap(waist),chestZ,chestY),chestMap=p=>transform(p,chest,newChest,chestZ,chestY),newNeck=chestMap(neck),newHead=transform(head,neck,newNeck,chestZ+number('head')*rad*dir,(number('headYaw'))*rad*dir);
  const chains={},fixed=INK.FrameDeform.lengths(source),residuals={},nativeSolved={},forwardBindings={};
  for(const name of ['rearArm','frontArm','rearLeg','frontLeg']){
   const leg=name.endsWith('Leg'),rear=name.startsWith('rear'),map=leg?hipMap:chestMap,chain=j[name],root=map(chain[0]),key=(rear?'r':'f')+(leg?'a':'w'),elbow=(rear?'r':'f')+'e';
   // Feet preserve their source world anchor unless the sampled leg response
   // explicitly releases one. Hands follow the carrier shoulder plus lag.
   const target=add(leg?(footTargets?.[rear?'rear':'front']||chain[2]):map(chain[2]),offset(key)),pole=sub(add(map(chain[1]),leg?[0,0,0]:offset(elbow)),root);
   if(carrier.representation==='legacyProjected'){
    const binding=carrier.bindings[name],native=carrier.nativeChains[name],baseRoot=INK.mat.point(binding,native[0]),shift=[root[0]-chain[0][0],root[1]-chain[0][1]],adjusted=binding.slice();adjusted[4]+=shift[0];adjusted[5]+=shift[1];
    const u=clamp(settle,0,1),goal=target.slice(0,2);if(settleFrame&&!(leg&&footTargets?.[rear?'rear':'front']))for(let i=0;i<2;i++)goal[i]+=(settleFrame.joints3D[name][2][i]-chain[2][i])*u;
    const correction=carrier.corrections[name],solved=projectedChain(native,adjusted,goal.map((v,i)=>v-correction[2][i]));
    nativeSolved[name]=solved.native;forwardBindings[name]=adjusted;chains[name]=solved.projected.map((p,i)=>[p[0]+correction[i][0],p[1]+correction[i][1],chain[i][2]]);residuals[name]=Math.hypot(chains[name][2][0]-goal[0],chains[name][2][1]-goal[1]);
   }else if(projected){chains[name]=chain.map(p=>add(p,sub(root,chain[0])));residuals[name]=Math.hypot(...sub(chains[name][2],target));}
   else{const solved=INK.VisualFrame.twoBone3D(root,target,fixed[name][0],fixed[name][1],pole);chains[name]=solved.chain;residuals[name]=solved.residual;}
  }
  // Material sheets keep a nonzero section while the skeleton rotates in 3D.
  // Translate each sheet by its actual transformed anchor, rotate in screen,
  // and use the same bounded yaw-thickness rule as the carrier model.
  const sheet=(m,origin,target,z,y)=>{const at=transform([m[4],m[5],origin[2]],origin,target,z,y),width=Math.sqrt(Math.cos(y)**2+.64**2*Math.sin(y)**2),c=Math.cos(z),s=Math.sin(z);return [width*(c*m[0]-s*m[1]),width*(s*m[0]+c*m[1]),c*m[2]-s*m[3],s*m[2]+c*m[3],at[0],at[1]];};
  const skinMatrices=source.skinMatrices.map((m,i)=>i===0?sheet(m,hip,newHip,hipZ,hipY):i===2?sheet(m,chest,newChest,chestZ,chestY):sheet(m,hip,newHip,(hipZ+chestZ)*.5,(hipY+chestY)*.5));
  const headMatrix=sheet(source.headMatrix,head,newHead,chestZ+number('head')*rad*dir,number('headYaw')*rad*dir),materialAngles={...source.materialAngles,body:source.materialAngles.body+dir*number('chestYaw'),pelvis:source.materialAngles.pelvis+dir*number('pelvisYaw'),head:source.materialAngles.head+dir*number('headYaw')};
  const nativeLengths=carrier.representation==='legacyProjected'?Object.fromEntries(names.map(n=>[n,[0,1].map(i=>Math.hypot(...carrier.nativeChains[n][i+1].map((v,j)=>v-carrier.nativeChains[n][i][j])))])):undefined;
  const result=INK.FrameDeform.apply(source,{chains,nativeLengths,joints:{pelvis:newHip,chest:newChest,neck:newNeck,head:newHead},skinMatrices,headMatrix,materialAngles,world});
  return {...result,hitBodyResiduals:residuals,carrierDiagnostics:carrier.diagnostics,nativeChains:projected?nativeSolved:undefined,forwardBindings:projected?forwardBindings:undefined};
 }
 INK.HitBodyFrame={capture,deform};
})();
