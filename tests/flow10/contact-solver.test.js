'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
require('../../src/ink/contact-solver.js');
const S=INK.ContactSolver,box=(x,y=0,w=10,h=10)=>({x,y,w,h});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('crossing with no endpoint overlap has a time of impact',()=>{
 const a=box(0),end=box(100),b=box(50);
 assert.equal(S.discrete(end,b),null);const c=S.sweep(a,end,b,b);
 near(c.time,.4);assert.deepEqual(c.point,[50,5]);assert.deepEqual(c.normal,[1,0]);
});
test('relative movement, shared translation and mirrors',()=>{
 near(S.sweep(box(0),box(40),box(50),box(30)).time,2/3);
 assert.equal(S.sweep(box(0),box(40),box(50),box(90)),null);
 const mirror=b=>({...b,x:-b.x-b.w});
 const c=S.sweep(...[box(0),box(100),box(50),box(50)].map(mirror));
 near(c.time,.4);assert.deepEqual(c.normal,[-1,0]);
});
test('all four edges move, including width and height',()=>{
 const c=S.sweep(box(0,0,10),box(0,0,100),box(50),box(50));near(c.time,4/9);
 near(S.sweep(box(0,0,10,10),box(0,0,10,100),box(0,50),box(0,50)).time,4/9);
});
test('initial overlap is time zero, separating motion is valid',()=>{
 const c=S.sweep(box(0),box(-100),box(5),box(5));near(c.time,0);assert.equal(c.initialOverlap,true);
});
test('edge sliding and terminal tangency are not hits',()=>{
 assert.equal(S.sweep(box(0,10),box(100,10),box(50),box(50)),null);
 assert.equal(S.sweep(box(0),box(40),box(50),box(50)),null);
 assert.equal(S.sweep(box(0),box(-40),box(10),box(10)),null);
});
test('touching then penetrating starts at zero',()=>{
 near(S.sweep(box(0),box(5),box(10),box(10)).time,0);
});
test('invalid or degenerate inputs do not create contacts',()=>{
 for(const bad of [null,box(NaN),box(0,0,0),box(0,0,-1),box(Infinity)]){
  assert.equal(S.sweep(bad,box(0),box(0),box(0)),null);
  assert.equal(S.closest(box(0),bad,box(0),box(0)),null);
 }
});
test('closest approach finds interior minima and nearest points',()=>{
 const c=S.closest(box(0,20),box(100,20),box(50),box(50));near(c.distance,10);
 assert.ok(c.time>=.4&&c.time<=.6);near(Math.hypot(c.pointA[0]-c.pointB[0],c.pointA[1]-c.pointB[1]),10);
 const d=S.closest(box(-20,30),box(30,-20),box(0),box(0));near(d.distance,0);
});
test('deterministic randomized comparison against independent dense oracle',()=>{
 let seed=97031;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const random=()=>box(rand()*160-80,rand()*160-80,2+rand()*24,2+rand()*24);
 for(let n=0;n<200;n++){
  const [a0,a1,b0,b1]=[random(),random(),random(),random()];
  const c=S.sweep(a0,a1,b0,b1),closest=S.closest(a0,a1,b0,b1);let min=Infinity,first=null;
  for(let i=0;i<=2000;i++){
   const t=i/2000,a=S.at(a0,a1,t),b=S.at(b0,b1,t);
   const dx=Math.max(0,a.x-b.x-b.w,b.x-a.x-a.w),dy=Math.max(0,a.y-b.y-b.h,b.y-a.y-a.h);
   min=Math.min(min,Math.hypot(dx,dy));
   if(a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h&&first===null)first=t;
  }
  assert.ok(closest.distance<=min+1e-7);assert.ok(min-closest.distance<.15);
  if(first!==null){assert.ok(c);assert.ok(c.time<=first+1e-7);assert.ok(first-c.time<=.000501);}
  if(c){const t=Math.min(1,c.time+1e-7),a=S.at(a0,a1,t),b=S.at(b0,b1,t);assert.ok(S.overlap(a,b));}
 }
});
