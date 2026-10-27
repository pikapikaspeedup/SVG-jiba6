'use strict';
const assert=require('node:assert/strict');global.INK={};require('../../src/ink/defense-pressure.js');const D=INK.DefensePressure;
let state=D.create(0),maximum=0;for(let i=0;i<80;i++){
 const time=i*.3,prior=D.advance(state,time),sign=i%3?-1:1;
 state=D.commit(state,time,{arm:[sign*100,35],body:[sign*70,-21]});
 for(const k of ['arm','body'])assert.deepEqual(state[k].z,prior[k].z);
 const saved=JSON.stringify(state);
 for(let j=0;j<=10;j++){const q=D.sample(state,time+j*.11);for(const k of ['arm','body']){const n=Math.hypot(...q[k].z);maximum=Math.max(maximum,n);assert(n<=1+1e-12);assert(Math.hypot(...q[k].v.map((v,a)=>v+D.omega[k]*q[k].z[a]))<=D.omega[k]+1e-12);}}
 assert.equal(JSON.stringify(state),saved);
}
assert.equal(D.advance(state,state.time-1),null);for(const k of ['arm','body'])assert.deepEqual(D.sample(state,1e308)[k].z,[0,0]);
console.log(JSON.stringify({worldChannels:2,commits:80,maximum,sameBoundaryPosition:true,pure:true,bounded:true}));
