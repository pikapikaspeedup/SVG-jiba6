"""Creation IDs and cyclic combat references."""
from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow11';O.mkdir(exist_ok=True);html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode());p.wait_for_function('window.INKSpacingLab?.ready')
 out=p.evaluate('''()=>{const A=SVG_FIGHTER,G=A.state,rows=[],check=(name,passed)=>rows.push({name,passed}),config={seed:991,characters:['ryu','ken']};
 const begin=()=>{A.session.begin(config);G.paused=true;};begin();A.teleport(0,105);A.teleport(1,1335);A.inputMove(0,'hadoken_1');let shot;for(let i=0;i<90;i++){A.step();if(G.shots.length&&!A.fighters[0].attack){shot=G.shots[0];break;}}
 check('A projectile outlives its originating attack',!!shot&&!A.fighters[0].attack);
 const before=INK.CombatEntities.inspect().serial,graph=A.entityGraph(),again=A.entityGraph();check('Repeated entity export never allocates IDs',before===INK.CombatEntities.inspect().serial&&INK.Canonical.hash(graph)===INK.Canonical.hash(again));
 check('Departed source attack remains reachable through projectile',!!shot&&graph.entities.some(e=>e.id===shot.sourceAttack.combatID)&&graph.entities.find(e=>e.id===shot.combatID).state.sourceAttack.$ref===shot.sourceAttack.combatID);
 check('Export has no projectile DOM nodes',graph.entities.every(e=>!('node'in e.state)&&!('visual'in e.state)));
 const expected=INK.Canonical.hash(graph),tape=A.commands.export();A.session.play(config,tape);G.paused=true;A.teleport(0,105);A.teleport(1,1335);A.step(tape.ticks);check('Same setup and command replay regenerate IDs and entity content',INK.Canonical.hash(A.entityGraph())===expected);
 begin();A.teleport(0,600);A.teleport(1,710);A.inputMove(0,'throw');for(let i=0;i<30&&!A.fighters[0].throwAction;i++)A.step();const action=A.fighters[0].throwAction,throws=A.entityGraph();check('Real throw creates one entity shared by both actors',!!action&&action===A.fighters[1].throwAction&&throws.entities.filter(e=>e.id===action.combatID).length===1&&throws.roots.fighters[0].throw===throws.roots.fighters[1].throw);
 check('Throw ownership is represented without object cycles',!!action&&throws.entities.find(e=>e.id===action.combatID).state.owner.$ref==='fighter:0');
 begin();const first=INK.Canonical.hash(A.entityGraph());A.inputMove(0,'sHP');A.step();const used=INK.CombatEntities.inspect().serial;A.render();A.render();check('Rendering cannot allocate combat identities',INK.CombatEntities.inspect().serial===used&&used>0);begin();check('Canonical new match resets entity serial',INK.Canonical.hash(A.entityGraph())===first);return rows;}''')
 b.close()
for row in out:print('PASS' if row['passed'] else 'FAIL',row['name'],flush=True)
(O/'entities-browser.json').write_text(json.dumps({'htmlSha256':hashlib.sha256(html).hexdigest(),'rows':out,'errors':errors},indent=2)+'\n')
assert all(x['passed'] for x in out) and not errors
