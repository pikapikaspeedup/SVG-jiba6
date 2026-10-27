/* A finite grounded preparation inside the existing jumpPre window. The
 * ground owner still supplies feet and collision; this never delays takeoff. */
'use strict';
(()=>{
 const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;},copy=x=>JSON.parse(JSON.stringify(x));
 function begin(f){
  const amount=INK.AirBodyData?.preparation?.[f.ch.id];if(!Number.isFinite(amount)||INK.AirBodyPolicy?.evaluate(f).mode!=='native'||!INK.RulePose?.owns(f))return null;
  const sample=INK.RulePose.sample(f);if(!sample?.model)return null;
  return f._inkAirPrep=freeze({model:copy(sample.model),dir:f.dir,born:f._inkVisualClock||0,amount,policy:INK.AirBodyPolicy.evaluate(f).fingerprint});
 }
 function apply(f,model,time){
  const q=f._inkAirPrep;if(!q||f.y!==0||f.state!=='idle'||f.attack||f.dir!==q.dir||time<q.born||time>q.born+4||INK.AirBodyPolicy?.evaluate(f).fingerprint!==q.policy)return model;
  const entry=INK.AirStrikeSpace.entry(model);if(!entry)return model;
  const target=INK.DefenseBody.solve(model.profile,{...model.pose,bob:(model.pose.bob||0)+q.amount},entry.targets,{bodyX:entry.bodyX,poles:entry.poles,supportWeights:{front:1,rear:1}});
  return INK.HitRuleHandoff.apply(target,{model:q.model,dir:q.dir},{age:time-q.born,duration:3,dir:q.dir});
 }
 function release(f){f._inkAirPrep=null;}
 INK.AirPreparation=Object.freeze({begin,apply,release});
})();
