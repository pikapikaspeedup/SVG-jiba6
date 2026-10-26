"""Input file identity rejection and effective asset isolation, not full state validation."""
from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow11';O.mkdir(exist_ok=True);html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode());p.wait_for_function('window.INKSpacingLab?.ready')
 out=p.evaluate('''()=>{const A=SVG_FIGHTER,G=A.state,C=INK.CombatIdentity,S=INK.Runtime.sourceStore,rows=[];
 const check=(name,passed)=>rows.push({name,passed}),config={seed:811,characters:['ryu','ken']};
 const snap=()=>JSON.stringify({tick:G.tick,rng:INK.Random.combat.inspect(),fighters:A.fighters.map(f=>({x:f.x,hp:f.hp,state:f.state,t:f.stateT,held:[...f.input.held]}))});
 A.session.begin(config);G.paused=true;A.press(0,'right');A.step(8);A.release(0,'right');A.step(20);const expected=snap(),file=A.session.export();
 A.session.load(JSON.stringify(file));G.paused=true;A.step(file.commands.ticks);check('Identity checked file regenerates selected combat state',snap()===expected);
 function rejected(name,data){const before=snap(),actor=A.fighters[0];let error=false;try{A.session.load(typeof data==='string'?data:JSON.stringify(data));}catch{error=true;}check(name,error&&snap()===before&&A.fighters[0]===actor);}
 for(const key of ['build','assets','rules']){const bad=JSON.parse(JSON.stringify(file));bad.identity[key]='0'.repeat(64);rejected(key+' mismatch rejects before changing battle',bad);}
 rejected('Malformed input file rejects atomically','{');const bad=JSON.parse(JSON.stringify(file));bad.config.untrustedPatch={hp:1};rejected('Unknown config rejects atomically',bad);
 const originalRevision=S.revision,hash=C.capture().hash;S.revision++;check('Revision alone does not change content identity',C.capture().hash===hash);S.revision=originalRevision;
 const old=S.overrides.models.ryu,model=JSON.parse(JSON.stringify(S.getModel('ryu'))),pinned=INK.Runtime.store,pinnedModel=JSON.stringify(pinned.getModel('ryu'));model.identityTest='changed';S.overrides.models.ryu=model;
 try{check('Same revision with changed override changes content hash',C.capture().hash!==hash);check('Active session keeps its captured effective model',INK.Runtime.store===pinned&&JSON.stringify(pinned.getModel('ryu'))===pinnedModel);rejected('Live override mismatch rejects before changing battle',file);}finally{if(old===undefined)delete S.overrides.models.ryu;else S.overrides.models.ryu=old;}
 A.session.begin(config);G.paused=true;INK.CombatFlow.set({speed:.5});A.step();check('Playback scheduling speed does not invalidate rules',G.tick===1&&!A.session.status().error);
 for(const field of ['dummy','infinite','autohp']){A.session.begin(config);G.paused=true;const el=document.getElementById(field);if(field==='dummy')el.value='guard';else el.checked=true;const tick=G.tick;A.step();let refused=false;try{A.session.export();}catch{refused=true;}check(field+' change stops before advancing and refuses export',G.tick===tick&&refused&&!!A.session.status().error);}
 A.session.begin(config);G.paused=true;INK.CombatFlow.set({buffer:3});A.step();check('Input buffer change invalidates session before step',G.tick===0&&!!A.session.status().error);
 A.session.stop();check('Stopping restores live asset store',INK.Runtime.store===S&&!A.session.status().active);return rows;}''')
 b.close()
for row in out:print('PASS' if row['passed'] else 'FAIL',row['name'],flush=True)
(O/'identity-browser.json').write_text(json.dumps({'htmlSha256':hashlib.sha256(html).hexdigest(),'rows':out,'errors':errors},indent=2)+'\n')
assert all(x['passed'] for x in out) and not errors
