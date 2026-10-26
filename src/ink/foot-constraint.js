/* Fixed-length projected foot fitting. No inverse projector, mutable history,
 * root displacement, anatomy recursion or gameplay ownership. */
'use strict';
(() => {
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
 const finite2=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
 function solve(source,projector,target,{pole,iterations=12,tolerance=.5}={}){
  if(!Array.isArray(source)||source.length!==3||!source.every(finite2)||!Array.isArray(projector)||projector.length!==6||!projector.every(Number.isFinite)||!finite2(target))throw TypeError('Finite source chain, affine projector and target required');
  if(!Number.isFinite(iterations)||!Number.isFinite(tolerance)||tolerance<0)throw RangeError('Finite iteration count and nonnegative tolerance required');
  const lengths=[Math.hypot(source[1][0]-source[0][0],source[1][1]-source[0][1]),Math.hypot(source[2][0]-source[1][0],source[2][1]-source[1][1])];
  if(lengths.some(n=>n<1e-8))throw RangeError('Positive source bone lengths required');
  const root=source[0],l1=lengths[0],l2=lengths[1],a0=Math.atan2(source[1][1]-root[1],source[1][0]-root[0]),lower=Math.atan2(source[2][1]-source[1][1],source[2][0]-source[1][0]),delta=wrap(lower-a0);
  // INK.twoBone pole is opposite the signed upper-to-lower bend.
  const sign=pole===undefined?(delta<0?-1:1):(pole<0?1:-1),bend0=Math.abs(delta),maxBend=Math.PI-1e-5;
  let a=a0,b=clamp(bend0,0,maxBend);const count=clamp(Math.round(iterations),1,16);
  const point=(x,y)=>[projector[0]*x+projector[2]*y+projector[4],projector[1]*x+projector[3]*y+projector[5]];
  const evaluate=(u,v)=>{const lower=u+sign*v,joint=[root[0]+l1*Math.cos(u),root[1]+l1*Math.sin(u)],end=[joint[0]+l2*Math.cos(lower),joint[1]+l2*Math.sin(lower)],projected=point(...end),error=[projected[0]-target[0],projected[1]-target[1]];return {joint,end,projected,error,cost:error[0]**2+error[1]**2};};
  let current=evaluate(a,b),best=current,bestA=a,bestB=b;
  // Well-conditioned projectors admit an exact source-space candidate. It
  // avoids local angle-space traps without inventing reach or changing pole.
  // Rank-deficient/edge-on projections stay entirely on the damped path.
  const detP=projector[0]*projector[3]-projector[1]*projector[2],trace=projector[0]**2+projector[1]**2+projector[2]**2+projector[3]**2,disc=Math.sqrt(Math.max(0,trace*trace-4*detP*detP)),largest=(trace+disc)*.5,smallest=(trace-disc)*.5;
  if(largest>1e-12&&smallest/largest>=.01){
   const tx=target[0]-projector[4],ty=target[1]-projector[5],x=(projector[3]*tx-projector[2]*ty)/detP-root[0],y=(-projector[1]*tx+projector[0]*ty)/detP-root[1],distance=Math.hypot(x,y);
   if(distance>1e-8){const d=clamp(distance,Math.abs(l1-l2)+1e-7,l1+l2-1e-7),u=[x/distance,y/distance],along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along)),jx=u[0]*along+u[1]*height*sign,jy=u[1]*along-u[0]*height*sign,candidateA=Math.atan2(jy,jx),candidateB=clamp(Math.acos(clamp((d*d-l1*l1-l2*l2)/(2*l1*l2),-1,1)),0,maxBend),candidate=evaluate(candidateA,candidateB);
    if(candidate.cost<best.cost){a=bestA=candidateA;b=bestB=candidateB;current=best=candidate;}
   }
  }
  for(let iteration=0;iteration<count;iteration++){
   const lower=a+sign*b,dxA=-l1*Math.sin(a)-l2*Math.sin(lower),dyA=l1*Math.cos(a)+l2*Math.cos(lower),dxB=-sign*l2*Math.sin(lower),dyB=sign*l2*Math.cos(lower);
   const j0=[projector[0]*dxA+projector[2]*dyA,projector[1]*dxA+projector[3]*dyA],j1=[projector[0]*dxB+projector[2]*dyB,projector[1]*dxB+projector[3]*dyB];
   const aa=j0[0]**2+j0[1]**2,bb=j1[0]**2+j1[1]**2,ab=j0[0]*j1[0]+j0[1]*j1[1],damping=Math.max(1e-7,(aa+bb)*1e-4),regularization=Math.max(1e-9,(aa+bb)*1e-8),h0=aa+damping+regularization,h1=bb+damping+regularization,det=h0*h1-ab*ab;
   const g0=j0[0]*current.error[0]+j0[1]*current.error[1]+regularization*wrap(a-a0),g1=j1[0]*current.error[0]+j1[1]*current.error[1]+regularization*(b-bend0);
   let da=clamp((-h1*g0+ab*g1)/det,-.35,.35),db=clamp((ab*g0-h0*g1)/det,-.35,.35),accepted=false;
   for(const scale of [1,.5,.25]){const nextA=a+da*scale,nextB=clamp(b+db*scale,0,maxBend),next=evaluate(nextA,nextB);if(next.cost<current.cost-1e-10){a=nextA;b=nextB;current=next;accepted=true;break;}}
   // A straight limb at an extremum has zero first-order shortening. A tiny,
   // deterministic bend probe escapes that stationary point without a pole flip.
   if(!accepted){for(const offset of [.04,-.04]){const nextB=clamp(b+offset,0,maxBend),next=evaluate(a-sign*(nextB-b)*.5,nextB);if(next.cost<current.cost-1e-10){a-=sign*(nextB-b)*.5;b=nextB;current=next;break;}}}
   if(current.cost<best.cost){best=current;bestA=a;bestB=b;}
  }
  const result=evaluate(bestA,bestB),residual=Math.hypot(...result.error);
  return {chain:[root.slice(),result.joint,result.end],projectedFoot:result.projected,residual,residualVector:result.error,lengths: lengths.slice(),iterations:count,reachable:residual<=tolerance,pole:sign<0?1:-1};
 }
 INK.FootConstraint={solve};
})();
