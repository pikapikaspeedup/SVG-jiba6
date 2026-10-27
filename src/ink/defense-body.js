/* Shared defense geometry boundary. State selection and plans belong to the
 * simulation caller; this adapter never reads input, clock or display settings. */
'use strict';
(()=>{
 const names=['rearArm','frontArm','rearLeg','frontLeg'];
 const vector=q=>Array.isArray(q)&&q.length===3&&q.every(Number.isFinite);
 // Only genuine spatial chains may enter the shared solver. A bridged or
 // projected carrier requires its own forward representation, not guessed depth.
 function fromFrame(frame,{dir=1}={}){
  if(!frame||![1,-1].includes(dir)||frame.bridge||frame.space!=='actor-screen')return null;
  const representation=frame.carrierSpec?.representation;
  if(representation!=='spatial3D'&&!(representation==null&&frame.mode==='locomotion'))return null;
  const j=frame.joints3D,a=frame.materialAngles;
  if(!j||!vector(j.pelvis)||!vector(j.chest)||!a||!['pelvis','body','head'].every(k=>Number.isFinite(a[k])))return null;
  const convert=q=>[q[0]*dir,q[1],q[2]*dir],sub=(x,y)=>x.map((v,i)=>v-y[i]),dot=(x,y)=>x.reduce((v,n,i)=>v+n*y[i],0),unit=q=>{const l=Math.hypot(...q);return l>1e-8?q.map(v=>v/l):null;};
  const angle=v=>dir<0?(frame.surfaceMode==='persistent-facing'?180-v:v-180):v;
  const yaw=angle(a.pelvis),r=yaw*Math.PI/180,unturn=q=>[q[0]*Math.cos(r)-q[2]*Math.sin(r),q[1],q[0]*Math.sin(r)+q[2]*Math.cos(r)];
  const pelvis=unturn(convert(j.pelvis)),axis=unturn(sub(convert(j.chest),convert(j.pelvis))),targets={},poles={};
  for(const name of names){const chain=j[name];if(!Array.isArray(chain)||chain.length!==3||!chain.every(vector))return null;
   const c=chain.map(convert),d=sub(c[2],c[0]),e=unit(d);if(!e)return null;
   const lengths=frame.physicalLengths?.[name];if(!Array.isArray(lengths)||lengths.length!==2||lengths.some((v,i)=>!Number.isFinite(v)||v<=0||Math.abs(Math.hypot(...sub(c[i+1],c[i]))-v)>1e-4))return null;
   const v=sub(c[1],c[0]);let pole=unit(v.map((x,i)=>x-e[i]*dot(v,e)));
   if(!pole){const basis=Math.abs(e[1])<.9?[0,1,0]:[1,0,0];pole=unit(basis.map((x,i)=>x-e[i]*dot(basis,e)));}
   targets[name]=c[2].slice();poles[name]=pole;
  }
  return {pose:{...INK.copy(frame.legacyPose||{}),yaw,bob:pelvis[1]+191,lean:Math.atan2(axis[0],-axis[1])*180/Math.PI,twist:angle(a.body)-yaw,headYaw:angle(a.head)-yaw},bodyX:pelvis[0],targets,poles};
 }
 function solve(profile,pose,targets,options={}){
  const own={};for(const name of names){if(!vector(targets?.[name]))throw TypeError('Defense targets require canonical XYZ');own[name]=targets[name].slice();}
  if(options.worldFeet){const w=options.world;if(!w||!Number.isFinite(w.x)||!Number.isFinite(w.y)||!Number.isFinite(w.scale)||w.scale<=0||![1,-1].includes(w.dir))throw TypeError('Defense world feet require explicit physical world');
   for(const key of ['rear','front']){const q=options.worldFeet[key];if(!vector(q))throw TypeError('Defense world foot requires XYZ');own[key+'Leg']=[(q[0]-w.x)/w.scale*w.dir,(q[1]-665-w.y)/w.scale,q[2]/w.scale*w.dir];}
  }
  const rad=Math.PI/180,add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),length=q=>Math.hypot(...q);
  const rotate=(q,yaw,roll=0)=>{const x=q[0]*Math.cos(yaw)+q[2]*Math.sin(yaw);return [x*Math.cos(roll)-q[1]*Math.sin(roll),x*Math.sin(roll)+q[1]*Math.cos(roll),-q[0]*Math.sin(yaw)+q[2]*Math.cos(yaw)];};
  const p={...INK.copy(pose),depth:1,reachScale:1,rootShift:0,spin:0,floor:0},bodyX=options.bodyX??p.bodyX??0,yaw=(p.yaw||0)*rad,lean=(p.lean||0)*rad,twist=(p.twist||0)*rad;
  const turn=q=>rotate(q,yaw),chestVector=q=>turn(rotate(q,twist,lean)),pelvis=turn([bodyX,-191+(p.bob||0),0]),middle=add(pelvis,turn(rotate([0,-55,0],0,lean))),chest=add(middle,turn(rotate([0,-49,0],0,lean))),roots={};
  for(const n of names){const rear=n.startsWith('rear'),leg=n.endsWith('Leg'),anchor=leg?[(rear?-1:1)*(profile.rigHipWidth||52)/2,0,(rear?-1:1)*5]:[...(rear?profile.rigRearShoulder:profile.rigFrontShoulder)];if(!leg){anchor[1]+=295;anchor[2]=(rear?-1:1)*8;}roots[n]=add(leg?pelvis:chest,leg?turn(anchor):chestVector(anchor));}
  if(options.guardRelative)own.rearArm=add(chest,chestVector(options.guardRelative));if(options.frontGuardRelative)own.frontArm=add(chest,chestVector(options.frontGuardRelative));
  let drop=0;const unreachableSupport={};
  for(const key of ['rear','front']){const n=key+'Leg',H=roots[n],E=own[n],weight=options.supportWeights?.[key]??1,grounded=options.groundedFeet?.[key]??Math.abs(E[1]+16)<.5,L=profile.rigLengths[2]+profile.rigLengths[3]-.01,horizontal=(E[0]-H[0])**2+(E[2]-H[2])**2;
   if(weight<=.01||!grounded)continue;if(horizontal>L*L){unreachableSupport[key]=true;continue;}drop=Math.max(drop,E[1]-H[1]-Math.sqrt(L*L-horizontal));}
  drop=Math.max(0,Math.min(12,drop));const shift=q=>[q[0],q[1]+drop,q[2]],joints3D={},chains={},endFrames={},fanFrames={},physicalLengths={},residuals={};
  for(const n of names){const leg=n.endsWith('Leg'),rear=n.startsWith('rear'),H=shift(roots[n]),E=leg?own[n]:shift(own[n]),lens=profile.rigLengths.slice(leg?2:0,leg?4:2),pole=options.poles?.[n]||[leg?1:0,leg?0:1,(rear?-1:1)*.2],chain=INK.StrikeSpace.solve3D(H,E,lens,add(H,pole));joints3D[n]=chain;chains[n]=chain.map(q=>q.slice(0,2));physicalLengths[n]=lens.slice();residuals[n]=length(sub(chain[2],E));
   const config={kind:leg?'foot':'hand',heading:yaw+(leg?0:twist),authoredAngle:leg?(rear?p.rfoot:p.ffoot)||0:Math.atan2(chain[2][1]-chain[1][1],chain[2][0]-chain[1][0])/rad,scale:leg?(profile.female?.79:.88):(profile.female?.7:profile.id==='luke'?.88:.82)};endFrames[n]=INK.VisualFrame.thickEndFrame(chain,config);if(!leg)fanFrames[n]=INK.VisualFrame.thinFanFrame(chain,config);}
  // The projected vertical column follows the actual rotated 3D carrier.
  // The orthogonal thick cross-section is a deliberate 2.5D proxy.
  const carrier=(center,vertical,heading)=>{const l=Math.hypot(vertical[0],vertical[1]);if(l<1e-8)throw RangeError('Degenerate defense carrier');const width=Math.hypot(Math.cos(heading),.64*Math.sin(heading));return [width*vertical[1]/l,-width*vertical[0]/l,vertical[0],vertical[1],center[0],center[1]];};
  const skinMatrices=[carrier(shift(pelvis),turn([0,1,0]),yaw),carrier(shift(middle),turn(rotate([0,1,0],0,lean)),yaw+twist*.5),carrier(shift(chest),chestVector([0,1,0]),yaw+twist)];
  const h=profile.rigHeadOffset||[6,-46];joints3D.pelvis=shift(pelvis);joints3D.chest=shift(add(chest,chestVector([0,3,0])));joints3D.neck=shift(add(chest,chestVector([5,-29,0])));joints3D.head=shift(add(chest,chestVector([...h,0])));
  const headYaw=(p.headYaw||0)*rad,headVertical=chestVector(rotate([0,1,0],headYaw-twist,(p.head||0)*rad)),headMatrix=carrier(joints3D.head,headVertical,yaw+headYaw);p.bob=(p.bob||0)+drop;
  const model={pose:p,profile,chains,joints3D,skinMatrices,headMatrix,endFrames,fanFrames,physicalLengths,materialAngles:{pelvis:yaw/rad,body:(yaw+twist)/rad,head:(yaw+headYaw)/rad},residuals,supportDrop:drop,unreachableSupport};for(const key of ['pelvis','chest','neck','head'])model[key]=joints3D[key].slice(0,2);
  return {...model,kind:'defense-body',representation:'spatial3D',character:profile.id,bodyX,supportTargets:{rear:own.rearLeg.slice(),front:own.frontLeg.slice()}};
 }
 function frame(f,model,{world}={}){return {...INK.StrikeModelFrame.build(f,model,{world}),mode:'defense-body'};}
 function geometry(model,{world}={}){if(!world)return INK.StrikeCollider.body(model);return INK.StrikeCollider.body(model,{world:{x:world.x,groundWorldY:665+world.y,scale:world.scale,dir:world.dir}});}
 INK.DefenseBody=Object.freeze({solve,frame,geometry,fromFrame});
})();
