/* The pre-contact native owner is sampled before combat mutates its state.
 * Rendering, visual transitions and legacy reaction packets are not inputs. */
'use strict';
(()=>{
 const copy=x=>JSON.parse(JSON.stringify(x)),freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
 function capture(f){
  const time=f?._inkVisualClock;
  if(!Number.isInteger(time)||time<0||!INK.HitRulePolicy?.supports(f))return null;
  const world={x:f.x,y:f.y,dir:f.dir===-1?-1:1,scale:f.ch.scale||1};
  let model,frame,owner;
  if(INK.AirStrike?.owns(f)&&f.y===0){
   model=INK.AirStrike.sample(f);if(!model)return null;
   frame={...INK.StrikeModelFrame.build(f,model,{world}),mode:'air-strike'};owner='attack:'+f.attack.combatID;
  }else if(INK.StrikeModel?.owns(f)){
   model=INK.StrikeModel.sample(f);if(!model)return null;
   frame=INK.StrikeModelFrame.build(f,model,{world});owner='attack:'+f.attack.combatID;
  }else if(INK.RulePose?.owns(f)){
   const source=INK.RulePose.sample(f,{time,world});if(!source?.model)return null;
   model=source.model;frame=source.frame;owner=f._inkRuleBody?.owner||'defense:'+f.index+':'+(f._inkContactEpoch||0);
  }else return null;
  const decision=INK.HitRulePolicy.entry(f,frame);if(!decision.ok)return null;
  const carrier=INK.HitRuleBody.capture(model,{world,sourceID:owner,policy:decision.policy});if(!carrier)return null;
  // Keep only the current finite plans. Never retain fighter/attack references
  // or recursively copy presentation history into an episode.
  const trim=plan=>plan?copy({...plan,previous:null}):null;
  // A bounded local derivative of the RULE sampler covers the attacking leg
  // as well as IK reach projection. It never differentiates rendered frames.
  // Root velocity is the completed simulation displacement, not a new push.
  const h=.001,lo=Math.max(0,time-h,time-(f.attack?.t??time)),hi=time+h;
  const rootVelocity=[Number.isFinite(f.px)?f.x-f.px:0,Number.isFinite(f.py)?f.y-f.py:0];
  const at=t=>{const dt=t-time,v=Object.create(f),w={...world,x:world.x+rootVelocity[0]*dt,y:world.y+rootVelocity[1]*dt};v.x=w.x;v.y=w.y;v._inkVisualClock=t;
   if(f.attack){v.attack={...f.attack,t:f.attack.t+dt};const m=INK.AirStrike?.sample(v)||INK.StrikeModel.sample(v);return m?INK.StrikeModelFrame.build(v,m,{world:w}).worldFeet:null;}
   return INK.RulePose.sample(v,{time:t,world:w})?.worldFeet||null;
  };
  const before=at(lo),after=at(hi);if(!before||!after)return null;
  const worldVelocities=Object.fromEntries(['rear','front'].map(k=>[k,after[k].map((v,i)=>(v-before[k][i])/(hi-lo))]));
  if(Object.values(worldVelocities).some(v=>!v.every(Number.isFinite)))return null;
  return freeze({time,epoch:f._inkContactEpoch||0,owner,carrier,worldFeet:copy(frame.worldFeet),worldVelocities,velocityEvidence:'rule-local-difference',velocityStep:h,
   support:{facing:trim(f._inkFacing),strike:trim(f.attack?.airStrikeSupportPlan||f.attack?.strikeSupportPlan),locomotion:trim(f._inkLocomotion)},
   source:{state:f.state,attackID:f.attack?.combatID||null,attackAge:f.attack?.t??null,contactChain:model.contactChain||null}});
 }
 INK.HitRuleSource=Object.freeze({capture});
})();
