/* FLOW 05 · presentation math and deadline-constrained inertial transitions.
 * Pure, random-access functions. Never writes a fighter, collision, or meter.
 * Angles are unwrapped only BETWEEN clips: authored 360/720-degree turns remain.
 */
'use strict';
(() => {
  const {clamp,copy,rad,sampleTrack,finite}=INK;
  const angles=new Set(['yaw','spin','head','lean','chest','pelvis','chestYaw','headYaw','pelvisYaw','fanAngle','ffoot','rfoot']);
  const shortest=d=>((d+180)%360+360)%360-180;
  const smoother=u=>{u=clamp(u);return u*u*u*(10+u*(-15+6*u));};
  function residual(offset,velocity,time,duration) {
    if(duration<=0||time>=duration)return 0;
    const u=clamp(time/duration),u2=u*u,u3=u2*u,u4=u3*u,u5=u4*u;
    return offset*(1-10*u3+15*u4-6*u5)+velocity*duration*(u-6*u3+8*u4-3*u5);
  }
  function bridge(from,oldVelocity,target,targetVelocity,duration) {
    finite(duration,'Transition duration');
    const offsets={},velocities={};
    for(const [key,v] of Object.entries(target)) {
      const a=from[key];if(a==null||key==='rootX'||key==='rootY')continue;
      const delta=(x,y)=>angles.has(key)?shortest(x-y):x-y;
      const bound=Array.isArray(v)?32:angles.has(key)?28:8;
      if(Array.isArray(v)&&Array.isArray(a)) {
        offsets[key]=v.map((x,i)=>a[i]-x);
        velocities[key]=v.map((_,i)=>clamp((oldVelocity[key]?.[i]||0)-(targetVelocity[key]?.[i]||0),-bound,bound));
      } else if(typeof v==='number'&&typeof a==='number') {
        offsets[key]=delta(a,v);velocities[key]=clamp((oldVelocity[key]||0)-(targetVelocity[key]||0),-bound,bound);
      }
    }
    return {offsets,velocities,duration:Math.max(0,duration)};
  }
  function apply(p,transition,time) {
    if(!transition||time>=transition.duration||transition.duration<=0)return p;
    const out=copy(p);
    for(const [key,d] of Object.entries(transition.offsets)) {
      const v=transition.velocities[key];
      if(Array.isArray(out[key]))out[key]=out[key].map((x,i)=>x+residual(d[i],v[i],time,transition.duration));
      else if(typeof out[key]==='number')out[key]+=residual(d,v,time,transition.duration);
    }
    // Keep scale and weapon openness in their physical domains during handoff.
    for(const k of ['depth','reachScale','frontArmProjection','rearArmProjection','frontLegProjection','rearLegProjection'])if(k in out)out[k]=clamp(out[k],.12,3);
    if('fan' in out)out.fan=clamp(out.fan);
    return out;
  }
  function velocity(a,b,dt=.25) {
    const out={};if(dt<=0)return out;
    for(const [k,v]of Object.entries(b)) {
      if(Array.isArray(v)&&Array.isArray(a[k]))out[k]=v.map((x,i)=>(x-a[k][i])/dt);
      else if(typeof v==='number'&&typeof a[k]==='number')out[k]=(v-a[k])/dt;
    }return out;
  }
  function secondary(clip,frame,enabled=true) {
    if(INK.SecondaryDynamics)return INK.SecondaryDynamics.sample(clip,frame,enabled&&INK.MotionGraph.settings.springs);
    if(!enabled)return {hair:0,cloth:0,twist:0,flutter:0,breath:0};
    const data=clip?.data||clip,tracks=data?.tracks||{};
    const at=(name,t)=>tracks[name]?sampleTrack(tracks[name],Math.max(0,t)):0;
    // Causal samples: the accessory reacts to body movement that already happened.
    const speed=(k,lag,span)=>(at(k,frame-lag)-at(k,frame-lag-span))/span;
    const yaw=speed('yaw',1,2),spin=speed('spin',.5,2),lean=speed('lean',1.5,2.5);
    const beats=data?.meta?.secondaryBeats||[];
    let pulse=0;for(const b of beats){const t=frame-b.frame;if(t>=0&&t<52)pulse+=(b.amplitude??6)*Math.exp(-t*.095)*Math.sin(t*.42);}
    return {
      hair:clamp(-yaw*.84-spin*.3-lean*.72+pulse*.65+Math.sin(frame*.072)*1.4,-36,36),
      cloth:clamp(-speed('yaw',2.5,3)*.6-speed('spin',2,3)*.28-lean*.45+pulse+Math.sin(frame*.061)*1.6,-38,38),
      twist:clamp(yaw*.6+spin*.25,-18,18),
      flutter:Math.sin(frame*.34)*clamp(Math.abs(yaw)*.11+Math.abs(spin)*.07+Math.abs(pulse)*.06,0,3.5),
      breath:Math.sin(frame*Math.PI/60)*.6
    };
  }
  function blendSecondary(from,to,time,duration=8) {
    if(!from||time>=duration)return to;const u=smoother(time/duration),out={};
    const mix=(a,b)=>Array.isArray(b)?b.map((v,i)=>mix(a?.[i],v)):b&&typeof b==='object'?Object.fromEntries(Object.entries(b).map(([k,v])=>[k,mix(a?.[k],v)])):(a||0)*(1-u)+b*u;
    for(const k of Object.keys(to))out[k]=mix(from[k],to[k]);return out;
  }
  // Arc-length resampling keeps a fast hand from making a very wide, uneven fan
  // of triangles. Zero-length curves and duplicate samples are well-defined.
  function resample(points,count=17) {
    if(!Array.isArray(points)||!points.length)return [];
    if(!Number.isInteger(count)||count<2||count>128)throw RangeError('Samples 2..128');
    const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
    const total=lengths.at(-1);if(total<1e-7)return Array.from({length:count},()=>points[0].slice());
    let j=1;return Array.from({length:count},(_,i)=>{const d=total*i/(count-1);while(j<lengths.length-1&&lengths[j]<d)j++;const t=(d-lengths[j-1])/Math.max(1e-9,lengths[j]-lengths[j-1]);return [points[j-1][0]+(points[j][0]-points[j-1][0])*t,points[j-1][1]+(points[j][1]-points[j-1][1])*t];});
  }
  // Shared by the weapon rendering and emitter sockets. These are visual sockets,
  // not a replacement for the original fan's fixed weaponReach combat rule.
  function fanSocket(p,rig,name='fanTip') {
    const r=INK.Rig.sockets(p,rig),hand=r.frontArm[2],elbow=r.frontArm[1];
    const theta=Math.atan2(hand[1]-elbow[1],hand[0]-elbow[0]);
    const grip=[hand[0]+Math.cos(theta)*11.2,hand[1]+Math.sin(theta)*11.2];
    if(name==='fanGrip')return grip;
    const angle=theta+rad(-18+(p.fanAngle||0));return[grip[0]+Math.cos(angle)*55.3,grip[1]+Math.sin(angle)*55.3];
  }
  INK.Motion={version:'5.0.0',angles,shortest,smoother,residual,bridge,apply,velocity,secondary,blendSecondary,resample,fanSocket};
})();
