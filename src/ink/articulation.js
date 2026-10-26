/* FLOW 06 · deterministic angular articulation, not render-frame smoothing.
 * Targets are compiled to source-space joint rotations at 1/4-frame resolution.
 * Shoulder/hip angles are unwrapped and rate-limited before FK reconstruction.
 * This prevents a wrist crossing a shoulder, or a foot crossing a hip, from
 * instantaneously switching to the opposite IK solution. A random seek uses
 * exactly the same cache as sequential playback. Combat never reads this cache.
 */
'use strict';
(() => {
 const {mat,vec,rad,clamp}=INK,parts=['rearArm','frontArm','rearLeg','frontLeg'],step=.25;
 const settings={enabled:true,armSpeed:32,legSpeed:26,bendSpeed:38};
 const bodyLimits={lean:16,chest:18,pelvis:12,head:18,yaw:40,spin:60,headYaw:24,chestYaw:24,pelvisYaw:24,turn:.22,bob:24,floor:24,ffoot:40,rfoot:40};
 let cache=new WeakMap(),contexts=new WeakMap();const snapshots=new WeakMap();
 const stats={bakes:0,evaluations:0,limited:0};
 const shortest=x=>((x+180)%360+360)%360-180;
 function signature(c){return JSON.stringify([c.id,c.female,c.rigLengths,c.rigHipWidth,c.rigRearShoulder,c.rigFrontShoulder,settings.armSpeed,settings.legSpeed,settings.bendSpeed]);}
 function angles(chain){const a=vec.sub(chain[1],chain[0]),b=vec.sub(chain[2],chain[1]),u=Math.atan2(a[1],a[0])*180/Math.PI,v=Math.atan2(b[1],b[0])*180/Math.PI;return[u,shortest(v-u)];}
 function reference(c,p){return INK.Anatomy.sourceRig(c,p,true);}
 // Build only the prefix needed by this request. A public bake without a
 // target still warms the whole clip; random/reverse seeks share the same rows.
 function bake(data,c,through=data.duration){
  let profiles=cache.get(data);if(!profiles){profiles=new Map();cache.set(data,profiles);}const key=signature(c);
  let value=profiles.get(key);
  if(!value){
   const clip=new INK.CompiledClip(data),count=Math.ceil(data.duration/step)+1;
   value={clip,tracks:Object.fromEntries(parts.map(k=>[k,new Float64Array(count*2)])),body:Object.fromEntries(Object.keys(bodyLimits).map(k=>[k,new Float64Array(count)])),count,limited:0,built:0};
   if(profiles.size>=4)profiles.delete(profiles.keys().next().value);profiles.set(key,value);stats.bakes++;
  }
  const {clip,count,tracks,body}=value,end=Math.min(count-1,Math.ceil(clamp(through,0,data.duration)/step));let limited=0;
  for(let i=value.built;i<=end;i++){
   const p=clip.sample(Math.min(data.duration,i*step));
   for(const name in bodyLimits){const raw=p[name]??0,prev=i?body[name][i-1]:raw,delta=raw-prev,limit=bodyLimits[name]*step;if(Math.abs(delta)>limit+.0001)limited++;body[name][i]=prev+clamp(delta,-limit,limit);p[name]=body[name][i];}
   const r=reference(c,p);
   for(const name of parts){const raw=angles(r[name]),a=tracks[name],speed=name.includes('Leg')?settings.legSpeed:settings.armSpeed;
    for(let j=0;j<2;j++){if(!i){a[j]=raw[j];continue;}const prev=a[(i-1)*2+j],delta=shortest(raw[j]-prev),limit=(j?settings.bendSpeed:speed)*step;
     if(Math.abs(delta)>limit+.0001)limited++;a[i*2+j]=prev+clamp(delta,-limit,limit);
    }
   }
  }
  stats.bakedFrames=(stats.bakedFrames||0)+Math.max(0,end+1-value.built);value.built=Math.max(value.built,end+1);value.limited+=limited;stats.limited+=limited;return value;
 }
 function sampleBody(b,frame,p,base=null){const index=Math.min(b.count-1,frame/step),i=Math.floor(index),j=Math.min(b.count-1,i+1),u=index-i;for(const [name,a]of Object.entries(b.body)){const correction=base?(p[name]??0)-(base[name]??0):0;p[name]=a[i]+(a[j]-a[i])*u+correction;}return p;}
 function prepare(p,data,frame,c){if(c&&data&&Number.isFinite(frame)){frame=clamp(frame,0,data.duration);contexts.set(p,{data,frame,c});if(settings.enabled){const b=bake(data,c,frame+step);sampleBody(b,frame,p,b.clip.sample(frame));}}return p;}
 function inherit(from,to){const ctx=contexts.get(from);if(ctx)contexts.set(to,ctx);return to;}
 function stabilize(c,p,raw){
  const snapshot=snapshots.get(p);if(snapshot){const out={};for(const name of parts){const a=snapshot[name],root=raw[name][0],l0=vec.length(vec.sub(raw[name][1],root)),l1=vec.length(vec.sub(raw[name][2],raw[name][1])),first=[root[0]+Math.cos(rad(a[0]))*l0,root[1]+Math.sin(rad(a[0]))*l0];out[name]=[root,first,[first[0]+Math.cos(rad(a[0]+a[1]))*l1,first[1]+Math.sin(rad(a[0]+a[1]))*l1]];}return out;}
  const ctx=contexts.get(p);if(!settings.enabled||!ctx)return raw;
  const b=bake(ctx.data,c,ctx.frame+step),index=Math.min(b.count-1,ctx.frame/step),i=Math.floor(index),j=Math.min(b.count-1,i+1),u=index-i;
  const base=sampleBody(b,ctx.frame,b.clip.sample(ctx.frame)),ref=reference(c,base),out={};
  for(const name of parts){
   const tr=b.tracks[name],a0=angles(raw[name]),a1=angles(ref[name]);
   // Preserve bounded, current-frame layer/contact corrections. Rate control
   // applies to the authored path, not to an accumulated previous render pose.
   const a=[0,1].map(k=>tr[i*2+k]+(tr[j*2+k]-tr[i*2+k])*u+clamp(shortest(a0[k]-a1[k]),-14,14));
   const jt=ctx.transition;if(jt&&ctx.transitionTime<jt.duration&&jt.duration>0){
    const u=clamp(ctx.transitionTime/jt.duration),h=2*u*u*u-3*u*u+1,g=u*u*u-2*u*u+u;
    for(let k=0;k<2;k++)a[k]+=INK.Kinetic?.settings.enabled?INK.Motion.residual(jt.offsets[name][k],jt.velocities[name][k],ctx.transitionTime,jt.duration):jt.offsets[name][k]*h+jt.velocities[name][k]*jt.duration*g;
   }
   const root=raw[name][0],l0=vec.length(vec.sub(raw[name][1],root)),l1=vec.length(vec.sub(raw[name][2],raw[name][1]));
   const first=[root[0]+Math.cos(rad(a[0]))*l0,root[1]+Math.sin(rad(a[0]))*l0];
   out[name]=[root,first,[first[0]+Math.cos(rad(a[0]+a[1]))*l1,first[1]+Math.sin(rad(a[0]+a[1]))*l1]];
  }
  stats.evaluations++;return out;
 }
 function attachTransition(p,transition,t){const c=contexts.get(p);if(c&&transition&&t<transition.duration)contexts.set(p,{...c,transition,transitionTime:Math.max(0,t)});return p;}
 function bridge(from,previous,target,next,duration,dt=.25){
  const offsets={},velocities={};for(const name of parts){const a=angles(from.anatomy.source[name]),b=angles(previous.anatomy.source[name]),c=angles(target.anatomy.source[name]),d=angles(next.anatomy.source[name]);
   offsets[name]=a.map((v,k)=>shortest(v-c[k]));velocities[name]=a.map((v,k)=>clamp((shortest(v-b[k])-shortest(d[k]-c[k]))/Math.max(.001,dt),-64,64));}
  return{offsets,velocities,duration};
 }
 INK.Articulation={version:'9.0.0',attachSnapshot(p,angles){for(const k of parts){if(!Array.isArray(angles?.[k])||angles[k].length!==2||!angles[k].every(Number.isFinite))throw TypeError('Invalid solved pose angles');}snapshots.set(p,Object.fromEntries(parts.map(k=>[k,angles[k].slice()])));return p;},settings,stats,prepare,inherit,stabilize,bake,angles,bodyLimits,attachTransition,bridge,clear(){cache=new WeakMap();contexts=new WeakMap();}};
})();
