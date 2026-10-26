"""Actual left/right contacts and rush echoes share the evaluated world frame."""
from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/contact-sense';O.mkdir(exist_ok=True);h=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(h.decode());p.wait_for_function('window.INKDuel?.ready');p.locator('.kinetic-launch button').click()
 rows=p.evaluate('''()=>{const A=SVG_FIGHTER,G=A.state,out=[];
 for(const actor of [0,1]){A.start('ryu','ken','training','classic',42);G.paused=true;document.getElementById('dummy').value='idle';A.teleport(0,560);A.teleport(1,760);A.tryMove(actor,'sMP');G.paused=true;for(let i=0;i<55&&!INK.Kinetic.inspect().events.length;i++)A.step();A.renderFraction(1);const e=INK.Kinetic.inspect().events.at(-1),light=INK.StageLight.sources(G,1).find(q=>q.defender===1-actor),before=JSON.stringify(A.combatState()),count=INK.Kinetic.inspect().events.length;for(let i=0;i<6;i++)A.renderFraction(i%3/2);out.push({kind:'contact',actor,hit:e?.type==='hit',incoming:e?.incoming,light,unit:Math.abs(Math.hypot(...(e?.incoming||[]))-1)<1e-8,pure:before===JSON.stringify(A.combatState())&&count===INK.Kinetic.inspect().events.length,angle:document.querySelector('[data-contact-result="hit"]')?.getAttribute('transform')});}
 for(const actor of [0,1]){A.start('ryu','ken','training','classic',42);document.getElementById('dummy').value='idle';A.teleport(0,350);A.teleport(1,1100);A.press(actor,'RUSH');G.paused=true;A.step(8);const slots=INK.SceneFeedback.slots.filter(s=>s.actor===actor);out.push({kind:'rush',actor,count:slots.length,positiveRoot:slots.length>0&&slots.every(s=>!s.root.getAttribute('transform').includes('scale(-')),transforms:slots.map(s=>s.root.getAttribute('transform'))});}return out;}''');b.close()
(O/'composition.json').write_text(json.dumps({'htmlSha256':hashlib.sha256(h).hexdigest(),'rows':rows,'errors':errors},indent=2)+'\n');print(json.dumps(rows,indent=2))
assert not errors and all(r['hit'] and r['unit'] and r['pure'] and r['light']['aspect']<1 if r['kind']=='contact' else r['positiveRoot'] for r in rows)
