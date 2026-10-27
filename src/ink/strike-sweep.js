/* Fixed eight-segment AABB approximation. Fractional model samples are read-only;
 * coverage describes box topology, not exact collision with a curved surface. */
'use strict';
(() => {
 const ordered=rows=>Array.isArray(rows)?rows.slice().sort((a,b)=>String(a.id??a.part).localeCompare(String(b.id??b.part))):null;
 function inspect(a0,a1,b0,b1,{sampleA,sampleB,steps=8}={}){
  const S=INK.ContactSolver,result={contact:null,near:null,overlapped:false,coverage:true,model:'piecewise-AABB',steps:8};
  if(steps!==8||!S){result.coverage=false;return result;}
  const valid=rows=>rows&&rows.length>0&&rows.every(b=>S.valid(b)&&typeof b.part==='string'&&b.part.length>0)&&new Set(rows.map(b=>b.id??b.part)).size===rows.length;
  const compatible=(a,b)=>valid(a)&&valid(b)&&a.length===b.length&&a.every((q,i)=>(q.id??q.part)===(b[i].id??b[i].part)&&q.part===b[i].part);
  const endsA=[ordered(a0?.hit),ordered(a1?.hit)],endsB=[ordered(b0?.hurt),ordered(b1?.hurt)];
  if(!compatible(...endsA)||!compatible(...endsB)){result.coverage=false;return result;}
  const at=(ends,u)=>ends[0].map((q,i)=>({...S.at(q,ends[1][i],u),part:q.part,id:q.id})),A=[],B=[];
  for(let i=0;i<=8;i++){
   const u=i/8;let a,b;
   try{a=typeof sampleA==='function'?ordered(sampleA(u)?.hit):at(endsA,u);b=typeof sampleB==='function'?ordered(sampleB(u)?.hurt):at(endsB,u);}catch{result.coverage=false;return result;}
   if(!compatible(endsA[0],a)||!compatible(endsB[0],b)){result.coverage=false;return result;}
   A.push(a);B.push(b);
  }
  // All samples validate first: partial coverage must not masquerade as a full miss.
  for(let step=0;step<8;step++)for(let i=0;i<A[step].length;i++)for(let j=0;j<B[step].length;j++){
   const from=A[step][i],to=A[step+1][i],target=B[step][j],next=B[step+1][j],parts={hitID:from.id??from.part,hurtID:target.id??target.part,hitPart:from.part,hurtPart:target.part};
   const c=S.sweep(from,to,target,next),g=S.closest(from,to,target,next);
   if(c){const row={...c,...parts,time:(step+c.time)/8};result.overlapped=true;if(!result.contact||row.time<result.contact.time)result.contact=row;}
   if(g){const row={...g,...parts,time:(step+g.time)/8};if(!result.near||row.distance<result.near.distance-1e-9||Math.abs(row.distance-result.near.distance)<=1e-9&&row.time<result.near.time)result.near=row;}
  }
  if(result.contact){
   result.contact.strikeGeometry=null;
   // One extra sample only after the earliest global TOI is selected. This
   // evidence affects presentation quality, never already-validated coverage.
   if(typeof sampleA==='function')try{
    const geometry=sampleA(result.contact.time),sections=geometry?.strikeSections;
    if(Array.isArray(sections)){
     const vector=(q,n)=>Array.isArray(q)&&q.length===n&&q.every(Number.isFinite)?Object.freeze(q.slice()):null;
     const rows=sections.map(s=>{
      if(typeof s.hitID!=='string'||typeof s.part!=='string')return null;
      if(s.kind==='segment'){const start=vector(s.start,2),end=vector(s.end,2);return start&&end?Object.freeze({hitID:s.hitID,part:s.part,kind:'segment',start,end}):null;}
      if(s.kind==='radial'){const matrix=vector(s.matrix,6);return matrix&&Number.isFinite(s.radius)&&s.radius>0?Object.freeze({hitID:s.hitID,part:s.part,kind:'radial',matrix,radius:s.radius}):null;}
      return null;
     });
     if(rows.every(Boolean))result.contact.strikeGeometry=Object.freeze({strikeSections:Object.freeze(rows),nativeExtension:Number.isFinite(geometry.nativeExtension)?geometry.nativeExtension:null});
    }
   }catch{/* Missing presentation witness does not invalidate collision. */}
  }
  return result;
 }
 INK.StrikeSweep=Object.freeze({inspect});
})();
