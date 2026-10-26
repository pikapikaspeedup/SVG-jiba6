'use strict';
const path=require('path'),fs=require('fs'),root=path.resolve(__dirname,'../..');
require(path.join(root,'src/ink/core.js'));require(path.join(root,'src/ink/skin-geometry.js'));
const rows=[];
for(const [id,profile] of Object.entries(INK.SkinGeometry.morphology))for(const part of ['arm','leg'])for(const angle of [0,45,90,135,175,180]){
 const a=angle*Math.PI/180,chain=[[0,0],[0,90],[Math.sin(a)*80,90+Math.cos(a)*80]],before=JSON.stringify(chain),g=INK.SkinGeometry.sampled(chain,[24,15,9],profile[part]),d=INK.SkinGeometry.sweep(chain,[24,15,9],INK.mat.identity(),g);
 if(/NaN|Infinity/.test(d)||before!==JSON.stringify(chain)||g.leftR.some(x=>x<=0)||g.rightR.some(x=>x<=0))throw Error(id+part+angle);
 rows.push({id,part,angle,vertices:g.centers.length});
}
fs.mkdirSync(path.join(root,'qa/model-upgrade'),{recursive:true});fs.writeFileSync(path.join(root,'qa/model-upgrade/geometry.json'),JSON.stringify({passed:true,samples:rows.length,rows},null,2));console.log('PASS',rows.length,'finite folded/straight limb envelopes; input joints unchanged');
