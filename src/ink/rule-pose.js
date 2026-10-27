/* Rule-owned neutral/gait sampling. Never reads a displayed frame. */
'use strict';
(()=>{
 const clips=new WeakMap();
 const eligible=f=>INK.RuleBody?.owns(f)||!!f&&!INK.DefenseData?.[f.ch?.id]&&f.y===0&&!f.attack&&!f.crouch&&!f.jumpPre&&!f.captured&&['idle','dash','rush'].includes(f.state);
 function base(f){const store=INK.Runtime?.store,record=store?.byGame(f.ch.id,'@idle');if(!record)return null;let clip=clips.get(record.clip);if(!clip){clip=new INK.CompiledClip(record.clip);clips.set(record.clip,clip);}return clip.sample(0,INK.basePose);}
 function sample(f,{time=f._inkVisualClock||0,world={x:f.x,y:f.y,dir:f.dir,scale:f.ch.scale||1},bare=false}={}){
  const native=INK.RuleBody?.sample(f,{time,world,bare});if(native)return native;
  if(!eligible(f))return null;const p=base(f);if(!p)return null;
  const view=Object.create(f);view._inkRawVisual=false;view._inkJointTransition=null;view._inkFrameTransition=null;
  if(bare){view._inkLocomotion=null;view._inkSupport=null;}
  const gait=bare?null:INK.Locomotion?.sample(view,time,world),profile=INK.BodySupport?.profiles[f.ch.id];
  if(gait){p.lean=(p.lean||0)+gait.body.lean;p.bob=(p.bob||0)+gait.body.bob*(profile?.load||1);p.pelvisYaw=(p.pelvisYaw||0)+gait.body.pelvisYaw;}
  const facing=INK.FacingMotion?.sample(view,time,world),frame=INK.VisualFrame.build(view,p,{world,time,facing});
  return {pose:p,frame,worldFeet:frame.worldFeet,heading:facing?.heading??(f.dir<0?Math.PI:0),time};
 }
 function capture(f,options){const sampled=sample(f,options);if(!sampled)return null;
  // Copy the complete owned frame, including nonenumerable rig metadata, before
  // freezing; never freeze the shared Runtime profile or a live fighter plan.
  const clone=x=>JSON.parse(JSON.stringify(x)),frame=clone(sampled.frame);Object.defineProperties(frame.rig,{profile:{value:clone(sampled.frame.rig.profile)},anatomy:{value:clone(sampled.frame.rig.anatomy)}});frame.legacyRig=frame.rig;
  const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};freeze(frame.rig.profile);freeze(frame.rig.anatomy);
  return freeze({...sampled,pose:clone(sampled.pose),frame,worldFeet:frame.worldFeet});
 }
 function returnSeed(f){
  if(!INK.DefenseData?.[f.ch.id]||INK.DefensePolicy?.evaluate(f).mode!=='native')return null;
  const canonicalRest=INK.RuleBody.target(f,'stance');
  const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
  return freeze({character:f.ch.id,dir:f.dir,scale:f.ch.scale||1,policy:INK.DefensePolicy.evaluate(f).fingerprint,canonicalRest,rootLocalFeet:canonicalRest.feet});
 }
 function restFrame(f,seed=f._inkRuleReturnSeed){
  if(!seed||seed.character!==f.ch.id||INK.DefensePolicy?.evaluate(f).fingerprint!==seed.policy)return null;
  const view=Object.create(f);Object.assign(view,{state:'idle',attack:null,y:0,dir:seed.dir,crouch:false,aiGuard:false,jumpPre:0,captured:false,throwAction:null,airLock:false,input:{dir:5},_inkRuleBody:null,_inkRulePressure:null,_inkLocomotion:null,_inkFacing:null,_inkSupport:null});
  return INK.RuleBody?.sample(view,{time:f._inkVisualClock||0,bare:true,restParams:seed.canonicalRest,world:{x:f.x,y:0,dir:seed.dir,scale:seed.scale}})||null;
 }
 // Edited defense clips may still precede an original native attack. Its rule
 // entry samples the saved combat clip directly, never a display switch/bridge.
 function compatibility(f){
  const store=INK.Runtime?.store;if(!store)return null;const key=f.attack?null:INK.State.id(f)||'idle',record=f.attack?store.byGame(f.ch.id,f.attack.m.id):store.byGame(f.ch.id,'@'+key);if(!record)return null;
  const time=f.attack?INK.Runtime.clipFrame(record,f.attack.m,f.attack.t):key==='idle'?(f._inkVisualClock||0)%record.clip.duration:INK.State.frame(f,record,key),pose=store.clip(record).sample(time,INK.basePose),profile=store.profile(f.ch.id);
  delete pose.rootX;delete pose.rootY;pose.floor=pose.floor||0;pose.reachScale=1;pose.depth=1;
  return {pose,rig:(INK.Rig.solveCombat||INK.Rig.solveAnimation)(profile,pose)};
 }
 INK.CompatibilityRulePose=Object.freeze({sample:compatibility});
 INK.RulePose=Object.freeze({eligible,base,sample,capture,returnSeed,restFrame,owns:f=>!!INK.RuleBody?.owns(f),prepare:(...args)=>INK.RuleBody?.prepare(...args),geometry:f=>INK.RuleBody?.geometry(f),between:(...args)=>INK.RuleBody?.between(...args),queueContact:(...args)=>INK.RuleBody?.queueContact(...args),settle:f=>INK.RuleBody?.settle(f),reset:f=>{f._inkRuleReturnSeed=null;return INK.RuleBody?.reset(f);},continuous:(...args)=>!!INK.RuleBody?.continuous(...args)});
})();
