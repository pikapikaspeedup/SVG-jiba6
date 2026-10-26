'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');const ctx={INK:{}};vm.runInNewContext(fs.readFileSync('src/ink/exchange-facts.js','utf8'),ctx);const X=ctx.INK.ExchangeFacts,G={actionTick:0},f={index:0,ch:{id:'ryu'},y:0},d={index:1};let seq=0;
function attack(extra={}){const a={combatID:'attack:'+ ++seq,t:0,m:{id:'sMP',category:'normal',normalState:'s',kind:'normal',hits:1,damage:500,startup:6,active:4,total:23,...extra}};f.attack=a;X.begin(f,a,G);return a;}
function coverage(a,model='discrete',skip=-1){for(let t=6;t<10;t++){a.t=t;if(t!==skip)X.sampleActive(f,a,{age:t,model,complete:true},G);}a.t=10;X.requestClose(f,a,{terminalRequired:model==='sweep'},G);}
function settle(a){X.settle([f],G);return X.inspect(a);}
let a=attack();coverage(a);assert.equal(X.inspect(a),null);assert.equal(settle(a).result,'cleanMiss');assert.equal(X.inspect(a).coverage,'complete');assert.equal(X.inspect(a).activeClosed,true);
a=attack();a.t=10;assert.equal(settle(a).result,'unknown');assert.equal(X.inspect(a).activeClosed,false);
a=attack();coverage(a,'discrete',7);assert.equal(settle(a).result,'unknown');assert.equal(X.inspect(a).coverage,'broken');
a=attack();coverage(a,'sweep');assert.equal(settle(a).result,'unknown','terminal sweep missing');
a=attack();coverage(a,'sweep');X.sampleActive(f,a,{age:10,model:'sweep',terminal:true,complete:true},G);X.contact(f,a,d,'hit',G);assert.equal(settle(a).result,'hit','terminal hit defeats miss');
a=attack();coverage(a);X.contact(f,a,d,'immune',G);assert.equal(settle(a).result,'avoided');assert.equal(X.inspect(a).whiff,false);
for(const result of ['hit','block','parry','armor']){a=attack();coverage(a);X.end(f,a,'interrupted',G);f.attack=null;X.contact(f,a,d,result,G);assert.equal(settle(a).result,result,'detached trade accepted');}
for(const reason of ['cancel','feint','capture','round','interrupted']){a=attack();coverage(a);X.end(f,a,reason,G);assert.equal(settle(a).result,reason);assert.equal(X.inspect(a).whiff,false);}
a=attack({hits:2});coverage(a);assert.equal(settle(a).result,'unknown');assert.equal(X.inspect(a).coverage,'unsupported');
a=attack();coverage(a);X.sampleActive(f,a,{age:10,model:'sweep',terminal:true,complete:true},G);assert.equal(settle(a).result,'unknown','model switch breaks coverage');
for(let i=0;i<40;i++){a=attack();coverage(a);X.end(f,a,'natural',G);settle(a);}assert.equal(X.public(f).records.length,8);assert.equal(X.public(f).events.length,24);assert(Object.isFrozen(X.public(f).records[0]));const before=JSON.stringify(X.public(f));X.public(f,{actionTick:999});assert.equal(JSON.stringify(X.public(f)),before);
const old=X.public(f).epoch;X.reset();seq=0;a=attack();coverage(a);settle(a);assert.equal(X.public(f).epoch,old+1);assert(X.inspect(a).id.startsWith((old+1)+':'));
for(const extra of [{air:true},{throw:true},{kind:'projectile'},{category:'special'},{normalState:'a'}]){a=attack(extra);assert.equal(X.contact(f,a,d,'hit',G),false);}
console.log('ExchangeFacts coverage, terminal hit, avoided shield, unsupported/missing samples, interruption, detached trade, bounds and epochs passed');

f._inkContactEpoch=3;a=attack();for(let t=6;t<10;t++){a.t=t;if(t===8)f._inkContactEpoch++;X.sampleActive(f,a,{age:t,model:'discrete',complete:true},G);}a.t=10;X.requestClose(f,a,{},G);assert.equal(settle(a).result,'unknown');assert.equal(X.inspect(a).coverage,'broken','teleport invalidates continuous coverage');console.log('ExchangeFacts contact epoch discontinuity rejected');

a=attack();coverage(a);settle(a);let ev=X.public(f).events.at(-1);assert.equal(ev.firstResult,true);assert.equal(ev.resultChanged,true);X.end(f,a,'natural',G);settle(a);ev=X.public(f).events.at(-1);assert.equal(ev.firstResult,false);assert.equal(ev.resultChanged,false);console.log('ExchangeFacts natural-end duplicate is not a learning event');
