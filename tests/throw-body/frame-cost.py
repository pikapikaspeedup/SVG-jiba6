"""Sequential real throw CPU samples. No display FPS or long-run claim."""
from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/throw-body';html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode());p.wait_for_function('window.INKDuel?.ready')
 rows=p.evaluate('''()=>{const A=SVG_FIGHTER,G=A.state,out=[];const run=(id,back,warm)=>{A.start(id,'ryu','training','classic',22);G.paused=true;document.getElementById('dummy').value='idle';A.teleport(0,560);A.teleport(1,685);A.tryMove(0,back?'backthrow':'throw');const times=[];for(let i=0;i<75;i++){const t=performance.now();A.step();A.render();INK.VFX.render(G,1);const elapsed=performance.now()-t,a=A.fighters[0].throwAction;if(a&&a.t>=4&&a.t<23)times.push(elapsed);}times.sort((a,b)=>a-b);if(!warm)out.push({id,back,gripFrames:times.length,mean:times.reduce((s,v)=>s+v,0)/times.length,p95:times[Math.floor(times.length*.95)],max:times.at(-1)});};run('ryu',false,true);for(const id of INK.Schema.CHARACTERS)for(const back of [false,true])run(id,back,false);return out;}''');b.close()
report={'htmlSha256':hashlib.sha256(html).hexdigest(),'scope':'Sequential actual forward/back throw simulation + full SVG/VFX DOM render. One full throw warmup, grip frames 4..22 sampled. CPU only; no display/GPU/mobile or endurance claim.','rows':rows,'errors':errors};(O/'frame-cost.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2));assert not errors and all(r['gripFrames']>0 for r in rows)
