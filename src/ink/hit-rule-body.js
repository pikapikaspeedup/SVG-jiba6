/* Canonical native-hit source boundary. No impulses, lifecycle, foot planning,
 * visual capture or simulation mutation. Dynamic evaluation is intentionally absent. */
'use strict';
(()=>{
 const names=['rearArm','frontArm','rearLeg','frontLeg'],copy=x=>JSON.parse(JSON.stringify(x));
 const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
 const vector=q=>Array.isArray(q)&&q.length===3&&q.every(Number.isFinite),matrix=m=>Array.isArray(m)&&m.length===6&&m.every(Number.isFinite),distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 const validWorld=w=>w&&['x','y','scale'].every(k=>Number.isFinite(w[k]))&&w.scale>0&&[1,-1].includes(w.dir);
 function valid(model){
  const carriers=model?.nativeCarriers;if(!carriers||!['pelvis','middle','chest','head'].every(k=>{const c=carriers[k];return vector(c?.point)&&vector(c?.vertical)&&Number.isFinite(c.heading)&&Math.hypot(...c.vertical)>1e-8&&Math.hypot(c.vertical[0],c.vertical[1])>=1e-3*Math.hypot(...c.vertical);}))return false;
  const p=model?.profile;if(!p||typeof p.id!=='string'||!Array.isArray(p.rigLengths)||p.rigLengths.length!==4||!p.rigLengths.every(n=>Number.isFinite(n)&&n>0))return false;
  if(!Array.isArray(model.skinMatrices)||model.skinMatrices.length!==3||!model.skinMatrices.every(matrix)||!matrix(model.headMatrix))return false;
  if(!['pelvis','chest','neck','head'].every(k=>vector(model.joints3D?.[k])))return false;
  for(const n of names){const q=model.joints3D?.[n],L=model.physicalLengths?.[n],offset=n.endsWith('Leg')?2:0;
   if(!Array.isArray(q)||q.length!==3||!q.every(vector)||!Array.isArray(L)||L.length!==2||!matrix(model.endFrames?.[n]))return false;
   for(let i=0;i<2;i++)if(!Number.isFinite(L[i])||Math.abs(L[i]-p.rigLengths[offset+i])>1e-5||Math.abs(distance(q[i],q[i+1])-L[i])>1e-5)return false;
  }return true;
 }
 function capture(model,{world,sourceID,policy=null}={}){
  if(!valid(model)||!validWorld(world)||typeof sourceID!=='string'||!sourceID.length)return null;
  // Whitelist numeric/model content rather than retaining an actor, attack or
  // a renderer-owned frame. A fresh source must be supplied by the rule owner.
  const source={};for(const k of ['pose','profile','joints3D','physicalLengths','skinMatrices','headMatrix','endFrames','fanFrames','materialAngles','residuals','supportDrop','bodyX','entryCarriers','nativeCarriers'])if(model[k]!==undefined)source[k]=copy(model[k]);
  source.chains=Object.fromEntries(names.map(n=>[n,source.joints3D[n].map(q=>q.slice(0,2))]));for(const k of ['pelvis','chest','neck','head'])source[k]=source.joints3D[k].slice(0,2);
  const canonical=INK.StrikeModelFrame.build({x:0,y:0,dir:1,ch:{scale:1}},source,{world:{x:0,y:0,dir:1,scale:1}}),entry=INK.DefenseBody.fromFrame(canonical,{dir:1});if(!entry)return null;
  const baseline=INK.DefenseBody.solve(source.profile,entry.pose,entry.targets,{bodyX:entry.bodyX,poles:entry.poles,supportWeights:{front:0,rear:0}});
  if(!valid(baseline))return null;
  return freeze({entry,baseline,version:1,kind:'native-hit-source',sourceID,policy:policy?copy(policy):null,world:{x:world.x,y:world.y,scale:world.scale,dir:world.dir},model:source});
 }
 const clone=carrier=>carrier?.kind==='native-hit-source'&&valid(carrier.model)?copy(carrier.model):null;
 function geometry(carrier,{world=carrier?.world}={}){if(!validWorld(world)||!valid(carrier?.model))return null;return INK.StrikeCollider.body(carrier.model,{world:{x:world.x,groundWorldY:665+world.y,scale:world.scale,dir:world.dir}});}
 function frame(carrier,{world=carrier?.world}={}){if(!validWorld(world)||!valid(carrier?.model))return null;const f={x:world.x,y:world.y,dir:world.dir,ch:{scale:world.scale}};return {...INK.StrikeModelFrame.build(f,carrier.model,{world}),mode:'hit-rule',nativeBody:true};}
 function deform(carrier,{world=carrier?.world,poseDelta={},targetDeltas={},polesOverride,armDirections,worldFeet,supportWeights,groundedFeet,carrierWeight=1}={}){
  if(!valid(carrier?.model)||!carrier.entry||!validWorld(world)||!Number.isFinite(carrierWeight)||carrierWeight<0||carrierWeight>1)return null;
  const allowed=['bodyX','bob','lean','yaw','twist','head','headYaw'],p=copy(carrier.entry.pose),targets=copy(carrier.entry.targets),M=INK.mat;p.bodyX=carrier.entry.bodyX;
  for(const [k,v]of Object.entries(poseDelta)){if(!allowed.includes(k)||!Number.isFinite(v))return null;p[k]=(k==='bodyX'?carrier.entry.bodyX:p[k]||0)+v;}
  for(const [n,v]of Object.entries(targetDeltas)){if(!names.includes(n)||!vector(v))return null;targets[n]=targets[n].map((x,i)=>x+v[i]);}
  if(armDirections&&Object.entries(armDirections).some(([k,v])=>!['frontArm','rearArm'].includes(k)||!Array.isArray(v)||v.length!==2||v.some(q=>!vector(q)||Math.abs(Math.hypot(...q)-1)>1e-6)))return null;
  if(polesOverride&&Object.entries(polesOverride).some(([k,v])=>!names.includes(k)||!vector(v)||Math.hypot(...v)<1e-8))return null;
  if(worldFeet&&!['front','rear'].every(k=>vector(worldFeet[k])))return null;
  for(const values of [supportWeights,groundedFeet])if(values&&Object.keys(values).some(k=>!['front','rear'].includes(k)))return null;
  if(supportWeights&&Object.values(supportWeights).some(v=>!Number.isFinite(v)||v<0||v>1))return null;
  if(groundedFeet&&Object.values(groundedFeet).some(v=>typeof v!=='boolean'))return null;
  const model=INK.DefenseBody.solve(carrier.model.profile,p,targets,{bodyX:p.bodyX??carrier.entry.bodyX,poles:{...carrier.entry.poles,...polesOverride},worldFeet,world,supportWeights:supportWeights||{front:0,rear:0},groundedFeet});
  // The rest path owns two fixed-length bone directions. IK is only used
  // for its two endpoints, never to choose a new bend midway through rest.
  if(armDirections)for(const [n,dirs]of Object.entries(armDirections)){
   const q=[model.joints3D[n][0].slice()],L=model.physicalLengths[n];for(let i=0;i<2;i++)q.push(q[i].map((v,j)=>v+dirs[i][j]*L[i]));model.joints3D[n]=q;model.chains[n]=q.map(v=>v.slice(0,2));model.residuals[n]=0;
   const config={kind:'hand',heading:((p.yaw||0)+(p.twist||0))*Math.PI/180,authoredAngle:Math.atan2(q[2][1]-q[1][1],q[2][0]-q[1][0])*180/Math.PI,scale:model.profile.female?.7:model.profile.id==='luke'?.88:.82};
   model.endFrames[n]=INK.VisualFrame.thickEndFrame(q,config);model.fanFrames[n]=INK.VisualFrame.thinFanFrame(q,config);model.pose[n==='rearArm'?'rw':'fw']=q[2].slice(0,2);
  }
  const carry=(current,base,source)=>{const det=base[0]*base[3]-base[1]*base[2];if(!Number.isFinite(det)||Math.abs(det)<1e-8)return null;const inverse=[base[3]/det,-base[1]/det,-base[2]/det,base[0]/det,(base[2]*base[5]-base[3]*base[4])/det,(base[1]*base[4]-base[0]*base[5])/det];const out=M.multiply(M.multiply(current,inverse),source);return matrix(out)?out:null;};
  const qr=m=>{const sx=Math.hypot(m[0],m[1]),det=m[0]*m[3]-m[1]*m[2];if(sx<=1e-8||det<=1e-8)return null;return {angle:Math.atan2(m[1],m[0]),sx,sy:det/sx,shear:(m[0]*m[2]+m[1]*m[3])/sx,x:m[4],y:m[5]};};
  const interpolate=(base,carried)=>{if(!carried)return null;if(carrierWeight===0)return base.slice();if(carrierWeight===1)return carried.slice();const a=qr(base),b=qr(carried);if(!a||!b)return null;const mix=(x,y)=>x+(y-x)*carrierWeight,angle=a.angle+Math.atan2(Math.sin(b.angle-a.angle),Math.cos(b.angle-a.angle))*carrierWeight,c=Math.cos(angle),s=Math.sin(angle),sx=mix(a.sx,b.sx),sy=mix(a.sy,b.sy),shear=mix(a.shear,b.shear);return [c*sx,s*sx,c*shear-s*sy,s*shear+c*sy,mix(a.x,b.x),mix(a.y,b.y)];};
  const source=carrier.model,base=carrier.baseline,rawSkin=model.skinMatrices.map(m=>m.slice()),rawHead=model.headMatrix.slice();model.skinMatrices=model.skinMatrices.map((m,i)=>interpolate(m,carry(m,base.skinMatrices[i],source.skinMatrices[i])));model.headMatrix=interpolate(model.headMatrix,carry(model.headMatrix,base.headMatrix,source.headMatrix));
  if(model.skinMatrices.some(m=>!m)||!model.headMatrix)return null;
  for(const n of names){const q=interpolate(model.endFrames[n],carry(model.endFrames[n],base.endFrames[n],source.endFrames[n]));if(!q)return null;q[4]=model.chains[n][2][0];q[5]=model.chains[n][2][1];model.endFrames[n]=q;
   if(source.fanFrames?.[n]){const fan=carry(q,source.endFrames[n],source.fanFrames[n]);if(!fan)return null;fan[4]=q[4];fan[5]=q[5];model.fanFrames[n]=fan;}}
  model.joints3D.head[0]=model.headMatrix[4];model.joints3D.head[1]=model.headMatrix[5];model.head=model.joints3D.head.slice(0,2);
  // Carry the source's numeric carrier calibration alongside its matrices.
  // Otherwise a zero-response Spatial pass starts from DefenseBody metadata
  // even though the visible/physical sheets still belong to the source.
  for(const [i,k]of ['pelvis','middle','chest','head'].entries()){
   const current=model.nativeCarriers[k],original=source.nativeCarriers[k],initial=base.nativeCarriers[k],raw=i===3?rawHead:rawSkin[i],bm=i===3?base.headMatrix:base.skinMatrices[i],final=i===3?model.headMatrix:model.skinMatrices[i];
   const transformed=carry(raw,bm,[0,0,original.vertical[0],original.vertical[1],0,0]);if(!transformed)return null;
   current.vertical=[current.vertical[0]+carrierWeight*(transformed[2]-current.vertical[0]),current.vertical[1]+carrierWeight*(transformed[3]-current.vertical[1]),current.vertical[2]+carrierWeight*(original.vertical[2]-initial.vertical[2])];
   current.point=[final[4],final[5],current.point[2]+carrierWeight*(original.point[2]-initial.point[2])];
   current.heading+=carrierWeight*Math.atan2(Math.sin(original.heading-initial.heading),Math.cos(original.heading-initial.heading));
  }
  for(const k of ['pelvis','body','head']){const delta=(source.materialAngles[k]-base.materialAngles[k])*Math.PI/180;model.materialAngles[k]+=carrierWeight*Math.atan2(Math.sin(delta),Math.cos(delta))*180/Math.PI;}
  return valid(model)?model:null;
 }
 INK.HitRuleBody=Object.freeze({capture,clone,geometry,frame,valid,deform});
})();
