"""Short synchronous simulation/render cost sample, not a displayed FPS benchmark."""
from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page();p.set_content(html.decode());p.wait_for_function('window.INKKineticLab?.ready')
 rows=p.evaluate('''()=>{const A=SVG_FIGHTER,out=[];for(const enabled of [false,true,true,false]){INK.MaterialFlow.settings.enabled=enabled;A.start('mai','iori','demo','classic',82);A.state.paused=true;const samples=[];for(let i=0;i<420;i++){const t=performance.now();A.step();A.render();INK.VFX.render(A.state,1);if(i>=120)samples.push(performance.now()-t);}samples.sort((a,b)=>a-b);out.push({enabled,mean:samples.reduce((a,b)=>a+b,0)/samples.length,p95:samples[Math.floor(samples.length*.95)],max:samples.at(-1),slots:INK.Kinetic.inspect().slots});}return out;}''');b.close()
report={'htmlSha256':hashlib.sha256(html).hexdigest(),'scope':'Synchronous headless CPU work only; same combat settings and seed; no GPU/display FPS claim','rows':rows}
(R/'qa/material/frame-cost.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
