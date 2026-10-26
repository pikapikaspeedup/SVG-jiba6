/* A shared actor-screen frame. Legacy art is adapted exactly; only the grounded
 * locomotion family is reconstructed as a designed fixed-length 3D skeleton. */
'use strict';
(() => {
 const {mat}=INK,A=INK.Anatomy,solveLegacy=A.solve,sourceRig=A.sourceRig,skinLegacy=A.skinMatrices,handLegacy=A.handMatrix,footLegacy=A.footMatrix;
 const frames=new WeakMap(),names=['rearArm','frontArm','rearLeg','frontLeg'];
 const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),mul=(a,k)=>a.map(x=>x*k),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=a=>Math.hypot(...a),unit=(a,f=[1,0,0])=>length(a)>1e-9?mul(a,1/length(a)):f.slice(),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const rotate=(p,a)=>[p[0]*Math.cos(a)+p[2]*Math.sin(a),p[1],-p[0]*Math.sin(a)+p[2]*Math.cos(a)];
 const valid=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
 function twoBone3D(H,E,L1,L2,pole){
  if(!valid(H)||!valid(E)||!valid(pole)||![L1,L2].every(x=>Number.isFinite(x)&&x>0))throw TypeError('Finite 3D endpoints, pole vector and positive bone lengths required');
  const delta=sub(E,H),distance=length(delta),u=unit(delta,[0,1,0]),d=clamp(distance,Math.abs(L1-L2)+1e-7,L1+L2-1e-7),along=(L1*L1-L2*L2+d*d)/(2*d),height=Math.sqrt(Math.max(0,L1*L1-along*along));
  let bend=sub(pole,mul(u,dot(pole,u)));
  if(length(bend)<1e-8){const fallback=Math.abs(u[0])<.8?[1,0,0]:[0,0,1];bend=sub(fallback,mul(u,dot(fallback,u)));}
  const knee=add(add(H,mul(u,along)),mul(unit(bend),height)),end=add(H,mul(u,d));
  return {chain:[H.slice(),knee,end],residual:length(sub(end,E)),target:E.slice(),lengths:[L1,L2],reachable:Math.abs(distance-d)<.5};
 }
 // Positive-thickness orthographic section of a physical end frame. The
 // square root of its projected covariance has eigenvalues >= thickness²,
 // including when the original flat hand/sole is exactly edge-on.
 function thickFrame(u,v,n,at,scale,thickness,seedAngle){
  const xx=u[0]**2+v[0]**2+thickness*thickness*n[0]**2,xy=u[0]*u[1]+v[0]*v[1]+thickness*thickness*n[0]*n[1],yy=u[1]**2+v[1]**2+thickness*thickness*n[1]**2,d=Math.sqrt(Math.max(0,xx*yy-xy*xy)),den=Math.sqrt(xx+yy+2*d),S=[(xx+d)/den,xy/den,xy/den,(yy+d)/den,at[0],at[1]];
  return mat.multiply(S,mat.compose(0,0,seedAngle*180/Math.PI,scale,scale));
 }
 // authoredAngle is degrees; heading is radians. Thick ends retain an actual
 // section, while the fan deliberately uses the projected thin plane.
 function endBasis(chain,{kind='hand',heading=0,authoredAngle=0,reference}={}){
  if(kind==='foot'){const a=authoredAngle*Math.PI/180;return {u:rotate([Math.cos(a),Math.sin(a),0],heading),v:rotate([-Math.sin(a),Math.cos(a),0],heading),n:rotate([0,0,1],heading)};}
  const u=unit(sub(chain[2],chain[1])),ref=reference||rotate([0,0,1],heading);let n=unit(cross(sub(chain[1],chain[0]),sub(chain[2],chain[1])),ref);if(dot(n,ref)<0)n=mul(n,-1);
  return {u,v:unit(cross(n,u),rotate([0,1,0],heading)),n};
 }
 function thickEndFrame(chain,options={}){const {kind='hand',scale=1,authoredAngle=0}=options,{u,v,n}=endBasis(chain,options);return thickFrame(u,v,n,chain[2],scale,kind==='foot'?.6:.55,authoredAngle*Math.PI/180);}
 function thinFanFrame(chain,options={}){const {u,v}=endBasis(chain,options),s=options.scale??1,e=chain[2];return [u[0]*s,u[1]*s,v[0]*s,v[1]*s,e[0],e[1]];}
 const physicalLengths=source=>Object.fromEntries(names.map(name=>[name,[Math.hypot(...source[name][1].map((v,i)=>v-source[name][0][i])),Math.hypot(...source[name][2].map((v,i)=>v-source[name][1][i]))]]));
 const profile=f=>INK.Runtime?.profile?INK.Runtime.profile(f.ch.id):f.ch;
 const worldFor=(f,w={})=>({x:w.x??f.x??0,y:w.y??f.y??0,scale:w.scale||f.renderScale||f.ch.scale||1});
 const outer=(f,p,w)=>mat.multiply(mat.compose(0,0,0,(w?.dir??f.dir??1)*(p.depth||1),1),mat.multiply(mat.compose(p.rootShift||0,(p.floor||0)-180,p.spin||0),mat.compose(0,180)));
 const worldPoint=(p,w)=>[w.x+p[0]*w.scale,665+w.y+p[1]*w.scale,(p[2]||0)*w.scale];
 function headLegacyMatrix(p,r){const h=r.anatomy.sockets.head,hv=INK.Turn.view(INK.Turn.angle(p,'head'));return mat.compose(h[0]+hv.offset*.5,h[1],(p.lean||0)+(p.head||0)+(p.chest||0),.8+.2*hv.width,1);}
 function legacy(f,p,{world}={}){
  const c=profile(f),r=solveLegacy(c,p,{force:true}),B=outer(f,p,world),w=worldFor(f,world),rig={},sockets={},joints3D={},projectors={},depth={},turns={},surfaces={},endFrames={};
  for(const name of names){sockets[name]=r.anatomy.sockets[name].map(q=>mat.point(B,q));rig[name]=sockets[name];depth[name]=r.anatomy.depth[name].slice();turns[name]=r.anatomy.turns[name];projectors[name]=mat.multiply(B,r.anatomy.projectors[name]);joints3D[name]=sockets[name].map((q,i)=>[...q,depth[name][i]]);surfaces[name]=r.anatomy.surfaces[name];endFrames[name]=mat.multiply(B,name.includes('Leg')?footLegacy(p,r,c,name.startsWith('rear')):handLegacy(p,r,c,name.startsWith('rear')));}
  for(const name of ['pelvis','chest','neck','head'])sockets[name]=mat.point(B,r.anatomy.sockets[name]);
  Object.defineProperties(rig,{profile:{value:c},anatomy:{value:{source:r.anatomy.source,sockets,depth,turns,surfaces:Object.freeze(surfaces),projectors}}});
  return {space:'actor-screen',mode:'legacy',carrierSpec:{representation:'legacyProjected',nativeChains:r.anatomy.source,forwardBindings:Object.fromEntries(names.map(n=>[n,n.includes('Leg')?projectors[n]:mat.multiply(projectors[n],A.frameInfo(p).body)]))},physicalLengths:physicalLengths(r.anatomy.source),supportDrop:0,fanFrames:endFrames,legacyMatrix:B,legacyPose:INK.copy(p),legacyRig:r,rig,joints3D,skinMatrices:skinLegacy(p).map(m=>mat.multiply(B,m)),headMatrix:mat.multiply(B,headLegacyMatrix(p,r)),endFrames,materialAngles:{body:INK.Turn.angle(p),head:INK.Turn.angle(p,'head'),pelvis:INK.Turn.angle(p,'pelvis')},worldFeet:{rear:worldPoint(joints3D.rearLeg[2],w),front:worldPoint(joints3D.frontLeg[2],w)},residuals:{rear:0,front:0},bodyOuter:mat.identity()};
 }
 function persistentSurface(f,p,frame){
  // This is a template-basis correction, not a new attack skeleton. Grounded
  // mild-spin poses only; complex airborne/throw/spinning art stays compatible.
  const m=f.attack?.m;
  if(!f._inkFacing||f.dir>=0||f.y!==0||f.captured||f.airLock||m?.air||m?.throw||Math.abs(p.spin||0)>30||['captured','throwing','tumble','down','rise','ko'].includes(f.state))return frame;
  const H=[-1,0,0,1,0,0],old=frame.rig.anatomy,depth={},turns={},surfaces={},rig={},joints3D={...frame.joints3D},endFrames={},fanFrames={...frame.fanFrames};
  for(const name of names){
   rig[name]=frame.rig[name];depth[name]=old.depth[name].map(v=>-v);turns[name]=180-old.turns[name];
   const angle=turns[name],r=angle*Math.PI/180,s=old.surfaces[name];surfaces[name]=Object.freeze({...s,depth:Object.freeze(depth[name].slice()),segmentDepth:Object.freeze(s.segmentDepth.map(v=>-v)),turn:Object.freeze({angle,cos:Math.cos(r),sin:Math.sin(r)})});
   joints3D[name]=frame.joints3D[name].map(q=>[q[0],q[1],-q[2]]);
   const leg=name.endsWith('Leg'),c=frame.rig.profile,scale=leg?(c.female?.79:.88):(c.female?.7:c.id==='luke'?.88:.82),oldEnd=frame.endFrames[name],authoredAngle=leg?-((name.startsWith('rear')?p.rfoot:p.ffoot)||0)-(p.spin||0):Math.atan2(oldEnd[1],oldEnd[0])*180/Math.PI;
   endFrames[name]=thickEndFrame(joints3D[name],{kind:leg?'foot':'hand',scale,heading:turns[name]*Math.PI/180,authoredAngle});

  }
  Object.defineProperties(rig,{profile:{value:frame.rig.profile},anatomy:{value:{...old,depth,turns,surfaces:Object.freeze(surfaces)}}});
  return {...frame,rig,joints3D,endFrames,fanFrames,surfaceMode:'persistent-facing',skinMatrices:frame.skinMatrices.map(m=>mat.multiply(m,H)),headMatrix:mat.multiply(frame.headMatrix,H),materialAngles:Object.fromEntries(Object.entries(frame.materialAngles).map(([k,v])=>[k,180-v])),worldFeet:Object.fromEntries(Object.entries(frame.worldFeet).map(([k,q])=>[k,[q[0],q[1],-q[2]]]))};
 }
 function build(f,p,{world,time=f._inkVisualClock||0,facing=null,mode,persistentSurfaces=true}={}){
  const eligible=!f.attack&&!f.crouch&&!f.jumpPre&&f.y===0&&['idle','dash','rush'].includes(f.state);
  if(mode==='legacy')return legacy(f,p,{world});
  if(!eligible){const frame=legacy(f,p,{world});return persistentSurfaces?persistentSurface(f,p,frame):frame;}
  const c=profile(f),w=worldFor(f,world),raw=sourceRig(c,p),body=INK.bodyMatrix(p),torso=INK.Rig.torsoMatrices(p),base=f.dir<0?Math.PI:0;
  const headings={body:facing?.chest??facing?.heading??base,head:facing?.head??facing?.heading??base,pelvis:facing?.pelvis??facing?.heading??base};
  const rig={},joints3D={},sockets={},depth={},turns={},projectors={},surfaces={},endFrames={},fanFrames={},residuals={},gait=INK.Locomotion?.sample(f,time,world);
  const pivot=leg=>[torso[leg?0:2][4],torso[leg?0:2][5],0];
  const requests={},handoff=f._inkSupport?.handoff?.feet;let supportDrop=0;
  for(const key of ['rear','front']){
   const request=(facing?.ownsFeet===true||facing?.handoff||facing?.ownsFeet==null&&facing?.turning)?facing?.feet?.[key]:null,requested=request?.targetWorld||request,weight=request?(request.weight??1):(gait?.weights?.[key]??1);
   const chain=raw[key+'Leg'],z=(key==='rear'?-1:1)*5,hip=rotate([...chain[0],z],headings.pelvis),end=rotate([...chain[2],z],headings.pelvis),gaitGoal=gait?.feet3D?.[key]||gait?.feet?.[key],settled=handoff?.[key],complete=q=>[q[0],q[1],q.length>2?q[2]:end[2]*w.scale];
   let goal=Array.isArray(requested)?requested:null;
   if(!goal&&gaitGoal){goal=complete(gaitGoal);if(settled){const fallback=complete(settled),blend=clamp(gait.blend??1,0,1);goal=goal.map((v,i)=>fallback[i]+(v-fallback[i])*blend);}}
   if(!goal&&settled)goal=complete(settled);if(!goal)continue;
   const target=[(goal[0]-w.x)/w.scale,(goal[1]-665-w.y)/w.scale,goal.length>2?goal[2]/w.scale:end[2]],total=length(sub([...chain[1],0],[...chain[0],0]))+length(sub([...chain[2],0],[...chain[1],0]))-1e-5,dxz=(target[0]-hip[0])**2+(target[2]-hip[2])**2;
   requests[key]=target;
   const u=clamp((weight-.5)*2,0,1),loaded=u*u*(3-2*u),needed=Math.max(0,target[1]-hip[1]-Math.sqrt(Math.max(0,total*total-dxz)));
   supportDrop=Math.max(supportDrop,needed*loaded);
  }
  supportDrop=clamp(supportDrop,0,24);

  for(const name of names){
   const leg=name.includes('Leg'),rear=name.startsWith('rear'),heading=leg?headings.pelvis:headings.body,center=pivot(leg),z=(rear?-1:1)*(leg?5:8),original=raw[name].map(q=>leg?q:mat.point(body,q));
   const turnedCenter=add(rotate(center,heading),[0,supportDrop,0]),chain=original.map(q=>add(turnedCenter,rotate([q[0]-center[0],q[1]-center[1],z],heading)));
   if(leg){const key=rear?'rear':'front',target=requests[key];
    if(target){const axis=unit(sub(chain[2],chain[0])),bend=sub(sub(chain[1],chain[0]),mul(axis,dot(sub(chain[1],chain[0]),axis))),fit=twoBone3D(chain[0],target,length(sub(chain[1],chain[0])),length(sub(chain[2],chain[1])),length(bend)>1e-6?bend:rotate([rear?-1:1,0,0],heading));chain.splice(0,3,...fit.chain);residuals[key]=fit.residual*w.scale;
    }else residuals[key]=0;
   }
   joints3D[name]=chain;sockets[name]=chain.map(q=>q.slice(0,2));rig[name]=sockets[name];depth[name]=chain.map(q=>q[2]);turns[name]=heading*180/Math.PI;projectors[name]=mat.identity();surfaces[name]=A.surfaceInfo(c.id,original,sockets[name],depth[name],turns[name]);
   const scale=leg?(c.female?.79:.88):(c.female?.7:c.id==='luke'?.88:.82),authoredAngle=leg?((rear?p.rfoot:p.ffoot)||0):Math.atan2(original[2][1]-original[1][1],original[2][0]-original[1][0])*180/Math.PI,options={kind:leg?'foot':'hand',scale,heading,authoredAngle};
   endFrames[name]=thickEndFrame(chain,options);if(!leg)fanFrames[name]=thinFanFrame(chain,options);
  }
  // Torso sheets retain physical thickness while material headings remain
  // continuous; no actor-wide negative/zero scale is introduced.
  const skinMatrices=torso.map((m,i)=>{const heading=i===0?headings.pelvis:i===2?headings.body:(headings.pelvis+headings.body)*.5,width=Math.sqrt(Math.cos(heading)**2+.64**2*Math.sin(heading)**2),center=rotate([m[4],m[5],0],heading),vertical=rotate([m[2],m[3],0],heading),v=unit([vertical[0],vertical[1],0],[0,1,0]);return [v[1]*width,-v[0]*width,vertical[0],vertical[1],center[0],center[1]+supportDrop];});
  const torsoPoint=(q,heading)=>add(rotate([q[0],q[1],0],heading),[0,supportDrop,0]);
  const pelvis3=torsoPoint(mat.point(torso[0],[0,0]),headings.pelvis),chest3=torsoPoint(mat.point(torso[2],[0,3]),headings.body),neckRaw=mat.point(torso[2],[5,-29]),neck3=torsoPoint(neckRaw,headings.body),h=c.rigHeadOffset||[6,-46],headRaw=mat.point(torso[2],h),head3=add(neck3,rotate([headRaw[0]-neckRaw[0],headRaw[1]-neckRaw[1],0],headings.head));
  for(const [name,q]of Object.entries({pelvis:pelvis3,chest:chest3,neck:neck3,head:head3})){joints3D[name]=q;sockets[name]=q.slice(0,2);}
  const headWidth=Math.sqrt(Math.cos(headings.head)**2+.64**2*Math.sin(headings.head)**2),headVertical=rotate([torso[2][2],torso[2][3],0],headings.head),headAxis=unit([headVertical[0],headVertical[1],0],[0,1,0]),headMatrix=mat.multiply([headAxis[1]*(.8+.2*headWidth),-headAxis[0]*(.8+.2*headWidth),headAxis[0],headAxis[1],head3[0],head3[1]],mat.compose(0,0,p.head||0));
  Object.defineProperties(rig,{profile:{value:c},anatomy:{value:{source:raw,sockets,depth,turns,surfaces:Object.freeze(surfaces),projectors}}});
  return {space:'actor-screen',mode:'locomotion',physicalLengths:physicalLengths(raw),supportDrop,fanFrames,legacyMatrix:outer(f,p,world),legacyPose:INK.copy(p),legacyRig:solveLegacy(c,p,{force:true}),rig,joints3D,skinMatrices,headMatrix,endFrames,materialAngles:Object.fromEntries(Object.entries(headings).map(([k,v])=>[k,v*180/Math.PI])),worldFeet:{rear:worldPoint(joints3D.rearLeg[2],w),front:worldPoint(joints3D.frontLeg[2],w)},residuals,bodyOuter:mat.identity()};
 }
 const get=p=>p&&frames.get(p)||null,attach=(p,frame)=>{frames.set(p,frame);return p;};
 INK.VisualFrame={get,attach,build,legacy,twoBone3D,thickEndFrame,thinFanFrame};
})();
