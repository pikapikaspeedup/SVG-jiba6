/* FLOW 06 — data-driven presentation graph.
 * Base clip + inertial handoff (caller) -> masked additive/override layers ->
 * contact constraints -> the shared IK solver. World root motion remains combat
 * owned. Visual corrections never feed damage, hitboxes or movement rules.
 */
'use strict';
(() => {
  const {clamp,copy,mat}=INK;
  const channels=new Set(['lean','bob','head','chest','pelvis','headYaw','chestYaw','pelvisYaw','fan','fanAngle','ffoot','rfoot','fw','rw','fa','ra']);
  const settings={enabled:true,layers:true,contacts:true,springs:true};
  const stats={evaluations:0,layerEvaluations:0,contactEvaluations:0};
  let cache=new WeakMap();
  function validate(data) {
    const cfg=data.meta?.motion5;if(cfg===undefined)return true;
    const fail=msg=>{throw TypeError('Motion graph: '+msg);};
    if(!cfg||typeof cfg!=='object'||Array.isArray(cfg)||cfg.version!==1)fail('motion5.version must be 1');
    if(cfg.weightScale!==undefined&&(!Number.isFinite(cfg.weightScale)||cfg.weightScale<0||cfg.weightScale>1))fail('weightScale 0..1');
    if(cfg.layers!==undefined&&(!Array.isArray(cfg.layers)||cfg.layers.length>6))fail('at most six layers');
    const ids=new Set();
    for(const l of cfg.layers||[]) {
      if(!l||!/^[-a-zA-Z0-9_]{1,64}$/.test(l.id)||ids.has(l.id))fail('unique layer id required');ids.add(l.id);
      if(!['additive','override'].includes(l.mode))fail('layer mode additive/override');
      if(!l.tracks||typeof l.tracks!=='object'||Array.isArray(l.tracks)||Object.keys(l.tracks).length>12||!Object.keys(l.tracks).length)fail('1..12 layer tracks');
      if(Object.keys(l.tracks).some(k=>!channels.has(k)))fail('unsafe or combat-owned layer channel');
      INK.validateClip({version:1,id:'layer-validation',duration:data.duration,tracks:l.tracks});
      if(typeof l.weight==='number'){if(!Number.isFinite(l.weight)||l.weight<0||l.weight>1)fail('weight 0..1');}
      else {
        if(!Array.isArray(l.weight)||!l.weight.length)fail('weight curve required');
        INK.validateClip({version:1,id:'weight-validation',duration:data.duration,tracks:{fan:l.weight}});
        if(l.weight.some(k=>typeof k[1]!=='number'||k[1]<0||k[1]>1))fail('weight curve values 0..1');
      }
    }
    if(cfg.contacts!==undefined&&(!Array.isArray(cfg.contacts)||cfg.contacts.length>8))fail('at most eight contacts');
    ids.clear();const previous={};
    for(const c of (cfg.contacts||[]).slice().sort((a,b)=>a.start-b.start)) {
      if(!c||!/^[-a-zA-Z0-9_]{1,64}$/.test(c.id)||ids.has(c.id))fail('unique contact id');ids.add(c.id);
      if(!['frontFoot','rearFoot'].includes(c.socket))fail('contact must be a foot socket');
      if(!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<0||c.end<=c.start||c.end>data.duration)fail('contact range outside clip');
      if(previous[c.socket]>c.start)fail('same-foot contacts may not overlap');previous[c.socket]=c.end;
      for(const [key,min,max]of [['strength',0,1],['maxCorrection',1,60],['fadeIn',0,(c.end-c.start)/2],['fadeOut',0,(c.end-c.start)/2]]) {
        if(c[key]!==undefined&&(!Number.isFinite(c[key])||c[key]<min||c[key]>max))fail('invalid '+key);
      }
    }
    if(cfg.springs!==undefined) {
      if(!cfg.springs||typeof cfg.springs!=='object'||Array.isArray(cfg.springs))fail('spring settings object');
      for(const [key,min,max]of [['frequency',.08,1],['damping',.1,2],['hairStrength',0,1.8],['clothStrength',0,1.8]]) {
        if(cfg.springs[key]!==undefined&&(!Number.isFinite(cfg.springs[key])||cfg.springs[key]<min||cfg.springs[key]>max))fail('invalid spring '+key);
      }
    }
    return true;
  }
  function compiled(data) {
    let c=cache.get(data);if(c)return c;validate(data);
    c={clip:new INK.CompiledClip(data),layers:(data.meta?.motion5?.layers||[]).map(l=>({...l,
      channels:Object.entries(l.tracks).map(([k,v])=>[k,new INK.CompiledMotion.Track(v)]),
      weightTrack:typeof l.weight==='number'?null:new INK.CompiledMotion.Track(l.weight)}))};
    cache.set(data,c);return c;
  }
  function layers(data,frame,base,options=settings) {
    const p=copy(base);if(!options.enabled||!options.layers||!data.meta?.motion5)return p;
    for(const l of compiled(data).layers) {
      const w=clamp(l.weightTrack?l.weightTrack.sample(frame):l.weight)*(data.meta.motion5.weightScale??1);if(w===0)continue;
      for(const [key,track]of l.channels) {
        const v=track.sample(frame),from=p[key]??INK.basePose[key];
        const mix=(a,b)=>l.mode==='additive'?a+b*w:a+(b-a)*w;
        p[key]=Array.isArray(v)?v.map((x,i)=>mix(from[i],x)):mix(from,v);
      }
      stats.layerEvaluations++;
    }
    if('fan' in p)p.fan=clamp(p.fan);return p;
  }
  function rootMatrix(p,root={}) {
    const x=root.x||0,y=root.y||0,s=root.scale||1,dir=root.dir||root.facing||1;
    return mat.multiply(mat.compose(x,y,0,s*dir*(p.depth||1),s),
      mat.multiply(mat.compose(p.rootShift||0,(p.floor||0)-180,p.spin||0),mat.compose(0,180)));
  }
  function rootAt(context,t) {
    const rows=context?.history;if(!rows?.length)return context?.origin||context||{};
    if(t<=rows[0].t)return rows[0];if(t>=rows.at(-1).t)return rows.at(-1);
    let i=1;while(rows[i].t<t)i++;const a=rows[i-1],b=rows[i],u=(t-a.t)/(b.t-a.t);
    return {x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,scale:(a.scale||1)+((b.scale||1)-(a.scale||1))*u,dir:u<1?a.dir:b.dir};
  }
  function compose(record,frame,base,profile,context=null,options=settings) {
    const data=record?.clip||record;if(!data)return copy(base);
    const p=layers(data,frame,base,options);stats.evaluations++;
    const ready=()=>INK.Articulation?INK.Articulation.prepare(p,data,frame,profile):p;
    if(!options.enabled||!options.contacts||!profile||context?.airborne)return ready();
    const contacts=data.meta?.motion5?.contacts||[];
    for(const c of contacts) {
      if(frame<c.start||frame>=c.end)continue;
      const ease=INK.Motion.smoother,fadeIn=c.fadeIn??2,fadeOut=c.fadeOut??3;
      const weight=(c.strength??1)*(fadeIn?ease((frame-c.start)/fadeIn):1)*(fadeOut?ease((c.end-frame)/fadeOut):1);
      if(weight<=0)continue;
      const compiledData=compiled(data);compiledData.contactRefs??=new Map();
      const referenceKey=c.id+'|'+JSON.stringify([profile.rigLengths,profile.rigRearShoulder,profile.rigFrontShoulder,profile.rigHipWidth,options.enabled,options.layers,INK.Anatomy?.settings,INK.Articulation?.settings]);
      let reference=compiledData.contactRefs.get(referenceKey);
      if(!reference){const ref=layers(data,c.start,compiledData.clip.sample(c.start),options);reference={ref,rig:INK.Rig.solveAnimation(profile,ref)};if(compiledData.contactRefs.size>=32)compiledData.contactRefs.clear();compiledData.contactRefs.set(referenceKey,reference);}
      const {ref,rig}=reference;
      const part=c.socket==='frontFoot'?'frontLeg':'rearLeg',key=c.socket==='frontFoot'?'fa':'ra';
      const world=mat.point(rootMatrix(ref,rootAt(context,c.start)),rig[part][2]);
      const projected=mat.point(mat.inverse(rootMatrix(p,context||{})),world);
      const target=INK.Anatomy?INK.Anatomy.inverseTarget(p,projected,part,profile):projected;
      let dx=target[0]-p[key][0],dy=target[1]-p[key][1],distance=Math.hypot(dx,dy);
      const limit=c.maxCorrection??32;if(distance>limit){dx*=limit/distance;dy*=limit/distance;}
      p[key]=[p[key][0]+dx*weight,p[key][1]+dy*weight];stats.contactEvaluations++;
    }
    return ready();
  }
  INK.MotionGraph={compose,layers,rootMatrix,rootAt,validate,settings,stats,version:'6.0.0',clear(){cache=new WeakMap();}};
})();
