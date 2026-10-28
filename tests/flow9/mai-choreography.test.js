'use strict';
// Source-level checks for Mai's editable clips, input decisions and retained FX.
// Does not claim a browser/UI run and does not write QA evidence files.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
global.window=global;
for(const name of ['core','body-proxy','canonical','compiled-motion','inbetween','anatomy','articulation','motion','secondary-dynamics','motion-graph','combat-flow','assets','renderer','project','runtime','states','visual-frame','strike-space','strike-model-policy','strike-model-data','strike-model-frame','strike-model','air-strike-data'])require(root+'/src/ink/'+name+'.js');
require(root+'/src/mai-sf6.js');
const game=fs.readFileSync(root+'/game.js','utf8');
vm.runInThisContext(game.slice(0,game.indexOf('let gameTime='))+';globalThis.maiData={CHARACTERS,MOVES,BASESPECIALS,getMove};})();');
const bundle={manifest:JSON.parse(fs.readFileSync(root+'/assets/ink/project.json')),characters:{}};
for(const id of INK.Schema.CHARACTERS){
 const dir=root+'/assets/ink/characters/'+id;
 bundle.characters[id]={model:JSON.parse(fs.readFileSync(dir+'/model.json')),rig:JSON.parse(fs.readFileSync(dir+'/rig.json')),moves:Object.fromEntries(fs.readdirSync(dir+'/moves').filter(f=>f.endsWith('.json')).map(f=>[f.slice(0,-5),JSON.parse(fs.readFileSync(dir+'/moves/'+f))]))};
}
INK.Schema.bundle(bundle);
const store=new INK.AssetStore(bundle);INK.Runtime.install(store);
INK.StrikeModelPolicy.installBaseline(bundle);
const profile=store.profile('mai'),get=(f,id)=>maiData.getMove(f,id),mai={ch:maiData.CHARACTERS.find(c=>c.id==='mai')};
const authored=store.list('mai').filter(r=>r.clip.meta?.maiChoreography);
assert.equal(authored.length,51);
for(const r of authored){
 assert.equal(r.binding.rootPolicy,'combat');assert.equal(r.boxes.mode,'inherit');
 assert(!('rootX' in r.clip.tracks)&&!('rootY' in r.clip.tracks));
 const clip=store.clip(r),sample=t=>{
  const p=INK.MotionGraph.compose(r,t,clip.sample(t),profile,null),rig=INK.Rig.solveAnimation(profile,p);
  for(const chain of ['rearArm','frontArm','rearLeg','frontLeg'])assert(rig[chain].flat().every(Number.isFinite),r.key+' finite '+chain);
  assert(p.fan>=0&&p.fan<=1,r.key+' fan bounds');
  return {p,rig};
 };
 // Quarter-frame evaluation is the actual articulation resolution.
 for(let t=0;t<=r.clip.duration;t+=.25)sample(t);
 const t=r.binding.startup+r.binding.active*.37,a=sample(t),b=sample(1),c=sample(t);
 assert.deepEqual(c,a,r.key+' reverse/random seek must not change the pose');
 assert.notDeepEqual(a.rig,b.rig,r.key+' must contain a real action');
 assert.deepEqual(clip.sample(r.clip.duration).fa,[82,-16],r.key+' returns to guard');
}
for(const id of ['fMP','bHK','hien2','hien3','hoshi2','airthrow']){
 assert(get(mai,id),id+' has combat move');assert(store.byGame('mai',id),id+' has bound asset');
}
const held=INK.Runtime.record(mai,{...get(mai,'kachosen_3'),fanCharged:true});
assert.equal(held.gameId,'@kachosen-od-held');
assert.deepEqual(held.clip.meta.maiChoreography.releases,[12,32]);
assert.equal(store.clip(held).sample(12).fan,0);assert.equal(store.clip(held).sample(32).fan,0);
assert(store.clip(held).sample(28).fan>.8,'hand visibly reloads between the first two throws');
const regular=store.byGame('mai','kachosen_3');store.overrides.moves['mai:'+regular.key]=regular;
assert.equal(INK.Runtime.record(mai,{...get(mai,'kachosen_3'),fanCharged:true}),regular,'preserve user-edited OD animation');delete store.overrides.moves['mai:'+regular.key];
for(const id of ['sMP','sHP','cMK']){
 const m=get(mai,id),f={...mai,state:'attack',x:0,y:0,dir:1,attack:{m,t:m.startup,combatID:'mai-choreography-'+id}};
 const decision=INK.StrikeModelPolicy.evaluate(f,m);assert.equal(decision.mode,'native');INK.StrikeModelPolicy.latch(f.attack,decision);
 const model=INK.StrikeModel.sample(f);
 assert(model&&Object.values(model.joints3D).flat(2).every(Number.isFinite));
 assert.equal(INK.StrikeModelData['mai:'+id].designRevision,'mai-native-choreography-2026-10');
}
for(const id of ['aMP','aHK','cHP'])assert(INK.AirStrikeData['mai:'+id].nodes.some(n=>n.targetPolar&&n.fan!==undefined));

