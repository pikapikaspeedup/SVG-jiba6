"""FLOW 09 migration, with exact anchors so source changes cannot silently go missing."""
from pathlib import Path
import json
R=Path(__file__).resolve().parents[1]
def change(path,old,new,count=1):
 p=R/path;s=p.read_text();assert s.count(old)==count,(path,s.count(old),old[:100]);p.write_text(s.replace(old,new),encoding='utf-8')
# Same evaluated time must have the same pose on the first and every following draw.
change('game.js',"if(!changed&&G.screen==='battle'&&!renderHold&&alpha<1)view=INK.Presentation.view(f,alpha,false);", "if(G.screen==='battle'&&!renderHold&&alpha<1)view=INK.Presentation.view(f,alpha,false);")
# Keep the compatibility renderer's separate hold code. The production path is simulation-owned.
change('game.js',"function renderFighter(f,dt=1/60,alpha=1){\n if(G.paused||G.hitstop>0||G._inkStepFrozen)f._inkHoldAction=G.actionTick;", "function renderFighter(f,dt=1/60,alpha=1){\n // Freeze-release ownership is written by simulate(), never by this draw.")
change('game.js',"function simulate(force=false){const before=G.tick;simulateCore(force);if(G.tick!==before)INK.Replay.capture(G,fighters);}","function simulate(force=false){const before=G.tick;simulateCore(force);if(G.tick!==before){if(G.hitstop>0||G._inkStepFrozen)for(const f of fighters)f._inkHoldAction=G.actionTick;INK.Replay.capture(G,fighters);}}")
# No global shake/pose-bounds camera. Explicit close-up remains an opt-in.
p=R/'game.js';s=p.read_text();a=s.index('function artCamera(now,alpha=1)');b=s.index('\nconst originalStartBattle=',a);s=s[:a]+'''function artCamera(now,alpha=1){
 INK.Cinema.sync(INK.Cinema.enabled&&INK.Combo.status!=='idle');
 return INK.Viewport.sample(G,fighters,now,alpha);
}'''+s[b:];s=s.replace("camZoom=1.045;camX=720;camY=480;camStamp=0;originalStartBattle();","camZoom=1.045;camX=720;camY=480;camStamp=0;INK.Viewport.reset();originalStartBattle();")
s=s.replace("SVG_FIGHTER.focusCamera=()=>{camX=(fighters[0].x+fighters[1].x)/2;const bs=fighters.map(actorYBounds);camY=(Math.min(...bs.map(b=>b[0]))+Math.max(...bs.map(b=>b[1])))/2;camZoom=1.065;camStamp=0;};", "SVG_FIGHTER.focusCamera=()=>INK.Viewport.reset();SVG_FIGHTER.renderCamera=(now=performance.now(),alpha=1)=>{const value=artCamera(now,alpha);sa($('camera'),'transform',value);return value;};")
p.write_text(s)
# Exact equivalent arithmetic, without a temporary array/map/join for every Bezier point.
change('src/ink/skin-geometry.js',"const fmt=q=>q.map(x=>Math.round(x*1000)/1000).join(' ');", "const fmt=q=>(Math.round(q[0]*1000)/1000)+' '+(Math.round(q[1]*1000)/1000);\n const xy=(x,y)=>(Math.round(x*1000)/1000)+' '+(Math.round(y*1000)/1000);")
change('src/ink/skin-geometry.js',"d+='C'+fmt(vec.add(b,vec.mul(vec.sub(c,a),tension)))+' '+fmt(vec.sub(c,vec.mul(vec.sub(e,b),tension)))+' '+fmt(c);", "d+='C'+xy(b[0]+(c[0]-a[0])*tension,b[1]+(c[1]-a[1])*tension)+' '+xy(c[0]-(e[0]-b[0])*tension,c[1]-(e[1]-b[1])*tension)+' '+fmt(c);")
change('src/ink/skin-geometry.js',"function sweep(chain,widths,outer=mat.identity()){\n  const g=sampled(chain,widths);", "function sweep(chain,widths,outer=mat.identity(),g=sampled(chain,widths)){")
change('src/ink/skin-geometry.js',"function band(chain,widths,outer,from=-.92,to=-.48){\n  const g=sampled(chain,widths);if(!g)return '';", "function band(chain,widths,outer,from=-.92,to=-.48,g=sampled(chain,widths)){\n  if(!g)return '';")
# Export a shared centerline. Three surfaces no longer resample the same limb three times.
p=R/'src/ink/skin-geometry.js';s=p.read_text();assert 'INK.SkinGeometry=' in s;s=s.replace('INK.SkinGeometry={','INK.SkinGeometry={sampled,');p.write_text(s)
change('src/ink/renderer.js',"const contour=INK.SkinGeometry.sweep(chain,baseWidths,outer);assign(this.surface,'d',contour,stats);assign(this.clipShape,'d',contour,stats);\n   assign(this.skinShade,'d',this.material.skin?INK.SkinGeometry.band(chain,baseWidths,outer):'',stats);\n   assign(this.skinLight,'d',this.material.skin?INK.SkinGeometry.band(chain,baseWidths,outer,.38,.61):'',stats);", "const centerline=INK.SkinGeometry.sampled(chain,baseWidths);\n   const contour=INK.SkinGeometry.sweep(chain,baseWidths,outer,centerline);assign(this.surface,'d',contour,stats);assign(this.clipShape,'d',contour,stats);\n   assign(this.skinShade,'d',this.material.skin?INK.SkinGeometry.band(chain,baseWidths,outer,-.92,-.48,centerline):'',stats);\n   assign(this.skinLight,'d',this.material.skin?INK.SkinGeometry.band(chain,baseWidths,outer,.38,.61,centerline):'',stats);")
change('src/ink/renderer.js',"assign(part.shade,'d',segmentShadow(L,top,bottom,!!i),stats);assign(part.light,'d',segmentLight(L,top,bottom),stats);", "if(!this.material.skin){assign(part.shade,'d',segmentShadow(L,top,bottom,!!i),stats);assign(part.light,'d',segmentLight(L,top,bottom),stats);}")
change('src/ink/renderer.js',"this.torso.render(p,s);this.torsoBack.render(p,s);this.torsoSide.render(p,s);\n   const bodyBands=INK.Turn.bands(INK.Turn.angle(p),64),faceBands=INK.Turn.bands(INK.Turn.angle(p,'head'),48);", "const bodyBands=INK.Turn.bands(INK.Turn.angle(p),64),faceBands=INK.Turn.bands(INK.Turn.angle(p,'head'),48);\n   if(bodyBands.front[1]>=.001)this.torso.render(p,s);\n   if(bodyBands.back[1]>=.001)this.torsoBack.render(p,s);\n   if(bodyBands.profile[1]>=.001)this.torsoSide.render(p,s);")
# Avoid building a string signature on every torso point; still detect in-place editor mutation.
change('src/ink/anatomy.js',"const frameCache=new WeakMap();\n function frameInfo(p){\n  const signature=[p.lean,p.bob,p.chest,p.pelvis,p.yaw,p.turn,p.chestYaw,p.pelvisYaw,p.headYaw].join('|');\n  const old=frameCache.get(p);if(old?.signature===signature)return old;", "const frameCache=new WeakMap(),frameKeys=['lean','bob','chest','pelvis','yaw','turn','chestYaw','pelvisYaw','headYaw'];\n function frameInfo(p){\n  const old=frameCache.get(p);let equal=!!old;\n  if(old)for(let i=0;i<frameKeys.length;i++)if(old.signature[i]!==p[frameKeys[i]]){equal=false;break;}\n  if(equal)return old;const signature=frameKeys.map(k=>p[k]);")
# Small pose copies are the inner animation operation. Preserve own-property and array ownership semantics.
change('src/ink/core.js',"const copy = o => Object.fromEntries(Object.entries(o).map(([k,v])=>[k,Array.isArray(v)?v.slice():v]));", "const copy = o => {const out={};for(const k in o)if(Object.hasOwn(o,k)){const v=o[k];out[k]=Array.isArray(v)?v.slice():v;}return out;};")
# Cache pure reference contact rig (same foot/start/clip/settings), never history/world roots.
change('src/ink/motion-graph.js',"const ref=layers(data,c.start,compiled(data).clip.sample(c.start),options),rig=INK.Rig.solveAnimation(profile,ref);", "const compiledData=compiled(data);compiledData.contactRefs??=new Map();\n      const referenceKey=c.id+'|'+JSON.stringify([profile.rigLengths,profile.rigRearShoulder,profile.rigFrontShoulder,profile.rigHipWidth,options.enabled,options.layers,INK.Anatomy?.settings,INK.Articulation?.settings]);\n      let reference=compiledData.contactRefs.get(referenceKey);\n      if(!reference){const ref=layers(data,c.start,compiledData.clip.sample(c.start),options);reference={ref,rig:INK.Rig.solveAnimation(profile,ref)};if(compiledData.contactRefs.size>=32)compiledData.contactRefs.clear();compiledData.contactRefs.set(referenceKey,reference);}\n      const {ref,rig}=reference;")
# Local FX requires current roots, but the same frame sample may serve many sockets/events.
change('src/ink/effects.js',"render(record,frame,pose,rig,context=null){this.context=context;", "render(record,frame,pose,rig,context=null){this.context=context;this.frameSamples=new Map();")
old="const context=this.context?.history?{...INK.MotionGraph.rootAt(this.context,time),history:this.context.history,origin:this.context.origin}:null,p=INK.MotionGraph.compose(record,time,this.clip.sample(time),profile,context,this.graphOptions||INK.MotionGraph.settings),r=INK.Rig.solveAnimation(profile,p);q=mat.point(rootMat(p),INK.Runtime.socket(p,r,socket));"
new="let evaluated=this.frameSamples?.get(time);if(!evaluated){const context=this.context?.history?{...INK.MotionGraph.rootAt(this.context,time),history:this.context.history,origin:this.context.origin}:null,p=INK.MotionGraph.compose(record,time,this.clip.sample(time),profile,context,this.graphOptions||INK.MotionGraph.settings);evaluated={p,r:INK.Rig.solveAnimation(profile,p),matrix:rootMat(p)};this.frameSamples?.set(time,evaluated);}q=mat.point(evaluated.matrix,INK.Runtime.socket(evaluated.p,evaluated.r,socket));"
change('src/ink/effects.js',old,new)
# Return zero for every old scene-wide shake path, independent of particle intensity.
p=R/'src/ink/scene-feedback.js';s=p.read_text();a=s.index('  camera(G,alpha=1)');b=s.index('\n  clear()',a);s=s[:a]+"  camera(){return[0,0];}, // FLOW 09: hit feedback never translates the scenery.\n"+s[b:];p.write_text(s)
# A new clearly-labelled stop profile. The established two remain unchanged.
change('src/ink/combat-flow.js',"rhythm:'weighted', speed:1", "rhythm:'fluid', speed:1")
change('src/ink/combat-flow.js',"const profiles = {", "const profiles = {\n    fluid:{label:'连贯节奏',light:4,medium:5,heavy:7,block:3,superStart:18,superMid:2,superEnd:9},")
change('src/ink/combat-flow.js',"m.hits>1&&!last&&settings.rhythm==='weighted'?Math.min(5,m.level>=2?5:4)", "m.hits>1&&!last&&settings.rhythm==='fluid'?Math.min(3,m.level>=2?3:2):m.hits>1&&!last&&settings.rhythm==='weighted'?Math.min(5,m.level>=2?5:4)")
change('forge/rhythm.js', '<select id="r7-rhythm"><option value="weighted">', '<select id="r7-rhythm"><option value="fluid">连贯节奏 · 减少反复定格</option><option value="weighted">')
# Version and import storage boundary, not changes to the 690 character assets.
change('src/ink/core.js',"'8.0.0-response'","'9.0.0-fluid'")
change('src/ink/game-adapter.js',"version:'8.0.0'","version:'9.0.0'")
change('game.js',"version:'8.0.0-ink-response'","version:'9.0.0-ink-fluid'")
change('src/ink/project.js',"'ink-flow-sf6-v8'","'ink-flow-sf6-v9'")
change('tools/build_forge.py',"<title>INK FLOW 08 · 落地响应与实战回放</title>","<title>INK FLOW 09 · 稳镜与流畅动作</title>")
change('tools/build_forge.py',"'src/ink/scene-feedback.js',","'src/ink/scene-feedback.js','src/ink/viewport.js',")
change('tools/build_forge.py',"'ink-flow-player-8'","'ink-flow-player-9'")
p=R/'assets/ink/project.json';s=json.loads(p.read_text());s['name']='INK FLOW 09 / Fluid Motion & Stable Camera';s['build']='9.0.0';p.write_text(json.dumps(s,ensure_ascii=False,indent=2)+'\n')
