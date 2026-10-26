/* Continuous contact between linearly interpolated AABB edges.
 * Pure simulation math: no SVG, wall clock, cached poses or combat mutations.
 * This is exact for the linear box model, not for arbitrary curved limb paths.
 */
'use strict';
(() => {
 const EPS=1e-9;
 const valid=b=>b&&['x','y','w','h'].every(k=>Number.isFinite(b[k]))&&b.w>0&&b.h>0;
 const at=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,w:a.w+(b.w-a.w)*t,h:a.h+(b.h-a.h)*t});
 const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
 const center=b=>[b.x+b.w/2,b.y+b.h/2];
 function point(a,b){return[(Math.max(a.x,b.x)+Math.min(a.x+a.w,b.x+b.w))/2,(Math.max(a.y,b.y)+Math.min(a.y+a.h,b.y+b.h))/2];}
 // Four half spaces are positive exactly when both open rectangles overlap.
 function constraints(a,b){return[a.x+a.w-b.x,b.x+b.w-a.x,a.y+a.h-b.y,b.y+b.h-a.y];}
 function sweep(a0,a1,b0,b1){
  if(![a0,a1,b0,b1].every(valid))return null;
  const start=constraints(a0,b0),end=constraints(a1,b1);
  let enter=0,leave=1,axis=-1;
  for(let i=0;i<4;i++){
   const c=start[i],v=end[i]-c;
   if(Math.abs(v)<EPS){if(c<=0)return null;continue;}
   const t=-c/v;
   if(v>0){if(t>enter){enter=t;axis=i;}}
   else leave=Math.min(leave,t);
  }
  // A corner touch, or a touch only at the final endpoint, has no penetration.
  if(enter>=leave-EPS||leave<=0||enter>=1)return null;
  const time=Math.max(0,enter),a=at(a0,a1,time),b=at(b0,b1,time);
  const initial=overlap(a0,b0);
  if(initial)axis=start.indexOf(Math.min(...start));
  if(axis<0){const c=constraints(a,b);axis=c.indexOf(Math.min(...c));}
  return{time,point:point(a,b),normal:[[1,0],[-1,0],[0,1],[0,-1]][axis],initialOverlap:initial};
 }
 function discrete(a,b){return valid(a)&&valid(b)&&overlap(a,b)?{...sweep(a,a,b,b),time:1}:null;}
 function gap(a,b){
  if(!valid(a)||!valid(b))return null;
  const bc=center(b),px=Math.max(a.x,Math.min(bc[0],a.x+a.w)),py=Math.max(a.y,Math.min(bc[1],a.y+a.h));
  const qx=Math.max(b.x,Math.min(px,b.x+b.w)),qy=Math.max(b.y,Math.min(py,b.y+b.h));
  const x=Math.max(a.x,Math.min(qx,a.x+a.w)),y=Math.max(a.y,Math.min(qy,a.y+a.h));
  return{distance:Math.hypot(qx-x,qy-y),pointA:[x,y],pointB:[qx,qy]};
 }
 function closest(a0,a1,b0,b1){
  if(![a0,a1,b0,b1].every(valid))return null;
  // Squared gap is piecewise quadratic: each axis is max(0, two affine gaps).
  const axes=(a,b)=>[[0,b.x-a.x-a.w,a.x-b.x-b.w],[0,b.y-a.y-a.h,a.y-b.y-b.h]];
  const lo=axes(a0,b0),hi=axes(a1,b1),lines=lo.map((row,i)=>row.map((c,j)=>[c,hi[i][j]-c]));
  const cuts=[0,1];
  for(const row of lines)for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){
   const v=row[i][1]-row[j][1];if(Math.abs(v)<EPS)continue;
   const t=(row[j][0]-row[i][0])/v;if(t>0&&t<1)cuts.push(t);
  }
  cuts.sort((a,b)=>a-b);const candidates=[...cuts];
  for(let i=1;i<cuts.length;i++){
   const mid=(cuts[i-1]+cuts[i])/2;
   const active=lines.map(row=>row.reduce((best,l)=>l[0]+l[1]*mid>best[0]+best[1]*mid?l:best));
   const vv=active.reduce((s,l)=>s+l[1]*l[1],0);
   if(vv>EPS){const t=-active.reduce((s,l)=>s+l[0]*l[1],0)/vv;if(t>cuts[i-1]&&t<cuts[i])candidates.push(t);}
  }
  let best=null;
  for(const time of candidates.sort((a,b)=>a-b)){
   const sample=gap(at(a0,a1,time),at(b0,b1,time));
   if(!best||sample.distance<best.distance-EPS)best={...sample,time};
  }
  return best;
 }
 globalThis.INK=globalThis.INK||{};
 INK.ContactSolver={valid,at,overlap,discrete,sweep,gap,closest};
})();
