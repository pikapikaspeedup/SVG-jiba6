"""Retained node/paint-server and synchronous CPU cost checks.
CPU timings exclude paint/compositing and MUST NOT be reported as device FPS.
"""
from pathlib import Path
import os,shutil
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[2]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium') or shutil.which('google-chrome'),headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1080});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((ROOT/'dist/INK-Street-Fighter-6.html').read_text(),wait_until='load',timeout=60000);page.wait_for_function('window.INKForge?.ready')
 out=page.evaluate(r"""async()=>{
  await INKForge.route('studio');const tests=[],benchmark=[];
  const test=(name,value,detail=null)=>tests.push({name,pass:!!value,detail});
  const ids=new Set(),holder=document.createElement('div');document.body.append(holder);
  for(const id of INK.Schema.CHARACTERS){
   const svg=INK.SVG.node('svg',{viewBox:'0 0 600 600',width:300,height:300},holder),g=INK.SVG.node('g',{transform:'translate(280 520)'},svg),profile=INKForge.store.profile(id),r=new INK.Renderer(g,profile),fx=new INK.Effects(g),records=INKForge.store.list(id).filter(r=>!r.gameId.startsWith('@'));
   r.render(INK.basePose,{frame:0,secondary:false});const before=svg.querySelectorAll('*').length,times=[];
   for(let n=0;n<240;n++){const rec=records[n%records.length],frame=(n*3)%rec.clip.duration,pose=INKForge.store.clip(rec).sample(frame),t=performance.now();r.render(pose,{frame,secondary:true});fx.render(rec,frame,pose,r.lastRig);times.push(performance.now()-t);}
   const after=svg.querySelectorAll('*').length;test(id+': retained node count stable over 240 varied samples',before===after,{before,after});
   const owned=new Set([...svg.querySelectorAll('[id]')].map(n=>n.id));let local=true,unique=true;for(const name of owned){if(ids.has(name))unique=false;ids.add(name);}for(const el of svg.querySelectorAll('*'))for(const a of el.attributes)for(const m of a.value.matchAll(/url\(#([^\)]+)\)/g)){if(!owned.has(m[1]))local=false;}
   test(id+': SVG paint references are local and globally unique',local&&unique,{paintIds:owned.size});
   const pose=INKForge.store.clip(records[0]).sample(1);r.render(pose,{frame:1,secondary:false});r.render(pose,{frame:1,secondary:false});test(id+': repeated identical pose makes zero renderer writes',r.stats.writes===0,r.stats.writes);
   test(id+': no raster elements or non-finite SVG geometry',svg.querySelectorAll('image').length===0&&!/NaN|Infinity/.test(svg.outerHTML));
   times.sort((a,b)=>a-b);benchmark.push({character:id,nodes:after,samples:times.length,medianMs:times[120],p95Ms:times[228],maxMs:times.at(-1)});r.destroy();fx.destroy();svg.remove();
  }
  holder.remove();test('No external script, font, image or stylesheet loads in standalone app',!document.querySelector('script[src],link[rel=stylesheet][href^=http],img[src^=http]'));
  test('New roster starts in actual CPU battle mode',document.getElementById('f-match-mode').value==='cpu');
  return {tests,total:tests.length,passed:tests.filter(t=>t.pass).length,benchmark,note:'Synchronous JavaScript render+FX time only in headless Chromium; not GPU/paint time or a device FPS guarantee.'};
 }""")
 out['errors']=errors;(ROOT/'qa/forge-retained.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in out.items() if k!='tests'},ensure_ascii=False,indent=2));print('failures:',[t for t in out['tests'] if not t['pass']]);b.close()
 if out['passed']!=out['total'] or errors:raise SystemExit(1)
