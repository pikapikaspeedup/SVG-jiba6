from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/pressure-flow';O.mkdir(exist_ok=True);html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode());p.wait_for_function('window.INKDuel?.ready')
 rows=p.evaluate('''()=>{const A=SVG_FIGHTER,G=A.state,rows=[],check=(name,passed,details)=>rows.push({name,passed,details});
 const second=(id,guard=false)=>{A.start(id,'ryu','training','classic',42);G.paused=true;document.getElementById('dummy').value=guard?'guard':'idle';document.getElementById('infinite').checked=false;document.getElementById('autohp').checked=false;A.teleport(0,560);A.teleport(1,720);const f=A.fighters[0];for(const move of INK.FlowChain.routes[id].slice(0,2)){A.inputMove(0,move);for(let n=0;n<70&&(f.attack?.m.id!==move||!f.attack.confirmed);n++)A.step();while(G.hitstop)A.step();}return f;};
 for(const id of INK.Schema.CHARACTERS){
  let f=second(id),choice=INK.FlowChain.branches[id].pursuit,drive=f.drive,x=f.x,decision=A.decide(0,choice.move),accepted=A.tryMove(0,choice.move),a=f.attack;check(id+' hit pursuit pays once and terminates route',accepted&&a.targetChain?.terminal&&a.targetChain.branch==='pursuit'&&Math.abs(drive-f.drive-1)<1e-6,{decision,attack:a.m.id});let maxTravel=0;for(let n=0;n<65&&f.attack===a;n++){A.step();maxTravel=Math.max(maxTravel,f.x-x);}check(id+' pursuit is bounded forward travel',maxTravel>0&&maxTravel<=choice.travel+.01,{maxTravel,budget:choice.travel,hitConfirmed:!!a.hitConfirmed});
  f=second(id,true);choice=INK.FlowChain.branches[id].pressure;drive=f.drive;const contact=f.attack?._inkContact,remaining=contact?Math.max(0,contact.blockstun-(G.actionTick-contact.actionTick)):999;decision=A.decide(0,choice.move);accepted=A.tryMove(0,choice.move);a=f.attack;check(id+' blocked branch pays and leaves a defensive gap',accepted&&a.targetChain?.terminal&&a.targetChain.branch==='pressure'&&Math.abs(drive-f.drive-1.5)<1e-6&&a.m.startup>=remaining+4&&!a.m.cancel,{decision,startup:a.m.startup,remaining});let free=0;for(let n=0;n<60&&f.attack===a&&a.t<a.m.startup;n++){if(A.fighters[1].state!=='block'&&!G.hitstop)free++;A.step();}check(id+' defender really leaves blockstun before branch active',free>=4,{freeFrames:free});
 }
 let f=second('ryu');check('Pressure cannot replace a hit finisher',!A.decide(0,'sLK').ok);f.drive=.5;const attack=f.attack;check('Insufficient drive denies pursuit without mutation',!A.tryMove(0,'sMK')&&f.attack===attack&&f.drive===.5&&!INK.FlowChain.inspect(f,G).branches.find(b=>b.kind==='pursuit').gate.ok);
 f=second('ryu');A.teleport(1,1200);check('Beyond geometry band plus finite travel rejects pursuit',!A.decide(0,'sMK').ok);
 f=second('ryu',true);check('Pursuit remains hit-only',!A.decide(0,'sMK').ok);A.tryMove(0,'sLK');for(let n=0;n<45&&!f.attack?.confirmed;n++)A.step();while(G.hitstop)A.step();check('Pressure cannot recursively restart the target route',!!f.attack&&f.attack.targetChain?.terminal&&!A.decide(0,'sLP').ok);
 return rows;}''')
 p.locator('.kinetic-launch button').click();p.locator('#fight-practice').click();p.locator('#chain-close').click();p.evaluate("SVG_FIGHTER.state.paused=true;document.getElementById('infinite').checked=false")
 for i in range(2):
  p.locator('#chain-steps button').nth(i).click();p.evaluate("i=>{const A=SVG_FIGHTER;for(let n=0;n<70&&(A.fighters[0].attack?.targetChain?.step!==i||!A.fighters[0].attack?.hitConfirmed);n++)A.step();while(A.state.hitstop)A.step();}",i)
 p.locator('#chain-branches button[data-branch=pursuit]').click();p.evaluate('SVG_FIGHTER.step()')
 rows.append({'name':'Actual coach branch button commits pursuit','passed':p.evaluate("SVG_FIGHTER.fighters[0].attack?.targetChain?.branch==='pursuit'")});p.locator('#chain-coach').screenshot(path=str(O/'branches-coach.png'));b.close()
for row in rows: print('PASS' if row['passed'] else 'FAIL',row['name'],row.get('details',''))
(O/'branches.json').write_text(json.dumps({'htmlSha256':hashlib.sha256(html).hexdigest(),'rows':rows,'errors':errors},indent=2)+'\n');assert all(r['passed'] for r in rows) and not errors
