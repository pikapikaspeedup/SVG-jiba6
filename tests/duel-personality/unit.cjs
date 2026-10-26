'use strict';const assert=require('node:assert/strict');global.INK={};require('../../src/ink/duel-personality.js');const P=INK.DuelPersonality,self={x:0};
const event=(serial,result='cleanMiss',firstResult=true)=>({id:'2:attack:'+serial,epoch:2,serial,result,firstResult,target:1});
const observation=(action,events,receivedContacts=[])=>({index:1,action,x:100,state:'block',attack:{category:'normal',combatID:'attack:'+action,id:'cHK',height:'low'},exchange:{epoch:2,events,records:[{id:'stale',result:'cleanMiss'}]},receivedContacts});
let m=P.observe(null,observation(1,[event(1)]),{},self);assert.equal(m.samples,1);assert.equal(m.whiffRate,.54);assert(Math.abs(m.bias.probe)<.02);assert.equal(m.guardRate,.5);
let old=JSON.stringify(m);P.observe(m,observation(2,[]),{},self);assert.equal(JSON.stringify(m),old);
const same=P.observe(m,observation(2,[event(1),event(2,'cleanMiss',false)]),{},self);assert.equal(same.samples,1);assert.equal(same.whiffRate,m.whiffRate);
for(const result of ['avoided','unknown','whiff']){const skipped=P.observe(m,observation(2,[event(2,result)]),{},self);assert.equal(skipped.samples,1);assert.equal(skipped.whiffRate,m.whiffRate);}
m=P.observe(m,observation(2,[],[event(1,'parry')]),{},self);assert(m.guardRate>.5);const g=m.guardRate;m=P.observe(m,observation(3,[],[event(1,'parry'),event(2,'parry',false)]),{},self);assert.equal(m.guardRate,g);
for(let n=4;n<=35;n++)m=P.observe(m,observation(n,[event(n,'hit')],[event(n,'block')]),{},self);assert.equal(m.seenIDs.length,16);const samples=m.samples,wr=m.whiffRate,gr=m.guardRate,hr=m.heavyRate;
// Old 8-record/event windows reappear after >16 other IDs: never re-learn.
for(let n=36;n<70;n++){const o=observation(n,Array.from({length:8},(_,i)=>event(i+1)),Array.from({length:8},(_,i)=>event(i+1,'parry')));o.attack.combatID='attack:1';m=P.observe(m,o,{},self);}
assert.equal(m.samples,samples);assert.equal(m.whiffRate,wr);assert.equal(m.guardRate,gr);assert.equal(m.heavyRate,hr);assert.equal(m.eventSerial,35);assert.equal(m.receiptSerial,35);
for(const v of Object.values(m.bias))assert(v>=-.15&&v<=.15);assert(Object.isFrozen(P.profile('ryu')));assert.equal(new Set(['ryu','ken','chun','cammy','luke','juri','mai','iori'].map(c=>JSON.stringify(P.profile(c)))).size,8);
console.log('DuelPersonality monotonic event/attack watermarks, eviction-safe receipts, end duplicates and bounded bias passed');
