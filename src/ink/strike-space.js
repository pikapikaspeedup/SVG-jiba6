/* Fixed-length strike geometry. Pure math; no actor or render dependencies. */
'use strict';
(()=>{
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function vector(p,n){if(!Array.isArray(p)||p.length<n||!p.slice(0,n).every(Number.isFinite))throw TypeError('Finite strike-space vector required');return p.slice(0,n);}
 function bones(v){const a=vector(v,2);if(a.some(x=>x<=0))throw RangeError('Positive bone lengths required');return a;}
 const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),norm=a=>Math.hypot(...a),sub=(a,b)=>a.map((v,i)=>v-b[i]),add=(a,b,s=1)=>a.map((v,i)=>v+b[i]*s);
 function solve3D(root,target,lengths,pole=[0,0,1]){
  const r=vector(root,3),t=vector(target,3),p=vector(pole,3),[a,b]=bones(lengths),delta=sub(t,r),distance=norm(delta),u=distance>1e-12?delta.map(v=>v/distance):[1,0,0];
  const d=clamp(distance,Math.abs(a-b),a+b),end=add(r,u,d);
  let lateral=sub(p,r);lateral=add(lateral,u,-dot(lateral,u));
  if(norm(lateral)<1e-10){const axis=[0,1,2].sort((i,j)=>Math.abs(u[i])-Math.abs(u[j]))[0];lateral=[0,0,0];lateral[axis]=1;lateral=add(lateral,u,-dot(lateral,u));}
  lateral=lateral.map(v=>v/norm(lateral));
  const along=d>1e-12?(a*a-b*b+d*d)/(2*d):0,height=Math.sqrt(Math.max(0,a*a-along*along)),joint=add(add(r,u,along),lateral,height);
  return [r,joint,end];
 }
 function solve2D(root,target,lengths,bend=1){const r=vector(root,2),t=vector(target,2),d=sub(t,r),n=norm(d),u=n>1e-12?d.map(v=>v/n):[1,0],side=bend<0?-1:1;return solve3D([...r,0],[...t,0],lengths,[r[0]-u[1]*side,r[1]+u[0]*side,0]).map(p=>p.slice(0,2));}
 function samplePath(keys,t){
  if(!Array.isArray(keys)||!keys.length||!Number.isFinite(t))throw TypeError('Finite strike path required');
  const size=keys[0].value?.length;if(!size)throw TypeError('Nonempty path vectors required');
  const values=keys.map((k,i)=>{if(!Number.isFinite(k.time)||i&&k.time<=keys[i-1].time)throw RangeError('Path times must strictly increase');return vector(k.value,size);});
  if(t<=keys[0].time)return values[0];if(t>=keys.at(-1).time)return values.at(-1);
  let i=0;while(t>keys[i+1].time)i++;const h=keys[i+1].time-keys[i].time,u=(t-keys[i].time)/h;
  const slope=(j,c)=>(values[j+1][c]-values[j][c])/(keys[j+1].time-keys[j].time);
  function tangent(j,c){const left=j?slope(j-1,c):null,right=j<keys.length-1?slope(j,c):null,slopes=[left,right].filter(v=>v!==null);if(slopes.some(v=>v===0)||slopes.length===2&&left*right<=0)return 0;
   const sign=Math.sign(slopes[0]),limit=3*Math.min(...slopes.map(Math.abs));let v;
   if(keys[j].tangent!==undefined)v=vector(keys[j].tangent,size)[c];
   else if(slopes.length===1)v=slopes[0];else{const hl=keys[j].time-keys[j-1].time,hr=keys[j+1].time-keys[j].time,w1=2*hr+hl,w2=hr+2*hl;v=(w1+w2)/(w1/left+w2/right);}
   return sign*clamp(sign*v,0,limit);
  }
  return values[i].map((v,c)=>(2*u**3-3*u*u+1)*v+(u**3-2*u*u+u)*h*tangent(i,c)+(-2*u**3+3*u*u)*values[i+1][c]+(u**3-u*u)*h*tangent(i+1,c));
 }
 function project(chain,matrix){const m=vector(matrix,6);return chain.map(p=>{const q=vector(p,2);return [m[0]*q[0]+m[2]*q[1]+m[4],m[1]*q[0]+m[3]*q[1]+m[5]];});}
 globalThis.INK=globalThis.INK||{};INK.StrikeSpace=Object.freeze({solve2D,solve3D,samplePath,project});
})();
