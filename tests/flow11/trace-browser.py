"""Creation IDs and cyclic combat references."""
from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow11';O.mkdir(exist_ok=True);html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode());p.wait_for_function('window.INKSpacingLab?.ready')
 out=p.evaluate('''()=>{const A=SVG_FIGHTER,G=A.state,rows=[],check=(name,passed)=>rows.push({name,passed}),config={seed:2026,characters:['ryu','ken'],spacing:true,preset:'spacing'};
 A.session.begin(config);G.paused=true;A.inputMove(1,'sHK');A.step(6);A.retreat(0);A.step(65);const file=A.session.export();check('Recording contains S0 and every completed simulation boundary',file.proof.frames.length===file.commands.ticks+1&&A.session.status().trace.status==='recording');
 A.session.load(JSON.stringify(file));G.paused=true;check('Import begins checking without claiming success',A.session.status().trace.status==='checking');A.step(file.commands.ticks);check('Full replay reaches matched only after the last boundary',A.session.status().trace.status==='matched');const end=G.tick;A.step(3);check('Matched playback cannot advance past its recorded end',G.tick===end);
 A.session.load(JSON.stringify(file));G.paused=true;A.step(4);A.fighters[0].input.chargeB+=20;A.step();const divergent=A.session.status().trace;check('Live hidden-state perturbation stops at its first differing step',divergent.status==='diverged'&&divergent.tick===5&&divergent.divergence.groups.includes('actors'));const stopped=G.tick;A.step(5);check('Divergence remains terminal for this replay',G.tick===stopped&&A.session.status().trace.tick===5);
 const bad=JSON.parse(JSON.stringify(file));bad.proof.frames.pop();const actor=A.fighters[0];let refused=false;try{A.session.load(JSON.stringify(bad));}catch{refused=true;}check('Truncated proof rejects before replacing the current battle',refused&&A.fighters[0]===actor);
 const legacy=JSON.parse(JSON.stringify(file));delete legacy.proof;A.session.load(JSON.stringify(legacy));G.paused=true;A.step(legacy.commands.ticks);check('Input-only files never claim state verification',A.session.status().trace.status==='unverified');
 A.session.begin(config);G.paused=true;A.step(2);A.fighters[0].hp--;refused=false;try{A.session.export();}catch{refused=true;}check('Out-of-step state changes cannot be exported as verified boundaries',refused);
 A.session.begin(config);G.paused=true;const empty=A.session.export();A.session.load(JSON.stringify(empty));check('Zero-step proof verifies the initial boundary',A.session.status().trace.status==='matched');return rows;}''')
 b.close()
for row in out:print('PASS' if row['passed'] else 'FAIL',row['name'],flush=True)
(O/'trace-browser.json').write_text(json.dumps({'htmlSha256':hashlib.sha256(html).hexdigest(),'rows':out,'errors':errors},indent=2)+'\n')
assert all(x['passed'] for x in out) and not errors
