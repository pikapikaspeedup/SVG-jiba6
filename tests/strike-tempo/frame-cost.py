"""Short sequential held-heavy CPU samples, not display FPS."""
from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/strike-tempo';html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode());p.wait_for_function('window.INKTempoLab?.ready')
 rows=p.evaluate('''()=>{const A=SVG_FIGHTER,G=A.state,out=[];const run=(id,key,warm)=>{A.start(id,'ryu','training','classic',22);G.paused=false;document.getElementById('dummy').value='idle';A.teleport(0,400);A.teleport(1,1100);A.press(0,key);const times=[];for(let i=0;i<65;i++){const t=performance.now();A.step();A.render();INK.VFX.render(G,1);const elapsed=performance.now()-t;if(A.fighters[0].attack?.tempo?.phase==='holding')times.push(elapsed);}A.release(0,key);times.sort((a,b)=>a-b);if(!warm)out.push({id,key,holdFrames:times.length,mean:times.reduce((s,v)=>s+v,0)/times.length,p95:times[Math.floor(times.length*.95)]});};run('ryu','HP',true);for(const id of INK.Schema.CHARACTERS)for(const key of ['HP','HK'])run(id,key,false);return out;}''');b.close()
report={'htmlSha256':hashlib.sha256(html).hexdigest(),'scope':'Sequential real held HP/HK simulation + SVG/VFX DOM render, one full-action warmup. CPU only.','rows':rows,'errors':errors};(O/'frame-cost.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2));assert not errors and all(r['holdFrames']==12 for r in rows)
