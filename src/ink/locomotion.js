/* Simulation-owned alternating support, sampled without mutation or root writes. */
'use strict';
(() => {
 const settings={enabled:true},clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
 const profiles=Object.freeze({ryu:{duration:10,height:13,stride:34,lean:2},ken:{duration:8,height:17,stride:40,lean:4},chun:{duration:9,height:12,stride:35,lean:1},cammy:{duration:7,height:12,stride:42,lean:5},luke:{duration:9,height:15,stride:38,lean:3},juri:{duration:11,height:22,stride:37,lean:-1},mai:{duration:10,height:15,stride:36,lean:2},iori:{duration:10,height:11,stride:43,lean:6}});
 const point=p=>Object.freeze([p[0],p[1]]),active=()=>settings.enabled&&INK.Kinetic?.settings.enabled;
 function reset(f){f._inkLocomotion=null;}
 function footAt(foot,time){if(!foot.swing)return foot.anchor.slice();const s=foot.swing,u=clamp((time-s.start)/s.duration),q=smooth(u);return [s.from[0]+(s.to[0]-s.from[0])*q,s.from[1]+(s.to[1]-s.from[1])*q-Math.sin(Math.PI*u)**2*s.height];}
 function freezeFoot(v){return Object.freeze({anchor:point(v.anchor),swing:v.swing?Object.freeze({...v.swing,from:point(v.swing.from),to:point(v.swing.to)}):null,weight:v.weight,z:Number.isFinite(v.z)?v.z:0});}
 function bodyLoad(f,{dx=0,scale=1,profile=null,actionclock=f._inkVisualClock??f._inkLocomotion?.time??0}={}){
  const old=f._inkLocomotion,p=profile||INK.BodySupport?.profiles?.[f.ch.id],moving=Math.abs(dx)>.08*scale;
  const rawDrop=moving?clamp(8+(p?.load||1)*2+Math.abs(dx)/scale*.45,8,14):old?.drop||0;
  return {drop:rawDrop};
 }
 function step(f,G,c){
  if(!active()||!c?.eligible||!c.grounded){reset(f);return null;}
  const now=c.actionclock;if(!Number.isFinite(now)||!c.baseFeet?.front||!c.baseFeet?.rear)return null;
  let old=f._inkLocomotion;if(old&&old.time===now)return old;
  if(old&&old.dir!==c.dir)old=null;
  const scale=c.scale||1,fallback=profiles[f.ch.id]||profiles.ryu,shared=c.profile||INK.BodySupport?.profiles?.[f.ch.id],p=shared?{duration:shared.settle||fallback.duration,height:(shared.lift||fallback.height)*1.4,stride:(shared.stride||fallback.stride)*.55,lean:(shared.drive||1)*3}:fallback,dx=Number.isFinite(c.actualdx)?c.actualdx:0,moving=Math.abs(dx)>.08*scale;
  if(moving&&old?.releaseStart!=null)old=null;
  if(!old&&!moving){reset(f);return null;}
  const feet={};for(const name of ['front','rear']){const prior=old?.feet[name];feet[name]=prior?{anchor:prior.anchor,swing:prior.swing,weight:prior.weight,z:prior.z||0}:{anchor:c.startFeet?.[name]||c.baseFeet[name],swing:null,weight:1};const foot=feet[name];if(foot.swing&&now>=foot.swing.start+foot.swing.duration){foot.anchor=foot.swing.to;foot.swing=null;foot.weight=1;}}
  let travel=(old?.travel||0)+Math.abs(dx),next=old?.next||'front';const swinging=['front','rear'].some(n=>feet[n].swing);
  const reach=name=>{const r=c.reach?.[name];return r?.length===2&&r.every(Number.isFinite)&&r[0]<=r[1]?r:null;};
  const clampTarget=(name,x)=>{const r=reach(name);return r?clamp(x,r[0],r[1]):x;};
  const danger=name=>{const r=reach(name);if(!r)return 0;const x=feet[name].anchor[0];return Math.max(0,r[0]+dx-x,x-r[1]-dx);};
  const urgent=['front','rear'].filter(n=>!feet[n].swing&&danger(n)>0).sort((a,b)=>danger(b)-danger(a))[0];
  if(urgent&&swinging){const name=urgent==='front'?'rear':'front',v=feet[name];if(v.swing&&!v.swing.urgent&&v.swing.start+v.swing.duration-now>2){const from=footAt(v,now),to=[clampTarget(name,from[0]+dx*2),v.swing.to[1]],distance=Math.hypot(to[0]-from[0],to[1]-from[1]),duration=Math.max(2,Math.ceil(1.5*distance/(18*scale)));v.swing={from,to,start:now,duration,height:0,urgent:true};}next=urgent;}
  if(!swinging&&(moving&&(travel>=3*scale||urgent)||!moving&&urgent&&old&&old.releaseStart===null)){
   const speed=Math.abs(dx)/scale,baseDuration=clamp(p.duration-speed*.45,5,p.duration),name=urgent||next,base=c.baseFeet[name],from=feet[name].anchor,advance=clamp(dx*baseDuration*.5,-p.stride*scale,p.stride*scale);
   const wished=moving?clamp(base[0]+advance,from[0]-p.stride*scale*2,from[0]+p.stride*scale*2):from[0],target=[clampTarget(name,wished),base[1]],height=p.height*scale*(.7+.3*clamp(speed/5));
   // Smoothstep translation peaks at 1.5×average; the lift derivative adds
   // pi*height. Budget both so a long authored stance cannot snap the foot.
   const maxSpeed=(18+6*clamp((speed-5)/5))*scale,distance=Math.hypot(target[0]-from[0],target[1]-from[1]),duration=Math.max(baseDuration,Math.ceil((1.5*distance+Math.PI*height)/maxSpeed));
   feet[name].swing={from,to:target,start:now,duration,height};feet[name].weight=0;next=name==='front'?'rear':'front';travel=0;
  }
  for(const name of ['front','rear']){const v=feet[name];if(v.swing){const u=clamp((now-v.swing.start)/v.swing.duration);v.weight=1-smooth(u/.18)*(1-smooth((u-.82)/.18));}}
  const braking=old?.moving&&(!moving||Math.sign(dx)!==Math.sign(old.dx)),brakeStart=braking?now:old?.brakeStart??-100,brakeDir=braking?Math.sign(old.dx):old?.brakeDir||0,brake=1-smooth((now-brakeStart)/7);
  const hasSwing=['front','rear'].some(n=>feet[n].swing),adopted=!!old?.adopted&&!moving;
  const releaseStart=adopted||moving||hasSwing?null:old?.releaseStart??now;
  const releaseDuration=moving?5:clamp(old?.releaseDuration||5,5,24);
  if(releaseStart!==null&&now-releaseStart>=releaseDuration){reset(f);return null;}
  const body=Object.freeze({lean:(old?.body.lean||0)+((moving?Math.sign(dx)*p.lean:0)-(old?.body.lean||0))*.3,bob:0,pelvisYaw:0});
  const previous=old?Object.freeze({...old,previous:null}):null;
  const drop=bodyLoad(f,{dx,scale,profile:shared,actionclock:now}).drop;
  const state=Object.freeze({adopted,drop,time:now,dir:c.dir,scale,feet:Object.freeze({front:freezeFoot(feet.front),rear:freezeFoot(feet.rear)}),next,travel,brake,brakeStart,brakeDir,releaseStart,releaseDuration,body,moving,dx,previous});f._inkLocomotion=state;return state;
 }
 function sample(f,time,world=null){
  let s=f._inkLocomotion;if(!active()||!s)return null;if(time<s.time&&s.previous)s=s.previous;const worldFeet={},feet={},feet3D={},weights={};let lift=0;
  for(const name of ['front','rear']){const foot=s.feet[name],p=footAt(foot,time);worldFeet[name]=p;feet[name]=p.slice();feet3D[name]=[p[0],p[1],foot.z||0];if(foot.swing){const u=clamp((time-foot.swing.start)/foot.swing.duration);weights[name]=1-smooth(u/.18)*(1-smooth((u-.82)/.18));lift=Math.max(lift,Math.sin(Math.PI*u)**2);}else weights[name]=1;}
  const blend=s.releaseStart===null?1:1-smooth((time-s.releaseStart)/(s.releaseDuration||5)),brake=1-smooth((time-s.brakeStart)/7);
  return {active:true,feet,feet3D,ownedFeet:feet3D,worldFeet,weights,blend,brake,body:{lean:(s.body.lean-s.brakeDir*3*brake)*blend,bob:(s.drop+2*lift+3*brake)*blend,pelvisYaw:((s.next==='front'?-1:1)*3*lift+s.brakeDir*4*brake)*blend}};
 }
 function adopt(f,worldFeet,c={}){
  if(!worldFeet||!['front','rear'].every(n=>Array.isArray(worldFeet[n])&&worldFeet[n].slice(0,2).every(Number.isFinite)))return null;
  const time=c.time??f._inkVisualClock??0,feet={};for(const name of ['front','rear'])feet[name]=freezeFoot({anchor:worldFeet[name].slice(0,2),z:worldFeet[name][2]||0,swing:null,weight:1});
  const state=Object.freeze({adopted:true,drop:0,time,dir:c.dir??f.dir,scale:c.scale||1,feet:Object.freeze(feet),next:'front',travel:0,brake:0,brakeStart:time-8,brakeDir:0,releaseStart:null,releaseDuration:5,body:Object.freeze({lean:0,bob:0,pelvisYaw:0}),moving:false,dx:0,previous:null});f._inkLocomotion=state;return state;
 }
 function samplePlan(plan,time){
  if(!plan)return null;const sampled=sample({_inkLocomotion:plan},time);if(!sampled)return null;
  const endTime=plan.releaseStart!=null?plan.releaseStart+(plan.releaseDuration||5):Math.max(plan.time,...Object.values(plan.feet).map(f=>f.swing?f.swing.start+f.swing.duration:plan.time));
  return {...sampled,endTime,active:time<endTime};
 }
 const overrideTurn=f=>reset(f);
 INK.Locomotion={settings,profiles,active,reset,adopt,bodyLoad,step,sample,samplePlan,overrideTurn};
})();
