'use strict';
/* A scoped CPU sampler benchmark. Not SVG FPS, not a cross-device promise. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{performance}=require('node:perf_hooks');
const R=path.resolve(__dirname,'../..');global.INK=require(R+'/src/ink/core.js');require(R+'/src/ink/compiled-motion.js');
const names=['ryuuenbu-heavy','enbu-ada-zakura','sMP','hissatsu-shinobi-bachi-heavy'];
const files=fs.readdirSync(R+'/assets/ink/characters/mai/moves').filter(x=>names.some(n=>x===n+'.json'));
const data=files.map(f=>JSON.parse(fs.readFileSync(R+'/assets/ink/characters/mai/moves/'+f)).clip);
const old=data.map(d=>new INK.Clip(d)),compiled=data.map(d=>new INK.CompiledClip(d));
const count=75000,runs=[];let checksum=0;
function measure(clips,n){const before=performance.now();let sum=0;for(let i=0;i<n;i++){const c=clips[i%clips.length],t=(i*.357143)%c.duration;const p=c.sample(t);sum+=(p.fanAngle||0)+p.fw[0]+p.fa[1];}checksum+=sum;return performance.now()-before;}
// Warm both paths. Alternating order reduces one-direction warmup bias.
measure(old,10000);measure(compiled,10000);
for(let i=0;i<7;i++){let a,b;if(i%2){b=measure(compiled,count);a=measure(old,count);}else{a=measure(old,count);b=measure(compiled,count);}runs.push({legacyMs:a,compiledMs:b});}
const median=a=>a.slice().sort((a,b)=>a-b)[Math.floor(a.length/2)];
const report={capturedAt:new Date().toISOString(),htmlSha256:crypto.createHash('sha256').update(fs.readFileSync(R+'/dist/INK-Street-Fighter-6.html')).digest('hex'),node:process.version,platform:process.platform,arch:process.arch,files,samplesPerRun:count,repetitions:runs.length,warmup:10000,legacyMedianMs:median(runs.map(x=>x.legacyMs)),compiledMedianMs:median(runs.map(x=>x.compiledMs)),runs,checksum,limitations:['Isolated Node CPU sampler only; excludes graph, DOM/SVG, springs, GPU and browser rendering.','Other tests may be active on the same host. Do not advertise this as game FPS improvement.']};report.ratio=report.legacyMedianMs/report.compiledMedianMs;
fs.writeFileSync(R+'/qa/flow5/benchmark.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
