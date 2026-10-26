/* Pure reconstruction of one coherent actor-screen frame. No pose sampling. */
'use strict';
(() => {
 const names=['rearArm','frontArm','rearLeg','frontLeg'],same=(a,b)=>a===b||Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>Array.isArray(v)?same(v,b[i]):v===b[i]);
 const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 function lengths(frame){return Object.fromEntries(names.map(n=>[n,[distance(frame.joints3D[n][0],frame.joints3D[n][1]),distance(frame.joints3D[n][1],frame.joints3D[n][2])]]));}
 function apply(source,options={}){
  const {chains={},joints={},world}=options,angles={...source.materialAngles,...options.materialAngles};
  const changed=names.some(n=>chains[n]&&!same(chains[n],source.joints3D[n]))||Object.entries(joints).some(([k,v])=>!same(v,source.joints3D[k]))||Object.keys(angles).some(k=>angles[k]!==source.materialAngles[k])||options.skinMatrices&&!same(options.skinMatrices,source.skinMatrices)||options.headMatrix&&!same(options.headMatrix,source.headMatrix);
  if(!changed&&!world)return source;
  const c=source.rig.profile,old=source.rig.anatomy,joints3D={...source.joints3D},sockets={...old.sockets},depth={...old.depth},surfaces={...old.surfaces},turns={...old.turns},projectors={...old.projectors},rig={...source.rig},endFrames={...source.endFrames},fanFrames={...source.fanFrames},fixed=options.nativeLengths||lengths(source);
  for(const n of names){
   const chain=chains[n]||source.joints3D[n];if(!chain.every(p=>p.length===3&&p.every(Number.isFinite)))throw TypeError('Finite XYZ limb chains required');
   const leg=n.endsWith('Leg'),heading=angles[leg?'pelvis':'body']||0,changedChain=!same(chain,source.joints3D[n]),changedAngle=heading!==source.materialAngles[leg?'pelvis':'body'];
   if(!changedChain&&!changedAngle)continue;
   joints3D[n]=chain.map(p=>p.slice());sockets[n]=chain.map(p=>p.slice(0,2));rig[n]=sockets[n];depth[n]=chain.map(p=>p[2]);turns[n]=heading;projectors[n]=[1,0,0,1,0,0];
   // A straight synthetic source preserves the actual 3D segment lengths in
   // surfaceInfo's 2D denominator, even for legacy projected carriers.
   const original=[[0,0],[fixed[n][0],0],[fixed[n][0]+fixed[n][1],0]];
   surfaces[n]=INK.Anatomy.surfaceInfo(c.id,original,sockets[n],depth[n],heading);
   const authoredAngle=leg?(n.startsWith('rear')?source.legacyPose?.rfoot:source.legacyPose?.ffoot)||0:Math.atan2(source.endFrames[n][1],source.endFrames[n][0])*180/Math.PI;
   const config={kind:leg?'foot':'hand',scale:leg?(c.female?.79:.88):(c.female?.7:c.id==='luke'?.88:.82),heading:heading*Math.PI/180,authoredAngle};
   endFrames[n]=INK.VisualFrame.thickEndFrame(chain,config);if(source.fanFrames?.[n])fanFrames[n]=INK.VisualFrame.thinFanFrame(chain,config);
  }
  for(const [n,p] of Object.entries(joints)){if(p.length!==3||!p.every(Number.isFinite))throw TypeError('Finite XYZ torso joints required');joints3D[n]=p.slice();sockets[n]=p.slice(0,2);}
  Object.defineProperties(rig,{profile:{value:c},anatomy:{value:{...old,sockets,depth,surfaces,turns,projectors}}});
  const worldFeet={};for(const k of ['rear','front']){const end=joints3D[k+'Leg'][2],before=source.joints3D[k+'Leg'][2];if(world){const scale=world.scale||1;worldFeet[k]=[world.x+end[0]*scale,665+(world.y||0)+end[1]*scale,end[2]*scale];}else if(same(end,before))worldFeet[k]=source.worldFeet[k];else throw TypeError('world is required when foot positions change');}
  return {...source,rig,joints3D,physicalLengths:fixed,endFrames,fanFrames,materialAngles:angles,worldFeet,skinMatrices:options.skinMatrices||source.skinMatrices,headMatrix:options.headMatrix||source.headMatrix};
 }
 INK.FrameDeform={apply,lengths};
})();
