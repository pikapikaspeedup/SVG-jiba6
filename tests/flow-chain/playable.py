from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow-chain';html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode());p.wait_for_function('window.INKDuel?.ready')
 rows=p.evaluate('''()=>{const A=SVG_FIGHTER,G=A.state,rows=[],check=(name,passed,details)=>rows.push({name,passed,details});const setup=id=>{A.start(id,'ken','training','classic',42);G.paused=true;document.getElementById('dummy').value='idle';document.getElementById('autohp').checked=false;A.teleport(0,560);A.teleport(1,720);};
 for(const id of INK.Schema.CHARACTERS){setup(id);const f=A.fighters[0],route=INK.FlowChain.routes[id],started=[];let good=true;for(let j=0;j<route.length;j++){A.inputMove(0,route[j]);for(let n=0;n<45&&f.attack?.m.id!==route[j];n++)A.step();if(f.attack?.m.id!==route[j]){good=false;break;}started.push(f.attack.targetChain?.step);for(let n=0;n<50&&!f.attack?.hitConfirmed;n++)A.step();if(!f.attack?.hitConfirmed){good=false;break;}}check(id+' completes its contact-gated three-stage route',good&&started.join(',')==='0,1,2',{started,hp:A.fighters[1].hp,combo:f.combo});}
 setup('ryu');A.inputMove(0,'sLP');while(!A.fighters[0].attack?.hitConfirmed)A.step();while(G.hitstop)A.step();const actor=A.fighters[0],before=INK.Runtime.visualRig(actor,A.visualPose(actor));const accepted=A.tryMove(0,'sMP'),after=INK.Runtime.visualRig(actor,A.visualPose(actor));let jump=0;for(const part of ['frontArm','rearArm','frontLeg','rearLeg'])for(let i=0;i<3;i++)jump=Math.max(jump,Math.hypot(after[part][i][0]-before[part][i][0],after[part][i][1]-before[part][i][1]));check('Cancel preserves all four solved limb chains at the handoff',accepted&&jump<1,{maxJointJump:jump});
 setup('ryu');A.teleport(1,1200);A.inputMove(0,'sLP');A.step(6);check('Whiff cannot cancel into the next normal',!A.decide(0,'sMP').ok);A.step(40);check('An expired opener does not keep a target-chain continuation',!A.fighters[0].attack);
 setup('ryu');document.getElementById('dummy').value='guard';A.inputMove(0,'sLP');for(let i=0;i<30&&!A.fighters[0].attack?.confirmed;i++)A.step();A.inputMove(0,'sMP');for(let i=0;i<40&&A.fighters[0].attack?.m.id!=='sMP';i++)A.step();for(let i=0;i<30&&!A.fighters[0].attack?.confirmed;i++)A.step();check('Guard allows the second strike but denies the hit-only finisher',A.fighters[0].attack?.m.id==='sMP'&&A.fighters[0].attack.confirmed&&!A.decide(0,'sHP').ok);
 setup('ryu');INK.FlowChain.settings.enabled=false;A.inputMove(0,'sLP');A.step(8);check('Disabling routes restores original normal cancel rules',!A.decide(0,'sMP').ok);INK.FlowChain.settings.enabled=true;return rows;}''')
 p.locator('.kinetic-launch button').click();p.locator('#fight-practice').click();p.locator('#chain-close').click();p.evaluate("SVG_FIGHTER.state.paused=true;document.getElementById('autohp').checked=false")
 for i in range(3):
  p.locator('#chain-steps button').nth(i).click()
  p.evaluate("i=>{const A=SVG_FIGHTER;for(let n=0;n<45&&(A.fighters[0].attack?.targetChain?.step!==i||!A.fighters[0].attack?.hitConfirmed);n++)A.step();}",i)
 rows.append({'name':'Three actual coach button clicks produce a three-hit combo','passed':p.evaluate("SVG_FIGHTER.fighters[0].combo===3&&SVG_FIGHTER.fighters[0].attack?.targetChain?.step===2")})
 p.locator('#chain-coach').screenshot(path=str(O/'coach.png'));p.evaluate("SVG_FIGHTER.render();INK.VFX.render(SVG_FIGHTER.state,1)");p.locator('#f-battle-mount').screenshot(path=str(O/'three-hit.png'))
 p.set_viewport_size({'width':390,'height':844});rows.append({'name':'Chain controls fit the mobile viewport','passed':p.evaluate("document.getElementById('chain-coach').getBoundingClientRect().right<=innerWidth+1")});b.close()

for r in rows:print('PASS' if r['passed'] else 'FAIL',r['name'],r.get('details',''))
(O/'playable.json').write_text(json.dumps({'htmlSha256':hashlib.sha256(html).hexdigest(),'rows':rows,'errors':errors},indent=2)+'\n');print(errors);assert all(r['passed'] for r in rows) and not errors
