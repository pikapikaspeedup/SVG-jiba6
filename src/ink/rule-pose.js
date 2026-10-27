/* Rule-owned neutral/gait sampling. Never reads a displayed frame. */
'use strict';
(()=>{
 const clips=new WeakMap();
 const eligible=f=>!!f&&f.y===0&&!f.attack&&!f.crouch&&!f.jumpPre&&!f.captured&&['idle','dash','rush'].includes(f.state);
 function base(f){const store=INK.Runtime?.store,record=store?.byGame(f.ch.id,'@idle');if(!record)return null;let clip=clips.get(record.clip);if(!clip){clip=new INK.CompiledClip(record.clip);clips.set(record.clip,clip);}return clip.sample(0,INK.basePose);}
 function sample(f,{time=f._inkVisualClock||0,world={x:f.x,y:f.y,dir:f.dir,scale:f.ch.scale||1},bare=false}={}){
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
 INK.RulePose=Object.freeze({eligible,base,sample,capture});
})();
