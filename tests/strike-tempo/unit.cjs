'use strict';
const assert=require('node:assert/strict');global.INK={};require('../../src/ink/strike-tempo.js');const T=INK.StrikeTempo;
const G={actionTick:0,phase:'fight',hitstop:0,paused:false};
function setup(){const f={state:'attack',hp:100,drive:3,y:0,dir:1,input:{held:new Set(['HP']),queue:[]},attack:{m:{id:'sHP',button:'HP',category:'normal',startup:11},t:8}};const origin=T.press(f,'HP',G);assert(T.started(f,G,{origin,neutral:true}));return f;}
let f=setup();for(let i=0;i<12;i++){G.actionTick++;assert(T.step(f,G));assert(T.step(f,G));}assert.equal(f.attack.tempo.age,12);G.actionTick++;assert(!T.step(f,G));assert.equal(f.attack.t,8);
f=setup();G.actionTick++;T.step(f,G);T.released(f,'HK');assert(!f.attack.tempo.pendingRelease);T.released(f,'HP');G.hitstop=4;assert(T.step(f,G));assert.equal(f.attack.tempo.age,1);G.hitstop=0;G.actionTick++;assert(!T.step(f,G));assert.equal(f.attack.tempo.phase,'released');
f=setup();G.actionTick++;T.step(f,G);let paid=0;assert(T.startFeint(f,G,{pay:(f,n)=>(paid+=n,true),state:(f,s,t)=>{f.state=s;f.stateT=t;f.attack=null;}}));assert.equal(paid,.5);assert.equal(f.stateT,12);assert.equal(f.throwInvuln,0);assert.equal(f._inkTempo.phase,'feint');assert(!T.startFeint(f,G,{pay:()=>{throw Error('double pay')}}));
f=setup();f.attack.tempo=null;assert(!T.started(f,G,{neutral:true}));const old=T.press(f,'HP',G);T.released(f,'HP');T.press(f,'HP',G);assert(!T.started(f,G,{origin:old,neutral:true}));
f=setup();T.clear(f);G.actionTick++;assert(!T.step(f,G));f=setup();T.clear(f,{cancel:true});assert(!f.attack.tempo);
console.log('StrikeTempo: bounded hold, token ownership, frozen release, paid feint and cleanup passed');
