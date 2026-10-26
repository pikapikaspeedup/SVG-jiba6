/* Readable combat camera basis, independent of physical facing and depth. */
'use strict';
(() => {
 const settings={enabled:true},clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rad=Math.PI/180;
 const profiles=Object.freeze(Object.fromEntries(Object.entries({ryu:[40,.76],ken:[43,.75],chun:[38,.78],cammy:[44,.73],luke:[37,.82],juri:[46,.72],mai:[40,.78],iori:[47,.74]}).map(([id,p])=>[id,Object.freeze({threeQuarter:p[0],thickness:p[1]})])));
 function eligible(f,frame,options){
  const m=f.attack?.m,p=frame.legacyPose||{};
  return settings.enabled&&options.preserveView!==true&&!f.captured&&!f.throwAction&&!m?.throw&&m?.kind!=='spin'&&!['captured','throwing','tumble','down','rise','ko'].includes(f.state)&&Math.abs(p.spin||0)<=35;
 }
 function sample(f,frame,options={}){
  if(!frame?.headMatrix||!eligible(f,frame,options))return {active:false};
  const p=profiles[f.ch.id]||profiles.ryu,m=frame.headMatrix;
  if(m.length!==6||!m.every(Number.isFinite))return {active:false};
  // Prefer the final material heading because it includes authored head
  // offset and contact response, but accept an explicit unwrapped radians.
  const reflected=m[0]*m[3]-m[1]*m[2]<0,legacyLeft=reflected&&f.dir<0&&frame.surfaceMode!=='persistent-facing';
  const rawHeading=(frame.materialAngles?.head??(legacyLeft?0:f.dir<0?180:0))*rad;
  const heading=Number.isFinite(options.heading)?options.heading:legacyLeft?Math.PI-rawHeading:rawHeading;
  const rawBody=(frame.materialAngles?.body??rawHeading/rad)*rad,bodyHeading=Number.isFinite(options.bodyHeading)?options.bodyHeading:legacyLeft?Math.PI-rawBody:rawBody;
  const side=Math.cos(heading),headViewAngle=p.threeQuarter*side,bodyViewAngle=48*Math.cos(bodyHeading),yaw=headViewAngle*rad;
  // Preserve the source head centre and upright/tilted vertical axis. The
  // source horizontal axis may be mirrored legacy art; it is not a camera.
  const height=Math.hypot(m[2],m[3]);if(height<1e-6)return {active:false};
  const vx=m[2]/height,vy=m[3]/height,sourceWidth=Math.abs(m[0]*m[3]-m[1]*m[2])/height;
  const section=Math.sqrt(Math.cos(yaw)**2+p.thickness**2*Math.sin(yaw)**2),width=clamp(sourceWidth,.65,1.5)*section;
  const headMatrix=[vy*width,-vx*width,vx*height,vy*height,m[4],m[5]];
  return {active:true,heading,headViewAngle,bodyViewAngle,headMatrix,faceSide:side,profileWeight:Math.abs(Math.sin(yaw)),frontWeight:Math.cos(yaw),thickness:p.thickness,physicalHeading:heading};
 }
 // Frame copy only: callers explicitly choose where this presentation layer
 // owns head/hair rendering. No changes to rig, joints, depth or materialAngles.
 function apply(f,frame,options={}){const view=sample(f,frame,options);return view.active?{...frame,combatView:view}:frame;}
 INK.CombatView={settings,profiles,sample,apply};
})();
