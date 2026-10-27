/* Shared ground-body implementation behind RulePose. Only commit functions
 * replace plans; sampling never reads a rendered pose or writes fighter state. */
'use strict';
(()=>{
 const chains=['rearArm','frontArm','rearLeg','frontLeg'],states=['idle','dash','rush','block','parry','recovery'],rad=Math.PI/180;
 const copy=x=>JSON.parse(JSON.stringify(x)),freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
 const blend=(a,b,u)=>typeof a==='number'&&typeof b==='number'?a+(b-a)*u:Array.isArray(b)?b.map((v,i)=>blend(a?.[i]??v,v,u)):b&&typeof b==='object'?Object.fromEntries(Object.entries(b).map(([k,v])=>[k,blend(a?.[k]??v,v,u)])):b;
 const rotate=(q,yaw,roll=0)=>{const c=Math.cos(yaw),s=Math.sin(yaw),x=q[0]*c+q[2]*s;return[x*Math.cos(roll)-q[1]*Math.sin(roll),x*Math.sin(roll)+q[1]*Math.cos(roll),-q[0]*s+q[2]*c];};
 const profiles=new Map();let serial=0;
 function owns(f){return !!(f&&INK.DefenseData?.[f.ch?.id]&&f.y===0&&!f.attack&&!f.captured&&!f.throwAction&&!f.airLock&&states.includes(f.state)&&INK.DefensePolicy?.evaluate(f).mode==='native');}
 function profile(f){const id=f.ch.id;if(!profiles.has(id)){const b=INK.DefensePolicy.baseline(id),r=b.rig;profiles.set(id,freeze(copy({...INK.assets.byID[id],...b.model,id,rigLengths:r.lengths.slice(),rigRearShoulder:r.rearShoulder.slice(),rigFrontShoulder:r.frontShoulder.slice(),rigHipWidth:r.hipWidth,rigHeadOffset:r.headOffset.slice()})));}return profiles.get(id);}
 function mode(f){if(f.state==='parry')return 'parry';if(['dash','rush'].includes(f.state)||f.jumpPre)return 'stance';const dir=f.intentDir||f.dir,back=dir<0?[3,6,9]:[1,4,7],guard=f.state==='block'||f.aiGuard||back.includes(f.input?.dir);return guard?(f.crouch?'low':'high'):f.crouch?'crouch':'stance';}
 function target(f,kind=mode(f)){return copy(INK.DefenseData[f.ch.id][kind]);}
 const quint=x=>{x=clamp(x);return x*x*x*(10+x*(-15+6*x));};
 function curve(plan,time){if(!plan)return {value:0,velocity:0};const t=Math.max(0,time-plan.start);
  if(t<plan.brake&&plan.brake>0)return {value:plan.value+plan.velocity*t-plan.velocity*t*t/(2*plan.brake),velocity:plan.velocity*(1-t/plan.brake)};
  const u=clamp((t-plan.brake)/plan.duration),delta=plan.target-plan.stop;return {value:plan.stop+delta*quint(u),velocity:delta*30*u*u*(1-u)*(1-u)/plan.duration};
 }
 function retarget(old,time,target,base){if(old&&old.target===target)return old;const q=old?curve(old,time):{value:target,velocity:0},margin=q.velocity>0?1-q.value:q.value,brake=Math.abs(q.velocity)<1e-12?0:Math.min(.75,2*Math.max(0,margin)/Math.abs(q.velocity)),stop=clamp(q.value+.5*q.velocity*brake);
  return {start:time,value:q.value,velocity:q.velocity,brake,stop,target,duration:Math.max(.5,base*Math.sqrt(Math.abs(target-stop)))};
 }
 function values(plan,time){return Object.fromEntries(Object.entries(plan.curves).map(([k,v])=>[k,curve(v,time).value]));}
 function composite(id,q){const d=INK.DefenseData[id],S=d.stance,C=d.crouch,H=d.high,L=d.low,P=d.parry;
  const out=blend(blend(S,C,q.crouch),blend(H,L,q.crouch),q.guard),parry=copy(P);
  for(const k of Object.keys(P.body))parry.body[k]=P.body[k]+q.crouch*((C.body[k]||0)-(S.body[k]||0));
  const result=blend(out,parry,q.parry),hands=blend(blend(S.wrists,C.wrists,q.handLow),blend(H.wrists,L.wrists,q.handLow),q.guard);
  result.wrists=blend(hands,P.wrists,q.parry);return result;
 }
 function at(plan,time){if(!plan)return null;const out=composite(plan.character,values(plan,time));if(!plan.entry)return out;return blend(plan.entry,out,quint((time-(plan.entryStart??plan.start))/4));}
 function fromFrame(frame,dir){const entry=INK.DefenseBody.fromFrame(frame,{dir});if(!entry)return null;const p=entry.pose,yaw=(p.yaw||0)*rad,lean=(p.lean||0)*rad,twist=(p.twist||0)*rad,convert=q=>[q[0]*dir,q[1],q[2]*dir],chest=convert(frame.joints3D.chest),offset=rotate(rotate([0,3,0],twist,lean),yaw),center=chest.map((q,i)=>q-offset[i]);
  const relative=q=>rotate(rotate(rotate(q.map((v,i)=>v-center[i]),-yaw),0,-lean),-twist);
  return {body:{bodyX:entry.bodyX,bob:p.bob||0,lean:p.lean||0,yaw:p.yaw||0,twist:p.twist||0,head:p.head||0,headYaw:p.headYaw||0},wrists:{front:relative(entry.targets.frontArm),rear:relative(entry.targets.rearArm)},feet:{front:entry.targets.frontLeg,rear:entry.targets.rearLeg},poles:Object.fromEntries(chains.map(n=>[n,n.endsWith('Arm')?rotate(rotate(rotate(entry.poles[n],-yaw),0,-lean),-twist):rotate(entry.poles[n],-yaw)])),hands:{front:p.handFront||'fist',rear:p.handRear||'fist'},fan:p.fan??.7,fanAngle:p.fanAngle||0};
 }
 function prepare(f,{entry=null,hitHandoff=null}={}){
  if(!owns(f)){f._inkRuleBody=null;f._inkRulePressure=null;f._inkRuleImpulse=null;return null;}
  const time=f._inkVisualClock||0,kind=mode(f),policy=INK.DefensePolicy.evaluate(f),old=f._inkRuleBody,sameContent=old&&old.policy.fingerprint===policy.fingerprint&&old.policy.revision===policy.revision;
  const logicalLow=kind==='low'||kind==='crouch'||kind==='parry'&&!!f.crouch,goals={crouch:logicalLow?1:0,guard:kind==='high'||kind==='low'?1:0,parry:kind==='parry'?1:0,handLow:logicalLow?1:0};
  if(sameContent&&old.dir===f.dir&&!entry&&!hitHandoff&&Object.entries(goals).every(([k,v])=>old.curves[k].target===v))return old;
  const curves={};for(const [k,v]of Object.entries(goals))curves[k]=retarget(sameContent?old.curves[k]:null,time,v,k==='crouch'?(v?4:5):k==='handLow'?2:v?2:3);
  const captured=entry?fromFrame(entry,f.dir):null;
  if(captured){const facing=INK.FacingMotion?.sample(f,time,{x:f.x,y:f.y,dir:f.dir,scale:f.ch.scale||1}),heading=facing?(f.dir<0?180-facing.pelvis/rad:facing.pelvis/rad):0;captured.body.yaw-=heading;if(facing){const sign=f.dir<0?-1:1;captured.body.twist-=sign*(facing.chest-facing.pelvis)/rad;captured.body.headYaw-=sign*(facing.head-facing.pelvis)/rad;}for(const key of ['rear','front'])captured.feet[key]=rotate(captured.feet[key],-heading*rad);}
  f._inkRuleBody=freeze({owner:sameContent?old.owner:'body:'+f.index+':'+(++serial),character:f.ch.id,policy,kind,logicalLow,dir:f.dir,start:time,curves,hitHandoff:hitHandoff||(sameContent?old.hitHandoff:null),handoffStart:hitHandoff?time:old?.handoffStart,entry:captured||(sameContent?old.entry:null),entryStart:captured?time:sameContent?old.entryStart:time});return f._inkRuleBody;
 }
 function sample(f,{time=f._inkVisualClock||0,world={x:f.x,y:f.y,dir:f.dir,scale:f.renderScale||f.ch.scale||1},bare=false,restParams=null}={}){
  if(!owns(f))return null;
  world={x:f.x,y:f.y,dir:f.dir,scale:f.renderScale||f.ch.scale||1,...world};
  const plan=f._inkRuleBody,params=bare?(restParams?copy(restParams):target(f)):plan?at(plan,time):target(f),p={...INK.copy(INK.basePose),...params.body,handFront:params.hands?.front,handRear:params.hands?.rear,fan:params.fan,fanAngle:params.fanAngle};
  const gait=bare?null:INK.Locomotion?.sample(f,time,world),facing=bare?null:INK.FacingMotion?.sample(f,time,world),direction=world.dir??f.dir,sign=direction<0?-1:1,heading=facing?(direction<0?180-facing.pelvis/rad:facing.pelvis/rad):0;
  p.yaw=(p.yaw||0)+heading;if(gait){p.bob=(p.bob||0)+gait.body.bob;p.lean=(p.lean||0)+gait.body.lean*sign;}
  if(facing){p.twist=(p.twist||0)+sign*(facing.chest-facing.pelvis)/rad;p.headYaw=(p.headYaw||0)+sign*(facing.head-facing.pelvis)/rad;}
  const pressure=!bare&&f._inkRulePressure?INK.DefensePressure?.sample(f._inkRulePressure,time):null,bz=pressure?.body?.z||[0,0],az=pressure?.arm?.z||[0,0];
  p.bodyX=(p.bodyX||0)+2*bz[0]*sign;p.lean=(p.lean||0)+2*bz[0]*sign;p.bob=(p.bob||0)+2*bz[1];
  const targets={rearArm:[0,0,0],frontArm:[0,0,0],rearLeg:rotate(params.feet.rear,heading*rad),frontLeg:rotate(params.feet.front,heading*rad)},poles=Object.fromEntries(chains.map(n=>[n,INK.DefenseData[f.ch.id].poleSpace==='body-local'?rotate(n.endsWith('Arm')?rotate(params.poles[n],(p.twist||0)*rad,(p.lean||0)*rad):params.poles[n],(p.yaw||0)*rad):rotate(params.poles[n],heading*rad)])),feet={},supportWeights={},groundedFeet={};
  for(const key of ['rear','front']){const turn=facing?.ownsFeet?facing.feet[key]?.targetWorld:null,gaitFoot=gait?.feet3D?.[key],settled=f._inkSupport?.handoff?.feet?.[key];let foot=turn||gaitFoot||(!bare&&settled);if(foot){foot=foot.slice();if(foot.length<3)foot.push(targets[key+'Leg'][2]*world.scale*direction);if(!turn&&gaitFoot&&settled){const u=gait.blend??1;foot=foot.map((v,i)=>(settled[i]??v)+(v-(settled[i]??v))*u);}feet[key]=foot;}const load=key==='front'?(params.frontLoad??.5):1-(params.frontLoad??.5),weight=turn?(facing.feet[key]?.weight??0):gait?(gait.weights?.[key]??0):1;groundedFeet[key]=foot?Math.abs(foot[1]-(665+world.y-16*world.scale))<2*world.scale:Math.abs(targets[key+'Leg'][1]+16)<2;supportWeights[key]=groundedFeet[key]?weight*load:0;}
  const wristOffset=rotate(rotate(rotate([az[0]*sign,az[1],0],-(p.yaw||0)*rad),0,-(p.lean||0)*rad),-(p.twist||0)*rad),yieldDistance=INK.DefenseData[f.ch.id].armYield||6,wrists={};for(const key of ['rear','front'])wrists[key]=params.wrists[key].map((v,i)=>v+wristOffset[i]*yieldDistance*(key==='rear'?.35:1));
  let model=INK.DefenseBody.solve(profile(f),p,targets,{bodyX:p.bodyX,poles,supportWeights,groundedFeet,guardRelative:wrists.rear,frontGuardRelative:wrists.front,...(!bare&&feet.rear&&feet.front?{worldFeet:feet,world}:{} )});
  if(!bare&&plan?.hitHandoff)model=INK.HitRuleHandoff.apply(model,plan.hitHandoff,{age:time-plan.handoffStart,duration:4,dir:world.dir});
  if(!bare)model=INK.AirPreparation?.apply(f,model,time)||model;
  for(const n of chains){const key=(n.startsWith('rear')?'r':'f')+(n.endsWith('Leg')?'a':'w');model.pose[key]=model.chains[n][2].slice();}
  const frame=INK.DefenseBody.frame(f,model,{world});return {pose:model.pose,model,frame,worldFeet:frame.worldFeet,heading:facing?.heading??(f.dir<0?Math.PI:0),time,kind:plan?.kind||mode(f)};
 }
 function snapshot(f){return freeze({index:f.index,_inkContactEpoch:f._inkContactEpoch||0,ch:{id:f.ch.id,scale:f.ch.scale},x:f.x,y:f.y,dir:f.dir,renderScale:f.renderScale||f.ch.scale||1,state:f.state,crouch:!!f.crouch,jumpPre:f.jumpPre||0,aiGuard:!!f.aiGuard,intentDir:f.intentDir,input:{dir:f.input?.dir||5},_inkVisualClock:f._inkVisualClock||0,_inkRuleBody:f._inkRuleBody,_inkAirPrep:f._inkAirPrep,_inkRulePressure:f._inkRulePressure,_inkLocomotion:f._inkLocomotion?copy(f._inkLocomotion):null,_inkFacing:f._inkFacing?copy(f._inkFacing):null,_inkSupport:f._inkSupport?copy(f._inkSupport):null});}
 function geometry(f){const q=sample(f);if(!q)return null;const world={x:f.x,y:f.y,dir:f.dir,scale:f.renderScale||f.ch.scale||1},g=INK.DefenseBody.geometry(q.model,{world});if(!g.valid)throw Error('Invalid shared defense geometry: '+g.reason);const view=snapshot(f);return {...g,grabHurt:g.hurt.filter(q=>!/arm/i.test(q.part||q.id||'')),bodyModel:{owner:f._inkRuleBody?.owner||'initial:'+f.index+':'+(f._inkContactEpoch||0),view,clock:view._inkVisualClock,x:f.x,y:f.y,dir:f.dir,scale:world.scale}};}
 function between(previous,current,u){
  const a=previous?.bodyModel,b=current?.bodyModel;if(!a||!b||a.owner!==b.owner||a.dir!==b.dir)return null;
  const time=a.clock+(b.clock-a.clock)*u,view={...(u===1?b.view:a.view),x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,_inkVisualClock:time};
  // A newly committed plan affects only its declared interval. In particular,
  // a contact commit at b.clock cannot rewrite the preceding subframes.
  for(const [key,birth]of [['_inkRuleBody','start'],['_inkRulePressure','time'],['_inkLocomotion','time'],['_inkFacing','time'],['_inkSupport','time']]){const next=b.view[key];if(next&&next[birth]<=time)view[key]=next;}
  return geometry(view);
 }

 function queueContact(f,type,facts){if(!owns(f)||!['block','parry'].includes(type))return;const raw=facts?.normal,n=Array.isArray(raw)&&raw.every(Number.isFinite)?Math.hypot(...raw):0,normal=n>1e-8?raw.map(v=>v/n):[facts?.attackerDir<0?-1:1,0],gain=(facts?.level>=3?1:facts?.level>=2?.70:.45)*(facts?.last===false?.65:1)*(type==='parry'?.45:1),old=f._inkRuleImpulse||{arm:[0,0],body:[0,0]};f._inkRuleImpulse={arm:old.arm.map((v,i)=>v+normal[i]*gain*.55),body:old.body.map((v,i)=>v+normal[i]*gain*.32)};}
 function settle(f){if(!owns(f)){f._inkRuleImpulse=null;return;}const time=f._inkVisualClock||0;if(f._inkRuleImpulse){const state=f._inkRulePressure||INK.DefensePressure.create(time);f._inkRulePressure=INK.DefensePressure.commit(state,time,f._inkRuleImpulse);}f._inkRuleImpulse=null;prepare(f);}
 function reset(f){f._inkRuleBody=null;f._inkRulePressure=null;f._inkRuleImpulse=0;}
 function continuous(f,next){return owns(f)&&states.includes(next);}
 INK.RuleBody={owns,profile,mode,target,prepare,sample,geometry,between,fromFrame,queueContact,settle,reset,continuous,curve,retarget};
})();
