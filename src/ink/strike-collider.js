/* Bounded canonical body proxies, not pixel/surface collision. Stable IDs own
 * temporal pairing; part/zone retain semantic contact and feedback identity. */
'use strict';
(()=>{
 const chainOrder=Object.freeze(['rearArm','frontArm','rearLeg','frontLeg']),finite=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite),matrix=m=>Array.isArray(m)&&m.length===6&&m.every(Number.isFinite),mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
 const metadata=Object.freeze({shape:'AABB',quality:'canonical-proxy',space:'world',subdivisionsPerBone:2,fan:'seven-analytic-arc-sectors'});
 const invalid=reason=>({valid:false,reason,hurt:[],hit:[],throw:[],push:null,metadata});
 function arcSector(geometry,matrix,index){
  const a=geometry.start+geometry.span*index/7,b=geometry.start+geometry.span*(index+1)/7,r=79,angles=[a,b];
  for(const [x,y]of [[matrix[0],matrix[2]],[matrix[1],matrix[3]]]){const base=Math.atan2(y,x);for(let k=Math.ceil((a-base)/Math.PI);k<=Math.floor((b-base)/Math.PI);k++)angles.push(base+k*Math.PI);}
  return [[matrix[4],matrix[5]],...angles.map(t=>INK.mat.point(matrix,[r*Math.cos(t),r*Math.sin(t)]))];
 }
 function sample(model,options={}){
  const w=options.world||{},s=w.scale,dir=w.dir,P=INK.BodyProxy;
  if(!P||!Number.isFinite(w.x)||!Number.isFinite(w.groundWorldY)||!Number.isFinite(s)||s<=0||![1,-1].includes(dir))return invalid('invalid-world');
  const chains=model?.chains,profile=model?.profile;
  if(!chains||chainOrder.some(k=>!Array.isArray(chains[k])||chains[k].length!==3||!chains[k].every(finite)))return invalid('invalid-chains');
  if(!profile||!['arm','leg'].every(k=>Array.isArray(profile[k])&&profile[k].length===3&&profile[k].every(v=>Number.isFinite(v)&&v>0))||!Number.isFinite(profile.headScale)||profile.headScale<=0)return invalid('invalid-canonical-profile');
  if(!Array.isArray(model.skinMatrices)||model.skinMatrices.length!==3||!model.skinMatrices.every(matrix)||!matrix(model.headMatrix)||chainOrder.some(k=>!matrix(model.endFrames?.[k])))return invalid('invalid-shared-frames');
  const world=q=>[w.x+dir*s*q[0],w.groundWorldY+s*q[1]],bounds=(ps,id,part,zone)=>{const points=ps.map(world),xs=points.map(q=>q[0]),ys=points.map(q=>q[1]),x=Math.min(...xs),y=Math.min(...ys);return {id,part,zone,x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y};};
  const endProxy=(name,kind)=>P.outlines[kind].map(q=>INK.mat.point(model.endFrames[name],q));
  const hurt=[bounds(P.outlines.head.map(q=>INK.mat.point(model.headMatrix,q.map(v=>v*profile.headScale))),'hurt.head','head','head')];
  for(const [name,x,y0,y1]of [['chest',43,-301,-260],['abdomen',36,-260,-218],['pelvis',34,-218,-178]]){
   const points=[];for(let row=0;row<=4;row++){const y=y0+(y1-y0)*row/4;for(const side of [-1,1])points.push(P.skinPoint([x*side,y],profile.shape||{},model.skinMatrices));}hurt.push(bounds(points,'hurt.'+name,'torso','body'));
  }
  const segment=(a,b,ra,rb)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy),n=l>1e-9?[-dy/l,dx/l]:[1,0];return [[a[0]+n[0]*ra,a[1]+n[1]*ra],[a[0]-n[0]*ra,a[1]-n[1]*ra],[b[0]+n[0]*rb,b[1]+n[1]*rb],[b[0]-n[0]*rb,b[1]-n[1]*rb]];};
  for(const name of chainOrder){const leg=name.includes('Leg'),widths=profile[leg?'leg':'arm'],part=name.replace('Arm','-arm').replace('Leg','-leg');for(let bone=0;bone<2;bone++)for(let sub=0;sub<2;sub++){const u=sub/2,v=(sub+1)/2,a=mix(chains[name][bone],chains[name][bone+1],u),b=mix(chains[name][bone],chains[name][bone+1],v),wa=widths[bone]+(widths[bone+1]-widths[bone])*u,wb=widths[bone]+(widths[bone+1]-widths[bone])*v;hurt.push(bounds(segment(a,b,wa,wb),`hurt.${name}.${bone?'lower':'upper'}.${sub}`,part,leg?'leg':'body'));}}
  const hit=[],strikeSections=[];
  if(options.active){const c=options.contact||{},name=c.chain,chain=chains[name],kind=c.kind,leg=name?.includes('Leg');if(!chain||!['fist','foot','fan'].includes(kind)||(kind==='foot')!==leg)return invalid('invalid-contact');
   hit.push(bounds(endProxy(name,leg?'foot':'hand'),'hit.'+name+'.end',leg?'foot':'fist',leg?'leg':'body'));
   const sectionStart=world(mix(chain[1],chain[2],.28)),sectionEnd=world(chain[2]),endTip=world(INK.mat.point(model.endFrames[name],[leg?48:24,0]));
   strikeSections.push({hitID:'hit.'+name+'.end',part:leg?'foot':'fist',kind:'segment',start:sectionStart.slice(),end:endTip});
   const widths=profile[leg?'leg':'arm'];for(let sub=0;sub<2;sub++){const u=.28+.36*sub,v=u+.36,a=mix(chain[1],chain[2],u),b=mix(chain[1],chain[2],v),ra=widths[1]+(widths[2]-widths[1])*u,rb=widths[1]+(widths[2]-widths[1])*v;hit.push(bounds(segment(a,b,ra,rb),`hit.${name}.distal.${sub}`,leg?'shin':'forearm',leg?'leg':'body'));strikeSections.push({hitID:`hit.${name}.distal.${sub}`,part:leg?'shin':'forearm',kind:'segment',start:sectionStart.slice(),end:sectionEnd.slice()});}
   if(kind==='fan'){const fan=options.fan,g=fan?.geometry;if(!g||!Number.isFinite(g.start)||!Number.isFinite(g.span)||g.span<=0||g.span>Math.PI||!matrix(fan.matrix))return invalid('missing-shared-fan-sector');for(let i=0;i<7;i++){hit.push(bounds(arcSector(g,fan.matrix,i),'hit.fan.'+i,'fan','body'));const fm=fan.matrix;strikeSections.push({hitID:'hit.fan.'+i,part:'fan',kind:'radial',matrix:[dir*s*fm[0],s*fm[1],dir*s*fm[2],s*fm[3],w.x+dir*s*fm[4],w.groundWorldY+s*fm[5]],radius:79});}}
  }
  const push={x:w.x-53*s,y:w.groundWorldY-260*s,w:106*s,h:250*s};
  if([...hurt,...hit,push].some(b=>!['x','y','w','h'].every(k=>Number.isFinite(b[k]))||b.w<=0||b.h<=0))return invalid('nonfinite-or-degenerate-bounds');
  return {valid:true,reason:null,hurt,hit,strikeSections,throw:[],push,metadata};
 }
 INK.StrikeCollider=Object.freeze({sample,chainOrder,metadata,arcSector});
})();
