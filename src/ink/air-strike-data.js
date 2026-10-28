/* Pro18 sections 4.1–4.6. Native polar [rho,elevation,depth] in degrees;
 * timing labels are resolved against the committed prepared move, not constants. */
'use strict';
(()=>{
 const raw={
 ryu:{mp:'.40,32,-10;.74,-10,-5;.90,-22,0;.84,-30,5;.48,14,10',hk:'.40,-18,4;.80,10,-4;.96,20,0;.90,30,6;.50,38,12',hp:'.42,38,-16;.70,-28,-6;.94,-58,0;.88,-76,8;.52,-12,16',mpD:[1,1,4,6,0],hkD:[-2,0,-10,6,0],hpB:[[-3,60,8,-12,0],[0,38,-5,14,0]],rear:[.62,58,176],load:.42,timing:[8,5,24]},
 ken:{mp:'.42,48,-28;.66,-4,-24;.80,-23,0;.70,-42,28;.46,20,34',hk:'.42,-12,-28;.78,5,-20;.93,22,0;.84,40,26;.46,46,30',hp:'.42,55,-30;.67,-22,-22;.88,-52,4;.78,-74,30;.48,12,34',mpD:[3,0,8,20,3],hkD:[1,-2,-8,18,6],hpB:[[-2,56,12,-20,-1],[5,36,3,26,2]],rear:[.54,38,158],load:.58,timing:[9,5,23]},
 chun:{mp:'.42,18,28;.76,-16,14;.94,-28,2;.87,-35,-12;.50,2,-22',hk:'.38,-26,18;.84,8,10;.97,20,0;.93,32,-10;.45,24,-18',hp:'.40,24,24;.74,-38,12;.97,-68,2;.90,-82,-10;.48,-16,-18',mpD:[0,-2,1,10,0],hkD:[-3,-3,-12,10,4],hpB:[[0,60,2,-8,-2],[-2,32,-8,10,4]],rear:[.48,22,165],load:.34,timing:[10,6,25]},
 cammy:{mp:'.36,8,-6;.78,-20,-4;.94,-24,0;.90,-26,4;.40,0,8',hk:'.40,-20,-5;.84,18,-3;.96,28,0;.91,37,4;.40,30,8',hp:'.34,18,-6;.74,-34,-3;.92,-59,0;.86,-74,5;.40,-12,8',mpD:[2,-1,4,3,0],hkD:[0,-2,-14,4,0],hpB:[[2,52,10,-6,0],[2,34,0,6,0]],rear:[.60,65,178],load:.50,timing:[8,5,22]},
 luke:{mp:'.42,38,-14;.68,-10,-10;.83,-24,0;.77,-32,10;.48,20,16',hk:'.48,-6,-10;.78,12,-8;.91,26,0;.86,36,10;.54,44,14',hp:'.42,52,-15;.64,-26,-10;.85,-56,0;.79,-70,12;.50,18,18',mpD:[3,3,7,12,0],hkD:[-1,2,-8,8,0],hpB:[[-2,58,16,-14,0],[4,42,4,16,0]],rear:[.66,60,174],load:.64,timing:[8,6,25]},
 juri:{mp:'.44,24,34;.66,-6,32;.86,-27,4;.78,-42,-26;.46,14,-34',hk:'.40,-28,-45;.82,6,-36;.96,20,0;.88,38,34;.46,8,44',hp:'.44,34,38;.68,-34,30;.91,-64,0;.80,-78,-28;.48,-4,-36',mpD:[-1,-2,-5,-22,6],hkD:[-4,-4,-18,-26,24],hpB:[[-4,70,-2,18,-6],[-6,46,-12,-22,12]],rear:[.82,74,175],load:.25,timing:[9,5,23]},
 mai:{mp:'.39,32,-26;.63,-18,-17;.85,-41,0;.74,-56,24;.43,8,28',hk:'.44,-22,-34;.80,3,-21;.97,21,2;.87,37,30;.47,36,38',hp:'.38,43,-35;.61,-23,-26;.88,-58,0;.77,-76,28;.43,14,34',mpD:[0,-3,-5,31,9],hkD:[-3,-4,-17,38,22],hpB:[[-2,64,5,-23,-6],[0,38,-9,32,14]],rear:[.58,38,145],load:.40,timing:[10,5,25]},
 iori:{mp:'.48,38,-26;.70,0,-20;.91,-24,0;.84,-43,20;.54,32,26',hk:'.50,2,18;.80,15,12;.95,29,0;.87,43,-14;.57,54,-20',hp:'.50,50,-36;.73,-20,-24;.95,-52,0;.86,-74,26;.58,20,34',mpD:[3,2,8,-20,-3],hkD:[1,3,-6,-18,-6],hpB:[[4,72,22,-20,2],[6,52,8,-26,-5]],rear:[.70,58,168],load:.62,timing:[9,5,24]}
 };
 const keys=['bodyX','bob','lean','twist','yaw'],weights=[-.35,.8,1,.65,.15,0],bob=[.6,.8,1,.7,.25,0],labels=['P','A0','Am','A1','R1','T'],freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
 const family={ryu:'direct-intercept',ken:'rotating-short-hook',chun:'rising-palm',cammy:'compact-pierce',luke:'compressed-boxing',juri:'coiling-palm-leg',mai:'fan-surface-cut',iori:'diagonal-claw'};
 const fan={aMP:[[.26,.72,1,.78,.35],[-28,-8,-42,-64,-12]],aHK:[[.5,.65,.65,.5,.4],[-10,-15,-20,-10,10]],cHP:[[.35,.74,1,.88,.4],[30,-8,-38,-66,12]]},data={};
 for(const [id,r]of Object.entries(raw))for(const [move,kind]of [['aMP','mp'],['aHK','hk'],['cHP','hp']]){
  const values=r[kind].split(';').map(v=>v.split(',').map(Number)),air=move!=='cHP',nodes=labels.map((label,i)=>{let body;if(air){const peak=r[kind+'D'];body=Object.fromEntries(keys.map((k,j)=>[k,peak[j]*(k==='bob'?bob[i]:weights[i])]));body.head=Math.max(-8,Math.min(8,-.35*body.lean));}else{const [P,A]=r.hpB,v=i===0?P:i===1?P.map((x,j)=>x+(A[j]-x)*.65):i===2?A:i===3?A.map((x,j)=>j===1?x+2:j===3?x*.85:x):i===4?A.map((x,j)=>x+(P[j]-x)*.55):P;body=Object.fromEntries(keys.map((k,j)=>[k,v[j]]));body.head=Math.max(-8,Math.min(8,-.35*body.lean));}return{label,body,...(i<5?{targetPolar:values[i]}:{returnToEntry:true}),...(id==='mai'&&i<5?{fan:fan[move][0][i],fanAngle:fan[move][1][i]}:{}),...(['A1','T'].includes(label)?{stopTangent:true}:{})};});
  nodes.splice(4,0,{...JSON.parse(JSON.stringify(nodes[3])),label:'E',stopTangent:true});data[id+':'+move]={revision:'air-pro-18-1',family:family[id],contactChain:move==='aHK'?'frontLeg':'frontArm',kind:move==='aHK'?'foot':id==='mai'?'fan':'fist',air,bodyMode:air?'flight-additive':'ground-absolute',nodes,rearLegActive:r.rear,frontLoad:r.load,referenceTiming:air?move==='aMP'?[7,4,14]:[12,5,19]:r.timing,poleSweep:id==='juri'&&move==='aHK'};
 }
 INK.AirStrikeData=freeze(data);
})();
