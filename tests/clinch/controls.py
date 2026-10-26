from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/clinch';O.mkdir(exist_ok=True);html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode());p.wait_for_function('window.INKClinchLab?.ready');p.evaluate("()=>INKDuel.start('training')");p.locator('#clinch-practice').click();rows=[]
 rows+=p.evaluate('''()=>{const A=SVG_FIGHTER,G=A.state,out=[];G.paused=true;const setup=()=>{A.start('ryu','ken','training','classic',29);G.paused=true;document.getElementById('dummy').value='idle';document.getElementById('autohp').checked=false;A.teleport(0,560);A.teleport(1,690);A.step();};
 setup();G.paused=false;document.getElementById('clinch-back').click();G.paused=true;const f=A.fighters[0],key=f.dir===1?'left':'right';out.push({name:'back throw button uses public directional input and releases its own held key',passed:f.attack?.m.id==='backthrow'&&!f.input.held.has(key)&&!f.input.held.has('THROW')});
 setup();A.tryMove(1,'throw');for(let i=0;i<30&&!A.fighters[0].captured;i++)A.step();const captured=A.fighters[0].captured;G.paused=false;document.getElementById('clinch-throw').click();G.paused=true;const event=G.lastCombatEvent,tech=INK.Clinch.inspect().filter(e=>e.result==='tech').length,before=JSON.stringify([A.fighters.map(f=>[f.x,f.y,f.hp,f.state,f.stateT]),INK.Clinch.inspect(),G.actionTick]);for(let i=0;i<12;i++)A.render();out.push({name:'throw button also techs real capture once with pure paused render',passed:captured&&event?.type==='throw-tech'&&tech===1&&before===JSON.stringify([A.fighters.map(f=>[f.x,f.y,f.hp,f.state,f.stateT]),INK.Clinch.inspect(),G.actionTick]),event});
 out.push({name:'tech keeps original recovery and no strike hit sound event',passed:A.fighters.every(f=>f.state==='recovery'&&f.stateT===19&&f.throwInvuln===26&&f.hp===10000)&&!INK.StrikeFeel.inspect().some(e=>e.type==='throw-tech')});return out;}''')
 b.close()
report={'htmlSha256':hashlib.sha256(html).hexdigest(),'rows':rows,'errors':errors};(O/'controls.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2));assert not errors and all(r['passed'] for r in rows)
