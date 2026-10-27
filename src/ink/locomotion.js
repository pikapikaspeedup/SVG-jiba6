/* Simulation-owned alternating support, sampled without mutation or root writes. */
'use strict';
(() => {
 const settings={enabled:true},clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
 const profiles=Object.freeze({ryu:{duration:10,height:13,stride:34,lean:2},ken:{duration:8,height:17,stride:40,lean:4},chun:{duration:9,height:12,stride:35,lean:1},cammy:{duration:7,height:12,stride:42,lean:5},luke:{duration:9,height:15,stride:38,lean:3},juri:{duration:11,height:22,stride:37,lean:-1},mai:{duration:10,height:15,stride:36,lean:2},iori:{duration:10,height:11,stride:43,lean:6}});
 const point=p=>Object.freeze([p[0],p[1]]),active=()=>settings.enabled;
 function reset(f){f._inkLocomotion=null;}
 function footAt(foot,time){if(!foot.swing)return foot.anchor.slice();if(foot.swing.run){const s=foot.swing,u=clamp((time-s.start)/s.duration),h00=2*u*u*u-3*u*u+1,h10=u*u*u-2*u*u+u,h01=-2*u*u*u+3*u*u;return (s.spatial3D?s.from.slice(0,2):s.from).map((v,i)=>h00*v+h10*s.duration*s.velocity[i]+h01*s.to[i]-(i===1?Math.sin(Math.PI*u)**2*s.height:0));}const s=foot.swing,u=clamp((time-s.start)/s.duration),q=smooth(u);return [s.from[0]+(s.to[0]-s.from[0])*q,s.from[1]+(s.to[1]-s.from[1])*q-Math.sin(Math.PI*u)**2*s.height];}
 // One-sided derivative at start; after end and before start the clamp is static.
 function footVelocity(foot,time){const s=foot.swing;if(!s||time<s.start||time>=s.start+s.duration)return [0,0,0];const u=(time-s.start)/s.duration,d=6*u*(1-u)/s.duration,w=Math.PI*Math.sin(2*Math.PI*u)/s.duration;return [0,1].map(i=>(s.to[i]-s.from[i])*d+(s.run?(s.velocity?.[i]||0)*(3*u*u-4*u+1):0)-(i===1?s.height*w:0)).concat(s.spatial3D?(s.to[2]-s.from[2])*d+(s.velocity[2]||0)*(3*u*u-4*u+1)+(s.arc||0)*w:0);}
 function foot3D(foot,time){const xy=footAt(foot,time),s=foot.swing;if(!s?.spatial3D)return [xy[0],xy[1],foot.z||0];const u=clamp((time-s.start)/s.duration),h=u*u*(3-2*u),g=u*(1-u)*(1-u);return [xy[0],xy[1],s.from[2]+(s.to[2]-s.from[2])*h+s.velocity[2]*s.duration*g+(s.arc||0)*Math.sin(Math.PI*u)**2];}
 const swingPoint=(q,spatial)=>Object.freeze(spatial?q.slice(0,3):[q[0],q[1]]);
 function freezeFoot(v){return Object.freeze({anchor:point(v.anchor),swing:v.swing?Object.freeze({...v.swing,from:swingPoint(v.swing.from,v.swing.spatial3D),to:swingPoint(v.swing.to,v.swing.spatial3D),...(v.swing.velocity?{velocity:swingPoint(v.swing.velocity,v.swing.spatial3D)}:{})}):null,weight:v.weight,runSteps:v.runSteps||0,z:Number.isFinite(v.z)?v.z:0});}
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
  const feet={};for(const name of ['front','rear']){const prior=old?.feet[name];feet[name]=prior?{anchor:prior.anchor,swing:prior.swing,weight:prior.weight,runSteps:prior.runSteps||0,z:prior.z||0}:{anchor:c.startFeet?.[name]||c.baseFeet[name],swing:null,weight:1};const foot=feet[name];if(foot.swing&&now>=foot.swing.start+foot.swing.duration){foot.anchor=foot.swing.to;if(foot.swing.spatial3D)foot.z=foot.swing.to[2];foot.swing=null;foot.weight=1;}}
  let travel=(old?.travel||0)+Math.abs(dx),next=old?.next||'front';const swinging=['front','rear'].some(n=>feet[n].swing);
  const reach=name=>{const r=c.reach?.[name];return r?.length===2&&r.every(Number.isFinite)&&r[0]<=r[1]?r:null;};
  const clampTarget=(name,x)=>{const r=reach(name);return r?clamp(x,r[0],r[1]):x;};
  const danger=name=>{const r=reach(name);if(!r)return 0;const x=feet[name].anchor[0];return Math.max(0,r[0]+dx-x,x-r[1]-dx);};
  const urgent=['front','rear'].filter(n=>!feet[n].swing&&danger(n)>0).sort((a,b)=>danger(b)-danger(a))[0];
  // A real wall stop invalidates forward prediction once. Keep the current
  // foot position/velocity, but bring its landing back into today's reach.
  if(!moving&&old?.moving)for(const name of ['front','rear']){const v=feet[name];if(v.swing?.run&&!v.swing.spatial3D){const at=footAt(v,now),before=footAt(v,now-.001),velocity=at.map((q,i)=>(q-before[i])/.001),to=[clampTarget(name,at[0]),c.baseFeet[name][1]];v.swing={run:true,from:at,to,velocity,start:now,duration:4,height:0};}}
  const run=moving&&(Math.abs(dx)/scale>=9||old?.mode==='run'&&Math.abs(dx)/scale>=7);
  let lastRunLaunch=old?.lastRunLaunch??-100;
  if(run){
   const speed=Math.abs(dx)/scale,sign=Math.sign(dx),accel=clamp(dx-(old?.dx??dx),-2*scale,2*scale);
   for(const name of ['front','rear'].sort((a,b)=>sign*(footAt(feet[a],now)[0]-footAt(feet[b],now)[0]))){
    const v=feet[name],r=reach(name),at=footAt(v,now),edge=r?(sign>0?at[0]-r[0]:r[1]-at[0]):Infinity;
    const launch=!v.swing&&(edge<Math.abs(dx)*2.5||travel>=Math.max(18,p.stride*.6)*scale&&name===next);
    const replan=v.swing&&!v.swing.run&&edge<Math.abs(dx)*2.5;
    if((!launch&&!replan)||now-lastRunLaunch<2)continue;
    const before=footAt(v,now-.001),velocity=v.swing?at.map((q,i)=>(q-before[i])/.001):[0,0];
    const horizon=4,prediction=dx*horizon+accel*horizon*(horizon+1)*.25;
    const range=r?[r[0]+prediction,r[1]+prediction]:null;
    // Catch the nearest future support boundary first, not the middle of the
    // stance. A later step advances further after this short recovery step.
    const wished=v.runSteps?at[0]+dx*7:at[0]+dx*2,target=[range?clamp(wished,range[0]+8*scale,range[1]-8*scale):wished,c.baseFeet[name][1]];
    const height=clamp(p.height*(v.runSteps?1.8:1),12,38)*scale;
    const swing={run:true,from:at,to:target,velocity,start:now,duration:4,height};
    // Check the actual Hermite+lift speed, including inherited velocity.
    // A currently unreachable foot may remain so briefly; never accelerate
    // it arbitrarily merely to obtain a zero IK residual.
    for(let attempt=0;attempt<14;attempt++){
     let peak=0;const h=.001;for(let j=0;j<=24;j++){const t=now+swing.duration*j/24,a=footAt({swing},t),b=footAt({swing},t+h);peak=Math.max(peak,Math.hypot(b[0]-a[0],b[1]-a[1])/h);}
     if(peak<=32*scale)break;swing.duration+=.5;
    }
    v.swing=swing;v.runSteps=(v.runSteps||0)+1;v.weight=0;next=name==='front'?'rear':'front';travel=0;lastRunLaunch=now;
   }
  }
  if(!run&&urgent&&swinging){const name=urgent==='front'?'rear':'front',v=feet[name];if(v.swing&&!v.swing.spatial3D&&!v.swing.urgent&&v.swing.start+v.swing.duration-now>2){const from=footAt(v,now),to=[clampTarget(name,from[0]+dx*2),v.swing.to[1]],distance=Math.hypot(to[0]-from[0],to[1]-from[1]),duration=Math.max(2,Math.ceil(1.5*distance/(18*scale)));v.swing={from,to,start:now,duration,height:0,urgent:true};}next=urgent;}
  if(!run&&!swinging&&(moving&&(travel>=3*scale||urgent)||!moving&&urgent&&old&&old.releaseStart===null)){
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
  const state=Object.freeze({lastRunLaunch,mode:run?'run':'walk',adopted,drop,time:now,dir:c.dir,scale,feet:Object.freeze({front:freezeFoot(feet.front),rear:freezeFoot(feet.rear)}),next,travel,brake,brakeStart,brakeDir,releaseStart,releaseDuration,body,moving,dx,previous});f._inkLocomotion=state;return state;
 }
 function sample(f,time,world=null){
  let s=f._inkLocomotion;if(!active()||!s)return null;if(time<s.time&&s.previous)s=s.previous;const worldFeet={},feet={},feet3D={},weights={},worldVelocities={};let lift=0;
  for(const name of ['front','rear']){const foot=s.feet[name],p=footAt(foot,time);worldFeet[name]=p;worldVelocities[name]=footVelocity(foot,time);feet[name]=p.slice();feet3D[name]=foot3D(foot,time);if(foot.swing){const u=clamp((time-foot.swing.start)/foot.swing.duration);weights[name]=1-smooth(u/.18)*(1-smooth((u-.82)/.18));lift=Math.max(lift,Math.sin(Math.PI*u)**2);}else weights[name]=1;}
  const blend=s.releaseStart===null?1:1-smooth((time-s.releaseStart)/(s.releaseDuration||5)),brake=1-smooth((time-s.brakeStart)/7);
  const flightWeight=(1-weights.front)*(1-weights.rear),runLean=s.mode==='run'?Math.sign(s.dx)*clamp(6+(Math.abs(s.dx)/s.scale-9)*.4,6,10):0;
  return {active:true,mode:s.mode||'walk',flight:weights.front<.5&&weights.rear<.5,flightWeight,feet,feet3D,ownedFeet:feet3D,worldFeet,worldVelocities,weights,blend,brake,body:{lean:(s.body.lean+runLean-s.brakeDir*3*brake)*blend,bob:(s.drop+2*lift+3*brake-(s.mode==='run'?6*flightWeight:0))*blend,pelvisYaw:((s.next==='front'?-1:1)*3*lift+s.brakeDir*4*brake)*blend}};
 }
 function adopt(f,worldFeet,c={}){
  if(!worldFeet||!['front','rear'].every(n=>Array.isArray(worldFeet[n])&&worldFeet[n].slice(0,2).every(Number.isFinite)))return null;
  const time=c.time??f._inkVisualClock??0,feet={};for(const name of ['front','rear'])feet[name]=freezeFoot({anchor:worldFeet[name].slice(0,2),z:worldFeet[name][2]||0,swing:null,weight:1});
  const state=Object.freeze({adopted:true,drop:0,time,dir:c.dir??f.dir,scale:c.scale||1,feet:Object.freeze(feet),next:'front',travel:0,brake:0,brakeStart:time-8,brakeDir:0,releaseStart:null,releaseDuration:5,body:Object.freeze({lean:0,bob:0,pelvisYaw:0}),moving:false,dx:0,previous:null});f._inkLocomotion=state;return state;
 }
 // Import a completed native-hit owner's finite world trajectory. No new
 // landing policy and no freezing a moving foot into a planted anchor.
 function adoptHitPlan(f,plan,{time=f._inkVisualClock,dir=f.dir,scale=f.ch?.scale||1}={}){
  if(!Number.isFinite(time)||!Number.isFinite(scale)||scale<=0||![1,-1].includes(dir))return null;
  const sampled=INK.HitRuleFeet?.sample(plan,time);if(!sampled)return null;const feet={};
  for(const name of ['front','rear']){let row=plan.feet[name];if(time<row.start)row=row.previous;if(!row)return null;const q=sampled[name];if(!q.point.every(Number.isFinite)||!q.velocity.every(Number.isFinite))return null;
   const live=row.to&&time<row.start+row.duration;if(!live&&q.velocity.some(v=>Math.abs(v)>1e-12))return null;
   feet[name]=freezeFoot({anchor:q.point,z:q.point[2],weight:live?0:1,swing:live?{spatial3D:true,run:true,from:row.point,to:row.to,velocity:row.velocity,start:row.start,duration:row.duration,height:row.height,arc:row.arc}:null});
  }
  return f._inkLocomotion=Object.freeze({adopted:true,drop:0,time,dir,scale,feet:Object.freeze(feet),next:'front',travel:0,brake:0,brakeStart:time-8,brakeDir:0,releaseStart:null,releaseDuration:5,body:Object.freeze({lean:0,bob:0,pelvisYaw:0}),moving:false,dx:0,previous:null});
 }
 // Commit an attack landing plan from the displayed feet. This is a pure
 // constructor: the caller owns the resulting snapshot and its clock.
 function strikePlan(plan,{time,world,frame,deadlineFrame,carry=0,dir=1}={}){
  if(!plan||!frame?.worldFeet||!Number.isFinite(time))return plan;
  const source=samplePlan(plan,time),prior=samplePlan(plan,time-.001),scale=world?.scale||plan.scale||1,feet={},offset=clamp(carry,0,18)*Math.sign(dir||1);
  let cursor=time;
  for(const name of ['front','rear']){
   const actual=frame.worldFeet[name];if(!actual?.slice(0,2).every(Number.isFinite))return plan;
   const moving=!!plan.feet[name].swing&&time<plan.feet[name].swing.start+plan.feet[name].swing.duration;
   const velocity=moving?source.feet[name].map((v,i)=>(v-prior.feet[name][i])/.001):[0,0];
   const intended=deadlineFrame?.worldFeet?.[name];
   // A planted foot remains the support. Carry may move the body over it;
   // never relocate both support anchors just because an attack started.
   if(!moving){feet[name]=freezeFoot({anchor:actual,weight:1,z:actual[2]||0,swing:null});continue;}
   const destination=intended||[actual[0],plan.feet[name].swing.to[1],actual[2]||0],to=[destination[0]+offset,destination[1]];
   const distance=Math.hypot(to[0]-actual[0],to[1]-actual[1]),duration=Math.max(4,Math.ceil(1.5*distance/(24*scale)));
   feet[name]=freezeFoot({anchor:actual,weight:0,z:actual[2]||0,swing:{run:true,from:actual,to,velocity,start:time,duration,height:Math.min(8*scale,Math.max(0,to[1]-actual[1])*.2)}});cursor=Math.max(cursor,time+duration);
  }
  return Object.freeze({...plan,time,feet:Object.freeze(feet),previous:null,moving:false,dx:0,travel:0,releaseStart:null,releaseDuration:5,attackLanding:true,endTime:cursor});
 }
 function samplePlan(plan,time){
  if(!plan)return null;const sampled=sample({_inkLocomotion:plan},time);if(!sampled)return null;
  const endTime=plan.releaseStart!=null?plan.releaseStart+(plan.releaseDuration||5):Math.max(plan.time,...Object.values(plan.feet).map(f=>f.swing?f.swing.start+f.swing.duration:plan.time));
  return {...sampled,endTime,active:time<endTime};
 }
 const overrideTurn=f=>reset(f);
 INK.Locomotion={settings,profiles,active,reset,adopt,adoptHitPlan,bodyLoad,step,sample,samplePlan,strikePlan,overrideTurn};
})();
