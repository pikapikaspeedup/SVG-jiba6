from pathlib import Path
import json,shutil,hashlib,datetime
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow8';errors=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox']);p=b.new_page(viewport={'width':1440,'height':1100});p.on('pageerror',lambda e: errors.append(str(e)));p.set_content((R/'dist/INK-Street-Fighter-6.html').read_text(),wait_until='load',timeout=60000);p.wait_for_function('window.INKResponseLab?.ready');p.screenshot(path=str(O/'home-candidate.png'))
 out=p.evaluate('''async()=>{await INKResponseLab.open();const reports=[];for(const kind of ['jump','walk','knockdown','combo']){await INKResponseLab.run(kind);const R=INK.Replay;let result;try{const v=R.parse(JSON.stringify(R.export()));result={frames:v.frames.length,events:v.events.length,bytes:JSON.stringify(v).length,types:[...new Set(v.events.map(e=>e.type))],states:[...new Set(v.frames.flatMap(f=>f.actors.map(a=>a.clip)))],maxHits:Math.max(...v.frames.map(f=>f.actors[0].combo)),maxDamage:Math.max(...v.frames.map(f=>f.actors[0].damage))};}catch(e){result={error:e.message,secondary:R.frames[0].actors[0].secondary,pose:R.frames[0].actors[0].pose}}reports.push({kind,...result});}await INKResponseLab.run('jump');INKResponseLab.seek(55);return reports;}''')
 p.screenshot(path=str(O/'review-candidate.png'));print(json.dumps(out,ensure_ascii=False,indent=2));print('ERRORS',errors);b.close()
 (O/'smoke-candidate.json').write_text(json.dumps({'results':out,'browserErrors':errors,'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':hashlib.sha256((R/'dist/INK-Street-Fighter-6.html').read_bytes()).hexdigest()},ensure_ascii=False,indent=2))
