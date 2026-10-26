/* Action-clock carry on a deliberately forward dash-to-normal commitment. */
'use strict';
(() => {
 const settings={enabled:true},rules=Object.freeze({maxCarry:18,maxFrames:5,minSpeed:.5});
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function prepare(f,m,context={}){
  const speed=(context.velocity??f.vx)*f.dir;
  if(!settings.enabled||!m||m.movementStrike||!['dash','rush'].includes(f.state)||f.attack||f.y!==0||f.airLock||f.captured||f.crouch||f.jumpPre||!context.forward||context.backward||context.cancel||context.chain||m.category!=='normal'||m.normalState!=='s'||m.air||m.throw||m.travel||!Number.isFinite(speed)||speed<=rules.minSpeed)return m;
  const level=clamp(m.level||1,1,3),kick=m.pose==='kick'||m.contactPart==='foot',budget=Math.min(rules.maxCarry,speed*(1.35+level*.3)*(kick?.88:1)),frames=Math.min(rules.maxFrames,Math.max(1,Math.floor(m.startup)-1)),penalty=level===3?3:2;
  const metadata=Object.freeze({dir:f.dir<0?-1:1,budget,frames,penalty,source:f.state});
  return {...m,recovery:m.recovery+penalty,total:m.total+penalty,movementStrike:metadata};
 }
 function clear(f){f._inkMovementStrike=null;}
 function commit(f,G){
  clear(f);const a=f.attack,q=a?.m.movementStrike;if(!settings.enabled||!q||f.state!=='attack')return false;
  f._inkMovementStrike={attack:a,dir:q.dir,budget:q.budget,remaining:q.budget,frames:q.frames,age:0,lastTick:G.actionTick,spent:0};return true;
 }
 function step(f,G,context={}){
  const q=f._inkMovementStrike;if(!q)return 0;
  if(!settings.enabled||f.attack!==q.attack||f.state!=='attack'||f.y!==0||f.airLock||f.captured){clear(f);return 0;}
  if(G.hitstop>0||G.paused&&!context.actionable||q.lastTick===G.actionTick)return 0;
  q.lastTick=G.actionTick;
  if(f.attack.t>=f.attack.m.startup||q.age>=q.frames){q.remaining=0;return 0;}
  // Front-loaded finite budget; a wall consumes the scheduled portion too.
  // No measurement of displacement can replenish it or cause a later launch.
  const n=q.frames,weight=(n-q.age)/(n*(n+1)/2),amount=Math.min(q.remaining,q.budget*weight);
  q.age++;q.remaining=Math.max(0,q.remaining-amount);q.spent+=amount;return amount*q.dir;
 }
 INK.MovementStrike={settings,rules,prepare,commit,step,clear};
})();
