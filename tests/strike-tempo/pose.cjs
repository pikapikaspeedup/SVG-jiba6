const fs=require('fs'),vm=require('vm'),assert=require('assert');
const INK={copy:x=>structuredClone(x),Kinetic:{settings:{enabled:true,motion:1}},Articulation:{inherit:(s,p)=>{p.metadata=s.metadata;return p;}}};
vm.runInNewContext(fs.readFileSync('src/ink/strike-tempo-fx.js','utf8'),{INK});
const M=INK.StrikeTempoFX,source={fw:[80,-270],rw:[-30,-260],fe:[30,-230],re:[-50,-230],fk:[30,-100],rk:[-20,-100],ff:[55,0],rf:[-50,0],metadata:{fixed:true}};
let fingerprints=new Set();
for(const id of Object.keys(M.profiles))for(const move of ['sHP','sHK']){
 const f={ch:{id},state:'attack',dir:1,attack:{t:9,m:{id:move,startup:12},tempo:{phase:'holding',age:12}}},before=JSON.stringify(f),base=JSON.stringify(source),p=M.pose(f,source);
 assert.equal(JSON.stringify(f),before);assert.equal(JSON.stringify(source),base);assert.equal(p.metadata,source.metadata);
 for(const key of ['fw','ff','rf'])assert.deepEqual(Array.from(p[key]),source[key]);
 assert.equal(JSON.stringify(M.pose(f,source)),JSON.stringify(p));
 f.dir=-1;assert.equal(JSON.stringify(M.pose(f,source)),JSON.stringify(p));
 assert.ok(JSON.stringify(p).indexOf('null')<0);fingerprints.add(JSON.stringify(p));
 f.attack.tempo.phase='released';f.attack.t=12;assert.equal(M.pose(f,source),source);
 f.attack.t=9+1e-6;const first=M.pose(f,source);assert.ok(Math.abs(first.bob-p.bob)<1e-6);
 f.attack.tempo.phase='armed';f.attack.tempo.age=0;f.attack.t=7;assert.equal(M.pose(f,source),source);
 f.state='recovery';f.attack=null;f._inkTempo={phase:'feint',age:0,move};assert.equal(M.pose(f,source),source);
 f._inkTempo.age=6;assert.notEqual(M.pose(f,source),source);f._inkTempo.age=12;assert.equal(M.pose(f,source),source);
}
assert.equal(fingerprints.size,16);console.log('StrikeTempoFX: 8 characters × 2 heavy paths; purity, endpoints, frozen sampling and phase endpoints passed.');
