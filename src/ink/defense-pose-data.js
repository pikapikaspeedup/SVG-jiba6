/* Phase 16 Pro five-state defense table. Feet are initialization/replant goals,
 * never a second live anchor plan. Wrists use chest-local native units. */
'use strict';
(()=>{
 const rows={"ryu":{"body":[[-2,4,1,4],[-6,70,6,0],[-4,8,-3,-4],[-7,74,3,-4],[-1,10,-1,10]],"w":[[0.34,-12,0.46,-22],[0.38,8,0.44,-18],[0.36,-48,0.5,-40],[0.46,30,0.48,-38],[0.58,-22,0.46,-32]],"extra":[139,42,-42,15,-15,25,15,-2,-88,96],"load":[0.45,0.38,0.42,0.35,0.48],"hands":["fist","fist"]},"ken":{"body":[[4,5,7,10],[2,64,13,8],[2,8,4,8],[0,68,10,6],[5,10,6,18]],"w":[[0.48,-8,0.46,-22],[0.46,14,0.46,-18],[0.44,-38,0.5,-38],[0.52,25,0.48,-32],[0.64,-15,0.46,-28]],"extra":[139,42,-42,18,-12,55,15,-1,-82,104],"load":[0.58,0.5,0.56,0.48,0.62],"hands":["guard","fist"]},"chun":{"body":[[-2,3,0,10],[-8,72,2,4],[-4,6,-2,16],[-8,74,0,12],[-3,8,-1,24]],"w":[[0.42,-18,0.48,-12],[0.38,12,0.44,-10],[0.48,-32,0.48,-30],[0.46,28,0.46,-26],[0.6,-10,0.44,-22]],"extra":[131,34,-33,10,-18,20,12,-1,-74,86],"load":[0.42,0.32,0.38,0.3,0.46],"hands":["palm","palm"]},"cammy":{"body":[[0,8,5,-6],[-2,80,10,-4],[-3,11,1,-10],[-4,83,6,-8],[-1,12,3,-14]],"w":[[0.3,-35,0.42,-28],[0.32,-12,0.4,-25],[0.3,-55,0.44,-45],[0.4,20,0.42,-38],[0.48,-28,0.42,-35]],"extra":[131,34,-33,30,-25,70,8,-4,-66,78],"load":[0.48,0.4,0.44,0.36,0.5],"hands":["fist","fist"]},"luke":{"body":[[2,8,4,8],[-3,66,10,4],[-2,11,-1,8],[-5,70,6,4],[1,12,1,14]],"w":[[0.34,-42,0.48,-38],[0.34,-15,0.46,-30],[0.34,-58,0.5,-48],[0.44,16,0.48,-40],[0.52,-28,0.48,-40]],"extra":[139,42,-42,18,-18,45,5,-5,-78,90],"load":[0.52,0.43,0.48,0.4,0.55],"hands":["fist","fist"]},"juri":{"body":[[-3,12,3,-20],[-8,88,11,-16],[-5,14,0,-24],[-9,90,7,-20],[-4,16,-1,-30]],"w":[[0.44,18,0.4,14],[0.42,28,0.42,0],[0.44,-20,0.48,-28],[0.5,40,0.44,-22],[0.62,4,0.42,-18]],"extra":[131,34,-33,30,-30,55,25,1,-78,60],"load":[0,0.25,0.18,0.28,0.1],"hands":["palm","palm"]},"mai":{"body":[[-4,6,2,18],[-7,72,7,14],[-6,9,-2,22],[-8,76,3,18],[-4,10,0,30]],"w":[[0.44,-12,0.44,-8],[0.4,14,0.42,-8],[0.48,-38,0.46,-32],[0.48,22,0.44,-28],[0.6,-18,0.44,-22]],"extra":[131,34,-33,12,-22,40,18,-1,-72,86],"load":[0.35,0.3,0.32,0.26,0.38],"hands":["grip","guard"]},"iori":{"body":[[4,20,12,-12],[2,86,20,-10],[1,24,8,-16],[0,88,15,-14],[4,24,10,-22]],"w":[[0.48,30,0.4,28],[0.46,36,0.42,20],[0.44,-18,0.48,-22],[0.54,38,0.46,-16],[0.62,12,0.44,-18]],"extra":[143,42,-42,-15,20,-25,12,-3,-96,112],"load":[0.56,0.5,0.52,0.46,0.58],"hands":["claw","claw"]}},rad=Math.PI/180,names=['stance','crouch','high','low','parry'];
 const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
 const data={};
 for(const [id,r] of Object.entries(rows)){
  const [length,frontX,rearX,betaF,betaR,kappa,eta,pitch,rearFoot,frontFoot]=r.extra,states={};
  for(let i=0;i<5;i++){
   const [bodyX,bob,lean,twist]=r.body[i],w=r.w[i],wrists={};
   for(const [key,index,x,y,z,beta] of [['front',0,frontX,5,8,betaF],['rear',2,rearX,3,-8,betaR]]){const rho=w[index],phi=w[index+1]*rad,b=beta*rad;wrists[key]=[x+rho*length*Math.cos(phi)*Math.cos(b),y+rho*length*Math.sin(phi),z+rho*length*Math.cos(phi)*Math.sin(b)];}
   // In-engine bilateral tuning: the original negative rear beta hid the
   // rear guard behind the torso. Keep a genuine shoulder-relative target at
   // the temple-side silhouette, with an outward elbow (no renderer depth fix).
   if(i===2||i===3){const rho=.52,phi=-36*rad,beta=80*rad;wrists.rear=[rearX+rho*length*Math.cos(phi)*Math.cos(beta),3+rho*length*Math.sin(phi),-8+rho*length*Math.cos(phi)*Math.sin(beta)];}
   if(i===3){wrists.front[0]-=12;wrists.front[1]-=9;}
   states[names[i]]={body:{bodyX,bob,lean,twist,yaw:0,head:pitch+[0,1,-3,-2,-1][i],headYaw:0},wrists,feet:{rear:[rearFoot,-16,-5],front:[frontFoot,id==='juri'&&i===0?-42:-16,5]},poles:{frontArm:[0,Math.cos(kappa*rad),Math.sin(kappa*rad)],rearArm:i===2||i===3?[-.7,.5,.5]:[0,Math.cos(kappa*rad),-Math.sin(kappa*rad)],frontLeg:[Math.cos(eta*rad),0,Math.sin(eta*rad)],rearLeg:[Math.cos(eta*rad),0,-Math.sin(eta*rad)]},hands:{front:r.hands[0],rear:r.hands[1]},frontLoad:r.load[i],fan:id==='mai'?[.35,.25,.55,.35,.65][i]:.7,fanAngle:id==='mai'?[35,50,70,-15,35][i]:0};
  }
  data[id]={...states,revision:'defense-pro-16-2-bilateral-guard',poleSpace:'body-local',durations:{down:4,up:5,guard:2,unguard:3,parry:2,hand:2},pressure:{bodyX:2,lean:2,bob:2},armYield:{ryu:6,ken:7,chun:6,cammy:5,luke:7,juri:8,mai:8,iori:8}[id]};
 }
 INK.DefenseData=freeze(data);
})();
