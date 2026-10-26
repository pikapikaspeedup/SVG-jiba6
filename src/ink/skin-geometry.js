/* FLOW 06 · continuous, variable-radius surfaces for articulated SVG limbs.
 * Geometry is generated in actor space from the SAME joint array as sockets.
 * Rounded centerlines avoid unbounded miter intersections at folded elbows.
 */
'use strict';
(() => {
 const {vec,mat,clamp,lerp}=INK;
 const length=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
 const fmt=q=>(Math.round(q[0]*1000)/1000)+' '+(Math.round(q[1]*1000)/1000);
 const xy=(x,y)=>(Math.round(x*1000)/1000)+' '+(Math.round(y*1000)/1000);
 function closed(points,tension=.13){
  if(!points.length)return '';
  let d='M'+fmt(points[0]);const n=points.length;
  for(let i=0;i<n;i++){
   const a=points[(i-1+n)%n],b=points[i],c=points[(i+1)%n],e=points[(i+2)%n];
   d+='C'+xy(b[0]+(c[0]-a[0])*tension,b[1]+(c[1]-a[1])*tension)+' '+xy(c[0]-(e[0]-b[0])*tension,c[1]-(e[1]-b[1])*tension)+' '+fmt(c);
  }
  return d+'Z';
 }
 // Visual morphology only: source joints, sockets and collision never move.
 const morphology=Object.freeze({
  ryu:{arm:[.15,.19,.06],leg:[.12,.13,.12]},
  ken:{arm:[.08,.12,.14],leg:[.13,.16,.18]},
  chun:{arm:[.06,.08,.04],leg:[.21,.17,.06]},
  cammy:{arm:[.11,.12,.04],leg:[.17,.19,.05]},
  luke:{arm:[.16,.31,.06],leg:[.12,.19,.06]},
  juri:{arm:[.05,.09,.035],leg:[.12,.17,.10]},
  mai:{arm:[.07,.10,.035],leg:[.16,.17,.04]},
  iori:{arm:[.06,.10,.16],leg:[.10,.14,.15]}
 });
 const jointFalloff=Array.from({length:18},(_,i)=>Math.exp(-Math.pow((i-8)/3.1,2)));
 function sampled(chain,widths,shape=null,surface=null){
  const [a,b,c]=chain,[w,j,z]=widths,L0=length(a,b),L1=length(b,c);
  if(L0+L1<.01)return null;
  const cut=Math.min(j*.9,L0*.23,L1*.23),u0=vec.normal(vec.sub(b,a)),u1=vec.normal(vec.sub(c,b));
  const before=vec.sub(b,vec.mul(u0,cut)),after=vec.add(b,vec.mul(u1,cut));
  const centers=[],radii=[];
  for(let i=0;i<=6;i++){const t=i/6;centers.push(vec.mix(a,before,t));radii.push(lerp(w,j,t)+Math.sin(t*Math.PI)*(shape?w*shape[0]:w*.04));}
  for(let i=1;i<=5;i++){const t=i/5,s=1-t;centers.push([s*s*before[0]+2*s*t*b[0]+t*t*after[0],s*s*before[1]+2*s*t*b[1]+t*t*after[1]]);radii.push(j);}
  for(let i=1;i<=6;i++){const t=i/6;centers.push(vec.mix(after,c,t));radii.push(lerp(j,z,t)+Math.sin(Math.pow(t,.72)*Math.PI)*(shape?j*shape[1]:j*.055));}
  const normals=centers.map((q,i)=>{const a=centers[Math.max(0,i-1)],b=centers[Math.min(centers.length-1,i+1)];let v=vec.sub(b,a);if(vec.length(v)<1e-6)v=i<centers.length/2?u0:u1;const u=vec.normal(v);return[-u[1],u[0]];});
  const bend=clamp((1-(u0[0]*u1[0]+u0[1]*u1[1]))*.5),cross=u0[0]*u1[1]-u0[1]*u1[0],side=cross<0?-1:1;
  // A shortened segment keeps a readable cross-section rather than becoming
  // a wide slab. The correction is bounded and never changes its centerline.
  const ratios=surface?.foreshortening||surface?.ratios||[1,1];
  const compress=i=>{const segment=i<9?0:1,ratio=Number.isFinite(ratios[segment])?ratios[segment]:1;return 1-.17*(1-clamp(ratio,.05,1));};
  const cloth=clamp((shape?.[2]||0)*4,0,.8),rootTaper=shape?.[0]||0;
  for(let i=0;i<radii.length;i++){const seam=1-(shape ? .07+rootTaper*.25 : 0)*Math.exp(-i*i/3);radii[i]*=compress(i)*seam;}
  const flex=shape?bend:0,outer=.13+cloth*.16,inner=.22+cloth*.15;
  const leftR=radii.map((r,i)=>{const joint=jointFalloff[i];return r*(1+flex*joint*(side<0?outer:-inner));});
  const rightR=radii.map((r,i)=>{const joint=jointFalloff[i];return r*(1+flex*joint*(side>0?outer:-inner));});
  return {centers,radii,normals,leftR,rightR,a,c,u0,u1,w,z,b,side,bend,cloth};
 }
 function sweep(chain,widths,outer=mat.identity(),g=sampled(chain,widths)){
  if(!g){const at=mat.point(outer,chain[0]),r=Math.max(...widths);return `M${at[0]-r} ${at[1]}a${r} ${r} 0 1 0 ${2*r} 0a${r} ${r} 0 1 0 ${-2*r} 0Z`;}
  const {centers,radii,normals,leftR=radii,rightR=radii,a,c,u0,u1,w,z}=g;
  const left=centers.map((q,i)=>vec.add(q,vec.mul(normals[i],leftR[i]))),right=centers.map((q,i)=>vec.sub(q,vec.mul(normals[i],rightR[i])));
  const head=vec.sub(a,vec.mul(u0,w*.75)),tip=vec.add(c,vec.mul(u1,z*.8));
  return closed([...left,tip,...right.reverse(),head].map(q=>mat.point(outer,q)),.105);
 }
 function band(chain,widths,outer,from=-.92,to=-.48,g=sampled(chain,widths)){
  if(!g)return '';
  const edge=f=>g.centers.map((q,i)=>mat.point(outer,vec.add(q,vec.mul(g.normals[i],(f<0?(g.rightR||g.radii)[i]:(g.leftR||g.radii)[i])*f*(1-(g.bend||0)*jointFalloff[i]*.18)))));
  return closed([...edge(from),...edge(to).reverse()],.09);
 }
 // One compound path per kind: reuse existing renderer nodes, no simulation.
 function folds(g,outer=mat.identity(),skin=false){
  if(!g)return {crease:'',shade:'',opacity:0};
  const bend=g.bend||0,cloth=skin?0:g.cloth||0,side=g.side||1,n=g.normals[8],b=g.b;
  const point=(along,across)=>mat.point(outer,[b[0]+g.u1[0]*along+n[0]*across*side,b[1]+g.u1[1]*along+n[1]*across*side]);
  const radius=g.radii[8],width=radius*(.45+.3*cloth)*bend;
  let crease='',shade='';
  const count=skin?1:3;
  for(let i=0;i<count;i++){
   const offset=(i-(count-1)/2)*radius*.34,reach=width*(1-i*.13),a=point(offset,-reach),q=point(offset+radius*.18,reach*.25),z=point(offset+radius*.05,reach);
   crease+='M'+fmt(a)+'Q'+fmt(q)+' '+fmt(z);
   if(!skin){const back=point(offset+radius*(.08+.12*cloth)*bend,0);shade+=closed([a,q,z,back],.04);}
  }
  return {crease,shade,opacity:clamp(bend*(skin?.24:.36+.2*cloth),0,.65)};
 }
 function frontClip(chain,depth,widths,handRadius=44,shape=null){
  // This masks an existing surface; widening the mask does not add geometry.
  if(shape)widths=widths.map(w=>w*(1+Math.max(...shape)));
  let d='';for(let i=0;i<2;i++){
   const a=depth[i],b=depth[i+1];if(Math.max(a,b)<=0)continue;
   const from=a>=0?0:clamp(-a/(b-a)),to=b>=0?1:clamp(-a/(b-a));
   const p=vec.mix(chain[i],chain[i+1],from),q=vec.mix(chain[i],chain[i+1],to),w=lerp(widths[i],widths[i+1],from)+2,z=lerp(widths[i],widths[i+1],to)+2;
   const fade=clamp(Math.max(a,b)/7);d+=sweep([p,vec.mix(p,q,.5),q],[w*fade,(w+z)*.5*fade,z*fade]);
  }
  if(depth[2]>0&&handRadius>0){const r=handRadius*clamp(depth[2]/8),q=chain[2];d+=`M${q[0]-r} ${q[1]}a${r} ${r} 0 1 0 ${2*r} 0a${r} ${r} 0 1 0 ${-2*r} 0Z`;}
  return d||'M0 0Z';
 }
 function torsoClip(p,x,width){
  if(width<=0)return 'M0 0Z';const ys=[-430,-360,-324,-295,-270,-246,-218,-191,-140];
  const left=ys.map(y=>INK.Anatomy.skinPoint(p,[x,y])),right=ys.slice().reverse().map(y=>INK.Anatomy.skinPoint(p,[x+width,y]));
  return 'M'+[...left,...right].map(fmt).join('L')+'Z';
 }
 function foot(angle){
  const c=Math.cos(INK.rad(angle)),s=Math.sin(INK.rad(angle));
  const heel=[-2*c,5],toe=[30*c,9+Math.abs(s)*2];
  const profile=Math.abs(s),halfWidth=8+profile*6;
  // A shoe seen end-on has a broad forefoot and a flat sole, rather than a
  // vertical centerline terminating in a pointed toe below the ankle.
  const left=lerp(Math.min(heel[0]-10,toe[0]-8),-halfWidth,profile),right=lerp(Math.max(heel[0]+10,toe[0]+8),halfWidth,profile),bottom=lerp(toe[1]+7,14,profile);
  const outline=closed([[-8,-13],[8,-13],[right,5],[right-1,bottom],[left+1,bottom],[left,5]],.12);
  const sole=`M${fmt([heel[0]-7*c,heel[1]+8])}Q${fmt([toe[0]*.5,16+Math.abs(s)])} ${fmt([toe[0]+4*c,toe[1]+5])}`;
  return {outline,sole,toe,angle};
 }
 INK.SkinGeometry={morphology,sampled,sweep,band,folds,frontClip,closed,torsoClip,foot,version:'7.0.0'};
})();
