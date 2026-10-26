from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/strike-tempo';html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode());p.wait_for_function('window.INKTempoLab?.ready')
 rows=p.evaluate('''async()=>{await INKDuel.start('training');const A=SVG_FIGHTER,G=A.state,out=[],check=(name,passed,detail)=>out.push({name,passed,detail}),hp=document.getElementById('tempo-hp');G.paused=false;document.getElementById('dummy').value='idle';A.teleport(0,400);A.teleport(1,1100);
 hp.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));for(let i=0;i<20&&A.fighters[0].attack?.tempo?.phase!=='holding';i++)A.step();let f=A.fighters[0],a=f.attack;check('practice hold button uses live origin',a?.tempo?.phase==='holding'&&f.input.held.has('HP'),{phase:a?.tempo?.phase});
 G.paused=true;const age=a.tempo.age,at=G.actionTick;A.step(2);check('paused explicit frame advance progresses hold',a.tempo.age===age+2&&G.actionTick===at+2,{age:a.tempo.age});
 const snapshot=JSON.stringify(a.tempo);for(let i=0;i<8;i++)A.renderFraction(i/8);check('paused render cannot advance hold',snapshot===JSON.stringify(a.tempo));
 G.paused=false;document.getElementById('tempo-feint').click();check('practice feint button uses back plus RUSH',f.state==='recovery'&&f._inkTempo?.phase==='feint'&&!f.input.held.has('left')&&!f.input.held.has('RUSH'));
 hp.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',bubbles:true}));check('practice release clears own source',!f.input.held.has('HP'));A.step(13);
 A.panelInput('control-peer',['HP']);A.step(4);hp.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));hp.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',bubbles:true}));check('panel release preserves another registered source',f.input.held.has('HP'));A.panelInput('control-peer',[]);
 return out;}''');b.close()
(O/'controls.json').write_text(json.dumps({'htmlSha256':hashlib.sha256(html).hexdigest(),'rows':rows,'errors':errors},indent=2)+'\n')
for row in rows:print('PASS' if row['passed'] else 'FAIL',row)
assert all(r['passed'] for r in rows) and not errors
