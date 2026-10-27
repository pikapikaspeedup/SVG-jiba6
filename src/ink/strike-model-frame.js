/* Presentation adapter for a shared strike model. No IK or state mutation. */
'use strict';
(()=>{
 const names=['rearArm','frontArm','rearLeg','frontLeg'],I=[1,0,0,1,0,0],H=[-1,0,0,1,0,0],copy=x=>JSON.parse(JSON.stringify(x));
 function build(f,model,{world={}}={}){
  const M=INK.mat,dir=(world.dir??f.dir)===-1?-1:1,reflection=dir<0?H:I,c=model.profile,p=model.pose||{},has3D=names.every(n=>model.joints3D?.[n]?.every(q=>q.length===3&&q.every(Number.isFinite))),joints3D={},rig={},sockets={},depth={},turns={},surfaces={},projectors={},source={},endFrames={},fanFrames={},physicalLengths={};
  const xyz=q=>{if(!Array.isArray(q)||q.length<2||!q.every(Number.isFinite))throw TypeError('Finite strike-model points required');return [q[0]*dir,q[1],(q[2]||0)*dir];};
  const basis=(matrix,thick=true)=>{if(!Array.isArray(matrix)||matrix.length!==6||!matrix.every(Number.isFinite))throw TypeError('Finite strike-model matrix required');const reflected=M.multiply(reflection,matrix);return dir<0&&thick?M.multiply(reflected,H):reflected;};
  const materialAngles=Object.fromEntries(Object.entries(model.materialAngles||{body:0,pelvis:0,head:0}).map(([k,v])=>[k,dir<0?180-v:v]));
  for(const n of names){const original=has3D?model.joints3D[n]:model.chains[n].map(q=>[...q,0]);if(original.length!==3)throw TypeError('Three joints required');const chain=original.map(xyz);joints3D[n]=chain;sockets[n]=chain.map(q=>q.slice(0,2));rig[n]=sockets[n];depth[n]=chain.map(q=>q[2]);turns[n]=materialAngles[n.endsWith('Leg')?'pelvis':'body']||0;projectors[n]=I.slice();source[n]=sockets[n].map(q=>q.slice());
   const lengths=[Math.hypot(...original[1].map((v,i)=>v-original[0][i])),Math.hypot(...original[2].map((v,i)=>v-original[1][i]))];physicalLengths[n]=lengths;
   if(model.physicalLengths?.[n]&&model.physicalLengths[n].some((v,i)=>Math.abs(v-lengths[i])>1e-5))throw RangeError('Model physical lengths disagree with chain');
   const straight=[[0,0],[lengths[0],0],[lengths[0]+lengths[1],0]];surfaces[n]=INK.Anatomy.surfaceInfo(c.id,straight,sockets[n],depth[n],turns[n]);
   endFrames[n]=basis(model.endFrames[n]);endFrames[n][4]=chain[2][0];endFrames[n][5]=chain[2][1];if(model.fanFrames?.[n])fanFrames[n]=basis(model.fanFrames[n],false);
  }
  const fallback={pelvis:[model.skinMatrices[0][4],model.skinMatrices[0][5],0],chest:[model.skinMatrices[2][4],model.skinMatrices[2][5],0],head:[model.headMatrix[4],model.headMatrix[5],0]};fallback.neck=fallback.head;
  for(const n of ['pelvis','chest','neck','head']){joints3D[n]=xyz(model.joints3D?.[n]||fallback[n]);sockets[n]=joints3D[n].slice(0,2);}
  Object.defineProperties(rig,{profile:{value:c},anatomy:{value:{source,sockets,depth,turns,surfaces,projectors}}});
  const scale=world.scale??f.renderScale??c.scale??1,worldFeet={};for(const k of ['rear','front']){const q=joints3D[k+'Leg'][2];worldFeet[k]=[(world.x??f.x??0)+q[0]*scale,665+(world.y??f.y??0)+q[1]*scale,q[2]*scale];}
  return {space:'actor-screen',mode:'strike-model',surfaceMode:'persistent-facing',carrierSpec:{representation:has3D?'spatial3D':'planar3D',nativeChains:copy(joints3D)},physicalLengths,supportDrop:0,fanFrames,legacyMatrix:I.slice(),legacyPose:copy(p),legacyRig:rig,rig,joints3D,skinMatrices:model.skinMatrices.map(m=>basis(m)),headMatrix:basis(model.headMatrix),endFrames,materialAngles,worldFeet,residuals:{rear:0,front:0},bodyOuter:I.slice()};
 }
 INK.StrikeModelFrame=Object.freeze({build});
})();
