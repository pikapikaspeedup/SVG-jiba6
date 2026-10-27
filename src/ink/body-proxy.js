/* Canonical shape preprocessing and torso skinning shared by renderer and rules.
 * Display volume/head options are deliberately absent. */
'use strict';
(()=>{
 const {clamp,lerp,mat}=INK;
 function shapePoint(q,shape={}){const upper=shape.chest??1,waist=shape.waist??1,hip=shape.hip??1,scale=q[1]<-244?lerp(waist,upper,clamp((-244-q[1])/55)):lerp(waist,hip,clamp((q[1]+244)/42));return [q[0]*scale,q[1]];}
 function torsoWeights(q){const y=q[1];if(y>=-246){const t=INK.easing(clamp((-191-y)/55));return [1-t,t,0];}const t=INK.easing(clamp((-246-y)/49));return [0,1-t,t];}
 function skinPoint(q,shape,matrices){const p=shapePoint(q,shape),w=torsoWeights(p),bindY=[-191,-246,-295],out=[0,0];for(let i=0;i<3;i++){const v=mat.point(matrices[i],[p[0],p[1]-bindY[i]]);out[0]+=w[i]*v[0];out[1]+=w[i]*v[1];}return out;}
 const outlines=Object.freeze({head:Object.freeze([[-28,-44],[29,-44],[29,39],[-28,39]].map(Object.freeze)),hand:Object.freeze([[-12,-13],[24,-13],[24,13],[-12,13]].map(Object.freeze)),foot:Object.freeze([[-20,-27],[48,-27],[48,25],[-20,25]].map(Object.freeze))});
 INK.BodyProxy=Object.freeze({shapePoint,torsoWeights,skinPoint,outlines});
})();
