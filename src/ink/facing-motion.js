/* Continuous visual heading and physical-foot plans; never combat facing. */
'use strict';
(() => {
 const epochs=new WeakMap();
 const TAU=Math.PI*2,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
 const profiles=Object.freeze({ryu:{turnFrames:8,head:.8,chest:.94,pelvis:1,height:8,arc:12,support:'rear',style:'rooted'},ken:{turnFrames:5,head:.75,chest:.84,pelvis:1,height:14,arc:17,support:'rear',style:'pursuit'},chun:{turnFrames:7,head:.78,chest:.9,pelvis:1,height:12,arc:16,support:'front',style:'alternating'},cammy:{turnFrames:5,head:.78,chest:.86,pelvis:1,height:13,arc:24,support:'rear',style:'spiral'},luke:{turnFrames:6,head:.82,chest:.88,pelvis:1,height:10,arc:13,support:'front',style:'boxing'},juri:{turnFrames:7,head:.83,chest:.96,pelvis:.9,height:24,arc:27,support:'rear',style:'single-leg'},mai:{turnFrames:8,head:.8,chest:.9,pelvis:1,height:17,arc:25,support:'rear',style:'fan-dance'},iori:{turnFrames:8,head:.88,chest:1,pelvis:.94,height:9,arc:19,support:'rear',style:'low-claw'}});
 const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};
 function curve(c,t){const u=clamp((t-c.start)/c.duration),d=c.duration,h=u*u*(3-2*u),g=u*(1-u)*(1-u),value=c.from+(c.to-c.from)*h+c.velocity*d*g,velocity=t<c.start||t>=c.start+d?0:(c.to-c.from)*6*u*(1-u)/d+c.velocity*(1-4*u+3*u*u);return {value,velocity};}
 const nearest=(angle,base,sign=1)=>{let d=((base-angle+Math.PI)%TAU+TAU)%TAU-Math.PI;if(Math.abs(Math.abs(d)-Math.PI)<1e-8)d=Math.PI*sign;return angle+d;};
 const make=(from,to,velocity,start,duration)=>({from,to,velocity,start,duration});
 function reset(f){epochs.set(f,(f._inkFacing?.epoch||epochs.get(f)||0)+1);f._inkFacing=null;}
 function initialize(f,c={}){
  const time=c.time||0,angle=f.dir<0?Math.PI:0,w=c.world||{x:f.x||0,y:f.y||0,scale:1},scale=w.scale||1,angles={};for(const name of ['heading','head','chest','pelvis'])angles[name]=make(angle,angle,0,time,1);
  const feet={};for(const name of ['front','rear']){const a=c.frame?.worldFeet?.[name]||[w.x+(name==='front'?30:-30)*scale*(f.dir||1),665+w.y,0];feet[name]={from:[...a.slice(0,2),a[2]||0],to:[...a.slice(0,2),a[2]||0],velocity:[0,0,0],start:time,duration:1,height:0,arc:0,support:true};}
  const stance={};for(const name of ['front','rear']){const q=feet[name].from,x=(q[0]-w.x)/scale,z=q[2]/scale;stance[name]=[Math.cos(angle)*x-Math.sin(angle)*z,(q[1]-665-w.y)/scale,Math.sin(angle)*x+Math.cos(angle)*z];}
  const s=freeze({stance,rootX:w.x,time,start:time,end:time,targetDir:f.dir||1,epoch:epochs.get(f)||1,angles,feet,feetOwned:false,suspended:false,handoff:null,previous:null,style:(profiles[f.ch.id]||profiles.ryu).style});f._inkFacing=s;return s;
 }
 function sample(f,time,world=null,includeFeet=false){
  let s=f._inkFacing;if(!s)return null;if(time<s.time&&s.previous)s=s.previous;
  const out={angularVelocities:{},feet:{},turning:!s.suspended&&time<(s.bodyEnd??s.end),progress:clamp((time-s.start)/Math.max(1,(s.bodyEnd??s.end)-s.start)),footProgress:clamp((time-s.start)/Math.max(1,s.end-s.start)),epoch:s.epoch,style:s.style,suspended:!!s.suspended,ownsFeet:!!s.feetOwned&&!s.suspended,landingCompleted:!s.suspended&&time>=s.end};
  for(const name of ['heading','head','chest','pelvis']){const q=curve(s.angles[name],time);out[name]=q.value;out.angularVelocities[name]=q.velocity;}
  for(const name of ['rear','front']){const p=s.feet[name],u=clamp((time-p.start)/p.duration),wave=Math.sin(Math.PI*u)**2,dwave=Math.PI*Math.sin(TAU*u)/p.duration,targetWorld=[],velocity=[];for(let i=0;i<3;i++){const q=curve(make(p.from[i],p.to[i],p.velocity[i],p.start,p.duration),time),offset=i===1?-p.height:i===2?p.arc:0;targetWorld.push(q.value+offset*wave);velocity.push(q.velocity+offset*dwave);}out.feet[name]={targetWorld,velocity,weight:time<p.start||time>=p.start+p.duration?1:1-Math.sin(Math.PI*u)**2,phase:time<p.start?'support':time>=p.start+p.duration?'planted':'swing'};}
  out.primarySupport=s.firstFoot?(time<s.feet[s.firstFoot].start+s.feet[s.firstFoot].duration?(s.firstFoot==='front'?'rear':'front'):s.firstFoot):null;
  if(!s.feetOwned&&!includeFeet)out.feet={};
  return out;
 }
 function retarget(f,targetDir,c){
  if(c.eligible===false||c.grounded===false)return step(f,c);
  if(!f._inkFacing)initialize(f,c);const old=f._inkFacing;if(targetDir===old.targetDir&&!old.suspended)return old;
  const now=c.time,current=sample(f,now,c.world,true),p=profiles[f.ch.id]||profiles.ryu,w=c.world||{x:f.x||0,y:f.y||0,scale:1},scale=w.scale||1,goal=nearest(current.heading,targetDir<0?Math.PI:0,p.support==='rear'?1:-1),angles={};
  for(const name of ['heading','head','chest','pelvis'])angles[name]=make(current[name],goal,current.angularVelocities[name],now,p.turnFrames*(p[name]||1));
  const feet={},delta=goal-current.heading,names=['rear','front'];
  // Complete the moving foot first on a reversal. The other physical foot
  // stays planted until that landing, then steps into its own rotated role.
  const speeds=names.map(n=>Math.hypot(...current.feet[n].velocity));
  const first=Math.max(...speeds)>.001?names[speeds[0]>=speeds[1]?0:1]:p.support==='rear'?'front':'rear',second=first==='front'?'rear':'front';
  let cursor=now;
  for(const name of [first,second]){const oldFoot=current.feet[name],captured=c.frame?.worldFeet?.[name],from=captured?[captured[0],captured[1],captured[2]||0]:oldFoot.targetWorld.slice(),v=(c.frame?.velocities?.worldFeet?.[name]||oldFoot.velocity).slice(),rest=old.stance[name],to=[w.x+scale*(Math.cos(goal)*rest[0]+Math.sin(goal)*rest[2]),665+w.y+scale*rest[1],scale*(-Math.sin(goal)*rest[0]+Math.cos(goal)*rest[2])],height=p.height*scale,arc=p.arc*scale*Math.sign(delta||1);
   const distance=Math.hypot(...to.map((x,i)=>x-from[i])),duration=Math.max(4,Math.ceil((1.5*distance+Math.PI*Math.hypot(height,arc))/(22*scale)));
   feet[name]={from,to,velocity:name===first?v:[0,0,0],start:cursor,duration,height,arc,support:name===second};cursor+=duration;
  }
  const state=freeze({stance:old.stance,rootX:w.x,time:now,start:now,bodyEnd:now+p.turnFrames,feetEnd:cursor,end:Math.max(now+p.turnFrames,cursor),firstFoot:first,targetDir,epoch:old.epoch,angles,feet,feetOwned:true,suspended:false,handoff:null,previous:{...old,previous:null},style:p.style});f._inkFacing=state;return state;
 }
 function needsFrame(f,c){const s=f._inkFacing;return !!(s?.feetOwned&&!s.handoff&&!s.suspended&&Math.abs((c.world?.x??f.x??s.rootX)-s.rootX)>2*(c.world?.scale||1));}
 function step(f,c){
  if(!f._inkFacing)initialize(f,c);const old=f._inkFacing;
  if(!c.eligible||!c.grounded){
   if(old.suspended)return old;const at=sample(f,c.time,c.world,true),angles={};for(const k of ['heading','head','chest','pelvis'])angles[k]=make(at[k],at[k],0,c.time,1);
   return f._inkFacing=freeze({...old,time:c.time,angles,feetOwned:false,suspended:true,handoff:null,previous:{...old,previous:null}});
  }
  if(old.suspended)return retarget(f,f.dir||old.targetDir,c);
  if(needsFrame(f,c)&&c.frame?.worldFeet){
   const feet={};for(const name of ['front','rear']){const p=c.frame.worldFeet[name];if(!Array.isArray(p)||!p.slice(0,2).every(Number.isFinite))return old;feet[name]=[p[0],p[1],p[2]||0];}
   return f._inkFacing=freeze({...old,time:c.time,handoff:{epoch:old.epoch,time:c.time,feet,reason:'movement'},previous:{...old,previous:null}});
  }
  if(old.feetOwned&&c.time>=old.end&&!old.handoff){
   const at=sample(f,c.time,c.world,true),feet={};for(const name of ['front','rear'])feet[name]=at.feet[name].targetWorld.slice();
   return f._inkFacing=freeze({...old,time:c.time,handoff:{epoch:old.epoch,time:c.time,feet},previous:{...old,previous:null}});
  }return old;
 }
 // Call only AFTER the simulation owner has adopted handoff.feet into its
 // next support plan. Until acknowledgment the final turn anchors stay owned.
 function completeHandoff(f,epoch,time){const old=f._inkFacing;if(!old?.handoff||old.epoch!==epoch)return false;f._inkFacing=freeze({...old,time,feetOwned:false,handoff:null,previous:{...old,previous:null}});return true;}
 function sampleFeet(plan,time){
  if(!plan)return null;const sampled=sample({_inkFacing:plan},time,null,true),endTime=plan.feetEnd??plan.end;
  return {feet:sampled.feet,endTime,active:time<endTime,epoch:plan.epoch,primarySupport:sampled.primarySupport};
 }
 INK.FacingMotion={profiles,initialize,retarget,step,sample,sampleFeet,reset,completeHandoff,needsFrame};
})();
