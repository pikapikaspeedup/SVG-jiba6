"""Creation IDs and cyclic combat references."""
from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow11';O.mkdir(exist_ok=True);html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode());p.wait_for_function('window.INKSpacingLab?.ready')
 out=p.evaluate('''()=>{const A=SVG_FIGHTER,G=A.state,C=INK.CombatState,rows=[],check=(name,passed)=>rows.push({name,passed}),config={seed:921,characters:['ryu','ken'],mode:'demo',spacing:true};
 A.session.begin(config);G.paused=true;const trace=[];for(let i=0;i<300;i++){A.step();trace.push(A.combatState());}const tape=A.commands.export();A.session.play(config,tape);G.paused=true;let mismatch=null;for(let i=0;i<300;i++){A.step();A.renderFraction(.4);A.renderFraction(.8);const diff=C.difference(trace[i],A.combatState());if(diff&&!mismatch)mismatch={tick:i+1,...diff};}check('CPU replay preserves grouped state despite additional renders',!mismatch);if(mismatch)rows.push({name:JSON.stringify(mismatch),passed:false});
 const baseline=A.combatState(),f=A.fighters[0],hp=f.hp;f.input.chargeB+=1;const changed=A.combatState();check('Charge mutation is detected before HP changes',f.hp===hp&&C.signature(baseline).root!==C.signature(changed).root&&C.difference(baseline,changed).path.includes('chargeB'));f.input.chargeB-=1;
 const immutable=C.signature(baseline).root;f.aiWait++;check('Captured state is detached from subsequent mutations',C.signature(baseline).root===immutable);check('AI timer mutation changes actor group',C.signature(A.combatState()).groups.actors!==C.signature(baseline).groups.actors);f.aiWait--;
 const sig=C.signature(baseline),bad=C.signature(changed);check('First divergence is retained even after later reconvergence',C.firstDivergence([sig,sig,sig],[sig,bad,sig]).tick===1);check('A truncated replay reports its first missing boundary',C.firstDivergence([sig,sig],[sig]).tick===1);
 check('Missing field differs from explicit undefined',C.difference({}, {x:undefined}).missing==='expected');check('Negative zero differs from zero',!!C.difference(-0,0));
 A.session.begin(config);G.paused=true;const clean=C.signature(A.combatState()).root;A.step(30);A.session.begin(config);G.paused=true;check('New canonical session regenerates grouped initial state',C.signature(A.combatState()).root===clean);let roster=true;for(const id of INK.Schema.CHARACTERS){const cfg={...config,characters:[id,'ryu']};A.session.begin(cfg);G.paused=true;const hashes=[];for(let i=0;i<180;i++){A.step();hashes.push(C.signature(A.combatState()).root);}const commands=A.commands.export();A.session.play(cfg,commands);G.paused=true;for(let i=0;i<180;i++){A.step();if(hashes[i]!==C.signature(A.combatState()).root)roster=false;}}check('All eight character CPU sessions reproduce 180 grouped steps',roster);return rows;}''')
 b.close()
for row in out:print('PASS' if row['passed'] else 'FAIL',row['name'],flush=True)
(O/'state-browser.json').write_text(json.dumps({'htmlSha256':hashlib.sha256(html).hexdigest(),'rows':out,'errors':errors},indent=2)+'\n')
assert all(x['passed'] for x in out) and not errors
