"""Body/contact enabled versus disabled CPU sample. Not GPU/display FPS or a long-run soak."""
from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode());p.wait_for_function('window.INKDuel?.ready')
 rows=p.evaluate('''()=>{const A=SVG_FIGHTER,out=[];for(const enabled of [false,true])for(const id of ['ryu','cammy']){INK.BodySupport.settings.enabled=enabled;INK.ContactResponse.settings.enabled=enabled;document.getElementById('difficulty').value='hard';A.start(id,id==='ryu'?'cammy':'ryu','demo','classic',82);A.state.paused=true;const samples=[];for(let i=0;i<480;i++){const t=performance.now();A.step();A.render();INK.VFX.render(A.state,1);if(i>=120)samples.push(performance.now()-t);}samples.sort((a,b)=>a-b);out.push({id,enabled,mean:samples.reduce((a,b)=>a+b,0)/samples.length,p95:samples[Math.floor(samples.length*.95)],max:samples.at(-1),nodes:document.querySelectorAll('#game *').length,light:INK.StageLight.inspect(),impacts:INK.Kinetic.inspect().slots});}return out;}''');b.close()
report={'htmlSha256':hashlib.sha256(html).hexdigest(),'scope':'Sequential body/contact off then on, Ryu/Cammy 480-step samples, first 120 warmup. Outcomes may differ due to push changes, so this is a workload sample, not an identical-frame benchmark. Synchronous simulation + SVG DOM + VFX CPU time only. No display/GPU FPS, audio hardware, true mobile, balance or endurance claim.','rows':rows,'errors':errors}
(R/'qa/body-contact/frame-cost.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2));assert not errors
