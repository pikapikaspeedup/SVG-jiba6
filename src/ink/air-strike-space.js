/* Pure native airborne strike space. No root motion, clocks or support owners. */
'use strict';
(()=>{
 const names=['rearArm','frontArm','rearLeg','frontLeg'],copy=x=>JSON.parse(JSON.stringify(x)),rad=Math.PI/180;
 const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
 const rotate=(v,yaw)=>[v[0]*Math.cos(yaw)+v[2]*Math.sin(yaw),v[1],-v[0]*Math.sin(yaw)+v[2]*Math.cos(yaw)];
 const polar=(root,p,length,yaw=0)=>add(root,rotate([length*p[0]*Math.cos(p[1]*rad)*Math.cos(p[2]*rad),length*p[0]*Math.sin(p[1]*rad),length*p[0]*Math.cos(p[1]*rad)*Math.sin(p[2]*rad)],yaw));
 function entry(model){const frame=INK.StrikeModelFrame.build({x:0,y:0,dir:1,ch:{scale:1}},model,{world:{x:0,y:0,dir:1,scale:1}});return INK.DefenseBody.fromFrame(frame,{dir:1});}
 const determinant=m=>m[0]*m[3]-m[1]*m[2];
 function inverse(m){const d=determinant(m);return Math.abs(d)>1e-9?[m[3]/d,-m[1]/d,-m[2]/d,m[0]/d,(m[2]*m[5]-m[3]*m[4])/d,(m[1]*m[4]-m[0]*m[5])/d]:null;}
 function mixMatrix(a,b,w){if(w<=0)return a.slice();if(w>=1)return b.slice();const parts=m=>{const x=Math.hypot(m[0],m[1]);return [Math.atan2(m[1],m[0]),x,determinant(m)/x,(m[0]*m[2]+m[1]*m[3])/x,m[4],m[5]];},x=parts(a),y=parts(b);if(x[1]<=0||x[2]<=0||y[1]<=0||y[2]<=0)return null;y[0]=x[0]+Math.atan2(Math.sin(y[0]-x[0]),Math.cos(y[0]-x[0]));const p=x.map((v,i)=>v+(y[i]-v)*w),c=Math.cos(p[0]),s=Math.sin(p[0]);return[c*p[1],s*p[1],c*p[3]-s*p[2],s*p[3]+c*p[2],p[4],p[5]];}
 const baselines=new WeakMap();
 function solve(source,pose,targets,{poles,polarTargets={},guardRelative,frontGuardRelative,carrierWeight=0,supportWeights={front:0,rear:0},groundedFeet}={}){
  if(!source||!Number.isFinite(carrierWeight)||carrierWeight<0||carrierWeight>1)return null;
  let base=baselines.get(source);if(!base){const e=entry(source);if(!e)return null;const model=INK.DefenseBody.solve(source.profile,e.pose,e.targets,{bodyX:e.bodyX,poles:e.poles,supportWeights:{front:0,rear:0}});base={entry:e,model};baselines.set(source,base);}
  const p={...copy(base.entry.pose),...copy(pose)},goals=copy(targets||base.entry.targets),options={bodyX:p.bodyX??base.entry.bodyX,poles:poles||base.entry.poles,supportWeights,groundedFeet,guardRelative,frontGuardRelative};
  let model=INK.DefenseBody.solve(source.profile,p,goals,options);
  for(const [n,value]of Object.entries(polarTargets)){if(!names.includes(n)||!Array.isArray(value)||value.length!==3||!value.every(Number.isFinite)||value[0]<=0||value[0]>1)throw TypeError('Air strike requires bounded native polar target');goals[n]=polar(model.joints3D[n][0],value,model.physicalLengths[n].reduce((a,b)=>a+b,0),(p.yaw||0)*rad);if(n.endsWith('Arm'))goals[n][1]-=model.supportDrop||0;}
  if(Object.keys(polarTargets).length)model=INK.DefenseBody.solve(source.profile,p,goals,options);
  const carry=(m,b,s)=>{const inv=inverse(b);return inv?mixMatrix(m,INK.mat.multiply(INK.mat.multiply(m,inv),s),carrierWeight):null;};
  if(carrierWeight>0){model.skinMatrices=model.skinMatrices.map((m,i)=>carry(m,base.model.skinMatrices[i],source.skinMatrices[i]));model.headMatrix=carry(model.headMatrix,base.model.headMatrix,source.headMatrix);if(!model.headMatrix||model.skinMatrices.some(m=>!m))return null;
   for(const n of names){const m=carry(model.endFrames[n],base.model.endFrames[n],source.endFrames[n]);if(!m)return null;m[4]=model.joints3D[n][2][0];m[5]=model.joints3D[n][2][1];model.endFrames[n]=m;if(source.fanFrames?.[n]){const inv=inverse(source.endFrames[n]);model.fanFrames[n]=INK.mat.multiply(INK.mat.multiply(m,inv),source.fanFrames[n]);}}
   model.joints3D.head[0]=model.headMatrix[4];model.joints3D.head[1]=model.headMatrix[5];model.head=model.joints3D.head.slice(0,2);
  }
  for(const n of names)model.pose[(n.startsWith('rear')?'r':'f')+(n.endsWith('Leg')?'a':'w')]=model.chains[n][2].slice();return model;
 }
 function direction(a,b,w){const A=Math.hypot(...a),B=Math.hypot(...b),x=a.map(v=>v/A),y=b.map(v=>v/B),dot=Math.max(-1,Math.min(1,x.reduce((n,v,i)=>n+v*y[i],0)));if(dot>.999999){const q=x.map((v,i)=>v+(y[i]-v)*w),l=Math.hypot(...q);return q.map(v=>v/l);}let side=y.map((v,i)=>v-dot*x[i]),l=Math.hypot(...side);if(l<1e-8){const axis=x.map(Math.abs).indexOf(Math.min(...x.map(Math.abs)));side=x.map((v,i)=>(i===axis?1:0)-x[axis]*v);l=Math.hypot(...side);}const angle=Math.acos(dot)*w;return x.map((v,i)=>v*Math.cos(angle)+side[i]/l*Math.sin(angle));}
 function bridge(source,target,w){if(w<=0)return copy(source);if(w>=1)return target;const out=copy(target),mix=(a,b)=>a.map((v,i)=>v+(b[i]-v)*w);
  for(const k of ['pelvis','chest','neck','head']){out.joints3D[k]=mix(source.joints3D[k],target.joints3D[k]);out[k]=out.joints3D[k].slice(0,2);}
  for(const n of names){const a=source.joints3D[n],b=target.joints3D[n],L=target.physicalLengths[n];if(L.some((v,i)=>Math.abs(v-source.physicalLengths[n][i])>1e-6))return null;const chain=[mix(a[0],b[0])];for(let j=0;j<2;j++){const v=direction(sub(a[j+1],a[j]),sub(b[j+1],b[j]),w);chain.push(chain[j].map((p,i)=>p+v[i]*L[j]));}out.joints3D[n]=chain;out.chains[n]=chain.map(q=>q.slice(0,2));out.endFrames[n]=mixMatrix(source.endFrames[n],target.endFrames[n],w);if(!out.endFrames[n])return null;out.endFrames[n][4]=chain[2][0];out.endFrames[n][5]=chain[2][1];
   if(source.fanFrames?.[n]&&target.fanFrames?.[n]){const A=INK.mat.multiply(inverse(source.endFrames[n]),source.fanFrames[n]),B=INK.mat.multiply(inverse(target.endFrames[n]),target.fanFrames[n]);out.fanFrames[n]=INK.mat.multiply(out.endFrames[n],mix(A,B));}out.pose[(n.startsWith('rear')?'r':'f')+(n.endsWith('Leg')?'a':'w')]=chain[2].slice(0,2);
  }
  out.skinMatrices=target.skinMatrices.map((m,i)=>mixMatrix(source.skinMatrices[i],m,w));out.headMatrix=mixMatrix(source.headMatrix,target.headMatrix,w);if(!out.headMatrix||out.skinMatrices.some(m=>!m))return null;out.headMatrix[4]=out.head[0];out.headMatrix[5]=out.head[1];
  for(const [k,c]of Object.entries(out.nativeCarriers||{})){const a=source.nativeCarriers[k],b=target.nativeCarriers[k];c.point=mix(a.point,b.point);const mag=Math.hypot(...a.vertical)+(Math.hypot(...b.vertical)-Math.hypot(...a.vertical))*w;c.vertical=direction(a.vertical,b.vertical,w).map(v=>v*mag);c.heading=a.heading+Math.atan2(Math.sin(b.heading-a.heading),Math.cos(b.heading-a.heading))*w;}
  for(const k of Object.keys(out.materialAngles)){const a=source.materialAngles[k],b=target.materialAngles[k];out.materialAngles[k]=a+Math.atan2(Math.sin((b-a)*rad),Math.cos((b-a)*rad))*w/rad;}return out;
 }
 INK.AirStrikeSpace=Object.freeze({entry,solve,polar,mixMatrix,bridge});
})();
