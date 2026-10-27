/* Bounded normalized vector modes. All arrivals preserve total position and
 * velocity; no contact may directly jump displacement. Fixed nine-slot memory. */
'use strict';
(()=>{
 const channels=Object.freeze(['pelvisTx','pelvisTy','pelvisRoll','pelvisYaw','lumbarRoll','lumbarYaw','chestRoll','chestYaw','neckRoll','neckYaw',...['front','rear'].flatMap(k=>[k+'Upper',k+'Depth',k+'Elbow',k+'Twist']), 'frontUnload','rearUnload']),N=channels.length,D=8;
 const zero=()=>Array(N).fill(0),norm=v=>Math.hypot(...v),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
 const integer=t=>{if(!Number.isInteger(t)||t<0)throw RangeError('Integer action clock required');};
 const freeze=s=>Object.freeze({time:s.time,config:Object.freeze({...s.config}),modes:Object.freeze(s.modes.map(m=>Object.freeze({x:Object.freeze(m.x),v:Object.freeze(m.v)}))),pending:Object.freeze(s.pending.map(p=>p?Object.freeze({at:p.at,values:Object.freeze(p.values)}):null))});
 function create(time=0,{slow=.16,fast=.45,Rs=4,Rf=4,budget=8}={}){integer(time);if(![slow,fast,Rs,Rf,budget].every(v=>Number.isFinite(v)&&v>0))throw TypeError('Positive finite dynamics parameters required');return freeze({time,config:{slow,fast,Rs,Rf,budget},modes:[{x:zero(),v:zero()},{x:zero(),v:zero()}],pending:Array(D+1).fill(null)});}
 function step(m,dt,w){if(!dt)return;const e=Math.exp(-w*dt);if(!e){m.x=zero();m.v=zero();return;}const b=m.v.map((v,i)=>v+w*m.x[i]);m.v=m.v.map((v,i)=>(v-w*b[i]*dt)*e);m.x=m.x.map((x,i)=>(x+b[i]*dt)*e);}
 // Positive endpoint of |b + lambda*j| <= radius. The zero endpoint is
 // already admissible by invariant; both modes use the SAME lambda.
 function allowance(b,j,r){const A=dot(j,j);if(A===0)return 1;const B=2*dot(b,j),C=Math.min(0,dot(b,b)-r*r),disc=Math.max(0,B*B-4*A*C);return Math.max(0,Math.min(1,(-B+Math.sqrt(disc))/(2*A)));}
 function arrive(s,j){const ws=[s.config.slow,s.config.fast],rs=[s.config.Rs,s.config.Rf],b=s.modes.map((m,k)=>m.v.map((v,i)=>v+ws[k]*m.x[i])),negative=j.map(v=>-v),lambda=Math.min(allowance(b[0],j,ws[0]*rs[0]),allowance(b[1],negative,ws[1]*rs[1]));for(let i=0;i<N;i++){s.modes[0].v[i]+=lambda*j[i];s.modes[1].v[i]-=lambda*j[i];}return lambda;}
 function fold(state,time,includeCurrent=true){if(!state||!Number.isFinite(time)||time<state.time)throw RangeError('Sample precedes checkpoint');const s={time,config:state.config,modes:state.modes.map(m=>({x:m.x.slice(),v:m.v.slice()})),pending:state.pending.map(p=>p?{at:p.at,values:p.values.slice()}:null)};let cursor=state.time;for(const p of s.pending.filter(p=>p&&(p.at<time||includeCurrent&&p.at===time)).sort((a,b)=>a.at-b.at)){s.modes.forEach((m,i)=>step(m,p.at-cursor,i?s.config.fast:s.config.slow));arrive(s,p.values);s.pending[p.at%(D+1)]=null;cursor=p.at;}s.modes.forEach((m,i)=>step(m,time-cursor,i?s.config.fast:s.config.slow));return s;}
 function vector(values){return channels.map(k=>{const v=values?.[k]??0;if(!Number.isFinite(v))throw TypeError('Finite normalized impulse required');return v;});}
 function commit(state,drives,now){integer(now);const s=fold(state||create(now),now,false),buckets=Array.from({length:D+1},()=>Array.from({length:N},()=>[]));
  for(const drive of Array.isArray(drives)?drives:[drives]){if(!drive)continue;if(drive.direct&&Object.values(drive.direct).some(v=>v!==0))throw TypeError('Position jumps are forbidden');for(const stage of drive.delayed||[]){if(!Number.isInteger(stage.delay)||stage.delay<0||stage.delay>D)throw RangeError('Delay must be 0..8');vector(stage.values).forEach((v,i)=>buckets[stage.delay][i].push(v));}}
  // Sort before summing so event permutation cannot alter saturation rounding.
  const sums=buckets.map(row=>row.map(values=>values.sort((a,b)=>Math.abs(a)-Math.abs(b)||a-b).reduce((a,b)=>a+b,0))),total=sums.reduce((n,v)=>n+norm(v),0),scale=total>s.config.budget?s.config.budget/total:1;
  const arrival=s.pending[now%(D+1)];if(arrival&&arrival.at!==now)throw Error('Delay ring collision');if(arrival)s.pending[now%(D+1)]=null;
  const immediate=sums[0].map((v,i)=>v*scale+(arrival?.values[i]||0));if(immediate.some(Boolean))arrive(s,immediate);
  const oldPending=s.pending.reduce((n,p)=>n+(p?norm(p.values):0),0),newPending=sums.slice(1).reduce((n,v)=>n+norm(v)*scale,0),futureScale=newPending?Math.min(1,Math.max(0,s.config.budget-oldPending)/newPending):1;
  for(let delay=1;delay<=D;delay++){const values=sums[delay].map(v=>v*scale*futureScale);if(!values.some(Boolean))continue;const at=now+delay,index=at%(D+1),old=s.pending[index];if(old&&old.at!==at)throw Error('Delay ring collision');s.pending[index]={at,values:values.map((v,i)=>v+(old?.values[i]||0))};}return freeze(s);
 }
 function advance(state,time){return freeze(fold(state,time));}
 function sample(state,time){const s=fold(state,time),q=channels.map((k,i)=>s.modes[0].x[i]+s.modes[1].x[i]),v=channels.map((k,i)=>s.modes[0].v[i]+s.modes[1].v[i]),d=Math.sqrt(1+dot(q,q)),projection=dot(q,v);return Object.freeze({value:Object.freeze(Object.fromEntries(channels.map((k,i)=>[k,q[i]/d]))),velocity:Object.freeze(Object.fromEntries(channels.map((k,i)=>[k,v[i]/d-q[i]*projection/(d*d*d)])))});}

 INK.HitRuleDynamics=Object.freeze({channels,create,commit,advance,sample});
})();
