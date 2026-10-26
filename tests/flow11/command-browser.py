from pathlib import Path
import os,json,hashlib,datetime
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow11';O.mkdir(exist_ok=True);html=(R/'dist/INK-Street-Fighter-6.html').read_bytes();rows=[];errors=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode());p.wait_for_function('window.INKSpacingLab?.ready')
 out=p.evaluate('''()=>{const A=SVG_FIGHTER,G=A.state,C=A.commands,rows=[];const check=(name,passed)=>rows.push({name,passed});
 A.start('ryu','ken','training','classic',42);G.paused=true;C.begin();const f=A.fighters[0],x=f.x;
 C.submit({type:'buttons',actor:0,press:['down','right'],release:[]});check('Queued directions do not mutate battle before a simulation boundary',f.x===x&&f.input.dir===5&&f.input.held.size===0);
 A.render();check('Rendering does not consume queued commands',C.inspect().pending===1&&C.inspect().tick===0);
 A.step();check('A diagonal is one direction sample at the boundary',f.input.dir===3&&f.input.dirs.length===1&&f.input.dirs[0].n===3);
 C.submit({type:'buttons',actor:0,press:[],release:['down','right']});A.step();check('Release returns to neutral through real input code',f.input.dir===5&&!f.input.held.size);
 G.hitstop=5;C.submit({type:'move',actor:0,id:'sMP',buffer:true});A.step();check('Commands in freeze use the normal input buffer',!f.attack&&f.input.queue[0]?.m.id==='sMP');A.step(4);check('Frozen steps remain distinct on the command timeline',C.inspect().tick===7&&C.export().events.at(-1).tick===3);
 A.step();check('Buffered command starts after freeze through normal rules',f.attack?.m.id==='sMP');
 const tape=C.export();check('Internal buffer consumption does not duplicate external commands',tape.events.length===3);
 A.reset();check('Reset drops the old command session',C.inspect().mode==='idle'&&C.inspect().pending===0);
 G.paused=true;C.begin();C.submit({type:'buttons',actor:0,press:['DI'],release:[]});A.step();check('Forced single-step applies action buttons as a running simulation',A.fighters[0].attack?.m.id==='DI'&&G.paused);
 check('Build fingerprint is embedded and immutable',/^[0-9a-f]{64}$/.test(INK.Build.id)&&Object.isFrozen(INK.Build));
 return rows;}''');rows.extend(out);rows.append({'name':'No browser exceptions','passed':not errors});b.close()
for row in rows:print('PASS' if row['passed'] else 'FAIL',row['name'])
(O/'command-browser.json').write_text(json.dumps({'scope':'Explicit command API boundary; device capture/full replay not yet implemented','htmlSha256':hashlib.sha256(html).hexdigest(),'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rows':rows,'errors':errors},indent=2)+'\n')
assert all(x['passed'] for x in rows)
