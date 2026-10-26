"""Same-script sequential comparison of phase-six and current real SVG frames."""
from pathlib import Path
import os,json,hashlib,argparse
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/body-volume'
a=argparse.ArgumentParser();a.add_argument('--baseline',type=Path,required=True);args=a.parse_args()
rows=[];errors=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True)
 for label,path in [('baseline',args.baseline),('current',R/'dist/INK-Street-Fighter-6.html')]:
  html=path.read_bytes();p=b.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode());p.wait_for_function('window.INKDuel?.ready')
  measurements=p.evaluate('''()=>{const A=SVG_FIGHTER,G=A.state,out=[];function run(id,warm){A.start(id,'ryu','training','classic',42);G.paused=true;document.getElementById('dummy').value='idle';A.teleport(0,480);A.teleport(1,950);A.tryMove(0,'sHK');const times=[];for(let i=0;i<64;i++){const t=performance.now();A.step();A.render();INK.VFX.render(G,1);if(i>=4)times.push(performance.now()-t);}times.sort((a,b)=>a-b);if(!warm)out.push({id,frames:times.length,mean:times.reduce((a,b)=>a+b,0)/times.length,p95:times[Math.floor(times.length*.95)]});}run('ryu',true);for(const id of INK.Schema.CHARACTERS)run(id,false);return out;}''')
  rows.append({'label':label,'htmlSha256':hashlib.sha256(html).hexdigest(),'rows':measurements});p.close()
 b.close()
report={'htmlSha256':rows[-1]['htmlSha256'],'scope':'Sequential same-script 60 measured action steps per character after 4 initial steps; one warmup each build. Simulation plus full SVG/VFX DOM render CPU only, not display/GPU/mobile FPS.','builds':rows,'errors':errors};(O/'frame-cost.json').write_text(json.dumps(report,indent=2)+'\n');assert not errors
for row in rows: print(row['label'],'mean',min(r['mean'] for r in row['rows']),max(r['mean'] for r in row['rows']),'p95',min(r['p95'] for r in row['rows']),max(r['p95'] for r in row['rows']))