const relative=(d,dir)=>dir<0?({1:3,3:1,4:6,6:4,7:9,9:7}[d]||d):d;
const input=(dir=1,held=6)=>({...mai,dir,intentDir:dir,y:0,input:{dir:held,held:new Set()}});
assert.equal(SF6Mai.uniqueInput(input(),['MP'],get,relative).id,'fMP');
assert.equal(SF6Mai.uniqueInput(input(-1,4),['MP'],get,relative).id,'fMP','forward is relative to committed intent');
assert.equal(SF6Mai.uniqueInput(input(1,4),['HK'],get,relative).id,'bHK');
assert.equal(SF6Mai.uniqueInput({...input(),y:-50},['MP'],get,relative),null);
for(const [from,button,to]of [['sLK','LK','hien2'],['hien2','LK','hien3'],['bHK','HK','hoshi2']]){
 const f={...input(),attack:{m:get(mai,from),confirmed:true}};
 assert.equal(SF6Mai.uniqueInput(f,[button],get,relative).id,to);
 f.attack.confirmed=false;assert.notEqual(SF6Mai.uniqueInput(f,[button],get,relative)?.id,to,'whiff must not open '+to);
}
const G={phase:'fight',mode:'training',actionTick:15,tick:15,hitstop:0};
const extract=(start,end)=>game.slice(game.indexOf('function '+start+'('),game.indexOf('function '+end+'('));
let requested=null;
const interpret=new Function('G','BUTTONS','MOVES','BASESPECIALS','getMove','relative','motion','consumeMotion','requestMove','performButton','canRekkaContinue','controlFacing',extract('interpret','decideMove')+';return interpret;')(
 G,['LP','MP','HP','LK','MK','HK'],maiData.MOVES,maiData.BASESPECIALS,get,relative,()=>false,()=>{},(_f,m)=>{requested=m.id;return true;},()=>{},()=>false,f=>f.intentDir||f.dir);
for(const [f,buttons,id]of [[input(),['MP'],'fMP'],[input(-1,6),['HK'],'bHK'],[{...input(),attack:{m:get(mai,'sLK'),confirmed:true}},['LK'],'hien2'],[{...input(),attack:{m:get(mai,'hien2'),confirmed:true}},['LK'],'hien3'],[{...input(),attack:{m:get(mai,'bHK'),confirmed:true}},['HK'],'hoshi2']]){
 requested=null;interpret(f,buttons);assert.equal(requested,id,'production button interpreter chooses '+id);
}
const decision=new Function('G','$','getMove','canRushCancel','canCancel','canAirFollow','canRekkaContinue',extract('decideMove','requestMove')+';return decideMove;')(
 G,()=>({checked:false}),get,()=>false,(f,m)=>INK.CombatFlow.cancel(f,m,G).ok,
 (f,m)=>!!(m.from===f.attack?.m.id&&f.attack.confirmed&&INK.CombatFlow.age(G,f.attack)<=20&&f.attack.t<f.attack.m.total),()=>false);
const fighter=()=>({...input(),hp:10000,state:'attack',super:3,drive:6,landT:0,airLock:false,burnout:false});
for(const [from,to]of [['sLK','hien2'],['hien2','hien3'],['bHK','hoshi2']]){
 const f=fighter();f.attack={m:get(mai,from),t:10,confirmed:true,confirmFrame:12};
 assert.equal(decision(f,get(mai,to)).kind,'branch',from+' real decision permits target combo');
 f.attack.confirmed=false;assert.equal(decision(f,get(mai,to)).ok,false);
}
const air=fighter();air.y=-70;air.airLock=true;air.attack={m:get(mai,'hien3'),t:20,confirmed:true,confirmFrame:12};
for(const id of ['musabi_0','SA2'])assert.equal(decision(air,get(mai,id)).kind,'mai-air-cancel');
assert.equal(decision(air,get(mai,'SA1')).ok,false);
air.attack.t=34;assert.equal(decision(air,get(mai,'musabi_0')).ok,false);
air.attack.t=17;assert.equal(decision(air,get(mai,'musabi_0')).ok,false);
const neutral=fighter();neutral.state='idle';neutral.attack=null;
assert.equal(decision(neutral,get(mai,'airthrow')).code,'air');
neutral.y=-100;assert.equal(decision(neutral,get(mai,'airthrow')).ok,true);
for(const id of ['hien3','hoshi2']){
 const f=fighter(),m=get(mai,id);f.attack={m,t:m.startup};f.y=0;SF6Mai.tick(f,G,()=>{},()=>{});
 assert(f.y<0&&f.vy<0&&f.airLock,id+' simulation owns takeoff');
 f.vy=-3;SF6Mai.tick(f,G,()=>{},()=>{});assert.equal(f.vy,-3,'takeoff applied once');
}

