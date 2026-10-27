/* Shared native strike space. Simulation samples this same body as presentation.
 * Fixed 3D limb lengths; orthographic screen projection; no render-state input. */
'use strict';
(()=>{
 const names=['rearArm','frontArm','rearLeg','frontLeg'],rad=Math.PI/180;
 const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),length=v=>Math.hypot(...v);
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function rotation(q,yaw,roll=0){const c=Math.cos(yaw),s=Math.sin(yaw),x=q[0]*c+q[2]*s,z=-q[0]*s+q[2]*c;return [x*Math.cos(roll)-q[1]*Math.sin(roll),x*Math.sin(roll)+q[1]*Math.cos(roll),z];}
 function spine(profile,p,bodyX=0){
  const heading=(p.yaw||0)*rad,lean=(p.lean||0)*rad,twist=(p.twist||0)*rad;
  const turn=q=>rotation(q,heading),P=turn([bodyX,-191+(p.bob||0),0]),C1=add(P,turn(rotation([0,-55,0],0,lean))),C2=add(C1,turn(rotation([0,-49,0],0,lean)));
  const chestPoint=q=>add(C2,turn(rotation(q,twist,lean))),roots={};
  for(const n of names){const rear=n.startsWith('rear'),leg=n.endsWith('Leg'),q=leg?[(rear?-1:1)*(profile.rigHipWidth||52)/2,0,(rear?-1:1)*5]:[...(rear?profile.rigRearShoulder:profile.rigFrontShoulder)];if(!leg){q[1]+=295;q[2]=(rear?-1:1)*8;}roots[n]=leg?add(P,turn(q)):chestPoint(q);}
  const matrices=[P,C1,C2].map((q,i)=>{const angle=i?lean:0,h=heading+(i?twist*(i===2?1:.5):0),width=Math.sqrt(Math.cos(h)**2+.64**2*Math.sin(h)**2);return [Math.cos(angle)*width,Math.sin(angle)*width,-Math.sin(angle),Math.cos(angle),q[0],q[1]];});
  return {roots,matrices,P,C1,C2,chestPoint,heading};
 }
 function polarPoint(H,K,L,heading=0){const [rho,phi,beta]=K,p=phi*rad,b=beta*rad;return add(H,rotation([rho*L*Math.cos(p)*Math.cos(b),rho*L*Math.sin(p),rho*L*Math.cos(p)*Math.sin(b)],heading));}
 function toPolar(H,E,L,heading=0){const q=rotation(sub(E,H),-heading),d=length(q);return [clamp(d/L,.001,1),Math.atan2(q[1],Math.hypot(q[0],q[2]))/rad,Math.atan2(q[2],q[0])/rad];}
 // Body sheet frames and shoulder/hip roots share the same rigid basis.
 function solve(profile,pose,targets,options={}){
  const M=INK.mat,S=INK.StrikeSpace,p={...INK.copy(pose),depth:1,reachScale:1,rootShift:0,spin:0,floor:0};
  const native=options.bodyMode==='pelvis-spine'?spine(profile,p,options.bodyX||0):null,matrices=native?.matrices||INK.Rig.torsoMatrices(p),angles={body:(p.yaw||0)+(native?p.twist||0:p.chestYaw||0),pelvis:(p.yaw||0)+(native?0:p.pelvisYaw||0),head:(p.yaw||0)+(p.headYaw||0)};
  const roots={},joints3D={},chains={},endFrames={},fanFrames={},physicalLengths={},residuals={};
  const origin=m=>[m[4]+(options.bodyX||0),m[5],0],transform=(q,i,angle)=>add(origin(matrices[i]),rotation(q,angle*rad,Math.atan2(matrices[i][1],matrices[i][0])));
  for(const name of names){const leg=name.endsWith('Leg'),rear=name.startsWith('rear'),anchor=leg?[(rear?-1:1)*(profile.rigHipWidth||52)/2,0,(rear?-1:1)*5]:[...(rear?profile.rigRearShoulder:profile.rigFrontShoulder)],index=leg?0:2;
   if(!leg){anchor[1]+=295;anchor[2]=(rear?-1:1)*8;}
   roots[name]=native?native.roots[name]:transform(anchor,index,angles[leg?'pelvis':'body']);
  }
  targets=INK.copy(targets);
  if(native){if(options.targetPolar)targets[options.contactChain]=polarPoint(roots[options.contactChain],options.targetPolar,profile.rigLengths.slice(options.contactChain.endsWith('Leg')?2:0,options.contactChain.endsWith('Leg')?4:2).reduce((a,b)=>a+b,0),native.heading);if(options.guardRelative)targets.rearArm=native.chestPoint(options.guardRelative);if(options.frontGuardRelative)targets.frontArm=native.chestPoint(options.frontGuardRelative);}
  // A support target can lower the shared torso within a finite budget. This
  // moves its actual hurt anchors too; it does not stretch or move the root.
  let drop=0;const lengths=profile.rigLengths;
  for(const name of ['rearLeg','frontLeg'])if(name!==options.contactChain){const H=roots[name],E=targets[name],L=lengths[2]+lengths[3]-.01,horizontal=(E[0]-H[0])**2+(E[2]-H[2])**2;drop=Math.max(drop,E[1]-H[1]-Math.sqrt(Math.max(0,L*L-horizontal)));}
  drop=clamp(drop,0,native?12:24);const shift=q=>[q[0],q[1]+drop,q[2]];
  // Local attack/guard targets share the support correction; planted feet do not.
  if(native)for(const name of names)if(name.endsWith('Arm')||name===options.contactChain)targets[name]=shift(targets[name]);
  for(const name of names){const leg=name.endsWith('Leg'),rear=name.startsWith('rear'),H=shift(roots[name]),E=targets[name],lens=leg?lengths.slice(2):lengths.slice(0,2),pole=options.poles?.[name]||[leg?(rear?-1:1):0,leg?0:1,leg?1:(rear?-1:1)*.45];
   const chain=S.solve3D(H,E,lens,add(H,pole));joints3D[name]=chain;chains[name]=chain.map(q=>q.slice(0,2));physicalLengths[name]=lens.slice();residuals[name]=length(sub(chain[2],E));
   const config={kind:leg?'foot':'hand',heading:angles[leg?'pelvis':'body']*rad,authoredAngle:leg?(rear?p.rfoot:p.ffoot)||0:Math.atan2(chain[2][1]-chain[1][1],chain[2][0]-chain[1][0])/rad,scale:leg?(profile.female?.79:.88):(profile.female?.7:profile.id==='luke'?.88:.82)};
   endFrames[name]=INK.VisualFrame.thickEndFrame(chain,config);if(!leg)fanFrames[name]=INK.VisualFrame.thinFanFrame(chain,config);
  }
  const h=profile.rigHeadOffset||[6,-46];joints3D.pelvis=shift(native?native.P:transform([0,0,0],0,angles.pelvis));joints3D.chest=shift(native?native.chestPoint([0,3,0]):transform([0,3,0],2,angles.body));joints3D.neck=shift(native?native.chestPoint([5,-29,0]):transform([5,-29,0],2,angles.body));joints3D.head=shift(native?native.chestPoint([...h,0]):transform([...h,0],2,angles.head));
  const skinMatrices=matrices.map((m,i)=>{if(native)return [...m.slice(0,5),m[5]+drop];const heading=(i===0?angles.pelvis:i===2?angles.body:(angles.pelvis+angles.body)/2)*rad,width=Math.sqrt(Math.cos(heading)**2+.64**2*Math.sin(heading)**2);return [m[0]*width,m[1]*width,m[2],m[3],m[4]+(options.bodyX||0),m[5]+drop];});
  const head=joints3D.head,headMatrix=M.compose(head[0],head[1],(p.lean||0)+(p.chest||0)+(p.head||0));
  if(native)p.bob=(p.bob||0)+drop;
  const nativeCarriers=native?{pelvis:{point:shift(native.P),vertical:rotation([0,1,0],native.heading),heading:native.heading},middle:{point:shift(native.C1),vertical:rotation(rotation([0,1,0],0,(p.lean||0)*rad),native.heading),heading:(angles.pelvis+angles.body)*rad*.5},chest:{point:shift(native.C2),vertical:sub(native.chestPoint([0,1,0]),native.C2),heading:angles.body*rad},head:{point:joints3D.head.slice(),vertical:[headMatrix[2],headMatrix[3],0],heading:angles.head*rad}}:null;
  const out={pose:p,profile,chains,joints3D,skinMatrices,headMatrix,endFrames,fanFrames,physicalLengths,nativeCarriers,materialAngles:angles,residuals,supportDrop:drop};
  for(const key of ['pelvis','chest','neck','head'])out[key]=joints3D[key].slice(0,2);
  return out;
 }
 const profiles=new Map(),defaults=new Map(),instancePaths=new WeakMap(),defaultPaths=new Map();
 const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
 function profile(character,move){const key=character+':'+move;if(!profiles.has(key)){const b=INK.StrikeModelPolicy.baseline(character,move),r=b.rig;profiles.set(key,freeze({...INK.assets.byID[character],...b.model,id:character,rigLengths:r.lengths.slice(),rigRearShoulder:r.rearShoulder.slice(),rigFrontShoulder:r.frontShoulder.slice(),rigHipWidth:r.hipWidth,rigHeadOffset:r.headOffset.slice()}));}return profiles.get(key);}
 const candidate=(f,m)=>INK.StrikeModelPolicy?.evaluate(f,m)?.mode==='native';
 const owns=f=>!!f?.attack&&f.state==='attack'&&INK.StrikeModelPolicy?.read(f)?.mode==='native';
 function fromPose(c,pose){const p={...INK.copy(pose),reachScale:1,depth:1,rootShift:0,spin:0,floor:0},B=INK.bodyMatrix(p),targets={};for(const n of names){const leg=n.endsWith('Leg'),rear=n.startsWith('rear'),q=p[(rear?'r':'f')+(leg?'a':'w')];targets[n]=[...(leg?q:INK.mat.point(B,q)),(rear?-1:1)*(leg?5:8)];}return {pose:p,targets,bodyX:0};}
 function defaultEntry(character,move){const key=character+':'+move;if(!defaults.has(key)){const rec=INK.StrikeModelPolicy.baseline(character,move).record,c=profile(character,move),p=new INK.CompiledClip(rec.clip).sample(0,INK.basePose);defaults.set(key,freeze(fromPose(c,p)));}return defaults.get(key);}
 function capture(f,m,outgoing=null){
  const decision=INK.StrikeModelPolicy?.evaluate(f,m);if(decision?.mode!=='native')return {decision,context:null};
  const source=outgoing||f,dir=source.dir||1,time=source._inkVisualClock||0;let entry,frame,hitHandoff=null,hitExit=null;
  if(INK.HitRule?.owns(source)){const current=INK.HitRule.sample(source);if(current){hitExit=INK.HitRule.handoff(source);frame=current.frame;entry=INK.DefenseBody.fromFrame(frame,{dir});hitHandoff=hitExit?.hitHandoff||INK.HitRuleHandoff?.capture(current,{time,dir});}}
  if(!entry&&source.y===0&&INK.AirStrike?.owns(source)){const h=INK.AirStrike.handoff(source);if(h){frame=h.frame;entry=INK.DefenseBody.fromFrame(frame,{dir});hitHandoff=h.hitHandoff||INK.HitRuleHandoff.capture({model:h.model,time},{time,dir});}}
  if(entry){}else if(owns(source)){const current=sample(source);frame=INK.StrikeModelFrame.build(source,current,{world:{x:source.x,y:source.y,dir,scale:source.ch.scale||1}});entry={pose:INK.copy(current.pose),targets:Object.fromEntries(names.map(n=>[n,current.joints3D[n][2].slice()])),bodyX:current.bodyX||0};}
  else{const rule=INK.RulePose?.capture(source);if(rule){frame=rule.frame;if(source._inkRuleBody?.hitHandoff&&time-source._inkRuleBody.handoffStart<4)hitHandoff=INK.HitRuleHandoff?.capture(rule,{time,dir});const convert=q=>[q[0]*dir,q[1],q[2]*dir],pelvis=convert(frame.joints3D.pelvis),chest=convert(frame.joints3D.chest),yaw=(frame.materialAngles?.pelvis??rule.heading/rad)-(dir<0?180:0),localP=rotation(pelvis,-yaw*rad),axis=rotation(sub(chest,pelvis),-yaw*rad);entry=INK.DefenseBody?.fromFrame(frame,{dir})||{pose:{...INK.copy(rule.pose),yaw,bob:localP[1]+191,lean:Math.atan2(axis[0],-axis[1])/rad,twist:(frame.materialAngles?.body??rule.heading/rad)-(frame.materialAngles?.pelvis??rule.heading/rad),headYaw:(frame.materialAngles?.head??rule.heading/rad)-(frame.materialAngles?.pelvis??rule.heading/rad)},bodyX:localP[0],targets:Object.fromEntries(names.map(n=>[n,convert(frame.joints3D[n][2])]))};}
   else{const saved=INK.CompatibilityRulePose?.sample(source),p=saved?.pose||globalThis.SVG_FIGHTER?.pose(source);entry=p?fromPose(profile(f.ch.id,m.id),p):defaultEntry(f.ch.id,m.id);if(saved){const B=INK.bodyMatrix(p);for(const n of names){const q=saved.rig[n][2],v=n.endsWith('Arm')?INK.mat.point(B,q):q;entry.targets[n]=[v[0],v[1],entry.targets[n][2]];}}}}
  const poles={};if(frame)for(const n of names){const chain=frame.joints3D[n].map(q=>[q[0]*dir,q[1],q[2]*dir]),d=sub(chain[2],chain[0]),J=sub(chain[1],chain[0]),square=d.reduce((v,q)=>v+q*q,0),u=square?J.reduce((v,q,i)=>v+q*d[i],0)/square:0;let v=J.map((q,i)=>q-u*d[i]);const len=length(v);poles[n]=len>1e-8?v.map(q=>q/len):INK.StrikeModelData[f.ch.id+':'+m.id].poles[n];}
  const worldFeet=frame?.worldFeet||Object.fromEntries(['rear','front'].map(n=>{const q=entry.targets[n+'Leg'],scale=source.ch.scale||1;return[n,[source.x+q[0]*scale*dir,665+source.y+q[1]*scale,q[2]*scale*dir]];}));
  let supportSource=source;if(hitExit?.hitFeet){supportSource=Object.create(source);supportSource._inkFacing=null;INK.Locomotion.adoptHitPlan(supportSource,hitExit.hitFeet,{time,dir,scale:source.ch.scale||1});}
  const supportPlan=INK.StrikeSupport?.capture(supportSource,{worldFeet},{time,epoch:(f._inkContactEpoch||0)+1,root:{x:f.x,y:f.y},scale:f.ch.scale||1,dir:f.dir});
  const carriers=frame?.mode==='defense-body'?entryCarriers(frame,dir,profile(f.ch.id,m.id),entry):null;
  return {decision,supportPlan,context:freeze({hitHandoff,carriers,version:1,character:f.ch.id,move:m.id,entry,poles,time,sourceDir:dir,targetDir:f.dir,origin:{x:f.x,y:f.y}})};
 }
 // A short carrier correction is part of the rule model, hence the same
 // matrices reach both hurt proxies and SVG. It ends before active startup.
 function matrixParams(m){const sx=Math.hypot(m[0],m[1]);return {angle:Math.atan2(m[1],m[0]),sx,sy:(m[0]*m[3]-m[1]*m[2])/sx,x:m[4],y:m[5]};}
 function entryCarriers(frame,dir,c,entry){
  const H=[-1,0,0,1,0,0],canonical=m=>dir<0?INK.mat.multiply(INK.mat.multiply(H,m),H):m.slice(),reference=solve(c,entry.pose,entry.targets,{bodyMode:'pelvis-spine',bodyX:entry.bodyX});
  const delta=(source,base)=>{const a=matrixParams(canonical(source)),b=matrixParams(base),q={};for(const k of Object.keys(a))q[k]=a[k]-b[k];q.angle=Math.atan2(Math.sin(q.angle),Math.cos(q.angle));return q;};
  return {skin:frame.skinMatrices.map((m,i)=>delta(m,reference.skinMatrices[i])),head:delta(frame.headMatrix,reference.headMatrix)};
 }
 function carryMatrices(model,context,t,startup){
  const c=context?.carriers,duration=Math.min(3,startup-1);if(!c||duration<=0||t>=duration)return;
  const u=clamp(t/duration,0,1),weight=1-u*u*(3-2*u),reflect=context.sourceDir!==context.targetDir;
  const apply=(m,d)=>{const q=matrixParams(m);for(const k of Object.keys(d))q[k]+=d[k]*weight*(reflect&&(k==='angle'||k==='x')?-1:1);const ca=Math.cos(q.angle),sa=Math.sin(q.angle);return [ca*q.sx,sa*q.sx,-sa*q.sy,ca*q.sy,q.x,q.y];};
  model.skinMatrices=model.skinMatrices.map((m,i)=>apply(m,c.skin[i]));model.headMatrix=apply(model.headMatrix,c.head);model.joints3D.head[0]=model.headMatrix[4];model.joints3D.head[1]=model.headMatrix[5];model.head=model.joints3D.head.slice(0,2);
 }
 const bodyKeys=['lean','bob','chest','pelvis','yaw','chestYaw','pelvisYaw','headYaw','head','ffoot','rfoot','twist'];
 function paths(character,m,context){
  const key=[character,m.id,m.startup,m.active,m.total].join(':'),cache=context?instancePaths:defaultPaths;
  let rows=context?cache.get(context):cache.get(key);if(rows?.key===key)return rows;
  const data=INK.StrikeModelData[character+':'+m.id],entry=context?.entry||defaultEntry(character,m.id),base=defaultEntry(character,m.id),c=profile(character,m.id),end=m.startup+m.active,recovery=m.total-end;
  const reflected=context&&context.sourceDir!==context.targetDir&&context.targetDir!=null,entryPose=INK.copy(entry.pose),entryTargets=INK.copy(entry.targets);
  if(reflected){for(const n of names){entryTargets[n][0]*=-1;entryTargets[n][2]*=-1;}entryPose.yaw=180-(entryPose.yaw||0);}
  const startX=(entry.bodyX||0)*(reflected?-1:1),startBasis=spine(c,entryPose,startX),basePose={...base.pose,yaw:0,chest:0,pelvis:0,twist:0},endBasis=spine(c,basePose,0),chain=data.contactChain,L=c.rigLengths.slice(chain.endsWith('Leg')?2:0,chain.endsWith('Leg')?4:2).reduce((a,b)=>a+b,0);
  const relative=(basis,q,p)=>rotation(rotation(rotation(sub(q,basis.C2),-basis.heading),0,-(p.lean||0)*rad),-(p.twist||0)*rad);
  const first={time:0,body:entryPose,bodyX:startX,targets:entryTargets,targetPolar:toPolar(startBasis.roots[chain],entryTargets[chain],L,startBasis.heading),guardRelative:relative(startBasis,entryTargets.rearArm,entryPose),frontGuardRelative:relative(startBasis,entryTargets.frontArm,entryPose),fan:entry.pose.fan,fanAngle:entry.pose.fanAngle};
  const last={body:basePose,bodyX:0,targets:base.targets,targetPolar:toPolar(endBasis.roots[chain],base.targets[chain],L),guardRelative:relative(endBasis,base.targets.rearArm,basePose),frontGuardRelative:relative(endBasis,base.targets.frontArm,basePose),fan:base.pose.fan,fanAngle:base.pose.fanAngle};
  const nodes=[first];
  for(const n of data.nodes){const time=n.phase==='startup'?n.u*m.startup:n.phase==='active'?m.startup+n.u*m.active:end+n.u*recovery;
   nodes.push(n.returnToEntry?{...last,time,stopTangent:true}:{...n,time,body:{...basePose,...n.body},bodyX:n.body?.bodyX||0,targets:INK.copy(base.targets),fan:n.fan??base.pose.fan,fanAngle:n.fanAngle??base.pose.fanAngle});
  }
  const values={},track=(k,get)=>values[k]=nodes.map(n=>({time:n.time,value:get(n),...(n.stopTangent?{tangent:get(n).map(()=>0)}:{})}));
  for(const n of names)track(n,q=>q.targets[n]);
  for(const k of bodyKeys)track(k,n=>[n.body[k]||0]);
  for(const k of ['bodyX','fan','fanAngle'])track(k,n=>[n[k]||0]);
  for(const k of ['targetPolar','guardRelative',...(chain==='frontLeg'?['frontGuardRelative']:[])])track(k,n=>n[k]);
  // Only depth headings need unwrap; phi stays in its defined elevation range.
  for(const [k,index] of [['targetPolar',2],['yaw',0],['twist',0]])for(let i=1;i<values[k].length;i++){const v=values[k][i].value=values[k][i].value.slice(),prior=values[k][i-1].value[index];while(v[index]-prior>180)v[index]-=360;while(v[index]-prior< -180)v[index]+=360;}
  rows={key,data,nodes,values,base};if(context)cache.set(context,rows);else {if(cache.size>=96)cache.delete(cache.keys().next().value);cache.set(key,rows);}return rows;
 }
 function sample(f,{time=f.attack?.t,context=f.attack?.strikeModelContext}={}){
  if(!owns(f))return null;const m=f.attack.m,id=f.ch.id,rows=paths(id,m,context),t=clamp(f.attack.tempo?.phase==='holding'?f.attack.t:time,0,m.total),at=k=>INK.StrikeSpace.samplePath(rows.values[k],t),p=INK.copy(rows.base.pose),targets={};
  for(const k of [...bodyKeys,'fan','fanAngle'])p[k]=at(k)[0];for(const n of names)targets[n]=at(n);
  const node=rows.nodes.findLast(n=>n.time<=t)||rows.nodes[0];p.handFront=node.handFront||rows.data.nodes[0].handFront;p.handRear=node.handRear||rows.data.nodes[0].handRear;
  const targetPolar=at('targetPolar'),bodyX=at('bodyX')[0],poles=INK.copy(rows.data.poles),end=m.startup+m.active,returnPlan=f.attack.strikeReturn;
  if(returnPlan&&t>end){const begin=Math.max(end,returnPlan.age),u=clamp((t-begin)/Math.max(1,m.total-begin),0,1),w=Math.sin(Math.PI*u)**2,result=returnPlan.result;
   if(result==='hit'){targetPolar[0]-=.035*w;targetPolar[1]+=4*w;p.lean-=1.3*w;}
   else if(result==='block'||result==='parry'||result==='armor'){targetPolar[0]-=.025*w;targetPolar[1]+=6*w;p.lean-=2*w;}
   else if(result==='cleanMiss'){targetPolar[0]+=.025*w;targetPolar[2]+=Math.sign(rows.data.nodes[3].targetPolar[2]||1)*6*w;p.lean+=1.5*w;}
   targetPolar[0]=clamp(targetPolar[0],.08,.985);
  }
  const support=INK.StrikeSupport?.sample(f.attack.strikeSupportPlan,{age:t,time:Number.isFinite(f._inkVisualClock)?f._inkVisualClock:(context?.time||0)+t,root:{x:f.x,y:f.y},scale:f.ch.scale||1,dir:f.dir,contactChain:rows.data.contactChain,defaultTargets:{rear:targets.rearLeg,front:targets.frontLeg}});
  if(support){targets.rearLeg=support.targets.rear;if(rows.data.contactChain!=='frontLeg')targets.frontLeg=support.targets.front;}

  if(rows.data.poleSweep)poles.frontLeg=rotation(poles.frontLeg,-targetPolar[2]*rad);
  for(const n of names){poles[n]=rotation(poles[n],(p.yaw||0)*rad);if(context?.poles?.[n]&&t<m.startup-1){const u=clamp(t/Math.max(1,m.startup-1),0,1),w=u*u*(3-2*u),sign=context.sourceDir===context.targetDir?1:-1,from=context.poles[n].map((q,i)=>i===1?q:q*sign);poles[n]=from.map((q,i)=>q+(poles[n][i]-q)*w);if(length(poles[n])<1e-7)poles[n]=[0,0,1];}}

  let model=solve(profile(id,m.id),p,targets,{bodyMode:rows.data.bodyMode,bodyX,poles,contactChain:rows.data.contactChain,targetPolar,guardRelative:at('guardRelative'),frontGuardRelative:rows.values.frontGuardRelative?at('frontGuardRelative'):null});
  carryMatrices(model,context,t,m.startup);
  if(context?.hitHandoff)model=INK.HitRuleHandoff.apply(model,context.hitHandoff,{age:t,duration:Math.max(0,m.startup-1),dir:f.dir});
  for(const n of names){const leg=n.endsWith('Leg'),rear=n.startsWith('rear');model.pose[(rear?'r':'f')+(leg?'a':'w')]=model.chains[n][2].slice();}
  return {...model,support,bodyX,character:id,move:m.id,age:t,contactChain:rows.data.contactChain,kind:rows.data.kind,family:rows.data.family};
 }
 function fan(model){if(model.character!=='mai')return null;const geometry=INK.FanGeometry.sample(model.pose.fan??.92),matrix=INK.mat.multiply(model.fanFrames.frontArm,INK.FanGeometry.transform(model.pose));return {geometry,rim:geometry.rim.map(q=>INK.mat.point(matrix,q)),matrix};}
 function geometry(f,closing=false){const model=sample(f);if(!model)return null;const a=f.attack,m=a.m,active=a.t>=m.startup&&(a.t<m.startup+m.active||closing&&a.t===m.startup+m.active),out=INK.StrikeCollider.sample(model,{world:{x:f.x,groundWorldY:665+f.y,scale:f.renderScale||f.ch.scale||1,dir:f.dir},active,contact:{chain:model.contactChain,kind:model.kind},fan:fan(model)});if(!out.valid)throw Error('Invalid native strike geometry: '+out.reason);return {...out,strikeModel:{character:f.ch.id,move:m,age:a.t,clock:f._inkVisualClock,returnPlan:a.strikeReturn,supportPlan:a.strikeSupportPlan,context:a.strikeModelContext||null,policy:a.strikeModelPolicy||INK.StrikeModelPolicy.read(f),x:f.x,y:f.y,scale:f.renderScale||f.ch.scale||1,dir:f.dir},nativeExtension:length(sub(model.joints3D[model.contactChain][2],model.joints3D[model.contactChain][0]))/model.physicalLengths[model.contactChain].reduce((a,b)=>a+b,0)};}
 function estimate(f,m,hurt,{travelBudget=0,startupFloor=0,uncertainty=0}={}){if(!candidate(f,m))return null;const prepared=INK.Runtime.prepare(f,m),startup=Math.max(prepared.startup,startupFloor),move={...prepared,startup,total:startup+prepared.active+prepared.recovery,travel:0,movementStrike:null},reach=INK.DuelReach.sample(f,move,globalThis.SVG_FIGHTER.geometry),begin=Math.max(1,startup-5),steps=startup+move.active-begin;return INK.DuelReach.estimate(f,reach,hurt,{uncertainty,travelAt:travelBudget>0?t=>Math.min(travelBudget,Math.max(0,t-begin+1)*travelBudget/steps):null});}
 function between(previous,current,u){const a=previous?.strikeModel,b=current?.strikeModel;if(!a||!b||a.character!==b.character||a.move.id!==b.move.id||a.dir!==b.dir)return null;const mix=(x,y)=>x+(y-x)*u,f={ch:{id:b.character,scale:b.scale},state:'attack',dir:b.dir,x:mix(a.x,b.x),y:mix(a.y,b.y),renderScale:b.scale,attack:{m:b.move,t:mix(a.age,b.age),strikeModelPolicy:b.policy,strikeModelContext:b.context,strikeReturn:b.returnPlan,strikeSupportPlan:u<1&&a.supportPlan!==b.supportPlan?a.supportPlan:b.supportPlan},_inkVisualClock:mix(a.clock??a.age,b.clock??b.age)};return geometry(f,true);}
 function rig(f,p){const model=sample(f);if(!model)return null;const inverse=INK.mat.inverse(INK.bodyMatrix(p||model.pose)),out={};for(const n of names)out[n]=n.endsWith('Arm')?model.chains[n].map(q=>INK.mat.point(inverse,q)):model.chains[n].map(q=>q.slice());Object.defineProperty(out,'profile',{value:model.profile});return out;}
 function prepareSupport(f){if(!owns(f)||!f.attack.strikeSupportPlan)return;const model=sample(f),data=INK.StrikeModelData[f.ch.id+':'+f.attack.m.id],a=f.attack;const plan=INK.StrikeSupport.prepare(a.strikeSupportPlan,{age:a.t,time:f._inkVisualClock,root:{x:f.x,y:f.y},scale:f.ch.scale||1,dir:f.dir,epoch:f._inkContactEpoch||0},{roots:{rear:model.joints3D.rearLeg[0],front:model.joints3D.frontLeg[0]},lengths:{rear:model.physicalLengths.rearLeg,front:model.physicalLengths.frontLeg},contactChain:data.contactChain,frontLoad:data.frontLoad});a.strikeSupportPlan=plan;}
 function settle(f){if(!owns(f))return;const a=f.attack,facts=INK.ExchangeFacts?.inspect(a);if(!a.strikeReturn&&['hit','block','parry','armor','cleanMiss'].includes(facts?.result))a.strikeReturn=freeze({result:facts.result,age:a.t});}
 function rebase(f,from){if(!owns(f)||!f.attack.strikeSupportPlan)return;const plan=f.attack.strikeSupportPlan,dx=f.x-from.x,dy=f.y-from.y,p=INK.StrikeSupport.rebase(plan,{root:{x:plan.origin.x+dx,y:plan.origin.y+dy},epoch:f._inkContactEpoch||0,previousTime:f._inkVisualClock||0,time:0});f.attack.strikeSupportPlan=p;}
 function handoff(f){if(!owns(f)||!INK.Locomotion)return null;const model=sample(f),frame=INK.StrikeModelFrame.build(f,model,{world:{x:f.x,y:f.y,dir:f.dir,scale:f.ch.scale||1}});return {frame,feet:frame.worldFeet,time:f._inkVisualClock||0,scale:f.ch.scale||1,dir:f.dir,world:{x:f.x,y:f.y,dir:f.dir,scale:f.ch.scale||1}};}
 INK.StrikeModel={handoff,rebase,prepareSupport,settle,estimate,between,rig,solve,candidate,owns,capture,sample,geometry,fan,defaultEntry};
})();
