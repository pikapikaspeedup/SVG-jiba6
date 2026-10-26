/* Conservative delayed-observation estimates, never grants a collision. */
'use strict';
(() => {
 const box=b=>b&&['x','y','w','h'].every(k=>Number.isFinite(b[k]))&&b.w>0&&b.h>0;
 function candidates(f,obs,G,choices,options={}){
  const remaining=options.remaining,speed=f?.ch?.speed,dir=f?.dir<0?-1:1;
  if(!f||f.y!==0||f.state!=='idle'||f.attack||f.captured||f.jumpPre||f.airLock||f.landT>0||!obs||obs.y!==0||!Number.isFinite(remaining)||remaining<=0||!Number.isFinite(speed)||speed<=0||!Number.isFinite(f.x))return [];
  const maxWalk=Math.min(6,Math.max(0,Math.floor(Number.isFinite(options.maxWalk)?options.maxWalk:6))),reserve=Math.max(0,Number.isFinite(options.reserve)?options.reserve:3),u=Math.max(0,Number.isFinite(options.uncertainty)?options.uncertainty:8);
  const hurt=(obs.hurt||[]).filter(box).map(b=>({lo:dir>0?b.x+u:-(b.x+b.w-u),hi:dir>0?b.x+b.w-u:-(b.x+u),top:b.y+u,bottom:b.y+b.h-u})).filter(b=>b.hi>b.lo&&b.bottom>b.top);
  if(!hurt.length)return [];
  const out=[];
  for(const choice of choices||[]){const m=choice?.move,r=choice?.reach;if(!m||!r||r.space!=='root-local-world-units'||m.category!=='normal'||m.air||m.throw||!['s','c'].includes(m.normalState)||m.travel||m.movementStrike||String(m.kind).includes('projectile'))continue;
   let best=null;
   for(const sample of r.frames||[]){if(!Number.isFinite(sample.t)||sample.t<m.startup||sample.t>=m.startup+m.active)continue;
    for(const hit of (sample.hit||[]).filter(box)){const lo=dir*f.x+hit.x,hi=lo+hit.w,top=(Number.isFinite(r.floor)?r.floor:665)+f.y+hit.y,bottom=top+hit.h;
     for(const target of hurt){if(Math.min(bottom,target.bottom)<=Math.max(top,target.top))continue;
      const gap=Math.max(0,target.lo-hi),walkFrames=Math.ceil(gap/speed),travel=walkFrames*speed;
      if(walkFrames>maxWalk||hi+travel<target.lo||lo+travel>=target.hi)continue;
      const impactFrame=walkFrames+sample.t,margin=remaining-impactFrame-reserve;if(margin<0)continue;
      const candidate={move:m,walkFrames,impactFrame,margin,gap};if(!best||impactFrame<best.impactFrame||impactFrame===best.impactFrame&&walkFrames<best.walkFrames)best=candidate;
     }
    }
   }
   if(best)out.push(best);
  }
  return out.sort((a,b)=>a.impactFrame-b.impactFrame||a.walkFrames-b.walkFrames);
 }
 INK.DuelWindow=Object.freeze({candidates});
})();
