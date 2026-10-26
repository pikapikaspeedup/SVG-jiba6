const fs=require('fs'),vm=require('vm'),assert=require('assert');const INK={Kinetic:{settings:{enabled:true,impact:1}}};vm.runInNewContext(fs.readFileSync('src/ink/hit-body.js','utf8'),{INK});const H=INK.HitBody;
assert.equal(H.wave(2,3,28),0);assert.equal(H.wave(3,3,28),0);assert.ok(Math.abs(H.wave(3.00001,3,28))<1e-9);
for(const id of Object.keys(H.profiles)){
 const f={ch:{id},dir:1,x:400,y:0,state:'hit',_inkVisualClock:0};const r={actorBirth:0,worldDir:1,energy:1,outcome:'hit',zone:'body',contact:{point:[420,440],normalGeom:[1,.2],hurtPart:'chest'}};
 assert.ok(H.commit(f,r));assert.ok(!H.commit(f,r));const zero=H.sample(f,0);assert.ok(zero.chest<0);assert.equal(zero.head,0);assert.equal(zero.pelvis,0);
 const snapshot=JSON.stringify(f);for(let t=0;t<30;t+=.25){const a=H.sample(f,t),b=H.sample(f,t);assert.equal(JSON.stringify(a),JSON.stringify(b));assert.ok(Object.values(a).flat().every(Number.isFinite));}assert.equal(JSON.stringify(f),snapshot);
 const a=H.sample(f,5);f.dir=-1;const b=H.sample(f,5);assert.ok(Math.abs(a.lean+b.lean)<1e-9);f.dir=1;
 H.commit(f,{...r,actorBirth:4});const mixed=H.sample(f,6);assert.equal(mixed.count,2);assert.notEqual(mixed.head,0);for(let i=5;i<12;i++)H.commit(f,{...r,actorBirth:i});assert.equal(f._inkHitBody.length,3);assert.ok(Object.isFrozen(f._inkHitBody[0].point));
 f.y=-1;assert.equal(H.sample(f,12).count,0);H.reset(f);assert.equal(f._inkHitBody,null);
}
const f={ch:{id:'ryu'},dir:1,x:0,y:0,state:'hit'};H.commit(f,{actorBirth:0,energy:1,worldDir:1,zone:'leg',contact:{hurtPart:'rearLeg'}});const q=H.sample(f,0);assert.ok(q.ra[1]<0);assert.equal(q.fa[1],0);assert.equal(q.head,0);assert.equal(H.commit(f,{guard:true}),false);assert.equal(H.commit(f,{armor:true}),false);
console.log('HitBody: 8 profiles, delayed propagation, history cap, frozen sampling, world direction and leg identity passed');
function bodyAt(y,normal=[1,0]){const f={ch:{id:'ryu'},dir:1,x:0,y:0,state:'hit'};H.commit(f,{actorBirth:0,energy:1,worldDir:1,zone:'body',contact:{point:[30,665+y],normalGeom:normal,hurtPart:'chest'}});return H.sample(f,6);}
const high=bodyAt(-300),low=bodyAt(-180);assert.ok(high.chestYaw*low.chestYaw<0,'same zone has signed off-centre twist');assert.ok(Math.abs(high.head)>Math.abs(low.head));assert.ok(Math.abs(low.pelvis)>Math.abs(high.pelvis));const nearA=bodyAt(-240-.0001),nearB=bodyAt(-240+.0001);assert.ok(Math.abs(nearA.chestYaw-nearB.chestYaw)<.0001);assert.notEqual(bodyAt(-240,[0,1]).chestYaw,bodyAt(-240,[0,-1]).chestYaw);
INK.StrikeFeel={settings:{enabled:false}};assert.equal(H.active(),false);const disabled={ch:{id:'ryu'},dir:1,x:0,y:0,state:'hit'};assert.equal(H.commit(disabled,{actorBirth:0,outcome:'hit',energy:1}),false);assert.equal(disabled._inkHitBody,undefined);INK.StrikeFeel.settings.enabled=true;assert.equal(H.sample(disabled,1).count,0);
