'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');for(const f of ['core','inbetween','anatomy'])require(path.join(root,'src/ink/'+f+'.js'));
const {Anatomy:A,mat}=INK,parts=['rearArm','frontArm','rearLeg','frontLeg'],fingerprints=new Set();let samples=0;
const near=(a,b)=>{assert.equal(a.length,b.length);a.forEach((x,i)=>Array.isArray(x)?near(x,b[i]):assert(Math.abs(x-b[i])<1e-8,`${x} != ${b[i]}`));};
for(const id of ['ryu','ken','chun','cammy','luke','juri','mai','iori']){
 const dir=path.join(root,'assets/ink/characters',id),model=JSON.parse(fs.readFileSync(path.join(dir,'model.json'))),rig=JSON.parse(fs.readFileSync(path.join(dir,'rig.json'))),c={id,female:model.female,rigLengths:rig.lengths,rigRearShoulder:rig.rearShoulder,rigFrontShoulder:rig.frontShoulder,rigHipWidth:rig.hipWidth,rigHeadOffset:rig.headOffset};
 for(const yaw of [-170,-90,-45,0,45,90,170])for(const flex of [0,1]){
 const p={...INK.copy(INK.basePose),yaw,frontArmYaw:flex?55:0,fw:flex?[48,-260]:[160,-290],fa:flex?[40,-190]:[110,-10]},before=JSON.stringify(p),r=A.solve(c,p),meta=r.anatomy;
 assert.equal(JSON.stringify(p),before);assert(Object.isFrozen(meta.surfaces));assert.throws(()=>{meta.surfaces={};},TypeError);
 for(const name of parts){const s=meta.surfaces[name],leg=name.includes('Leg'),original=meta.source[name].map(q=>leg?q:mat.point(INK.bodyMatrix(p),q)),expected=original.map(q=>mat.point(meta.projectors[name],q));near(meta.sockets[name],expected);near(r[name],expected.map(q=>leg?q:mat.point(mat.inverse(INK.bodyMatrix(p)),q)));assert(Object.isFrozen(s)&&Object.isFrozen(s.depth)&&Object.isFrozen(s.foreshortening)&&Object.isFrozen(s.turn)&&Object.isFrozen(s.bend));assert.notEqual(s.depth,meta.depth[name]);near(s.depth,meta.depth[name]);assert(s.foreshortening.every(x=>Number.isFinite(x)&&x>=0&&x<=1.25));assert(Object.values(s.turn).every(Number.isFinite));assert(Object.values(s.bend).every(Number.isFinite));}
 for(const rear of [false,true]){const name=rear?'rearArm':'frontArm',src=meta.source[name].map(q=>mat.point(INK.bodyMatrix(p),q)),angle=Math.atan2(src[2][1]-src[1][1],src[2][0]-src[1][0])*180/Math.PI,scale=c.female?.7:c.id==='luke'?.88:.82;near(A.handMatrix(p,r,c,rear),mat.multiply(meta.projectors[name],mat.compose(...src[2],angle,scale,scale)));const foot=meta.sockets[rear?'rearLeg':'frontLeg'][2],size=c.female?.79:.88;near(A.footMatrix(p,r,c,rear),mat.compose(...foot,rear?p.rfoot:p.ffoot,size,size));}
 assert.equal(JSON.stringify(A.solve(c,p).anatomy.surfaces),JSON.stringify(meta.surfaces));if(yaw===45&&flex===1)fingerprints.add(JSON.stringify(parts.map(n=>meta.surfaces[n].foreshortening)));samples++;
 }}
assert(fingerprints.size>=4,'actual character rigs must produce distinct projected measurements');
const degenerate=A.surfaceInfo('test',[[0,0],[0,0],[0,0]],[[0,0],[0,0],[0,0]],[0,0,0],90);assert.deepEqual(degenerate.foreshortening,[1,1]);assert.deepEqual(degenerate.bend,{cross:0,dot:0});
console.log(`PASS ${samples} actual-character projected poses; joints/sockets/hand/foot formula invariance, frozen metadata, finite edge cases and ${fingerprints.size} rig signatures`);
const lazyPose=INK.copy(INK.basePose),lazyRig=A.solve({id:'ryu'},lazyPose),descriptor=Object.getOwnPropertyDescriptor(lazyRig.anatomy,'surfaces');assert.equal(typeof descriptor.get,'function');assert.equal(descriptor.set,undefined);assert.equal(lazyRig.anatomy.surfaces,lazyRig.anatomy.surfaces,'first read must cache stable frozen surface identity');
