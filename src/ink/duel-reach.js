/* Sparse own-move geometry query; no opponent prediction or combat mutation. */
'use strict';
(() => {
 const frozen=rows=>Object.freeze(rows.map(r=>Object.freeze(r)));
 function supports(m){return !!m&&m.category==='normal'&&['s','c'].includes(m.normalState)&&!m.throw&&!m.air&&!m.travel&&!m.movementStrike&&!String(m.kind).includes('projectile')&&Number.isFinite(m.startup)&&m.startup>=0&&Number.isFinite(m.active)&&m.active>=1;}
 function sample(f,m,geometry){
  if(!supports(m)||typeof geometry!=='function')return null;
  const first=Math.ceil(m.startup),last=Math.ceil(m.startup+m.active)-1;if(last<first)return null;
  const times=[...new Set([first,Math.floor((first+last)/2),last])],frames=[];
  for(const t of times){
   const view=Object.create(f);Object.assign(view,{state:'attack',stateT:0,stateAge:t,attack:{m,t,confirmed:false,hitConfirmed:false,holding:false,hitsDone:new Set(),contacted:new Set()},x:0,y:0,px:0,py:0,dir:1,intentDir:1,crouch:m.normalState==='c',move:0,jumpPre:0,airLock:false,captured:false,throwAction:null,walkT:0,push:0,vx:0,vy:0,_inkTransition:null,_inkVisualTransition:null,_inkJointTransition:null,_inkStateVisualBlend:null,_inkStateBlend:null,_inkFrameTransition:null,_inkFacing:null,_inkLocomotion:null,_inkSupport:null,_inkHitEpisode:null,_inkHitBody:null,_inkReaction:null,_inkRecoil:null,_inkWeight:null,_inkPrevView:null,_inkHistory:null,_inkMotor:null,_inkPursuit:null,_inkDefense:null,_inkMovementStrike:null,_inkTempo:null,_inkVisualClock:t,_inkRawVisual:true,_poseSimulationFrame:null,_poseVelocity:null,pose:null});
   const result=geometry(view),hit=[];
   for(const r of result?.hit||[]){if(![r.x,r.y,r.w,r.h].every(Number.isFinite)||r.w<0||r.h<0)continue;hit.push({x:r.x,y:r.y-665,w:r.w,h:r.h,part:typeof r.part==='string'?r.part:null});}
   frames.push(Object.freeze({t,hit:frozen(hit),forward:Math.max(0,...hit.map(r=>r.x+r.w))}));
  }
  return Object.freeze({character:f.ch.id,move:m.id,scale:f.renderScale||f.ch.scale||1,space:'root-local-world-units',floor:665,frames:Object.freeze(frames),forward:Math.max(0,...frames.map(r=>r.forward)),sparse:true});
 }
 INK.DuelReach={supports,sample};
})();
