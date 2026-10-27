/* Fixed-size analytical critical damping. Contact commits velocity for the next
 * interval; evaluation is pure and never rewrites an already sampled body. */
'use strict';
(()=>{
 const omega=Object.freeze({arm:.55,body:.32}),keys=['arm','body'];
 const vec=a=>Array.isArray(a)&&a.length===2&&a.every(Number.isFinite);
 const frozen=s=>Object.freeze({time:s.time,...Object.fromEntries(keys.map(k=>[k,Object.freeze({z:Object.freeze(s[k].z.slice()),v:Object.freeze(s[k].v.slice())})]))});
 const valid=s=>s&&Number.isFinite(s.time)&&keys.every(k=>vec(s[k]?.z)&&vec(s[k]?.v));
 function create(time=0){return Number.isFinite(time)?frozen({time,arm:{z:[0,0],v:[0,0]},body:{z:[0,0],v:[0,0]}}):null;}
 function advance(state,time){
  if(!valid(state)||!Number.isFinite(time)||time<state.time)return null;
  const dt=time-state.time,out={time};
  for(const k of keys){const a=state[k],w=omega[k],decay=Math.exp(-w*dt),b=a.v.map((v,i)=>v+w*a.z[i]);
   out[k]=decay===0?{z:[0,0],v:[0,0]}:{z:a.z.map((z,i)=>(z+b[i]*dt)*decay),v:a.v.map((v,i)=>(v-w*b[i]*dt)*decay)};
  }
  return valid(out)?frozen(out):null;
 }
 function sample(state,time=state?.time){return advance(state,time);}
 function commit(old,time,impulse){
  const state=advance(old,time);if(!state||!keys.every(k=>vec(impulse?.[k])))return null;
  const out={time};for(const k of keys){const a=state[k],w=omega[k],sum=a.v.map((v,i)=>v+impulse[k][i]+w*a.z[i]),length=Math.hypot(...sum),scale=length>w?w/length:1;
   out[k]={z:a.z,v:sum.map((v,i)=>v*scale-w*a.z[i])};
  }
  return frozen(out);
 }
 INK.DefensePressure=Object.freeze({omega,create,advance,sample,commit});
})();
