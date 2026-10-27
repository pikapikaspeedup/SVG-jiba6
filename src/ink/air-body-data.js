/* Pro18 section 3: eight authored native airborne silhouettes. Angles degrees,
 * rho relative to each actual limb length; no combat-root displacement. */
'use strict';
(()=>{
 const raw={
 ryu:{B:[[0,2,-3,-4,2],[0,0,-1,-2,0],[2,4,4,2,-3],[2,12,8,2,-5]],yaw:[-3,0,2,0],legs:'.52,20,5/.66,45,170;.46,15,10/.58,42,165;.72,55,4/.78,65,175;.89,70,4/.89,72,176',arms:[[.52,-22,15],[.52,-38,80]],pole:[25,15],hands:['fist','guard'],sink:8,land:[3,5]},
 ken:{B:[[3,0,8,-10,-4],[4,-2,10,-6,-5],[5,2,12,6,-6],[4,14,12,4,-6]],yaw:[-8,-4,4,0],legs:'.44,12,-8/.76,48,165;.43,5,-12/.62,38,160;.76,50,0/.66,70,170;.90,67,0/.88,74,178',arms:[[.48,-24,5],[.48,-40,80]],pole:[55,15],hands:['fist','guard'],sink:8,land:[2,5]},
 chun:{B:[[0,-3,-1,12,1],[-1,-5,-3,16,2],[2,1,4,8,-2],[1,14,6,3,-3]],yaw:[10,12,6,0],legs:'.50,-8,20/.55,30,145;.43,-12,30/.48,18,150;.80,52,10/.62,62,160;.88,68,6/.85,72,174',arms:[[.55,-30,28],[.50,-34,92]],pole:[20,12],hands:['palm','palm'],sink:10,land:[3,5]},
 cammy:{B:[[4,0,12,-6,-5],[5,-2,14,-4,-7],[4,0,10,2,-5],[2,8,10,0,-5]],yaw:[-4,-6,0,0],legs:'.62,30,-5/.78,62,178;.50,20,-8/.66,48,175;.82,62,0/.80,73,178;.90,72,2/.89,76,178',arms:[[.30,-32,8],[.46,-42,82]],pole:[70,8],hands:['fist','guard'],sink:5,land:[4,2]},
 luke:{B:[[1,4,2,-8,-1],[0,2,1,-6,0],[2,5,6,2,-3],[2,14,10,2,-5]],yaw:[-6,-4,2,0],legs:'.58,35,-8/.68,50,170;.53,24,-5/.60,42,170;.76,58,0/.76,66,175;.88,70,3/.87,72,177',arms:[[.50,-22,8],[.52,-36,80]],pole:[45,5],hands:['fist','guard'],sink:8,land:[3,4]},
 juri:{B:[[-3,-2,-7,16,4],[-4,-5,-11,22,6],[0,2,-2,12,1],[-2,22,5,7,-3]],yaw:[15,24,10,4],legs:'.40,-18,25/.86,70,178;.35,-24,35/.78,60,174;.70,35,12/.88,73,177;.78,60,8/.81,76,178',arms:[[.58,-8,30],[.48,-26,105]],pole:[55,25],hands:['palm','palm'],sink:12,land:[5,2]},
 mai:{B:[[1,-2,3,20,-2],[0,-4,1,28,-1],[2,2,7,14,-4],[1,16,8,6,-4]],yaw:[14,22,8,0],legs:'.52,18,35/.65,42,145;.46,8,45/.56,26,145;.77,50,22/.72,64,155;.87,69,12/.85,74,168',arms:[[.54,-10,35],[.50,-30,95]],pole:[40,18],hands:['grip','guard'],sink:10,land:[3,5]},
 iori:{B:[[6,8,18,-12,-8],[7,7,22,-8,-10],[6,10,20,6,-9],[5,20,20,3,-9]],yaw:[-10,-8,2,0],legs:'.64,36,-12/.78,58,170;.56,24,-15/.67,42,165;.80,52,-8/.75,68,172;.87,66,0/.83,74,178',arms:[[.64,18,-18],[.56,4,100]],pole:[-25,12],hands:['claw','claw'],sink:8,land:[2,4]}
 };
 const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;},clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v);},rad=Math.PI/180;
 for(const row of Object.values(raw))row.legs=row.legs.split(';').map(s=>s.split('/').map(v=>v.split(',').map(Number)));freeze(raw);
 // Keep the tucked apex pose while the body is still high, then extend the
 // legs gradually as the fighter approaches the floor.
 function desiredPhase(y,vy){if(vy<0)return smooth((vy+12)/12);return 1+2*smooth((y+240)/240);}
 function sample(id,{phase=0}={}){const r=raw[id];if(!r)return null;const q=clamp(phase,0,3),i=Math.min(2,Math.floor(q)),u=smooth(q-i),at=a=>a[i]+(a[i+1]-a[i])*u,vector=a=>a[i].map((v,k)=>v+(a[i+1][k]-v)*u),B=vector(r.B),yaw=at(r.yaw),rotate=v=>[v[0]*Math.cos(yaw*rad)+v[2]*Math.sin(yaw*rad),v[1],-v[0]*Math.sin(yaw*rad)+v[2]*Math.cos(yaw*rad)],alpha=r.pole[0]*rad,kappa=r.pole[1]*rad;
  const front=r.arms[0].slice(),rear=r.arms[1].slice();front[0]+=at([0,-.02,.03,-.04]);front[1]+=at([0,-6,6,-2]);rear[1]+=at([0,-4,2,-2]);
  return {entryFrames:14,transitionFrames:4,bodyX:B[0],pose:{bodyX:B[0],bob:B[1],lean:B[2],twist:B[3],head:B[4],yaw,handFront:r.hands[0],handRear:r.hands[1],...(id==='mai'?{fan:at([.72,.85,.60,.45]),fanAngle:at([-15,-35,-5,10])}:{})},polarTargets:{frontArm:front,rearArm:rear,frontLeg:vector(r.legs.map(v=>v[0])),rearLeg:vector(r.legs.map(v=>v[1]))},poles:{frontArm:rotate([0,Math.cos(alpha),Math.sin(alpha)]),rearArm:rotate([0,Math.cos(alpha),-Math.sin(alpha)]),frontLeg:rotate([Math.cos(kappa),0,Math.sin(kappa)]),rearLeg:rotate([-Math.cos(kappa),0,-Math.sin(kappa)])}};
 }
 INK.AirBodyData=Object.freeze({revision:"air-body-pro18-1",rows:raw,sample,desiredPhase,preparation:freeze(Object.fromEntries(Object.entries(raw).map(([id,r])=>[id,r.sink]))),landing:freeze(Object.fromEntries(Object.entries(raw).map(([id,r])=>[id,{front:r.land[0],rear:r.land[1]}])))});
})();
