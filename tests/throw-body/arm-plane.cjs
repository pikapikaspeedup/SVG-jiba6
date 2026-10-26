'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),R=path.resolve(__dirname,'../..');global.INK=require(R+'/src/ink/core.js');
for(const n of ['inbetween','anatomy'])require(R+'/src/ink/'+n+'.js');
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);let cases=0;
for(const id of ['ryu','ken','chun','cammy','luke','juri','mai','iori']){
 const model=JSON.parse(fs.readFileSync(R+`/assets/ink/characters/${id}/model.json`)),rig=JSON.parse(fs.readFileSync(R+`/assets/ink/characters/${id}/rig.json`)),c={...model,id,rigLengths:rig.lengths,rigRearShoulder:rig.rearShoulder,rigFrontShoulder:rig.frontShoulder,rigHipWidth:rig.hipWidth};
 for(const yaw of [0,35,75,90,120,180])for(const offset of [-150,-90,-60,-25,25,60,90,150]){
  const p={...INK.copy(INK.basePose),yaw,turn:0},q={...INK.copy(p),frontArmYaw:offset,rearArmYaw:offset},a=INK.Rig.solveAnimation(c,p),b=INK.Rig.solveAnimation(c,q),sa=INK.Rig.sockets(p,a),sb=INK.Rig.sockets(q,b);
  for(const name of ['frontArm','rearArm']){
   assert(dist(sa[name][0],sb[name][0])<1e-7,'Arm abduction moved shoulder');
   for(let j=0;j<2;j++)assert(Math.abs(dist(a.anatomy.source[name][j],a.anatomy.source[name][j+1])-dist(b.anatomy.source[name][j],b.anatomy.source[name][j+1]))<1e-7,'Changed source bone length');
   const key=name==='frontArm'?'fw':'rw',projected=INK.mat.point(b.anatomy.projectors[name],INK.mat.point(INK.bodyMatrix(q),q[key])),back=INK.Anatomy.inverseTarget(q,projected,name,c),angle=INK.rad(yaw+offset),k=Math.cos(angle)+(name==='rearArm'?-.2:.2)*Math.sin(angle);
   if(Math.abs(k)>.18)assert(dist(back,q[key])<1e-7,'Inverse missed independent arm plane');
   assert(sb[name].flat().every(Number.isFinite));
  }
  for(const name of ['frontLeg','rearLeg'])for(let j=0;j<3;j++)assert(dist(sa[name][j],sb[name][j])<1e-7,'Arm abduction moved legs');cases++;
 }
}
console.log('PASS independent arm plane, fixed shoulder/leg anchors, source bone lengths and inverse mapping:',cases,'cases');
