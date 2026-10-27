/* Retained SVG renderer. DOM is retained after mount / first-draw decal initialization.
 * Paths are analytical anatomical pieces plus three-influence torso skinning.
 * Face/hand/back views are attachment swaps, not faded copies of a face.
 */
'use strict';
(() => {
 const {clamp,lerp,rad,mat,vec,Rig,WeightedPath,followThrough}=INK;
 const NS='http://www.w3.org/2000/svg',INKLINE='#302735';
 function node(tag,attrs={},parent=null){const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(parent)parent.appendChild(n);return n;}

 // Paint servers belong to their SVG viewport, never to a hidden sibling scene.
 // This also keeps several fighter previews from silently sharing duplicate IDs.
 const paintOwners=new WeakMap();let paintOwnerSerial=0;
 function paints(svg,id){let owner=paintOwners.get(svg);if(!owner){const defs=node('defs',{'data-ink-paints':'true'},svg);svg.insertBefore(defs,svg.firstChild);owner={prefix:'ink-paint-'+(++paintOwnerSerial)+'-',defs,ids:new Map()};paintOwners.set(svg,owner);}
  function gradient(name,colors,x2='.92',y2='.75'){if(owner.ids.has(name))return;const target=owner.prefix+name;owner.ids.set(name,target);const g=node('linearGradient',{id:target,x1:0,y1:0,x2,y2},owner.defs);colors.forEach((color,i)=>node('stop',{offset:[0,.44,1][i],'stop-color':color},g));}
  const p=SF6Art.palette[id];for(const key of ['skin','cloth','dark','hair'])gradient('atelier-'+id+'-'+key,p[key]);gradient('atelier-scarlet',['#f86a5f','#bb2e44','#601e38'],'.85','1');gradient('atelier-gold',['#fff0b2','#d9ac69','#866140'],'.6','1');
  return{scope(root){for(const n of [root,...root.querySelectorAll('*')]){for(const attr of [...n.attributes]){if(!attr.value.includes('url(#atelier-'))continue;const value=attr.value.replace(/url\(#(atelier-[a-z-]+)\)/g,(m,key)=>owner.ids.has(key)?'url(#'+owner.ids.get(key)+')':m);if(value!==attr.value)n.setAttribute(attr.name,value);}}},prefix:owner.prefix};
 }
 function assign(n,k,v,stats){if(k==='visibility'){if(n.hasAttribute('visibility'))n.removeAttribute('visibility');k='display';v=v==='hidden'?'none':'inline';}v=String(v);if(!n._inkAttrs)n._inkAttrs={};if(n._inkAttrs[k]===v)return;n._inkAttrs[k]=v;n.setAttribute(k,v);if(stats)stats.writes++;}
 function setTransform(n,m,s){assign(n,'transform',mat.svg(m),s);}
 function transform(text=''){
  let m=mat.identity();for(const[,name,v]of text.matchAll(/(matrix|translate|rotate|scale|skewX|skewY)\s*\(([^)]*)\)/g)){
   const a=v.trim().split(/[\s,]+/).map(Number);let q;
   if(name==='matrix')q=a;
   if(name==='translate')q=mat.compose(a[0],a[1]||0);
   if(name==='scale')q=mat.compose(0,0,0,a[0],a[1]??a[0]);
   if(name==='rotate')q=mat.multiply(mat.compose(a[1]||0,a[2]||0,a[0]),mat.compose(-(a[1]||0),-(a[2]||0)));
   if(name==='skewX')q=[1,0,Math.tan(rad(a[0])),1,0,0];if(name==='skewY')q=[1,Math.tan(rad(a[0])),0,1,0,0];
   m=mat.multiply(m,q);
  }return m;
 }
 const bind=[mat.compose(0,-191),mat.compose(0,-246),mat.compose(0,-295)];
 const torsoWeights=q=>INK.BodyProxy.torsoWeights(q);
 function ellipsePath(cx,cy,rx,ry){const k=.55228475;return `M${cx+rx} ${cy}C${cx+rx} ${cy+ry*k} ${cx+rx*k} ${cy+ry} ${cx} ${cy+ry}C${cx-rx*k} ${cy+ry} ${cx-rx} ${cy+ry*k} ${cx-rx} ${cy}C${cx-rx} ${cy-ry*k} ${cx-rx*k} ${cy-ry} ${cx} ${cy-ry}C${cx+rx*k} ${cy-ry} ${cx+rx} ${cy-ry*k} ${cx+rx} ${cy}Z`;}
 class SkinGroup {
  constructor(parent,markup,shape={}){
   this.group=node('g',{'data-ink-part':'weighted-torso'},parent);this.paths=[];const tmp=node('g');tmp.innerHTML=markup;
   const walk=(n,m,inherited={})=>{
    const current=mat.multiply(m,transform(n.getAttribute?.('transform')||'')),attrs={...inherited};
    for(const a of n.attributes||[])if(!['transform','d','cx','cy','rx','ry','r','x','y'].includes(a.name))attrs[a.name]=a.value;
    let d=n.getAttribute?.('d');if(['ellipse','circle'].includes(n.tagName)){const num=(a,def=0)=>+(n.getAttribute(a)||def);d=ellipsePath(num('cx'),num('cy'),num('rx',num('r')),num('ry',num('r')));}
    if(d){const path=INK.compilePath(d);for(let i=0;i<path.values.length;i+=2){const q=INK.BodyProxy.shapePoint(mat.point(current,[path.values[i],path.values[i+1]]),shape);path.values[i]=q[0];path.values[i+1]=q[1];}
     const dom=node('path',attrs,this.group),skin=new WeightedPath(INK.pathString(path),torsoWeights,bind);this.paths.push({dom,skin,rest:INK.pathString(path)});
    }else for(const c of n.children||[])walk(c,current,attrs);
   };for(const c of tmp.children)walk(c,mat.identity());
  }
  render(p,stats){
   this.rigid=false;assign(this.group,'transform','',stats);
   const matrices=INK.Anatomy.skinMatrices(p);
   for(const {dom,skin} of this.paths)assign(dom,'d',skin.deform(matrices),stats);
  }

 }
 function segmentShape(length,top,bottom,bulge=1,lower=false){
  const L=length,w=top,b=bottom,peak=w*bulge;
  return `M${-w*.67} ${-w*.3}C${-w*1.03} ${-w*.1} ${-peak} ${L*.15} ${-peak*.92} ${L*.33}C${-peak*.86} ${L*.59} ${-b*.96} ${L*.82} ${-b} ${L}Q0 ${L+b*.74} ${b} ${L}C${b*1.04} ${L*.77} ${peak*(lower?.83:1.07)} ${L*.51} ${peak*(lower?.96:1.05)} ${L*.28}Q${w*.91} ${-w*.36} ${w*.57} ${-w*.39}Q0 ${-w*.78} ${-w*.67} ${-w*.3}Z`;
 }
 function segmentShadow(L,w,b,lower){return `M${-w*.68} ${w*.06}Q${-w*.9} ${L*.2} ${-w*.76} ${L*.44}L${-b*.84} ${L*.95}Q${-b*.35} ${L*1.02} ${b*.2} ${L*.96}L${-b*.28} ${L*.72}Q${-w*.32} ${L*.38} ${-w*.1} ${L*.18}Z`;}
 function segmentLight(L,w,b){return `M${w*.16} ${w*.04}Q${w*.69} ${L*.03} ${w*.73} ${L*.28}Q${w*.67} ${L*.47} ${w*.4} ${L*.6}L${w*.2} ${L*.48}Q${w*.38} ${L*.25} ${w*.16} ${w*.04}Z`;}
 function boneMatrix(a,b,outer=mat.identity()) {const d=vec.sub(b,a);return mat.multiply(outer,mat.compose(a[0],a[1],Math.atan2(d[1],d[0])*180/Math.PI-90));}
 function material(c,leg,rear){
  const id=c.id,p=SF6Art.palette[id];let skin=leg?['mai','luke','cammy'].includes(id):!['ken','iori'].includes(id),key='skin';
  if(!skin)key=leg?(id==='chun'||id==='cammy'||(id==='juri'&&rear)?'dark':id==='iori'?'cloth':'cloth'):(id==='iori'?'dark':'cloth');
  const colors=p[key],base=id==='ken'&&leg?'#cc4c50':`url(#atelier-${id}-${key})`;
  return {base,shade:skin?p.skin[2]:colors[2],light:skin?p.skin[0]:colors[0],skin};
 }

 let serial=0;
 // One uninterrupted anatomical envelope. Bone-local shading is clipped into it;
 // knees and elbows are not two outlined cylinders meeting at a visible seam.
 class Limb {
  constructor(parent,c,leg,rear,profile){
   this.c=c;this.leg=leg;this.rear=rear;this.widths=leg?profile.leg:profile.arm;this.material=material(c,leg,rear);
   this.group=node('g',{'data-ink-part':(rear?'rear-':'front-')+(leg?'leg':'arm')},parent);
   this.body=node('g',{'data-ink-part':'limb-surface'},this.group);
   this.surface=node('path',{fill:this.material.base,stroke:INKLINE,'stroke-width':1.1,'stroke-linejoin':'round'},this.body);this.clip=node('clipPath',{id:'ink6-limb-'+(++serial),clipPathUnits:'userSpaceOnUse'},this.body);this.clipShape=node('path',{},this.clip);this.details=node('g',{'clip-path':'url(#'+this.clip.id+')'},this.body);
   this.pieces=[0,1].map(()=>{const group=node('g',{},this.details);return {group,outline:node('path',{fill:this.material.base,stroke:'none','stroke-width':0,'stroke-linejoin':'round'},group),shade:node('path',{fill:this.material.shade,opacity:rear?.28:.16},group),light:node('path',{fill:this.material.light,opacity:rear?.12:.2},group),line:node('path',{fill:'none',stroke:this.material.shade,'stroke-width':1,'stroke-linecap':'round',opacity:.68},group),cloth:node('g',{},group)};});
   this.skinShade=node('path',{fill:this.material.shade,opacity:this.rear?.22:.16},this.details);this.details.insertBefore(this.skinShade,this.details.firstChild);
   this.skinLight=node('path',{fill:this.material.light,opacity:.22},this.details);this.details.insertBefore(this.skinLight,this.details.firstChild);
   this.foldShade=node('path',{fill:this.material.shade},this.details);
   this.joint=node('ellipse',{fill:this.material.base},this.body);
   this.crease=node('path',{fill:'none',stroke:this.material.shade,'stroke-width':.95,'stroke-linecap':'round',opacity:.7},this.details);
   this.end=node('g',{},this.group);
   if(leg){
    const bare=['ryu','juri','luke','mai'].includes(c.id),p=SF6Art.palette[c.id];
    this.shoe=node('path',{fill:bare?`url(#atelier-${c.id}-skin)`:`url(#atelier-${c.id}-dark)`,stroke:INKLINE,'stroke-width':1.3,'stroke-linejoin':'round'},this.end);
    this.sole=node('path',{fill:'none',stroke:bare?p.skin[2]:p.dark[2],'stroke-width':2.1,'stroke-linecap':'round'},this.end);
    this.ankle=node('path',{d:'M-10 -16L10 -16 10 -3Q0 1-10 -3Z',fill:c.id==='mai'?'#f3e5d4':bare?p.dark[1]:p.dark[0],stroke:INKLINE,'stroke-width':.8},this.end);
    this.ankleDetail=node('path',{d:'M-9 -12L9 -10M-9 -7L9 -5',fill:'none',stroke:c.id==='mai'?'#b39a90':p.dark[2],'stroke-width':.8},this.end);
   }else{
    this.hands=Object.fromEntries(['fist','palm','guard','claw','grip'].map(kind=>{const group=node('g',{'data-hand':kind,visibility:kind==='fist'?'visible':'hidden'},this.end);group.innerHTML=INK.assets.hand(c,kind);return[kind,group];}));this.fist=this.hands.fist;this.palm=this.hands.palm;
    if(c.id==='mai'&&!rear){this.fan=node('g',{},this.end);this.fanRig=new INK.MaiFan(this.fan);this.end.insertBefore(this.fan,this.fist);}
   }
   this.decalsReady=false;
  }
  decals(lengths){
   if(this.decalsReady)return;this.decalsReady=true;this.decalLengths=lengths.slice();const c=this.c,id=c.id,p=SF6Art.palette[id],[w,e,a]=this.widths,[u,l]=lengths,{P,F,L}=INK.assets;
   const band=(top,bottom,width,fill)=>P(`M${-width} ${top}Q0 ${top+4} ${width} ${top}L${width*.78} ${bottom}Q0 ${bottom+4} ${-width*.78} ${bottom}Z`,fill,1);
   let upper='',lower='';
   if(!this.leg){
    if(id==='ryu'&&this.rear)upper+=P(`M${-w*.8} -8Q0 -20 ${w*.8} -8L${w*.95} ${u*.32}L${w*.55} ${u*.27}L${w*.2} ${u*.39}L${-w*.15} ${u*.31}L${-w*.5} ${u*.38}L${-w*.94} ${u*.28}Z`,`url(#atelier-${id}-cloth)`,1.1)+L(`M${-w*.5} 1L${-w*.4} ${u*.22}`,'#aaa7a1',1.1);
    if(id==='cammy')lower+=P(segmentShape(l*.92,e*1.43,a*1.05,1.05,true),'#cb4153',1.2)+L(`M${e*.35} 3L${e*.44} ${l*.56}`,'#ff9e90',2.2);
    if(['mai','chun','iori'].includes(id)){lower+=band(l*.81,l,a+2,id==='chun'?'#3e3446':p.trim)+L(`M${-a-1} ${l*.91}L${a+1} ${l*.91}`,p.dark[2],.9);if(id==='chun')for(const x of [-a*.7,0,a*.7])lower+=P(`M${x-1.5} ${l*.88}l2-3 2 4-2 2Z`,p.trim,.45);}
    if(id==='luke')lower+=L(`M${e*.4} ${l*.22}l-6 7 3 5-5 7M${e*.44} ${l*.52}l-5 5 2 5`,p.skin[2],1.7);
    if(['ken','iori'].includes(id)){upper+=L(`M${-w*.36} ${u*.38}L${-e*.2} ${u*.87}M${e*.1} ${u*.7}l8-7`,p.dark[2],1.2);lower+=L(`M${-e*.6} ${l*.2}l9 8-6 4M${a*.6} ${l*.88}L${-a*.7} ${l*.88}`,p.dark[2],1.1);}
   }else{
    if(id==='luke')upper+=P(segmentShape(u*.72,w+1.5,e+5),`url(#atelier-luke-cloth)`,1.2)+L(`M${-w*.43} 2L${-e*.8} ${u*.63}M${-e-4} ${u*.72}Q0 ${u*.77} ${e+4} ${u*.72}`,p.trim,2.5);
    if(id==='cammy'){upper+=F(`M${-w*.78} ${u*.28}L${w*.36} ${u*.37}L${w*.52} ${u*.43}L${-w*.69} ${u*.34}Z M${-w*.74} ${u*.45}L${w*.65} ${u*.49}L${w*.58} ${u*.55}L${-w*.68} ${u*.53}Z`,'#485c53','opacity=".64"');lower+=band(l*.38,l,e*.89,'#bb394b')+L(`M${e*.4} ${l*.51}L${a*.47} ${l*.94}`,'#f08081',1.4);}
    if(id==='chun')lower+=band(l*.48,l,e*.81,'#e9e4d9')+L(`M${-e*.72} ${l*.49}Q0 ${l*.57} ${e*.72} ${l*.49}`,p.trim,1.7);
    if(id==='mai')lower+=band(l*.76,l,a+2,'#f7e9d8')+L(`M${-a-1} ${l*.8}L${a+1} ${l*.84}M${-a-1} ${l*.9}L${a+1} ${l*.94}`,'#b99994',1);
    if(id==='juri'){upper+=L(`M${w*.66} ${u*.08}Q${w*.7} ${u*.4} ${e*.65} ${u*.92}`,p.trim,2.4);lower+=L(`M${e*.61} 0Q${e*.8} ${l*.4} ${a*.66} ${l*.82}`,p.trim,2.4);}
    if(['ryu','ken','iori'].includes(id)){upper+=L(`M${w*.21} ${u*.22}Q${w*.38} ${u*.5} ${e*.12} ${u*.91}M${-e*.7} ${u*.78}l7 12`,p.cloth[2],1.15);lower+=L(`M${-e*.6} ${l*.14}l8 9-8 10M${a*.8} ${l*.8}l-9 9M${-a*.8} ${l*.93}Q0 ${l*.97} ${a*.8} ${l*.93}`,p.cloth[2],1.05);}
   }
   this.pieces[0].cloth.innerHTML=upper;this.pieces[1].cloth.innerHTML=lower;
  }
  render(chain,p,stats,style={},rig=null) {
   const visual=INK.VisualFrame?.get(p),[a,b,c]=chain,outer=this.leg||visual?mat.identity():INK.bodyMatrix(p),ab=vec.sub(b,a),bc=vec.sub(c,b),lengths=[vec.length(ab),vec.length(bc)];
   const dot=clamp((ab[0]*bc[0]+ab[1]*bc[1])/Math.max(1e-8,lengths[0]*lengths[1]),-1,1),flex=(1-dot)*.5;
   const volume=style.volume??1,baseWidths=this.widths.map(w=>w*volume*(this.rear?.94:1));
   const[w,e,z]=baseWidths;
   // Decals are authored at invariant source-bone length, not at the
   // foreshortened length of whichever frame happened to mount first.
   const name=(this.rear?'rear':'front')+(this.leg?'Leg':'Arm'),source=rig.anatomy?.source[name];
   const invariant=INK.Anatomy.lengths(this.c),index=this.leg?2:0,sourceLengths=[invariant[index],invariant[index+1]];
   this.decals(sourceLengths);
   const centerline=INK.SkinGeometry.sampled(chain,baseWidths,INK.SkinGeometry.morphology[this.c.id]?.[this.leg?'leg':'arm'],rig.anatomy?.surfaces?.[name]);
   const contour=INK.SkinGeometry.sweep(chain,baseWidths,outer,centerline);assign(this.surface,'d',contour,stats);assign(this.clipShape,'d',contour,stats);
   assign(this.skinShade,'d',INK.SkinGeometry.band(chain,baseWidths,outer,-.94,this.material.skin?-.48:-.30,centerline),stats);
   assign(this.skinLight,'d',INK.SkinGeometry.band(chain,baseWidths,outer,.28,this.material.skin?.53:.67,centerline),stats);
   for(let i=0;i<2;i++){
    const part=this.pieces[i],L=lengths[i],top=i?e*(this.leg?1.05:1.14):w,bottom=i?z:e;
    const bulge=i?(this.leg?1.19:this.c.id==='luke'?1.47:1.24):(this.material.skin?1+flex*.1:1.015);
    setTransform(part.group,boneMatrix(i?b:a,i?c:b,outer),stats);
    assign(part.cloth,'transform',`scale(1 ${L/Math.max(.0001,this.decalLengths[i])})`,stats);
    // The continuous envelope owns all base fill, including cloth.
    assign(part.outline,'d','',stats);
    assign(part.shade,'display','none',stats);assign(part.light,'display','none',stats);
    assign(part.line,'d',this.material.skin?`M${top*.35} ${L*.36}Q${top*.47} ${L*.56} ${bottom*.23} ${L*.76}`:'',stats);
   }
   const joint=mat.point(outer,b),ang=Math.atan2(bc[1],bc[0])*180/Math.PI;
   assign(this.joint,'cx',joint[0],stats);assign(this.joint,'cy',joint[1],stats);assign(this.joint,'rx',e*.82,stats);assign(this.joint,'ry',e*.71,stats);
   // The shared continuous surface replaces the old overlaid joint patch.
   assign(this.joint,'visibility','hidden',stats);
   const folds=INK.SkinGeometry.folds(centerline,outer,this.material.skin);
   assign(this.crease,'d',folds.crease,stats);assign(this.crease,'opacity',folds.opacity,stats);
   assign(this.foldShade,'d',folds.shade,stats);assign(this.foldShade,'opacity',folds.opacity*.7,stats);
   const endMatrix=this.leg?INK.Anatomy.footMatrix(p,rig,this.c,this.rear):INK.Anatomy.handMatrix(p,rig,this.c,this.rear);
   setTransform(this.end,endMatrix,stats);
   if(this.leg){const shoe=INK.SkinGeometry.foot(visual?.materialAngles.pelvis??INK.Turn.angle(p,'pelvis'));assign(this.shoe,'d',shoe.outline,stats);assign(this.sole,'d',shoe.sole,stats);}

   if(!this.leg){const requested=this.rear?p.handRear:p.handFront,kind=this.fan&&p.fan!==0?'grip':['fist','palm','guard','claw','grip'].includes(requested)?requested:p.open>.45?'palm':'fist';for(const [name,group] of Object.entries(this.hands))assign(group,'visibility',name===kind?'visible':'hidden',stats);
    if(this.fan){this.fanRig.render(p.fan??.9,stats);const openness=clamp(p.fan??.9,.07,1),fanFrame=visual?.fanFrames?.[name],local=INK.FanGeometry.transform(p);assign(this.fan,'transform',fanFrame?mat.svg(mat.multiply(mat.multiply(mat.inverse(endMatrix),fanFrame),local)):`translate(16 0) rotate(${-18+(p.fanAngle||0)})`,stats);assign(this.fan,'visibility',p.fan===0?'hidden':'visible',stats);}
   }
  }
 }
 class Renderer {
  constructor(parent,character){
   if(!parent?.ownerSVGElement&&parent?.tagName!=='svg')throw TypeError('Renderer requires an SVG parent');
   this.assets=INK.assets.pack(character);this.c=this.assets.profile;this.paintScope=paints(parent.tagName==='svg'?parent:parent.ownerSVGElement,character.id);this.stats={writes:0,frames:0,mountNodes:0};this.style={volume:1,head:1};
   this.group=node('g',{'data-ink-character':character.id,'data-ink-mode':'skin'},parent);
   this.art=node('g',{'data-ink-layer':'art'},this.group);
   const a=this.assets;
   this.trail=node('g',{'data-ink-part':'cloth-followthrough'},this.art);this.trail.innerHTML=a.trail;
   this.rearLeg=new Limb(this.art,this.c,true,true,this.c);this.frontLeg=new Limb(this.art,this.c,true,false,this.c);
   this.hair=node('g',{'data-ink-part':'hair-followthrough'},this.art);this.hair.innerHTML=a.hair;
   this.rearArm=new Limb(this.art,this.c,false,true,this.c);
   this.torso=new SkinGroup(this.art,a.torso,this.c.shape);this.torsoBack=new SkinGroup(this.art,a.torsoBack,this.c.shape);this.torsoSide=new SkinGroup(this.art,a.torsoSide||a.torso,this.c.shape);
   this.pelvisSurface=node('path',{'data-ink-part':'pelvis-bridge',fill:this.c.id==='mai'?'#b42d47':material(this.c,true,false).base,stroke:'none'},this.art);
   this.coat=node('g',{'data-ink-part':'coat-followthrough'},this.art);this.coat.innerHTML=a.coat;
   this.strap=node('path',{fill:'none',stroke:'#a23c56','stroke-width':5,'stroke-linecap':'round'},this.art);
   this.head=node('g',{'data-ink-part':'head-slot'},this.art);this.heads={};
   for(const [name,markup]of Object.entries(a.heads)){this.heads[name]=node('g',{'data-ink-attachment':name},this.head);this.heads[name].innerHTML=markup;}
   this.expressions=[...this.head.querySelectorAll('[data-expression]')];
   if(INK.CombatHead){this.combatHead=node('g',{'data-ink-attachment':'combat-head',display:'none'},this.head);this.combatHead.innerHTML=INK.CombatHead.markup(this.c);this.combatHeadParts=new Map([...this.combatHead.querySelectorAll('[data-combat-head]')].map(n=>[n.dataset.combatHead,n]));}
   this.turnMasks={};this.turnDefs=node('defs',{},this.group);
   for(const part of ['body','face'])for(const view of ['front','profile','back']){
    const mask=node('clipPath',{id:'ink6-turn-'+(++serial),clipPathUnits:'userSpaceOnUse'},this.turnDefs);
    const rect=part==='body'?node('path',{},mask):node('rect',{x:-600,y:-600,width:1200,height:1200},mask);this.turnMasks[part+view]=rect;
    const target=part==='body'?({front:this.torso,profile:this.torsoSide,back:this.torsoBack}[view].group):this.heads[view];
    target.setAttribute('clip-path','url(#'+mask.id+')');
   }
   this.frontArm=new Limb(this.art,this.c,false,false,this.c);
   this.foregroundLimbs={};
   for(const name of ['rearLeg','frontLeg','rearArm','frontArm']){
    const limb=this[name],id='ink6-surface-source-'+(++serial),endId='ink6-end-source-'+(++serial);limb.body.id=id;limb.end.id=endId;
    const clip=node('clipPath',{id:'ink6-limb-depth-'+(++serial),clipPathUnits:'userSpaceOnUse'},this.turnDefs),path=node('path',{},clip);
    const group=node('g',{'data-ink-part':name+'-depth-overlay'},this.art);
    const use=node('use',{href:'#'+id,'clip-path':'url(#'+clip.id+')'},group);
    // Reuse the actual hand/fan/foot silhouette. An oversized wrist circle
    // must never drag a distant patch of sleeve or torso into the near pass.
    const end=node('use',{href:'#'+endId,'data-ink-part':name+'-end-overlay'},group);
    let rootFade=null;
    if(name.endsWith('Leg')){
     const gradient=node('linearGradient',{id:'ink6-root-fade-'+(++serial),gradientUnits:'userSpaceOnUse'},this.turnDefs);
     node('stop',{offset:0,'stop-color':'black'},gradient);node('stop',{offset:1,'stop-color':'white'},gradient);
     const mask=node('mask',{id:'ink6-root-seam-'+(++serial),maskUnits:'userSpaceOnUse',x:-1000,y:-1000,width:2000,height:2000,'mask-type':'luminance'},this.turnDefs);
     node('rect',{x:-1000,y:-1000,width:2000,height:2000,fill:'url(#'+gradient.id+')'},mask);
     use.setAttribute('mask','url(#'+mask.id+')');rootFade=gradient;
    }
    this.foregroundLimbs[name]={clip,path,use,end,group,rootFade};
   }
   this.foregroundArms={rearArm:this.foregroundLimbs.rearArm,frontArm:this.foregroundLimbs.frontArm};
   this.debug=node('g',{'data-ink-layer':'rig','pointer-events':'none'},this.group);
   this.bones=Array.from({length:11},()=>node('line',{stroke:'#3a8f87','stroke-width':1.35,'stroke-dasharray':'4 3'},this.debug));
   this.joints=Array.from({length:15},()=>node('circle',{r:3.4,fill:'#f6fbeb',stroke:'#238b81','stroke-width':1.4},this.debug));
   this.debug.setAttribute('display','none');this._order='';this.mode='skin';this.destroyed=false;
   if(this.c.id==='mai')this.maiSecondary=new INK.MaiSecondary(this);
   this.stats.mountNodes=this.group.querySelectorAll('*').length;
  }
  setMode(mode){if(!['skin','rig','silhouette','overlay'].includes(mode))throw Error('Unknown mode');this.mode=mode;assign(this.group,'data-ink-mode',mode,this.stats);assign(this.art,'visibility',mode==='rig'?'hidden':'visible',this.stats);assign(this.debug,'display',['rig','overlay'].includes(mode)?'inline':'none',this.stats);assign(this.debug,'visibility',['rig','overlay'].includes(mode)?'visible':'hidden',this.stats);}
  setStyle(style){if(style.volume!==undefined)this.style.volume=clamp(style.volume,.75,1.3);if(style.head!==undefined)this.style.head=clamp(style.head,.8,1.25);}
  render(p,{rig=null,frame=0,expression='rest',impulses=[],secondary=true,motion=null}={}) {
   if(this.destroyed)throw Error('Renderer already destroyed');const start=performance.now();this.stats.writes=0;this.stats.frames++;
   const visual=INK.VisualFrame?.get(p),signature=JSON.stringify([p,rig,visual?[visual.materialAngles,visual.skinMatrices,visual.headMatrix,visual.endFrames,visual.fanFrames,visual.rig.anatomy.depth,visual.combatView]:null,secondary?frame:0,expression,impulses,motion,this.style,this.mode]);if(signature===this.signature){this.stats.cpuMs=performance.now()-start;return this.stats;}this.signature=signature;
   const inputRig=rig?.anatomy?rig:visual?.rig||Rig.solveAnimation(this.c,p),r=inputRig,s=this.stats,bodyAngle=visual?.materialAngles.body??INK.Turn.angle(p),headAngle=visual?.materialAngles.head??INK.Turn.angle(p,'head'),turn=INK.Turn.view(bodyAngle),back=turn.far;
   this.inputRig=inputRig;
   for(const name of ['rearLeg','frontLeg','rearArm','frontArm'])this[name].render(r[name],p,s,this.style,r);
   const bodyBands=INK.Turn.bands(bodyAngle,64),faceBands=INK.Turn.bands(headAngle,48),combatView=visual?.combatView,readableHead=!!(combatView?.active&&this.combatHead),headFrame=readableHead?combatView.headMatrix:visual?.headMatrix;
   if(this.combatHead){assign(this.combatHead,'display',readableHead?'inline':'none',s);if(readableHead){const geometry=INK.CombatHead.sample(this.c,{look:combatView.faceSide,mood:combatView.mood});for(const [key,attributes]of Object.entries(geometry.parts)){const part=this.combatHeadParts.get(key);for(const [attribute,value]of Object.entries(attributes))assign(part,attribute,value,s);}}}
   if(bodyBands.front[1]>=.001)this.torso.render(p,s);
   if(bodyBands.back[1]>=.001)this.torsoBack.render(p,s);
   if(bodyBands.profile[1]>=.001)this.torsoSide.render(p,s);
   for(const name of ['front','profile','back']){
    const skin={front:this.torso,profile:this.torsoSide,back:this.torsoBack}[name],band=bodyBands[name],rect=this.turnMasks['body'+name];
    assign(skin.group,'display',band[1]<.001?'none':'inline',s);
    assign(skin.group,'transform','',s);
    assign(rect,'d',INK.SkinGeometry.torsoClip(p,band[0],band[1]),s);
    const fb=faceBands[name],fr=this.turnMasks['face'+name];assign(fr,'x',fb[0],s);assign(fr,'width',Math.max(0,fb[1]),s);assign(fr,'y',-100,s);assign(fr,'height',200,s);
    assign(this.heads[name],'display',readableHead||fb[1]<.001?'none':'inline',s);
   }
   this.turnState=turn;
   const hipShape=[[-24,-222],[-31,-212],[-33,-196],[-25,-180],[0,-171],[25,-180],[33,-196],[31,-212],[24,-222]];
   assign(this.pelvisSurface,'d',INK.SkinGeometry.closed(hipShape.map(q=>INK.Anatomy.skinPoint(p,q)),.15),s);

   // All limbs have a far pass and a near-depth surface pass. Raised thighs
   // can cross the belt/coat just as a forearm can cross the chest.
   const sockets=Rig.sockets(p,r),layers=this.foregroundLimbs;
   for(const name of ['rearLeg','frontLeg','rearArm','frontArm']){
    const leg=name.endsWith('Leg'),limb=this[name],chain=sockets[name],depth=(r.anatomy?.depth[name]||[1,1,1]).slice();
    if(name==='rearArm'){
     const guard=INK.Turn.smooth(-52,-22,p.rw[0])*(1-INK.Turn.smooth(-279,-247,p.rw[1]));
     const facing=Math.max(0,Math.cos(INK.rad(bodyAngle)));if(!(visual?.nativeBody||visual?.mode==='locomotion')){depth[1]+=guard*facing*10;depth[2]+=guard*facing*27;}
    }
    const exposure=leg?INK.Turn.smooth(-10,28,Math.max(chain[0][1]-chain[1][1],chain[0][1]-chain[2][1])):1;
    assign(layers[name].group,'opacity',exposure,s);
    const widths=limb.widths.map(w=>w*this.style.volume*(limb.rear?.94:1));
    assign(layers[name].path,'d',INK.SkinGeometry.frontClip(chain,depth,widths,0,INK.SkinGeometry.morphology[this.c.id]?.[leg?'leg':'arm']),s);
    assign(layers[name].end,'display',depth[2]>0?'inline':'none',s);
    assign(layers[name].end,'opacity',clamp(depth[2]/5),s);
    if(leg){
     // Fade only the near pass into its hip seam; the complete far surface
     // remains opaque underneath. Keep the foot outside this root-plane mask.
     const u=vec.normal(vec.sub(chain[1],chain[0])),seam=clamp(widths[0]*1.1,18,34),g=layers[name].rootFade;
     assign(g,'x1',chain[0][0],s);assign(g,'y1',chain[0][1],s);
     assign(g,'x2',chain[0][0]+u[0]*seam,s);assign(g,'y2',chain[0][1]+u[1]*seam,s);
    }
    layers[name].depth=(depth[1]+depth[2])*.5;
   }
   const nearLegs=['rearLeg','frontLeg'].sort((a,b)=>layers[a].depth-layers[b].depth),nearArms=['rearArm','frontArm'].sort((a,b)=>layers[a].depth-layers[b].depth);
   const order=[back,...nearLegs,...nearArms].join(':');if(order!==this._order){this._order=order;
    const legs=back?[this.frontLeg.group,this.rearLeg.group]:[this.rearLeg.group,this.frontLeg.group];
    const ordered=[this.trail,...legs,this.hair,this.rearArm.group,this.frontArm.group,this.pelvisSurface,this.strap,this.torso.group,this.torsoSide.group,this.torsoBack.group,this.coat,...nearLegs.map(n=>layers[n].group),this.head,...nearArms.map(n=>layers[n].group)];
    for(const n of ordered)this.art.appendChild(n);
   }
   if(this.c.id==='iori'){const a=vec.mix(r.rearLeg[0],r.rearLeg[1],.69),b=vec.mix(r.frontLeg[0],r.frontLeg[1],.69);assign(this.strap,'d',`M${a}Q${(a[0]+b[0])/2} ${Math.max(a[1],b[1])+55} ${b}`,s);}
   const body=INK.bodyMatrix(p),h=Rig.sockets(p,r).head,headScale=this.c.headScale*this.style.head;
   const hv=INK.Turn.view(headAngle);setTransform(this.head,visual?mat.multiply(headFrame,mat.compose(0,0,0,headScale,headScale)):mat.compose(h[0]+hv.offset*.5,h[1],(p.lean||0)+(p.head||0)+(p.chest||0),headScale*(.8+.2*hv.width),headScale),s);
   // Face attachments have continuous disjoint surface masks above.
   const face=expression==='hurt'?'hurt':['guard','brace'].includes(p.expression)?p.expression:expression;
   for(const e of this.expressions)assign(e,'visibility',e.dataset.expression===face?'visible':'hidden',s);
   const lag=secondary?followThrough(frame,impulses,1.15):0;const dynamics=secondary?motion:null;
   const oldHair=()=>{const at=visual?Rig.sockets(visual.legacyPose,visual.legacyRig).head:h;return mat.multiply(mat.compose(at[0]-6,at[1]-14,(dynamics?.hair??lag)*.7+(p.lean||0)+(p.chest||0)+(p.head||0)*.6),mat.compose(14,365));};
   setTransform(this.hair,readableHead||visual?.nativeBody||['locomotion','contact'].includes(visual?.mode)?mat.multiply(headFrame,mat.multiply(mat.compose(-6,-14,(dynamics?.hair??lag)*.7),mat.compose(14,365))):visual?mat.multiply(visual.legacyMatrix,oldHair()):oldHair(),s);
   const hipM=INK.Anatomy.skinMatrices(p)[0],belt=mat.point(hipM,[0,-14]);
   setTransform(this.coat,mat.multiply(hipM,mat.multiply(mat.compose(0,-14,(dynamics?.cloth??lag)*.22),mat.compose(0,205))),s);
   setTransform(this.trail,mat.multiply(hipM,mat.multiply(mat.compose(0,-14,(dynamics?.cloth??lag)*.18),mat.compose(0,205))),s);
   this.maiSecondary?.render(p,dynamics,secondary?frame:0,s);
   if(['rig','overlay'].includes(this.mode)){
    const sockets=Rig.sockets(p,r),lines=[],points=[];for(const name of ['rearLeg','frontLeg','rearArm','frontArm']){const q=sockets[name];lines.push([q[0],q[1]],[q[1],q[2]]);points.push(...q);}
    lines.push([sockets.pelvis,sockets.chest],[sockets.chest,sockets.neck],[sockets.neck,sockets.head]);points.push(sockets.pelvis,sockets.chest,sockets.head);
    lines.forEach(([a,b],i)=>{assign(this.bones[i],'x1',a[0],s);assign(this.bones[i],'y1',a[1],s);assign(this.bones[i],'x2',b[0],s);assign(this.bones[i],'y2',b[1],s);});
    points.forEach((q,i)=>{assign(this.joints[i],'cx',q[0],s);assign(this.joints[i],'cy',q[1],s);});
   }
   if(!this._paintsReady){this.paintScope.scope(this.group);this._paintsReady=true;}this.lastPose=p;this.lastRig=r;this.stats.cpuMs=performance.now()-start;return this.stats;
  }
  destroy(){this.group.remove();this.destroyed=true;this.heads={};this.expressions=[];}
 }
 INK.SVG={NS,node,assign,transform};INK.Paints={get:paints};INK.SkinGroup=SkinGroup;INK.Renderer=Renderer;INK.Limb=Limb;
})();
