/* FLOW 05 — fixed-step damped spring chains for hair and cloth.
 * Exact under/critical/over-damped integration for a constant target per step.
 * An immutable per-clip bake at 120 Hz makes scrub/reverse/display-rate changes
 * deterministic. Chains have position AND angular velocity, unlike sine offsets.
 */
'use strict';
(() => {
  const {clamp,finite}=INK;
  const ZERO=()=>({hair:0,cloth:0,twist:0,flutter:0,breath:0,hairChain:[0,0,0],clothChain:[0,0,0],velocity:{hair:0,cloth:0}});
  function stepSpring(position,velocity,target,omega,damping,dt) {
    for(const n of [position,velocity,target,omega,damping,dt])finite(n,'Non-finite spring state');
    if(omega<=0||damping<0||dt<0)throw RangeError('Spring frequency >0, damping/dt >=0 required');
    if(dt===0)return {position,velocity};
    const x=position-target,a=damping*omega;
    let y,v;
    if(Math.abs(damping-1)<1e-5) {
      const b=velocity+omega*x,e=Math.exp(-omega*dt);
      y=(x+b*dt)*e;v=(velocity-omega*b*dt)*e;
    } else if(damping<1) {
      const w=omega*Math.sqrt(1-damping*damping),e=Math.exp(-a*dt),c=Math.cos(w*dt),s=Math.sin(w*dt),b=(velocity+a*x)/w;
      y=e*(x*c+b*s);v=e*((-a*x+b*w)*c+(-a*b-x*w)*s);
    } else {
      const q=Math.sqrt(damping*damping-1),r1=-omega*(damping-q),r2=-omega*(damping+q);
      const c1=(velocity-r2*x)/(r1-r2),c2=x-c1,e1=Math.exp(r1*dt),e2=Math.exp(r2*dt);
      y=c1*e1+c2*e2;v=c1*r1*e1+c2*r2*e2;
    }
    return {position:y+target,velocity:v};
  }
  let cache=new WeakMap();const stats={bakes:0,samples:0,bakedFrames:0};
  // Prefix compilation avoids a whole-special spring bake on its first frame.
  // Integration order and step remain identical to an eager full bake.
  function bake(data,through=Infinity) {
    let result=cache.get(data);
    if(!result){
      const duration=Math.max(1,data.duration||120),clip=new (INK.CompiledClip||INK.Clip)({...data,version:data.version||1,id:data.id||'secondary',duration,tracks:data.tracks||{}});
      result={rows:[],step:.5,duration,clip,hair:Array.from({length:3},()=>({position:0,velocity:0})),cloth:Array.from({length:3},()=>({position:0,velocity:0})),last:clip.sample(0),prevVelocity:{yaw:0,spin:0,lean:0}};
      cache.set(data,result);stats.bakes++;
    }
    const {clip,duration,rows,step}=result,cfg=data.meta?.motion5?.springs||{},channel=(p,key)=>typeof p[key]==='number'?p[key]:0;
    let {hair,cloth,last,prevVelocity}=result;
    const end=Math.min(Math.ceil(duration/step),Math.ceil(Math.max(0,through)/step));
    for(let i=rows.length;i<=end;i++) {
      const frame=Math.min(duration,i*step),p=clip.sample(frame);
      const vel={};for(const key of ['yaw','spin','lean'])vel[key]=i?(channel(p,key)-channel(last,key))/step:0;
      const accel={};for(const key of ['yaw','spin','lean'])accel[key]=(vel[key]-prevVelocity[key])/step;
      let beat=0;
      for(const b of data.meta?.secondaryBeats||[])if(frame>=b.frame&&frame<b.frame+3)beat+=(b.amplitude??6)*Math.sin((frame-b.frame)/3*Math.PI);
      const hairTarget=clamp(-vel.yaw*.7-vel.spin*.35-vel.lean*.9-accel.lean*.3+beat*.8,-34,34)*(cfg.hairStrength??1);
      const clothTarget=clamp(-vel.yaw*.48-vel.spin*.3-vel.lean*.62-accel.yaw*.14+beat,-36,36)*(cfg.clothStrength??1);
      if(i)for(let j=0;j<3;j++) {
        hair[j]=stepSpring(hair[j].position,hair[j].velocity,j?hair[j-1].position:hairTarget,(cfg.frequency??.34)/(1+j*.24),cfg.damping??.42,step);
        cloth[j]=stepSpring(cloth[j].position,cloth[j].velocity,j?cloth[j-1].position:clothTarget,(cfg.frequency??.34)*.74/(1+j*.22),(cfg.damping??.42)+.1,step);
      }
      rows.push({hairChain:hair.map(s=>clamp(s.position,-38,38)),clothChain:cloth.map(s=>clamp(s.position,-40,40)),
        hair:clamp(hair[2].position,-38,38),cloth:clamp(cloth[2].position,-40,40),twist:clamp(hair[0].position-hair[2].position,-18,18),
        flutter:clamp(cloth[2].velocity*.28,-3,3),breath:Math.sin(frame*Math.PI/60)*.6,
        velocity:{hair:hair[2].velocity,cloth:cloth[2].velocity}});
      last=p;prevVelocity=vel;stats.bakedFrames++;
    }
    Object.assign(result,{hair,cloth,last,prevVelocity});return result;
  }
  function sample(data,frame,enabled=true) {
    if(!enabled)return ZERO();data=data?.data||data;
    if(!data||typeof data!=='object')return ZERO();
    finite(frame,'Finite secondary frame required');const b=bake(data,frame+.5),t=clamp(frame,0,b.duration)/b.step;
    const a=b.rows[Math.floor(t)],c=b.rows[Math.min(b.rows.length-1,Math.floor(t)+1)],u=t-Math.floor(t),out={};
    for(const k of ['hair','cloth','twist','flutter','breath'])out[k]=a[k]+(c[k]-a[k])*u;
    for(const k of ['hairChain','clothChain'])out[k]=a[k].map((x,i)=>x+(c[k][i]-x)*u);
    out.velocity={hair:a.velocity.hair+(c.velocity.hair-a.velocity.hair)*u,cloth:a.velocity.cloth+(c.velocity.cloth-a.velocity.cloth)*u};
    stats.samples++;return out;
  }
  INK.SecondaryDynamics={stepSpring,sample,bake,stats,clear(){cache=new WeakMap();},version:'9.0.0'};
})();
