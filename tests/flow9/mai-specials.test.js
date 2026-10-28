'use strict';
const assert=require('node:assert/strict');
global.window=global;
require('../../src/mai-sf6.js');

const special=(base,strength,od=false)=>({id:base+'_'+strength,category:'special',base,strength,od,damage:500,stun:20,blockstun:14,kind:base==='kachosen'?'projectile':'dive',total:50});
const moves={mai:[special('kachosen',0),special('kachosen',3,true),special('musabi',0)]};
SF6Mai.configure([{id:'mai'}],moves,{mai:[['kachosen'],['musabi']]});
const find=id=>moves.mai.find(m=>m.id===id);
assert.equal(find('kachosen_0').hits,1);
assert.equal(find('kachosen_3').hits,2,'uncharged OD fan must have two contacts');

// Exercise the actual projectile resolver, including its contact cooldown.
global.INK={Kinetic:{settings:{enabled:true}},VFX:{settings:{enabled:false},time:0},Particles:{}};
require('../../src/ink/projectile-flow.js');
const owner={ch:{id:'mai',color:'#ff8d78'},flameStock:0},defender={x:65,y:0,hp:10000,state:'idle'};
const shot={combatID:'mai-fan-1',owner,m:{...find('kachosen_3')},hits:2,x:0,y:0,dir:1,v:10,life:100,cool:0,node:{setAttribute(){},remove(){}}};
SF6Mai.initShot(shot);
assert.equal(shot.vulnerable,false,'OD fan cannot be knocked down by a strike');
const state={shots:[shot]},contacts=[];
let frame=0;
const api={enemy:()=>defender,geometry:()=>({hurt:[{x:40,y:-15,w:40,h:30,part:'body'}],hit:[]}),overlap:()=>false,burst(){},sound(){},notify(){},contact(_a,_d,_m,index){contacts.push({index,frame,y:shot.y});return 'hit';}};
for(;frame<80&&state.shots.length;frame++)INK.ProjectileFlow.update(state,api);
assert.deepEqual(contacts.map(c=>c.index),[0,1]);
assert(contacts[1].frame-contacts[0].frame>=24,'follow-up arrives after the fan rises and falls');
assert.equal(state.shots.length,0,'fan disappears after its final contact');

function charge(od,boost){
 const fighter={ch:{id:'mai'},flameStock:boost?1:0,input:{held:new Set(['HP'])}};
 const move=SF6Mai.start(fighter,{...find(od?'kachosen_3':'kachosen_0')});
 fighter.attack={m:move,t:move.startup-2};
 for(let i=0;i<20;i++)SF6Mai.holdTick(fighter);
 return {fighter,move};
}
const heldOD=charge(true,false),releases=SF6Mai.fanShots(heldOD.fighter,heldOD.move).map(m=>({m,frame:heldOD.move.startup}));
assert.equal(releases.length,1,'held OD must release the first fan alone');
heldOD.fighter.attack.projectileSent=true;
for(let t=heldOD.move.startup;t<heldOD.move.total;t++){
 heldOD.fighter.attack.t=t;
 SF6Mai.tick(heldOD.fighter,{actionTick:t},(_f,m)=>releases.push({m,frame:t}),()=>{});
 SF6Mai.tick(heldOD.fighter,{actionTick:t},(_f,m)=>releases.push({m,frame:t}),()=>{});
 if(t<heldOD.move.startup+20)assert(!heldOD.fighter.maiFollowUntil,'follow-up cannot erase the second throw');
}
assert.deepEqual(releases.map(e=>e.frame),[heldOD.move.startup,heldOD.move.startup+20],'two distinct simulation-owned throws');
const twins=releases.map(e=>e.m);
assert.equal(twins.length,2);assert.deepEqual(twins.map(m=>m.hits),[1,1]);
assert.equal(twins.reduce((total,m)=>total+m.damage,0),heldOD.move.damage);
assert(twins.every(m=>!m.knockdown),'ordinary charged OD fans do not launch the target');
const twinState={shots:twins.map((m,i)=>{const s={combatID:'twin-'+i,owner,m,hits:m.hits,x:0,y:0,dir:1,v:10,life:100,cool:0,node:{setAttribute(){},remove(){}}};SF6Mai.initShot(s);return s;})};
const twinContacts=[];
for(let i=0;i<50&&twinState.shots.length;i++)INK.ProjectileFlow.update(twinState,{...api,contact(_a,_d,m){twinContacts.push(m.maiTwin);return 'hit';}});
assert.deepEqual(twinContacts.sort(),[1,2],'both charged fans resolve their own contact');
const heldBoost=charge(true,true),boostedTwins=[...SF6Mai.fanShots(heldBoost.fighter,heldBoost.move),...SF6Mai.fanShots(heldBoost.fighter,heldBoost.move,1)];
assert.equal(heldBoost.fighter.flameStock,0);
assert.deepEqual(boostedTwins.map(m=>m.hits),[2,2]);
for(const move of boostedTwins){const s={owner,dir:1,m:move,hits:1,x:0,y:0};SF6Mai.initShot(s);SF6Mai.bounce(s,defender);assert.equal(s.fanPhase,'rising');}
const heldNormal=charge(false,false);
assert.equal(SF6Mai.fanShots(heldNormal.fighter,heldNormal.move).length,1);
const enhanced=SF6Mai.start({ch:{id:'mai'},flameStock:1},{...find('kachosen_0')});
assert.equal(enhanced.hits,2,'flame stock adds one outgoing contact to an uncharged fan');

