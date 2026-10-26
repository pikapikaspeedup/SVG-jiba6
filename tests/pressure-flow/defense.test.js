'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('immediate, CPU and buffered exits all protect exactly four contact frames',()=>{
 for(const startAfterMotion of [false,true]){
  const c={INK:{Kinetic:{settings:{enabled:true}},CombatFlow:{settings:{rules:'flow'}}}};vm.createContext(c);vm.runInContext(fs.readFileSync('src/ink/pressure-flow.js','utf8'),c);const P=c.INK.PressureFlow,G={actionTick:20,hitstop:0},f={x:500,y:0,dir:1,state:'block',stateT:16,input:{queue:[]}};
  P.start(f,'ESCAPE',G,{pay:()=>true,state:(f,state,t)=>Object.assign(f,{state,stateT:t}),notify:()=>{}});const protectedFrames=[];
  for(let i=0;i<6;i++){G.actionTick++;if(!startAfterMotion||i>0)P.step(f);P.beginContacts(f,G);protectedFrames.push(P.shields(f,{throw:false},G));assert.equal(P.shields(f,{throw:true},G),false);}
  assert.deepEqual(protectedFrames,[true,true,true,true,false,false]);
 }
});