class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.attrs={};}
 setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}
 hasAttribute(k){return k in this.attrs;}removeAttribute(k){delete this.attrs[k];}
 appendChild(n){this.children.push(n);n.parentNode=this;return n;}
}
global.document={createElementNS:(_ns,tag)=>new Element(tag)};
INK.VFX={settings:{enabled:true,reducedMotion:false,intensity:1}};
require(root+'/src/ink/mai-move-fx.js');
const back=new Element('g'),front=new Element('g'),fx=new INK.MaiMoveFX(back,front);
const all=()=>[...fx.nodes.back,...fx.nodes.front];
const heldPose=INK.MotionGraph.compose(held,32,store.clip(held).sample(32),profile,null);
assert(fx.render(held,32,heldPose,INK.Rig.solveAnimation(profile,heldPose))>0,'second throwing motion has its own release stroke');
for(const r of authored){
 const m=get(mai,r.gameId),clip=store.clip(r);
 for(const t of [0,r.binding.startup-.25,r.binding.startup,r.binding.startup+r.binding.active*.5,r.clip.duration]){
  const p=INK.MotionGraph.compose(r,t,clip.sample(t),profile,null),rig=INK.Rig.solveAnimation(profile,p),n=fx.render(r,t,p,rig,m,{dir:1,vx:10,vy:9,y:-100});
  assert(n<=48,r.key+' bounded retained pool');
  if(t<r.binding.startup||t===r.clip.duration)assert.equal(n,0,r.key+' no fire before launch or after recovery');
  for(const el of all().filter(el=>el.getAttribute('display')!=='none')){
   const d=el.getAttribute('d');assert(d&&!/NaN|Infinity|undefined/.test(d),r.key+' finite SVG path');
   try{assert(INK.compilePath(d).values.every(Number.isFinite));}catch(e){throw new Error(r.key+' at '+t+': '+d,{cause:e});}
  }
 }
}
// Live battle uses actor-screen coordinates: its outer group no longer mirrors
// the entire fighter. Test both headings using real VisualFrame construction.
for(const dir of [1,-1]){
 const r=store.byGame('mai','shinobibachi_2'),t=r.binding.startup+2,m=get(mai,r.gameId),f={...fighter(),dir,intentDir:dir,x:0,y:0,attack:{m,t}};
 const p=INK.MotionGraph.compose(r,t,store.clip(r).sample(t),profile,null),frame=INK.VisualFrame.build(f,p,{world:{x:0,y:0,dir,scale:1}});
 INK.VisualFrame.attach(p,frame);fx.render(r,t,p,frame.rig,m,f);
 assert(fx.nodes.front[0].getAttribute('transform').endsWith('rotate('+(dir<0?180:0)+')'),'rush flame follows live facing');
 const d=store.byGame('mai','musabi_0'),dm=get(mai,'musabi_0');f.y=-100;f.vx=dir*10;f.vy=9;f.attack={m:dm,t:dm.startup+2};
 const dp=INK.MotionGraph.compose(d,dm.startup+2,store.clip(d).sample(dm.startup+2),profile,null),df=INK.VisualFrame.build(f,dp,{world:{x:0,y:f.y,dir,scale:1}});
 INK.VisualFrame.attach(dp,df);fx.render(d,dm.startup+2,dp,df.rig,dm,f);
 const heading=Number(/rotate\(([^)]+)\)/.exec(fx.nodes.front[0].getAttribute('transform'))[1]);
 assert(dir<0?heading>90&&heading<180:heading>0&&heading<90,'air dive flame follows diagonal velocity');
}
INK.VFX.settings.enabled=false;assert.equal(fx.render(authored[0],10,{},{}),0);assert.equal(fx.front.getAttribute('display'),'none');
const owner={...mai},target={},throwMove=get(mai,'airthrow');owner.throwAction={owner,target,m:throwMove,t:20,release:26,duration:52};
assert.equal(INK.State.throwContext(owner).record.gameId,'@throw-air-sequence');
console.log('Mai choreography: 51 clips, held-OD release poses, quarter-frame rigs, native strikes, target-combo decisions, air cancel/throw and bounded SVG FX passed');
