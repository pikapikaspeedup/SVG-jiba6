/* Vector skins captured from reference images. All artwork is a bounded list
 * of numeric SVG paths; no embedded raster, scripts, URL references or markup
 * are accepted. The skin reads the same solved joints as the combat renderer. */
'use strict';
(()=>{
 const {mat,vec,clamp}=INK,{node,assign,transform}=INK.SVG;
 const joints=['head','neck','rearShoulder','rearElbow','rearHand','frontShoulder','frontElbow','frontHand','rearHip','rearKnee','rearFoot','frontHip','frontKnee','frontFoot'];
 const parts=['torso','head','rearUpperArm','rearLowerArm','rearHand','frontUpperArm','frontLowerArm','frontHand','rearUpperLeg','rearLowerLeg','rearFoot','frontUpperLeg','frontLowerLeg','frontFoot'];
 const characters=['ryu','ken','chun','cammy','luke','juri','mai','iori'];
 const assert=(ok,message)=>{if(!ok)throw Error(message);};
 function validate(source){
  assert(source&&source.version===1&&source.kind==='ink-vector-skin','不是有效的 INK 矢量人物模型');
  assert(characters.includes(source.character),'模型绑定的角色无效');
  const w=source.width,h=source.height;
  assert(Number.isInteger(w)&&Number.isInteger(h)&&w>=16&&h>=16&&w<=1024&&h<=1024,'画布尺寸无效');
  assert(source.joints&&typeof source.joints==='object','缺少骨骼关键点');
  assert(Object.keys(source.joints).length===joints.length&&Object.keys(source.joints).every(k=>joints.includes(k)),'骨骼关键点包含未知字段');
  for(const name of joints){const q=source.joints[name];assert(Array.isArray(q)&&q.length===2&&q.every(Number.isFinite)&&q[0]>=-w&&q[0]<=w*2&&q[1]>=-h&&q[1]<=h*2,'骨点无效：'+name);}
  const hip=(source.joints.rearHip[1]+source.joints.frontHip[1])*.5;
  assert(hip-source.joints.neck[1]>8,'颈部必须位于骨盆上方；请先校正骨点');
  for(const [a,b] of [['rearShoulder','rearElbow'],['rearElbow','rearHand'],['frontShoulder','frontElbow'],['frontElbow','frontHand'],['rearHip','rearKnee'],['rearKnee','rearFoot'],['frontHip','frontKnee'],['frontKnee','frontFoot']]){
   assert(vec.length(vec.sub(source.joints[a],source.joints[b]))>2,'相邻骨点不能重合：'+a+' / '+b);
  }
  assert(Array.isArray(source.paths)&&source.paths.length>0&&source.paths.length<=2000,'矢量分件数量无效');
  let length=0,seen=new Set();
  for(const item of source.paths){
   assert(item&&parts.includes(item.part)&&/^#[0-9a-f]{6}$/i.test(item.fill),'矢量分件或颜色无效');
   assert(typeof item.d==='string'&&item.d.length>0&&item.d.length<=30000&&/^[MLZ0-9.,\s+-]+$/.test(item.d),'路径只允许安全的 M/L/Z 矢量数据');
   length+=item.d.length;assert(length<=1800000,'矢量模型过大');
   const compiled=INK.compilePath(item.d);assert(compiled.commands.every(x=>['M','L','Z'].includes(x.op))&&compiled.values.length<=30000,'路径格式无效');
   assert([...compiled.values].every(v=>Number.isFinite(v)&&v>=-Math.max(w,h)*2&&v<=Math.max(w,h)*3),'路径坐标超出画布');
   seen.add(item.part);
  }
  assert(seen.has('torso')&&seen.has('head'),'未识别到完整的头部和躯干，需重新选择画面');
  return {version:1,kind:'ink-vector-skin',character:source.character,width:w,height:h,
   joints:Object.fromEntries(joints.map(name=>[name,source.joints[name].slice()])),
   paths:source.paths.map(({part,fill,d})=>({part,fill,d}))};
 }
 function basis(a,b){const d=vec.sub(b,a);return mat.compose(a[0],a[1],Math.atan2(d[1],d[0])*180/Math.PI-90);}
 function link(a,b,from,to,width){
  const old=vec.length(vec.sub(b,a)),now=vec.length(vec.sub(to,from));
  return mat.multiply(basis(from,to),mat.multiply(mat.compose(0,0,0,width,Math.max(.0001,now/old)),mat.inverse(basis(a,b))));
 }
 function markup(paths,m){return paths.map(q=>`<path d="${q.d}" fill="${q.fill}" fill-rule="evenodd" transform="${mat.svg(m)}"/>`).join('');}
 class VectorSkin {
  constructor(renderer,data){
   this.renderer=renderer;this.data=validate(data);const {joints:j,paths}=this.data;
   this.scale=clamp(132/((j.rearHip[1]+j.frontHip[1])*.5-j.neck[1]),.08,15);
   const hip=[(j.rearHip[0]+j.frontHip[0])*.5,(j.rearHip[1]+j.frontHip[1])*.5];
   this.group=node('g',{'data-ink-part':'image-skin'},renderer.art);
   const groupFor=part=>paths.filter(p=>p.part===part);
   const torsoMap=[this.scale,0,0,this.scale,-hip[0]*this.scale,-191-hip[1]*this.scale];
   this.torso=new INK.SkinGroup(this.group,markup(groupFor('torso'),torsoMap),{});
   this.head=node('g',{'data-image-skin':'head'},this.group);
   for(const p of groupFor('head'))node('path',{d:p.d,fill:p.fill,'fill-rule':'evenodd'},this.head);
   this.limbs={};
   for(const name of ['rearLeg','frontLeg','rearArm','frontArm']){
    const arm=name.endsWith('Arm'),side=name.startsWith('rear')?'rear':'front';
    const parent=node('g',{'data-image-skin':name},this.group),upper=node('g',{},parent),lower=node('g',{},parent),end=node('g',{},parent);
    for(const [root,key] of [[upper,side+(arm?'UpperArm':'UpperLeg')],[lower,side+(arm?'LowerArm':'LowerLeg')],[end,side+(arm?'Hand':'Foot')]])
     for(const p of groupFor(key))node('path',{d:p.d,fill:p.fill,'fill-rule':'evenodd'},root);
    const names=arm?[side+'Shoulder',side+'Elbow',side+'Hand']:[side+'Hip',side+'Knee',side+'Foot'];
    this.limbs[name]={parent,upper,lower,end,source:names.map(n=>j[n]),arm};
   }
   renderer.group.setAttribute('data-ink-image-skin','true');
  }
  render(p,rig,stats){
   const r=this.renderer,j=this.data.joints,sockets=INK.Rig.sockets(p,rig);
   this.torso.render(p,stats);
   const headScale=Math.max(.01,(r.c.headScale||.8)*(r.style.head||1));
   const hs=this.scale/headScale,headSource=[hs,0,0,hs,-j.head[0]*hs,-j.head[1]*hs];
   assign(this.head,'transform',mat.svg(mat.multiply(transform(r.head.getAttribute('transform')||''),headSource)),stats);
   const far=[],near=[];
   for(const [name,limb] of Object.entries(this.limbs)){
    const dst=sockets[name],src=limb.source;
    assign(limb.upper,'transform',mat.svg(link(src[0],src[1],dst[0],dst[1],this.scale)),stats);
    assign(limb.lower,'transform',mat.svg(link(src[1],src[2],dst[1],dst[2],this.scale)),stats);
    const end=transform(r[name].end.getAttribute('transform')||''),scale=this.scale/(limb.arm?(r.c.female?.7:r.c.id==='luke'?.88:.82):(r.c.female?.79:.88));
    const angle=limb.arm?Math.atan2(src[2][1]-src[1][1],src[2][0]-src[1][0])*180/Math.PI:0;
    const source=mat.inverse(mat.compose(src[2][0],src[2][1],angle));
    assign(limb.end,'transform',mat.svg(mat.multiply(end,mat.multiply(mat.compose(0,0,0,scale,scale),source))),stats);
    const depth=rig.anatomy?.depth?.[name]||[1,1,1];(depth[1]+depth[2]<0?far:near).push(limb.parent);
   }
   const order=[...far,this.torso.group,this.head,...near];
   if(order.some((n,i)=>this.group.children[i]!==n))for(const n of order)this.group.appendChild(n);
  }
 }
 INK.ImageSkin={validate,VectorSkin,parts:Object.freeze(parts),joints:Object.freeze(joints)};
})();
