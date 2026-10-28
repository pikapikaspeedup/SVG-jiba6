/* Articulated, session-only Mai appearance. The drawing is real SVG: each
 * visible part follows the live game rig; combat state stays owned by INK. */
'use strict';
(()=>{
 const {mat,vec,clamp}=INK,sourceJoints={
  rearShoulder:[383.3,289.4],rearElbow:[294.9,471.7],rearHand:[168.4,630.7],
  frontShoulder:[598.6,318.3],frontElbow:[702.5,466.1],frontHand:[842.2,369.6],
  rearHip:[421.4,633.3],rearKnee:[352.4,925.3],rearFoot:[180,1350],
  frontHip:[573.5,648.7],frontKnee:[710.4,924.6],frontFoot:[850,1300]
 };
 const parts=['backSash','hairBack','rearUpperLeg','rearLowerLeg','rearFoot','frontUpperLeg','frontLowerLeg','frontFoot','rearUpperArm','rearLowerArm','body','apron','rearHandFront','hairFront','head','frontUpperArm','frontLowerArm','fan','frontHand'];
 let cached=null,serial=0;
 function source(){
  if(cached)return cached;
  const data=document.getElementById('ink-mai-stage-art');
  if(!data)throw Error('舞的新造型素材未随游戏载入');
  const doc=new DOMParser().parseFromString(JSON.parse(data.textContent),'image/svg+xml');
  const root=doc.documentElement,allowed=new Set(['svg','title','desc','metadata','defs','clipPath','linearGradient','stop','mask','rect','g','path']);
  if(root.localName!=='svg'||doc.querySelector('parsererror'))throw Error('舞的新造型素材无效');
  for(const element of [root,...root.querySelectorAll('*')]){
   if(!allowed.has(element.localName))throw Error('舞的新造型包含不支持的内容');
   for(const attr of element.attributes){
    if(/^on/i.test(attr.name)||/href/i.test(attr.name)||(/url\(/i.test(attr.value)&&!/^url\(#[a-zA-Z0-9_-]+\)$/.test(attr.value)))throw Error('舞的新造型包含不支持的引用');
   }
  }
  for(const name of parts)if(root.querySelectorAll(`[data-part="${name}"]`).length!==1)throw Error('舞的新造型缺少分件：'+name);
  cached=root;return root;
 }
 function mount(renderer){
  const art=document.importNode(source(),true),renames=new Map(),prefix='ink-mai-stage-'+(++serial)+'-';
  for(const element of art.querySelectorAll('[id]')){const old=element.id,next=prefix+old;renames.set(old,next);element.id=next;}
  for(const element of [art,...art.querySelectorAll('*')])for(const attr of [...element.attributes]){
   const match=/^url\(#([a-zA-Z0-9_-]+)\)$/.exec(attr.value);
   if(match){const next=renames.get(match[1]);if(!next)throw Error('舞的新造型缺少引用');element.setAttribute(attr.name,`url(#${next})`);}
  }
  const {node}=INK.SVG,group=node('g',{'data-ink-part':'mai-stage-reference','pointer-events':'none'},renderer.art);
  const defs=art.querySelector('defs');group.append(defs);
  // A continuous skin surface sits behind the authored pieces and fills the
  // anatomy hidden in the single reference view, especially bent joints.
  const gradient=node('linearGradient',{id:prefix+'skin',x1:0,y1:0,x2:1,y2:.32},defs);
  for(const [offset,color] of [[0,'#c47c5e'],[.32,'#edac88'],[.66,'#fbd1a6'],[1,'#d98f6d']])node('stop',{offset,'stop-color':color},gradient);
  const surfaces={};
  for(const name of ['rearLeg','frontLeg','rearArm','frontArm']){
   const layer=node('g',{'data-ink-underlay':name},group);
   let joints=null;
   if(name.endsWith('Leg')){
    // Only fill the actual hip, knee and ankle seams. A full limb-sized
    // underlay projects outside the traced leg as a second pale silhouette.
    const clip=node('clipPath',{id:prefix+name+'-seams',clipPathUnits:'userSpaceOnUse'},defs);
    joints=[25,16,11].map(r=>node('circle',{r},clip));layer.setAttribute('clip-path',`url(#${clip.id})`);
   }
   surfaces[name]={base:node('path',{fill:`url(#${prefix}skin)`},layer),shade:node('path',{fill:'#a95f49',opacity:.14},layer),light:node('path',{fill:'#ffe5c5',opacity:.2},layer),joints};
  }
  // Native SVG patches supply the parts of the hips hidden by the original
  // reference. They follow the torso and sit behind the textured leg pieces.
  const hips=['M365 480Q413 492 466 500L471 616Q430 604 398 610L369 589Q358 540 365 480Z','M542 500Q598 492 630 482L641 583L617 618Q585 606 548 615Z']
   .map(d=>node('path',{d,fill:`url(#${prefix}skin)`},group));
  const layers={};for(const name of parts){const layer=art.querySelector(`[data-part="${name}"]`);layers[name]=layer;group.append(layer);}
  // Reuse one vector source per accessory in clipped bands. Each band can
  // follow the existing spring chain without retracing or duplicating paths.
  function flexible(layer,name,ranges){
   const master=node('g',{id:prefix+name+'-source'},defs);while(layer.firstChild)master.appendChild(layer.firstChild);
   return ranges.map(([lo,hi],i)=>{
    const clip=node('clipPath',{id:prefix+name+'-band-'+i,clipPathUnits:'userSpaceOnUse'},defs);
    node('rect',{x:-200,y:lo,width:1600,height:hi-lo},clip);
    const band=node('g',{},layer),cropped=node('g',{'clip-path':`url(#${clip.id})`},band);
    node('use',{href:'#'+master.id},cropped);return band;
   });
  }
  const flex={hair:flexible(layers.hairBack,'hair',[[-100,196],[180,316],[300,1550]]),
   apron:flexible(layers.apron,'apron',[[-100,696],[680,876],[860,1550]]),
   sash:flexible(layers.backSash,'sash',[[-100,810],[790,1550]])};
  const fanLeaves=[...layers.fan.querySelectorAll('[data-ink-fan-leaf]')];
  renderer.maiStagePreview={group,layers,surfaces,hips,flex,fanLeaves};renderer.group.removeAttribute('data-ink-image-skin');renderer.group.setAttribute('data-ink-mai-stage','true');
 }
 // Source segments have their local y-axis on the bone. Retaining its normal
 // width avoids stretching the detailed artwork as the game bends a limb.
 function basis(a,b){const d=vec.sub(b,a);return mat.compose(a[0],a[1],Math.atan2(d[1],d[0])*180/Math.PI-90);}
 function link(a,b,c,d,sign){const sourceLength=vec.length(vec.sub(b,a)),targetLength=vec.length(vec.sub(d,c));
  return mat.multiply(basis(c,d),mat.multiply(mat.compose(0,0,0,.28*sign,targetLength/Math.max(sourceLength,.001)),mat.inverse(basis(a,b))));
 }
 function end(a,b,c,d,sign){const src=vec.sub(b,a),dst=vec.sub(d,c),angle=(Math.atan2(dst[1],dst[0])-Math.atan2(src[1],sign*src[0]))*180/Math.PI;
  return mat.multiply(mat.compose(d[0],d[1],angle,.28*sign,.28),mat.compose(-b[0],-b[1]));
 }
 function around(matrix,point,angle,sx=1,sy=1){return mat.multiply(matrix,mat.multiply(mat.compose(point[0],point[1],angle,sx,sy),mat.compose(-point[0],-point[1])));}
 function update(renderer,f,pose,rig,motion,view=f){
  const preview=renderer.maiStagePreview;if(!preview||!rig)return;
  const joints=INK.Rig.sockets(pose,rig),sign=INK.VisualFrame?.get(pose)&&f.dir<0?-1:1,{layers,surfaces,hips,flex,fanLeaves}=preview,m={};
  for(const name of ['rearArm','frontArm','rearLeg','frontLeg']){
   const leg=name.endsWith('Leg'),side=name.startsWith('rear')?'rear':'front';
   const sourceNames=leg?[side+'Hip',side+'Knee',side+'Foot']:[side+'Shoulder',side+'Elbow',side+'Hand'];
   const [a,b,c]=sourceNames.map(key=>sourceJoints[key]),[x,y,z]=joints[name];
   m[side+(leg?'UpperLeg':'UpperArm')]=link(a,b,x,y,sign);
   m[side+(leg?'LowerLeg':'LowerArm')]=link(b,c,y,z,sign);
   m[side+(leg?'Foot':side==='rear'?'HandFront':'Hand')]=end(b,c,y,z,sign);
   const widths=leg?[23.5,13,8.2]:[11,7.4,5.8],shape=INK.SkinGeometry.morphology.mai[leg?'leg':'arm'];
   const sample=INK.SkinGeometry.sampled(joints[name],widths,shape,rig.anatomy?.surfaces?.[name]),surface=surfaces[name];
   INK.SVG.assign(surface.base,'d',INK.SkinGeometry.sweep(joints[name],widths,mat.identity(),sample));
   INK.SVG.assign(surface.shade,'d',INK.SkinGeometry.band(joints[name],widths,mat.identity(),-.9,-.6,sample));
   INK.SVG.assign(surface.light,'d',INK.SkinGeometry.band(joints[name],widths,mat.identity(),.3,.58,sample));
   if(surface.joints)surface.joints.forEach((circle,i)=>{INK.SVG.assign(circle,'cx',joints[name][i][0]);INK.SVG.assign(circle,'cy',joints[name][i][1]);});
  }
  const shoulder=vec.mix(sourceJoints.rearShoulder,sourceJoints.frontShoulder,.5),hip=vec.mix(sourceJoints.rearHip,sourceJoints.frontHip,.5);
  const targetShoulder=vec.mix(joints.rearArm[0],joints.frontArm[0],.5),targetHip=vec.mix(joints.rearLeg[0],joints.frontLeg[0],.5);
  m.body=link(shoulder,hip,targetShoulder,targetHip,sign);
  hips.forEach(path=>INK.SVG.assign(path,'transform',mat.svg(m.body)));
  const head=around(m.body,[490.9,303.9],clamp((pose.head||0)*.3,-8,8));
  m.head=m.hairBack=m.hairFront=head;
  const enabled=!INK.VFX?.settings?.reducedMotion,move=enabled?clamp(Math.abs(view.move||0),0,1):0;
  const sway=enabled?(Math.sin(view.walkT||0)*move*7+(pose.bob||0)*1.3):0;
  const hair=enabled?(motion?.hairChain||[0,0,0]):[0,0,0],cloth=enabled?(motion?.clothChain||[0,0,0]):[0,0,0];
  m.apron=around(m.body,[500,535],clamp((cloth[0]||0)*.05+sway*.04,-2,2));
  m.backSash=around(m.body,[300,650],clamp((cloth[0]||0)*.05+sway*.04,-2,2));
  const hairMid=clamp(((hair[1]||0)+sway*.7)*.13,-4,4),hairTip=clamp(((hair[2]||0)+sway)*.2,-6,6);
  const clothMid=clamp(((cloth[1]||0)+sway*.5)*.12,-4,4),clothTip=clamp(((cloth[2]||0)+sway*.8)*.17,-6,6);
  const sourceRotate=(x,y,angle)=>`rotate(${angle} ${x} ${y})`;
  INK.SVG.assign(flex.hair[1],'transform',sourceRotate(415,190,hairMid));
  INK.SVG.assign(flex.hair[2],'transform',sourceRotate(415,190,hairMid)+' '+sourceRotate(375,305,hairTip));
  INK.SVG.assign(flex.apron[1],'transform',sourceRotate(500,688,clothMid));
  INK.SVG.assign(flex.apron[2],'transform',sourceRotate(500,688,clothMid)+' '+sourceRotate(500,868,clothTip));
  INK.SVG.assign(flex.sash[1],'transform',sourceRotate(285,800,clothTip*.7));
  const fanOpen=clamp(pose.fan??.9,.08,1),fanAngle=clamp((pose.fanAngle??-9)+9,-65,65);
  m.fan=around(m.frontHand,[880,345],fanAngle);
  INK.SVG.assign(layers.fan,'display',pose.fan===0?'none':'inline');
  fanLeaves.forEach(leaf=>{const i=leaf.getAttribute('data-ink-fan-leaf');if(i!=='cord'){
   const center=-160+(Number(i)+.5)*20,fold=(1-fanOpen)*(-80-center);
   INK.SVG.assign(leaf,'transform',sourceRotate(880,345,fold));
  }});
  for(const name of parts)INK.SVG.assign(layers[name],'transform',mat.svg(m[name]));
 }
 INK.MaiStagePreview={enabled:false,mount,update};
})();
