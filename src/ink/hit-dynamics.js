/* Fixed-dimensional contact memory. Action commits are integer; samples are pure. */
'use strict';
(() => {
 const channels=Object.freeze(['head','headYaw','chest','chestYaw','pelvis','pelvisYaw','lean','bob',...['fw','rw','fe','re','fa','ra'].flatMap(k=>[k+'X',k+'Y'])]);
 const D=8,N=channels.length,slow=.16,fast=.45,limits=Object.freeze(channels.map(k=>k.length===3&&/[XY]$/.test(k)?18:22));
 const rules=Object.freeze({delay:D,slots:D+1,slow,fast,directBudget:12,impulseBudget:8});
 const zero=()=>Array(N).fill(0),integer=t=>{if(!Number.isInteger(t)||t<0)throw RangeError('Contact commit time must be a nonnegative integer action frame');};
 const freeze=s=>Object.freeze({time:s.time,modes:Object.freeze(s.modes.map(q=>Object.freeze(q))),pending:Object.freeze(s.pending.map(q=>q?Object.freeze({at:q.at,values:Object.freeze(q.values)}):null))});
 function create(time=0){integer(time);return freeze({time,modes:Array.from({length:N},()=>[0,0,0,0]),pending:Array(D+1).fill(null)});}
 function advanceMode(x,v,dt,w){const c=v+w*x,e=Math.exp(-w*dt);return [(x+c*dt)*e,(v-w*c*dt)*e];}
 function advance(modes,dt){if(!dt)return;for(const q of modes){const a=advanceMode(q[0],q[1],dt,slow),b=advanceMode(q[2],q[3],dt,fast);q.splice(0,4,...a,...b);}}
 function fold(state,time){
  if(!Number.isFinite(time)||time<state.time)throw RangeError('Dynamics sample precedes its immutable checkpoint');
  const modes=state.modes.map(q=>q.slice()),pending=state.pending.map(q=>q?{at:q.at,values:q.values.slice()}:null);let cursor=state.time;
  const arrivals=pending.filter(q=>q&&q.at<=time).sort((a,b)=>a.at-b.at);
  for(const q of arrivals){advance(modes,q.at-cursor);for(let i=0;i<N;i++){modes[i][1]+=q.values[i];modes[i][3]-=q.values[i];}cursor=q.at;pending[q.at%(D+1)]=null;}
  advance(modes,time-cursor);return {time,modes,pending};
 }
 function vector(values){const out=zero();for(let i=0;i<N;i++){const value=values?.[channels[i]]??0;if(!Number.isFinite(value))throw TypeError('Contact drive must be finite');out[i]=value;}return out;}
 function commit(state,drives,now){
  integer(now);const next=fold(state||create(now),now),direct=zero(),delayed=Array.from({length:D+1},zero);
  for(const drive of Array.isArray(drives)?drives:[drives]){if(!drive)continue;const v=vector(drive.direct);for(let i=0;i<N;i++)direct[i]+=v[i];for(const stage of drive.delayed||[]){if(!Number.isInteger(stage.delay)||stage.delay<0||stage.delay>D)throw RangeError('Contact delay must be an integer from 0 to 8');const a=vector(stage.values);for(let i=0;i<N;i++)delayed[stage.delay][i]+=a[i];}}
  for(let i=0;i<N;i++)next.modes[i][0]+=Math.max(-rules.directBudget,Math.min(rules.directBudget,direct[i]));
  // Budget only the new batch, jointly across delays. Existing pending memory
  // is never shrunk to make room for a fourth or later contact.
  for(let i=0;i<N;i++){const total=delayed.reduce((sum,a)=>sum+Math.abs(a[i]),0),scale=total>rules.impulseBudget?rules.impulseBudget/total:1;for(const a of delayed)a[i]*=scale;}
  for(let delay=0;delay<=D;delay++){const values=delayed[delay];if(!values.some(Boolean))continue;if(delay===0){for(let i=0;i<N;i++){next.modes[i][1]+=values[i];next.modes[i][3]-=values[i];}continue;}const at=now+delay,index=at%(D+1),old=next.pending[index];if(old&&old.at!==at)throw Error('Delay ring collision');next.pending[index]={at,values:values.map((v,i)=>v+(old?.values[i]||0))};}
  return freeze(next);
 }
 function sample(state,time){const q=fold(state,time);return Object.fromEntries(channels.map((k,i)=>[k,limits[i]*Math.tanh((q.modes[i][0]+q.modes[i][2])/limits[i])]));}
 INK.HitDynamics={channels,rules,create,commit,sample,advanceMode};
})();