const interrupted=charge(true,false);interrupted.fighter.attack=null;
SF6Mai.tick(interrupted.fighter,{actionTick:99},()=>assert.fail('interruption must cancel pending fan release'),()=>{});
assert(!interrupted.fighter.maiFollowUntil);
const follow=find('midare'),followFighter=heldOD.fighter;
followFighter.dir=1;followFighter.input.dir=6;followFighter.input.queue=[];
const interruptedWindow={...followFighter,state:'hit',attack:null,input:{...followFighter.input}};
assert.equal(SF6Mai.canFollow(interruptedWindow,{actionTick:39}),false,'hitstun must not be canceled through a leftover follow-up ticket');
SF6Mai.tick(interruptedWindow,{actionTick:39},()=>assert.fail('hitstun spawned a projectile'),()=>{});assert.equal(interruptedWindow.maiFollowUntil,0);
const early=charge(true,false).fighter;early.dir=1;early.input.dir=6;
assert.equal(SF6Mai.follow(early,['LP'],{actionTick:12},()=>follow,()=>assert.fail('follow-up opened too early'),x=>x),false);
assert.equal(SF6Mai.follow(followFighter,['LP'],{actionTick:39},()=>follow,(_f,m)=>{assert.equal(m.cost,0);followFighter.attack={m:{...m},t:0};return true;},x=>x),true);
assert.equal(followFighter.maiFollowUntil,0,'follow-up ticket is consumed once');
const extra=[];
for(let t=0;t<follow.total;t++){
 followFighter.attack.t=t;
 for(let duplicate=0;duplicate<2;duplicate++)SF6Mai.tick(followFighter,{actionTick:40+t},(_f,m)=>extra.push({m,frame:t}),()=>{});
}
assert.deepEqual(extra.map(e=>e.frame),[follow.startup,follow.startup],'third throwing motion releases the final pair together');
assert.equal(twins.length+extra.length,4,'full sequence is three throws and four fans');
assert.equal(extra.reduce((sum,e)=>sum+e.m.damage,0),1000,'follow-up retains its total damage');
const extraState={shots:extra.map(({m},i)=>{const s={combatID:'follow-'+i,owner,m,hits:m.hits,x:0,y:0,dir:1,v:m.speed,life:105,cool:0,node:{setAttribute(){},remove(){}}};SF6Mai.initShot(s);return s;})},extraContacts=[];
for(let t=0;t<100&&extraState.shots.length;t++)INK.ProjectileFlow.update(extraState,{...api,contact(_a,_d,m,index,shot){extraContacts.push({fan:m.maiFollowFan,index,phase:shot.fanPhase,t});return 'hit';}});
for(const fan of [1,2]){
 const contacts=extraContacts.filter(c=>c.fan===fan);assert.deepEqual(contacts.map(c=>c.index),[0,1]);
 assert.deepEqual(contacts.map(c=>c.phase),['outbound','falling'],'each added fan rises and physically falls back');
}
assert(extraContacts.find(c=>c.fan===2&&c.index===1).t>extraContacts.find(c=>c.fan===1&&c.index===1).t+8,'high and low fans land on separate beats');
assert.equal(extraState.shots.length,0);

const dive=find('musabi_0'),fighter={ch:{id:'mai'},dir:-1,y:-180,vx:5,vy:-7,attack:{m:dive,t:0}};
assert.equal(SF6Mai.beginDive(fighter,dive),true);
for(let t=1;t<dive.startup;t++){
 fighter.attack.t=t;SF6Mai.tick(fighter,{actionTick:t},()=>{},()=>{});
 fighter.y+=fighter.vy;fighter.vy+=.7;
 assert.equal(fighter.y,-180,'startup holds the airborne body');
}
fighter.attack.t=dive.startup;SF6Mai.tick(fighter,{actionTick:dive.startup},()=>{},()=>{});
assert.equal(fighter.vx,-10);assert.equal(fighter.vy,9);
fighter.vy=11;SF6Mai.tick(fighter,{actionTick:dive.startup+1},()=>{},()=>{});
assert.equal(fighter.vy,11,'the dive launch is applied only once');
assert.equal(SF6Mai.beginDive({ch:{id:'cammy'}},{base:'musabi'}),false);

const sa={id:'SA1',super:1,startup:8,active:42,recovery:27,total:77},ma={ch:{id:'mai'},flameStock:0,attack:{m:sa,t:8}},notices=[];
SF6Mai.tick(ma,{actionTick:8},()=>{},(_f,n)=>notices.push(n));
assert.equal(ma.flameStock,0,'startup must not grant stock');
ma.attack=null;SF6Mai.tick(ma,{actionTick:9},()=>{},()=>{});
assert.equal(ma.flameStock,0,'interruption must not grant stock');
const finished={m:sa,t:sa.total};SF6Mai.finish(ma,finished,(_f,n)=>notices.push(n));
SF6Mai.finish(ma,finished,(_f,n)=>notices.push(n));
assert.equal(ma.flameStock,5);assert.equal(notices.length,1);
console.log('Mai special moves: three throws/four fans, staggered falling contacts, interruption, air dive and SA1 stock passed');
