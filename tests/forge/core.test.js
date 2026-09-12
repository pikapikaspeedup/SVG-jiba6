/* Run: node tests/forge/core.test.js. No packages required. */
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../..');global.INK=require(root+'/src/ink/core.js');require(root+'/src/ink/project.js');require(root+'/src/ink/runtime.js');
let results=[];const test=(name,fn)=>{try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.message});}};
const bundle={manifest:JSON.parse(fs.readFileSync(root+'/assets/ink/project.json')),characters:{}};let count=0,byGame=new Set();
for(const id of INK.Schema.CHARACTERS){const dir=root+'/assets/ink/characters/'+id,model=JSON.parse(fs.readFileSync(dir+'/model.json')),rig=JSON.parse(fs.readFileSync(dir+'/rig.json')),moves={};test(id+' model/rig schema',()=>{INK.Schema.model(model);INK.Schema.rig(rig);});
 for(const f of fs.readdirSync(dir+'/moves')){const move=JSON.parse(fs.readFileSync(dir+'/moves/'+f));test(id+'/'+f,()=>{INK.Schema.move(move);assert.equal(move.key,path.basename(f,'.json'));assert(!byGame.has(id+':'+move.gameId));byGame.add(id+':'+move.gameId);});moves[move.key]=move;count++;}bundle.characters[id]={model,rig,moves};}
test('Complete bundle and manifest agree before the game boots',()=>assert(INK.Schema.bundle(bundle)));
test('Missing source action fails early instead of crashing during gameplay',()=>{const n=structuredClone(bundle);delete n.characters.mai.moves.idle;assert.throws(()=>INK.Schema.bundle(n));});
const r=bundle.characters.mai.moves['hishou-ryuuenjin-light'],copy=INK.Schema.clone;
test('690 independent assets, 522 combat entries + 168 state/sequence assets',()=>assert.equal(count,690));
test('Mai canonical names do not alias DP and ground spin',()=>{assert.equal(r.gameId,'ryuenbu_0');assert.equal(bundle.characters.mai.moves['ryuuenbu-light'].gameId,'hissatsu_0');});
test('retime changes all phases and does not mutate original',()=>{const n=INK.retime(r,14,27,36);assert.equal(n.clip.duration,77);assert.equal(r.binding.startup,5);assert(n.binding.retimed);assert.equal(n.fx[0].frame,14);INK.Schema.move(n);});
test('out-of-range times rejected',()=>assert.throws(()=>INK.retime(r,0,10,20)));
test('unsafe JSON key rejected',()=>assert.throws(()=>INK.Schema.safeData(JSON.parse('{"__proto__":{"polluted":1}}'))));
test('malformed track rejects atomically',()=>{const n=copy(r);n.clip.tracks.lean=[[8,1],[3,5]];assert.throws(()=>INK.Schema.move(n));});
test('mismatched action ID rejected',()=>{const n=copy(r);n.clip.id='ken:test';assert.throws(()=>INK.Schema.move(n));});
test('JSON property order does not change phase validation',()=>{const n=copy(r),p=n.clip.phases;n.clip.phases={recovery:p.recovery,active:p.active,startup:p.startup};INK.Schema.move(n);});
test('mismatched binding phases rejected',()=>{const n=copy(r);n.binding.startup=9;assert.throws(()=>INK.Schema.move(n));});
test('FX pool overflow is rejected instead of silently truncating effects',()=>{const n=copy(r);n.fx=Array.from({length:13},(_,i)=>({...n.fx[0],id:'overlap-'+i}));assert.throws(()=>INK.Schema.move(n));n.fx.pop();INK.Schema.move(n);});
test('negative FX duration rejected',()=>{const n=copy(r);n.fx[0].duration=-1;assert.throws(()=>INK.Schema.move(n));});
test('unknown socket rejected',()=>{const n=copy(r);n.fx[0].socket='wrist<script>';assert.throws(()=>INK.Schema.move(n));});
test('hit outside active frames rejected',()=>{const n=copy(r);n.boxes={mode:'custom',items:[{id:'hit1',kind:'hit',socket:'frontHand',start:0,end:3,x:0,y:0,w:20,h:20}]};assert.throws(()=>INK.Schema.move(n));});
test('legal box stays inside active range on retime',()=>{const n=copy(r);n.boxes={mode:'custom',items:[{id:'hit1',kind:'hit',socket:'frontHand',start:5,end:22,x:-20,y:-30,w:50,h:60}]};const m=INK.retime(n,10,4,20);assert.equal(m.boxes.items[0].start,10);assert.equal(m.boxes.items[0].end,14);});
test('hip and head rig metadata reach runtime sockets',()=>{const c={id:'mai',female:true,rigLengths:[64,67,96,98],rigHipWidth:70,rigHeadOffset:[10,-62]},p=INK.basePose,rig=INK.Rig.solveAnimation(c,p);assert.equal(rig.frontLeg[0][0]-rig.rearLeg[0][0],70);const sockets=INK.Rig.sockets(p,rig);assert.equal(sockets.head[1],-357);});
test('phase map aligns contact, not total-duration proportion',()=>{assert.equal(INK.Runtime.phaseMap(5,[0,5,22,44],[0,10,40,80]),10);assert.equal(INK.Runtime.phaseMap(22,[0,5,22,44],[0,10,40,80]),40);});
(async()=>{
 const store=new INK.AssetStore(bundle);await store.init();const n=copy(r);n.fx[0].color='#aabbcc';await store.save({motion:n});test('save affects only target move',()=>{assert.equal(store.getMove('mai',r.key).fx[0].color,'#aabbcc');assert.equal(store.getMove('mai','ryuuenbu-light').fx[0].color,bundle.characters.mai.moves['ryuuenbu-light'].fx[0].color);});
 const before=JSON.stringify(store.snapshot());try{const invalid=store.snapshot();invalid.moves['mai:'+r.key].binding.startup=-3;await store.importSnapshot(invalid);}catch(e){}test('invalid project import preserves previous state',()=>assert.equal(JSON.stringify(store.snapshot()),before));
 store.persistence.set=async()=>{throw Error('QuotaExceeded');};try{await store.save({motion:r});}catch(e){}test('failed durable save preserves previous revision',()=>assert.equal(JSON.stringify(store.snapshot()),before));
 test('all asset paths are separate JSON files',()=>{const files=store.files();assert.equal(Object.keys(files).length,708);assert(files['characters/mai/model.json']);assert(files['characters/mai/rig.json']);assert(files['characters/mai/moves/'+r.key+'.json']);});
 const out={suite:'forge-core',total:results.length,passed:results.filter(x=>x.pass).length,failures:results.filter(x=>!x.pass),tests:results};fs.writeFileSync(root+'/qa/forge-core.json',JSON.stringify(out,null,2));console.log(JSON.stringify({total:out.total,passed:out.passed,failures:out.failures},null,2));process.exitCode=out.failures.length?1:0;
})();
