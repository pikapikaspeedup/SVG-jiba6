'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
require('../../src/ink/contact-solver.js');require('../../src/ink/spacing.js');
const S=INK.Spacing;
const box=(x,part='body')=>({x,y:0,w:10,h:10,part});
function fixture(){
 S.set(true);S.reset();S.setReward(true);
 const m={id:'sMP',kind:'punch',category:'normal',startup:2,active:3,total:12,hits:1};
 const attack={m,t:1,hitsDone:new Set(),confirmed:false};
 const a={index:0,attack,state:'attack',x:0,y:0,dir:1,hp:1000,invuln:0};
 const b={index:1,attack:null,state:'evade',stateT:4,x:35,y:0,dir:-1,hp:1000,invuln:0,_inkRetreat:{origin:50,ready:false,used:false}};
 const G={actionTick:0};
 const geometry=f=>({hit:f===a?[box(10,'fist')]:[],hurt:[box(f===b?35:0)]});
 const frame=(t,provider=geometry,reverse=false)=>{G.actionTick++;attack.t=t;const out=S.frame(G,reverse?[b,a]:[a,b],provider);S.finish(G);return out;};
 return{a,b,G,attack,m,geometry,frame};
}
test('whole active phase, terminal coverage and next-step grant',()=>{
 const {b,G,frame}=fixture();frame(2);frame(3);frame(4);assert.equal(b._inkRetreat.ready,false);frame(5);
 assert.equal(b._inkRetreat.ready,true);assert.equal(S.canCancel(b,{id:'sMP',category:'normal'},G),false);
 G.actionTick++;assert.equal(S.canCancel(b,{id:'sMP',category:'normal'},G),true);
 assert.ok(S.consume(b,{id:'sMP',category:'normal'},G));assert.equal(S.consume(b,{id:'sMP',category:'normal'},G),null);
});
test('late start of observation cannot certify a whiff',()=>{
 const {b,frame}=fixture();frame(3);frame(4);frame(5);assert.equal(b._inkRetreat.ready,false);
});
test('last active interval contact vetoes earlier near evidence',()=>{
 const {a,b,frame}=fixture();frame(2);frame(3);frame(4);
 const result=frame(5,f=>({hit:f===a?[box(50,'fist')]:[],hurt:[box(f===b?35:0)]}));
 assert.ok(result.get(0).contact);assert.equal(b._inkRetreat.ready,false);
});
test('geometric overlap vetoes reward even if damage was immune',()=>{
 const {a,b,frame}=fixture();b.invuln=99;
 for(let t=2;t<=5;t++)frame(t,f=>({hit:f===a?[box(35,'fist')]:[],hurt:[box(f===b?35:0)]}));
 assert.equal(b._inkRetreat.ready,false);
});
test('missing shapes and topology changes cannot certify partial coverage',()=>{
 for(const type of ['empty','renamed','invalid']){
  const {a,b,frame}=fixture();frame(2);frame(3,f=>({hit:f===a?(type==='empty'?[]:[type==='invalid'?{...box(10,'fist'),w:NaN}:box(10,'other')]):[],hurt:[box(f===b?35:0)]}));frame(4);frame(5);
  assert.equal(b._inkRetreat.ready,false,type);
 }
});
test('interruptions, direct mirrors and explicit teleport epochs veto certification',()=>{
 for(const type of ['attack','mirror','teleport']){
  const {a,b,frame}=fixture();frame(2);frame(3);
  if(type==='attack')a.attack={...a.attack,hitsDone:new Set()};
  if(type==='mirror')b.dir=1;
  if(type==='teleport')S.invalidate(b);
  frame(4);frame(5);assert.equal(b._inkRetreat.ready,false,type);
 }
});
test('stationary or too-far retreats do not earn the spacing permission',()=>{
 const x=fixture();x.b._inkRetreat.origin=x.b.x;for(let t=2;t<=5;t++)x.frame(t);assert.equal(x.b._inkRetreat.ready,false);
 const y=fixture();for(let t=2;t<=5;t++)y.frame(t,f=>({hit:f===y.a?[box(-100,'fist')]:[],hurt:[box(35)]}));assert.equal(y.b._inkRetreat.ready,false);
});
test('reward disabled preserves evidence, but permission is not usable',()=>{
 const {b,G,frame}=fixture();S.setReward(false);for(let t=2;t<=5;t++)frame(t);G.actionTick++;
 assert.ok(S.events.some(e=>e.type==='near-miss'));assert.equal(S.canCancel(b,{id:'sMP',category:'normal'},G),false);
});
test('stable shape identities make collection order irrelevant',()=>{
 function run(reverse){const {a,b,frame}=fixture();const geometry=f=>({hit:f===a?[box(10,'fist'),box(12,'forearm')].sort((x,y)=>reverse?-x.part.localeCompare(y.part):x.part.localeCompare(y.part)):[],hurt:[box(f===b?35:0,'torso'),box(100,'head')].sort((x,y)=>reverse?-x.part.localeCompare(y.part):x.part.localeCompare(y.part))});for(let t=2;t<=5;t++)frame(t,geometry,reverse);return S.inspect().events;}
 assert.deepEqual(run(false),run(true));
});
test('continuous fast motion is not mistaken for teleportation',()=>{
 const {a,b,frame}=fixture();const geo=f=>({hit:f===a?[box(a.x,'fist')]:[],hurt:[box(f===b?300:-100)]});
 a.x=0;frame(2,geo);a.x=600;const result=frame(3,geo);
 assert.ok(result.get(0).contact?.swept);assert.ok(result.get(0).contact.time<1);
});
test('explicit discontinuity prevents a phantom fast sweep',()=>{
 const {a,b,frame}=fixture();const geo=f=>({hit:f===a?[box(a.x,'fist')]:[],hurt:[box(f===b?300:-100)]});
 a.x=0;frame(2,geo);S.invalidate(a);a.x=600;assert.equal(frame(3,geo).get(0).contact,null);
});
test('first active frame never sweeps from an inactive pose',()=>{
 const {a,b,frame}=fixture();const geo=f=>({hit:f===a?[box(a.x,'fist')]:[],hurt:[box(f===b?300:-100)]});
 a.x=0;frame(1,geo);a.x=600;assert.equal(frame(2,geo).get(0).contact,null);
});
test('contacts are bounded and invalid setting writes are rejected',()=>{
 const {G}=fixture();for(let i=0;i<300;i++)S.contact(G,{time:.5},'hit');assert.equal(S.events.length,160);
 assert.throws(()=>S.set('true'),TypeError);assert.throws(()=>S.setReward(1),TypeError);
});
