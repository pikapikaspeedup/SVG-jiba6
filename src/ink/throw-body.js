/* Paired throw presentation. Existing simulation owns capture roots and release. */
'use strict';
(() => {
 const settings={enabled:true},clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
 const profiles=Object.freeze({ryu:'hip',ken:'drive',chun:'leg',cammy:'coil',luke:'shoulder',juri:'side',mai:'fan',iori:'claw'});
 const active=()=>settings.enabled&&INK.Kinetic?.settings.enabled;
 function phase(action){if(!action||action.done)return null;const t=Math.max(0,action.t||0),release=Math.max(1,action.release||26),duration=Math.max(release+1,action.duration||52),u=t/release;
  return {t,release,duration,air:action.m?.kind==='airthrow'||action.originY<-8,back:!!action.back,name:t<4?'grip':u<.42?'load':t<release?'turn':'release',grip:smooth(t/4)*(1-smooth((t-release+3)/3)),load:Math.sin(Math.PI*clamp(u/.75))**2,turn:smooth((u-.25)/.65),settle:1-smooth((t-release)/(duration-release)),released:t>=release};}
 function pose(f,source){if(!active())return source;const a=f.throwAction,q=phase(a),tech=f._inkThrowTech,now=f._inkVisualClock||0;
  if(!q){const attack=f.attack,m=attack?.m,end=m?m.startup+m.active:0;
   if(f.state==='attack'&&m?.throw&&!attack.confirmed&&attack.t>=end){
    const u=clamp((attack.t-end)/Math.max(1,m.recovery)),reach=Math.sin(Math.PI*clamp(u/.65))**2,expose=Math.sin(Math.PI*u)**2,p=INK.copy(source);
    for(const [k,x,y]of [['fw',25,-4],['rw',12,5]])if(Array.isArray(p[k]))p[k]=[p[k][0]+x*reach,p[k][1]+y*reach];
    p.lean=(p.lean||0)+8*expose;p.chest=(p.chest||0)+4*expose;p.open=Math.max(p.open||0,.7*reach);p.handFront='guard';p.handRear='guard';return INK.Articulation.inherit(source,p);
   }
   if(!tech||now<tech.actorBirth||now>=tech.actorBirth+(tech.duration||8)||!['idle','recovery'].includes(f.state))return source;
   const p=INK.copy(source),u=(now-tech.actorBirth)/(tech.duration||8),w=Math.sin(Math.PI*u)*(1-u),sign=(tech.dir||f.dir)*f.dir;
   for(const key of ['fw','rw'])if(Array.isArray(p[key]))p[key]=[p[key][0]-sign*10*w,p[key][1]-5*w];p.chestYaw=(p.chestYaw||0)-sign*5*w;p.handFront='guard';p.handRear='guard';return INK.Articulation.inherit(source,p);
  }
  const owner=a.owner===f;if(!owner&&a.target!==f)return source;
  if(!owner&&q.released)return source;
  const styleMap={'hip-toss':'hip','shoulder-slam':'shoulder','leg-vault':'leg','fan-vault':'fan','claw-slam':'claw'},p=INK.copy(source),style=profiles[a.owner?.ch.id]||styleMap[a.m?.throwStyle]||'hip',load=q.load,turn=q.turn*(q.back?-1:1),fade=q.released?q.settle:1;
  const add=(k,v)=>p[k]=(p[k]||0)+v*fade,elbow=(k,x,y)=>{if(Array.isArray(p[k]))p[k]=[p[k][0]+x*fade,p[k][1]+y*fade];};
  if(owner){
   add('pelvis',-3*load);add('chest',-2*load);add('chestYaw',5*turn);add('pelvisYaw',-3*turn);add('head',-2*load);
   if(q.air){add('chest',-3*load);add('pelvis',2*load);add('turn',.035*turn);}
   else add('bob',3*load);
   // Large silhouette changes live in the supporting leg and torso, not the
   // contact wrists. All offsets remain local to the original capture trajectory.
   const liftBell=Math.sin(Math.PI*clamp(q.t/q.release)),pivot=turn*(q.air?.45:1);
   switch(style){
    case 'hip':
     add('pelvisYaw',-15*pivot);add('chestYaw',9*turn);add('pelvis',-7*load);add('bob',q.air?0:10*load);add('lean',-7*load+5*turn);
     elbow('rk',-17*load,-9*load);elbow('ra',-18*load,0);add('rfoot',-18*pivot);elbow('re',-8*load,-7*turn);break;
    case 'drive':
     add('lean',12*load-8*turn);add('chestYaw',12*turn);add('pelvisYaw',-5*turn);elbow('fk',18*load,-5*load);elbow('ra',-24*load,0);add('rfoot',12*pivot);elbow('fe',12*load,-8*turn);break;
    case 'leg':
     add('pelvisYaw',14*turn);add('chestYaw',-16*turn);add('lean',-9*liftBell);elbow('fa',-24*liftBell,-58*liftBell);elbow('fk',-14*liftBell,-35*liftBell);add('ffoot',-22*liftBell);elbow('re',-12*turn,-10*load);break;
    case 'coil':
     add('turn',.13*turn);add('chestYaw',18*turn);add('pelvisYaw',-18*turn);add('lean',-10*load);elbow('fa',-28*liftBell,-37*liftBell);elbow('fk',-23*liftBell,-24*liftBell);elbow('rk',15*load,-12*load);add('rfoot',-20*pivot);elbow('fe',-10*load,9*turn);break;
    case 'shoulder':
     add('chest',-11*load);add('head',-8*load);add('pelvis',-6*load);add('bob',q.air?0:13*load);add('lean',-10*load+12*turn);elbow('fk',14*load,-13*load);elbow('rk',-14*load,-13*load);elbow('fe',8*load,-16*load);elbow('re',-6*load,-13*load);break;
    case 'side':
     add('pelvisYaw',22*turn);add('chestYaw',-21*turn);add('lean',-13*load);elbow('fa',27*liftBell,-43*liftBell);elbow('fk',22*liftBell,-27*liftBell);add('ffoot',24*liftBell);add('rfoot',-14*pivot);elbow('re',-16*turn,4*load);break;
    case 'fan':
     add('turn',.1*turn);add('open',.12*load);add('chestYaw',-9*turn);elbow('ra',-24*liftBell,-29*liftBell);elbow('rk',-16*liftBell,-18*liftBell);add('rfoot',18*liftBell);elbow('re',-15*load,-15*turn);add('fanAngle',14*turn);break;
    case 'claw':
     add('lean',14*load);add('chestYaw',-16*turn);add('head',-8*turn);add('pelvis',-7*load);add('bob',q.air?0:11*load);elbow('fa',16*load,0);elbow('ra',-20*load,0);elbow('fk',17*load,-10*load);elbow('rk',-15*load,-8*load);elbow('fe',9*load,15*load);break;
   }
   if(q.back){add('pelvisYaw',-5*q.turn);add('chestYaw',3*q.turn);add('lean',-2*q.load);}
   if(!q.released){const bodyYaw=INK.Turn?.angle(p,'body')||0,armOffset=clamp(-bodyYaw*.78,-155,155)*q.grip;p.frontArmYaw=(p.frontArmYaw||0)+armOffset;p.rearArmYaw=(p.rearArmYaw||0)+armOffset;p.handFront=style==='claw'?'claw':'grip';p.handRear=style==='claw'?'claw':'grip';p.expression='brace';}
  }else{
   add('chest',-7*load);add('head',7*load);add('chestYaw',-6*turn);add('pelvisYaw',5*turn);elbow('fa',-12*load,-20*load);elbow('ra',12*load,-16*load);elbow('fk',-6*load,-12*load);elbow('rk',6*load,-10*load);elbow('fe',-5*load,3*load);elbow('re',5*load,3*load);p.handFront='guard';p.handRear='guard';
  }
  return INK.Articulation.inherit(source,p);
 }
 const diagnostics=new WeakMap();
 function constrain(f,source,context){const a=f.throwAction,q=phase(a);if(!active()||!q||a.owner!==f||q.released||q.grip<=0||!context?.rig?.anatomy||typeof context.toWorld!=='function'||typeof context.toLocal!=='function')return source;
  const rig=context.rig,solved=rig.anatomy.source,parts=['frontArm','rearArm','frontLeg','rearLeg'],angles=Object.fromEntries(parts.map(k=>[k,INK.Articulation.angles(solved[k])])),p=INK.Articulation.inherit(source,INK.copy(source)),report={};
  for(const [side,name] of [['front','frontArm'],['rear','rearArm']]){
   const chain=solved[name],length=(x,y)=>Math.hypot(x[0]-y[0],x[1]-y[1]),l1=length(chain[1],chain[0]),l2=length(chain[2],chain[1]),pole=p[name+'Pole']??(side==='rear'?1:-1);
   const projection=INK.mat.multiply(rig.anatomy.projectors[name],INK.bodyMatrix(p)),project=point=>context.toWorld(INK.mat.point(projection,point));
   // Damped least-squares inverse retains the null-space authored position at
   // edge-on yaw instead of dividing by a tiny cosine or freezing all x motion.
   const evaluate=anchor=>{const local=context.toLocal(anchor),prior=chain[2],at=INK.mat.point(projection,prior),dx=local[0]-at[0],dy=local[1]-at[1],aa=projection[0],bb=projection[1],cc=projection[2],dd=projection[3],damp=.0001;
    const u=aa*aa+bb*bb+damp,v=aa*cc+bb*dd,w=cc*cc+dd*dd+damp,det=u*w-v*v,bx=aa*dx+bb*dy,by=cc*dx+dd*dy;
    const raw=[prior[0]+(w*bx-v*by)/det,prior[1]+(u*by-v*bx)/det],rx=raw[0]-chain[0][0],ry=raw[1]-chain[0][1],reach=Math.hypot(rx,ry),bound=Math.min(1,(l1+l2)*2/Math.max(.001,reach)),aim=[chain[0][0]+rx*bound,chain[0][1]+ry*bound];

    const adjusted=INK.Anatomy.chain(chain[0],aim,l1,l2,pole,false),actual=project(adjusted[2]),error=Math.hypot(actual[0]-anchor[0],actual[1]-anchor[1]);
    const original=project(prior),move=Math.hypot(actual[0]-original[0],actual[1]-original[1]),preferred=context.anchors?.[side]||original,offset=Math.hypot(anchor[0]-preferred[0],anchor[1]-preferred[1]);return {anchor,aim,error,score:error*error+.015*offset*offset+.0002*move*move};};
   const segments=context.regions?.[side]||[],fallback=context.anchors?.[side];let best=null,candidates=[];
   const accept=result=>{if(!best||result.score<best.score)best=result;};
   if(Array.isArray(fallback)&&fallback.every(Number.isFinite))accept(evaluate(fallback));
   for(let index=0;index<segments.length;index++){
    const segment=segments[index];if(!Array.isArray(segment)||segment.length!==2||!segment.every(pt=>Array.isArray(pt)&&pt.length===2&&pt.every(Number.isFinite)))continue;
    const at=t=>{const result=evaluate([segment[0][0]+(segment[1][0]-segment[0][0])*t,segment[0][1]+(segment[1][1]-segment[0][1])*t]);return {...result,segment:index,t};};
    let localBest=at(0);candidates.push(localBest);for(let i=1;i<=8;i++){const test=at(i/8);candidates.push(test);if(test.score<localBest.score)localBest=test;}
    let lo=Math.max(0,localBest.t-.125),hi=Math.min(1,localBest.t+.125);for(let i=0;i<(segments.length===3?0:8);i++){const left=lo+(hi-lo)/3,right=hi-(hi-lo)/3;if(at(left).score<at(right).score)hi=right;else lo=left;}
    accept(localBest);if(segments.length!==3)accept(at((lo+hi)/2));
   }
   if(!best)continue;
   // The three regions form one continuous body path: elbow -> shoulder ->
   // chest -> abdomen. A soft minimum in its arc-length parameter prevents a
   // hard winner switch from teleporting the hand between disjoint candidates.
   if(segments.length===3){
    const lengths=segments.map(segment=>length(segment[0],segment[1])),total=lengths.reduce((sum,v)=>sum+v,0);let sum=0,param=0;
    for(const candidate of candidates){const index=candidate.segment??1,t=candidate.t??.3,s=index===0?(1-t)*lengths[0]:index===1?lengths[0]+t*lengths[1]:lengths[0]+lengths[1]+t*lengths[2],weight=Math.exp(-Math.min(80,(candidate.score-best.score)/25));sum+=weight;param+=weight*s;}
    let s=clamp(param/Math.max(1e-9,sum),0,total),index,t;if(s<=lengths[0]){index=0;t=1-s/Math.max(.001,lengths[0]);}else if(s<=lengths[0]+lengths[1]){index=1;t=(s-lengths[0])/Math.max(.001,lengths[1]);}else{index=2;t=(s-lengths[0]-lengths[1])/Math.max(.001,lengths[2]);}
    const segment=segments[index];best={...evaluate([segment[0][0]+(segment[1][0]-segment[0][0])*t,segment[0][1]+(segment[1][1]-segment[0][1])*t]),segment:index,t};
   }
   const aim=[chain[2][0]+(best.aim[0]-chain[2][0])*q.grip,chain[2][1]+(best.aim[1]-chain[2][1])*q.grip],adjusted=INK.Anatomy.chain(chain[0],aim,l1,l2,pole,false),actual=project(adjusted[2]);angles[name]=INK.Articulation.angles(adjusted);
   report[side]={anchor:best.anchor.slice(),actual,error:Math.hypot(actual[0]-best.anchor[0],actual[1]-best.anchor[1]),segment:best.segment??-1,t:best.t??0,grip:q.grip};
  }
  INK.Articulation.attachSnapshot(p,angles);diagnostics.set(p,report);return p;
 }
 function inspect(p){const q=diagnostics.get(p);return q?JSON.parse(JSON.stringify(q)):null;}
 INK.ThrowBody={settings,profiles,active,phase,pose,constrain,inspect};
})();
