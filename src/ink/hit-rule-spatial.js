/* Rule-owned articulated hit response. Pure finite rotations of a captured
 * native body; arms use FK, feet use the one explicit support plan. */
'use strict';
(()=>{
 const names=['rearArm','frontArm','rearLeg','frontLeg'],rad=Math.PI/180,copy=x=>JSON.parse(JSON.stringify(x));
 const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(v,s)=>v.map(x=>x*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),len=v=>Math.hypot(...v),unit=v=>{const n=len(v);return n>1e-10?mul(v,1/n):[0,0,1];},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const rotate=(v,roll=0,yaw=0)=>{const x=v[0]*Math.cos(yaw)+v[2]*Math.sin(yaw),z=-v[0]*Math.sin(yaw)+v[2]*Math.cos(yaw);return [x*Math.cos(roll)-v[1]*Math.sin(roll),x*Math.sin(roll)+v[1]*Math.cos(roll),z];};
 const axisRotate=(v,axis,angle)=>{const a=unit(axis),c=Math.cos(angle),s=Math.sin(angle);return add(add(mul(v,c),mul(cross(a,v),s)),mul(a,dot(a,v)*(1-c)));};
 const width=h=>Math.hypot(Math.cos(h),.64*Math.sin(h));
 const amplitude={pelvisTx:6,pelvisTy:5,pelvisRoll:4*rad,pelvisYaw:5*rad,lumbarRoll:10*rad,lumbarYaw:5*rad,chestRoll:12*rad,chestYaw:8*rad,neckRoll:18*rad,neckYaw:14*rad,frontUpper:14*rad,frontDepth:12*rad,frontElbow:22*rad,frontTwist:14*rad,rearUpper:14*rad,rearDepth:12*rad,rearElbow:22*rad,rearTwist:14*rad};
 function metadata(model){const c=model.nativeCarriers;if(c&&['pelvis','middle','chest','head'].every(k=>c[k]?.point?.length===3&&c[k]?.vertical?.length===3))return c;return null;}
 function budget(model,value){
  const carriers=metadata(model);if(!carriers)return null;
  const q=Object.fromEntries(Object.entries(amplitude).map(([k,a])=>[k,(value[k]||0)*a]));if(Object.values(q).some(v=>!Number.isFinite(v)))return null;
  const pivots=[carriers.pelvis.point,carriers.middle.point,carriers.chest.point,model.joints3D.neck],groups=[{key:'pelvis',points:[model.joints3D.pelvis],radius:58,depth:1,bound:8},{key:'chest',points:[model.joints3D.chest],radius:68,depth:3,bound:18},{key:'head',points:[model.joints3D.head],radius:Math.max(1,model.profile.headScale)*60,depth:4,bound:26}];
  for(const key of ['front','rear'])groups.push({key:key+'Arm',points:model.joints3D[key+'Arm'],radius:Math.max(...model.profile.arm,32),depth:3,bound:38,arm:key});
  if(model.profile.id==='mai')groups.push({key:'fan',points:[model.joints3D.frontArm[2]],radius:110,depth:3,bound:64,arm:'front'});
  const values={},prefix=['pelvis','lumbar','chest','neck'];let square=0;
  for(const group of groups){let b=Math.hypot(q.pelvisTx,q.pelvisTy);
   for(let i=0;i<group.depth;i++){const radius=Math.max(...group.points.map(p=>len(sub(p,pivots[i]))))+group.radius;b+=radius*(Math.hypot(q[prefix[i]+'Roll'],1e-8)+Math.hypot(q[prefix[i]+'Yaw'],1e-8));}
   if(group.arm){const k=group.arm,L=model.physicalLengths[k+'Arm'];b+=(L[0]+L[1]+group.radius)*(Math.hypot(q[k+'Upper'],1e-8)+Math.hypot(q[k+'Depth'],1e-8))+(L[1]+group.radius)*(Math.hypot(q[k+'Elbow'],1e-8)+Math.hypot(q[k+'Twist'],1e-8));}
   // The thickness derivative is bounded by .6 per radian. Include projected
   // outline displacement in addition to centerline rotations.
   b+=group.radius*.6*prefix.slice(0,group.depth).reduce((s,k)=>s+Math.hypot(q[k+'Yaw'],1e-8),0);values[group.key]=b;square+=(b/group.bound)**2;
  }
  const scale=1/Math.sqrt(1+square);return {value:Object.fromEntries(Object.entries(q).map(([k,v])=>[k,v*scale])),scale,envelopes:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,v*scale]))};
 }
 function solve(base,value,{world,worldFeet}={}){
  const limited=budget(base,value);if(!limited||!world||!worldFeet)return null;const q=limited.value,out=copy(base),c=metadata(base),translation=[q.pelvisTx,q.pelvisTy,0],ops=[];
  const apply=(p,count=ops.length)=>{let v=add(p,translation);for(const op of ops.slice(0,count))v=add(op.point,rotate(sub(v,op.point),op.roll,op.yaw));return v;};
  const vector=(p,count=ops.length)=>{let v=p.slice();for(const op of ops.slice(0,count))v=rotate(v,op.roll,op.yaw);return v;};
  for(const [key,pivot]of [['pelvis',c.pelvis.point],['lumbar',c.middle.point],['chest',c.chest.point],['neck',base.joints3D.neck]])ops.push({point:apply(pivot),roll:q[key+'Roll'],yaw:q[key+'Yaw']});
  const matrix=(source,carrier,count)=>{const next=vector(carrier.vertical,count),a=carrier.vertical,b=next,oldL=Math.hypot(a[0],a[1]),newL=Math.hypot(b[0],b[1]),angle=oldL>1e-8&&newL>1e-8?Math.atan2(b[1],b[0])-Math.atan2(a[1],a[0]):0,ca=Math.cos(angle),sa=Math.sin(angle),yaw=ops.slice(0,count).reduce((s,o)=>s+o.yaw,0),thick=width(carrier.heading+yaw)/width(carrier.heading),vertical=oldL>1e-8?newL/oldL:1,center=apply([source[4],source[5],carrier.point[2]],count);return [(ca*source[0]-sa*source[1])*thick,(sa*source[0]+ca*source[1])*thick,(ca*source[2]-sa*source[3])*vertical,(sa*source[2]+ca*source[3])*vertical,center[0],center[1]];};
  out.skinMatrices=['pelvis','middle','chest'].map((k,i)=>matrix(base.skinMatrices[i],c[k],i+1));out.headMatrix=matrix(base.headMatrix,c.head,4);
  out.joints3D.pelvis=apply(base.joints3D.pelvis,1);out.joints3D.chest=apply(base.joints3D.chest,3);out.joints3D.neck=apply(base.joints3D.neck,3);out.joints3D.head=apply(base.joints3D.head,4);out.joints3D.head[0]=out.headMatrix[4];out.joints3D.head[1]=out.headMatrix[5];
  for(const key of ['front','rear']){const n=key+'Arm',source=base.joints3D[n],root=apply(source[0],3),u=rotate(vector(sub(source[1],source[0]),3),q[key+'Upper'],q[key+'Depth']);let v=rotate(vector(sub(source[2],source[1]),3),q[key+'Upper'],q[key+'Depth']),bend=cross(u,v);if(len(bend)<1e-8)bend=cross(u,Math.abs(unit(u)[1])<.9?[0,1,0]:[1,0,0]);v=axisRotate(v,bend,-q[key+'Elbow']);v=axisRotate(v,u,q[key+'Twist']);const elbow=add(root,u);out.joints3D[n]=[root,elbow,add(elbow,v)];
   const leg=key+'Leg',old=base.joints3D[leg],H=apply(old[0],1),foot=worldFeet[key],E=[(foot[0]-world.x)/world.scale*world.dir,(foot[1]-665-world.y)/world.scale,foot[2]/world.scale*world.dir],axis=sub(old[2],old[0]),e=unit(axis),j=sub(old[1],old[0]),pole=sub(j,mul(e,dot(j,e)));
   out.joints3D[leg]=INK.StrikeSpace.solve3D(H,E,base.physicalLengths[leg],add(H,vector(len(pole)>1e-8?unit(pole):[1,0,0],1)));out.residuals[leg]=len(sub(out.joints3D[leg][2],E));
  }
  const inverse=m=>{const det=m[0]*m[3]-m[1]*m[2];if(Math.abs(det)<1e-8)return null;return [m[3]/det,-m[1]/det,-m[2]/det,m[0]/det,(m[2]*m[5]-m[3]*m[4])/det,(m[1]*m[4]-m[0]*m[5])/det];};
  for(const n of names){out.chains[n]=out.joints3D[n].map(p=>p.slice(0,2));const leg=n.endsWith('Leg'),key=n.startsWith('front')?'front':'rear',heading=(base.materialAngles[leg?'pelvis':'body']||0)*rad,extra=ops.slice(0,leg?1:3).reduce((s,o)=>s+o.yaw,0)+(leg?0:q[key+'Depth']),config=chain=>({kind:leg?'foot':'hand',heading,authoredAngle:leg?(base.pose[key==='rear'?'rfoot':'ffoot']||0):Math.atan2(chain[2][1]-chain[1][1],chain[2][0]-chain[1][0])/rad,scale:leg?(base.profile.female?.79:.88):(base.profile.female?.7:base.profile.id==='luke'?.88:.82)}),reference=INK.VisualFrame.thickEndFrame(base.joints3D[n],config(base.joints3D[n])),nextConfig=config(out.joints3D[n]);nextConfig.heading+=extra;const next=INK.VisualFrame.thickEndFrame(out.joints3D[n],nextConfig),inv=inverse(reference);if(!inv)return null;const delta=INK.mat.multiply(next,inv);out.endFrames[n]=INK.mat.multiply(delta,base.endFrames[n]);out.endFrames[n][4]=out.chains[n][2][0];out.endFrames[n][5]=out.chains[n][2][1];if(base.fanFrames?.[n]){out.fanFrames[n]=INK.mat.multiply(delta,base.fanFrames[n]);out.fanFrames[n][4]=out.endFrames[n][4];out.fanFrames[n][5]=out.endFrames[n][5];}
   out.pose[(key==='rear'?'r':'f')+(leg?'a':'w')]=out.chains[n][2].slice();
  }
  out.nativeCarriers={};for(const [k,count]of [['pelvis',1],['middle',2],['chest',3],['head',4]])out.nativeCarriers[k]={point:apply(c[k].point,count),vertical:vector(c[k].vertical,count),heading:c[k].heading+ops.slice(0,count).reduce((s,o)=>s+o.yaw,0)};
  out.materialAngles={...base.materialAngles,pelvis:base.materialAngles.pelvis+q.pelvisYaw/rad,body:base.materialAngles.body+(q.pelvisYaw+q.lumbarYaw+q.chestYaw)/rad,head:base.materialAngles.head+(q.pelvisYaw+q.lumbarYaw+q.chestYaw+q.neckYaw)/rad};
  for(const k of ['pelvis','chest','neck','head'])out[k]=out.joints3D[k].slice(0,2);out.kind='hit-rule';out.supportDrop=0;out.hitBudget={scale:limited.scale,envelopes:limited.envelopes};return out;
 }
 INK.HitRuleSpatial=Object.freeze({solve,budget,amplitude});
})();
