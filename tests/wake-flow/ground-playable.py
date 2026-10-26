"""Direct floor arrivals and wake controls; no synthetic combat states."""
from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/wake-flow';html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page(viewport={'width':1440,'height':1000});errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode());p.wait_for_function('window.INKWakeLab?.ready');p.locator('.kinetic-launch button').click()
 rows=p.evaluate('''()=>{const A=SVG_FIGHTER,G=A.state,C=INK.GroundContact,out=[],check=(name,passed,details)=>out.push({name,passed,details});
 function setup(stage){A.start('ryu','ken','training','classic',21);G.paused=true;A.setStage(stage);document.getElementById('dummy').value='idle';A.teleport(0,400);A.teleport(1,1050);A.step();}
 for(const [stage,surface]of [['neon','wet'],['courtyard','dust'],['rooftop','grit']]){setup(stage);A.press(0,'up');A.press(0,'right');A.step(10);A.release(0,'up');A.press(0,'down');for(let i=0;i<90&&!C.inspect().events.length;i++)A.step();A.release(0,'down');A.release(0,'right');const e=C.inspect().events.at(-1),f=A.fighters[0];check(stage+' real fast landing commits matching surface and velocity',e?.kind==='fast'&&e.surface===surface&&e.drift>0&&f.landT>0,e);const before=JSON.stringify([f.x,f.y,f.hp,f.landT,C.inspect().events]);for(let i=0;i<12;i++){A.renderFraction(i%3/2);INK.VFX.render(G,i%3/2);}check(stage+' drawing cannot change landing or event births',before===JSON.stringify([f.x,f.y,f.hp,f.landT,C.inspect().events])&&C.inspect().slots===4);}
 setup('neon');A.teleport(1,525);A.inputMove(0,'throw');for(let i=0;i<120&&!C.inspect().events.some(e=>e.kind==='throw');i++)A.step();const e=C.inspect().events.find(e=>e.kind==='throw');check('Real throw arrival creates heavy directional ground response',e?.heavy&&Math.abs(e.drift)>0,e);A.render();INK.VFX.render(G,1);check('Ground event history and node bank are bounded',C.inspect().events.length<=8&&document.querySelectorAll('[data-ground-contact] path').length===36);return out;}''')
 p.locator('#game').screenshot(path=str(O/'ground-contact.png'))
 p.locator('#fight-lab > summary').click();p.locator('#wake-practice').click();p.evaluate('SVG_FIGHTER.state.paused=true');p.evaluate("()=>{const A=SVG_FIGHTER;for(let i=0;i<130&&A.fighters[0].state!=='down';i++)A.step();}")
 p.locator('[data-wake="WAKE_DELAY"]').click();rows.append({'name':'Actual practice button and delay control change the real wake cycle','passed':p.evaluate('SVG_FIGHTER.fighters[0]._inkWake?.delayed===true')})
 p.evaluate("()=>{const A=SVG_FIGHTER;for(let i=0;i<110&&!(A.fighters[0].state==='rise'&&A.fighters[0].stateT<=7);i++)A.step();}")
 p.locator('[data-wake="WAKE_STRIKE"]').click();p.evaluate('SVG_FIGHTER.step(4)');rows.append({'name':'Actual wake strike button buffers into the legal window','passed':p.evaluate("SVG_FIGHTER.fighters[0].attack?.m.id==='WAKE_STRIKE'")});b.close()
report={'htmlSha256':hashlib.sha256(html).hexdigest(),'rows':rows,'errors':errors};(O/'ground-playable.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2));assert all(r['passed'] for r in rows) and not errors
