/* World-space finite hit-foot plans. No support policy or fighter mutation. */
'use strict';
(()=>{
 const keys=['rear','front'],vec=q=>Array.isArray(q)&&q.length===3&&q.every(Number.isFinite);
 const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
 function timeOK(time){if(!Number.isFinite(time))throw TypeError('Finite foot clock required');}
 function create(time,feet){timeOK(time);const out={};for(const key of keys){const f=feet?.[key];if(!vec(f?.point)||!vec(f?.velocity))throw TypeError('Known XYZ point and velocity required');out[key]={start:time,point:f.point.slice(),velocity:f.velocity.slice(),previous:null};}return freeze({time,feet:out});}
 function evaluate(f,time){if(time<f.start){if(!f.previous)return null;return evaluate(f.previous,time);}if(!f.to){const moving=f.velocity.some(v=>v!==0);if(moving&&time>f.start)return null;return {point:f.point.slice(),velocity:f.velocity.slice(),phase:moving?'unplanned':'planted'};}
  if(time>=f.start+f.duration)return {point:f.to.slice(),velocity:[0,0,0],phase:'landed'};
  const u=(time-f.start)/f.duration,h=u*u*(3-2*u),g=u*(1-u)*(1-u),wave=Math.sin(Math.PI*u)**2,d=6*u*(1-u)/f.duration,dg=1-4*u+3*u*u,dw=Math.PI*Math.sin(2*Math.PI*u)/f.duration;
  return {point:f.point.map((v,i)=>v+(f.to[i]-v)*h+f.velocity[i]*f.duration*g+(i===1?-f.height*wave:i===2?f.arc*wave:0)),velocity:f.point.map((v,i)=>(f.to[i]-v)*d+f.velocity[i]*dg+(i===1?-f.height*dw:i===2?f.arc*dw:0)),phase:'swing'};
 }
 function sample(plan,time){timeOK(time);if(!plan?.feet)return null;const out={};for(const key of keys){out[key]=evaluate(plan.feet[key],time);if(!out[key])return null;}return out;}
 function retarget(plan,key,time,{to,duration,height=0,arc=0}={}){timeOK(time);if(!keys.includes(key)||!vec(to)||!Number.isFinite(duration)||duration<=0||!Number.isFinite(height)||!Number.isFinite(arc))throw TypeError('Finite target and positive duration required');const old=plan?.feet?.[key];if(!old)throw TypeError('Foot plan required');if(time<old.start)throw RangeError('Cannot rewrite committed foot history');const current=evaluate(old,time);if(!current)throw RangeError('Foot boundary unavailable');const previous={...old,previous:null},foot={start:time,point:current.point,velocity:current.velocity,to:to.slice(),duration,height,arc,previous};return freeze({time,feet:{...plan.feet,[key]:foot}});}
 INK.HitRuleFeet=Object.freeze({create,retarget,sample});
})();
