from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/wake-flow';O.mkdir(exist_ok=True);html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode());p.wait_for_function('window.INKDuel?.ready')
 data=p.evaluate('''()=>{const A=SVG_FIGHTER,G=A.state,runs=[];const setup=seed=>{A.start('ryu','ryu','training','classic',seed);G.paused=true;G.difficulty='hard';document.getElementById('dummy').value='idle';document.getElementById('infinite').checked=false;document.getElementById('autohp').checked=false;A.teleport(0,560);A.teleport(1,720);};
 for(let seed=1;seed<=16;seed++){setup(seed);A.tryMove(0,'cHK');for(let n=0;n<130&&A.fighters[1].state!=='down';n++)A.step();const f=A.fighters[1],swept=f.state==='down';document.getElementById('dummy').value='cpu';for(let n=0;n<100;n++)A.step();runs.push({seed,role:'defend',swept,wake:f._inkWake,duel:f._inkDuel,drive:f.drive});}
 for(let seed=1;seed<=16;seed++){setup(seed);A.tryMove(1,'cHK');for(let n=0;n<130&&A.fighters[0].state!=='down';n++)A.step();const swept=A.fighters[0].state==='down';document.getElementById('dummy').value='cpu';for(let n=0;n<100;n++)A.step();runs.push({seed,role:'attack',swept,pressures:A.fighters[1].ai?.wakePressures||0,baits:A.fighters[1].ai?.wakeBaits||0,goal:A.fighters[1].ai?.goal});}
 return {runs,checks:{realSweeps:runs.every(r=>r.swept),delay:runs.some(r=>r.role==='defend'&&r.wake?.delayed),strike:runs.some(r=>r.role==='defend'&&r.wake?.struck&&r.wake.paid===1.5),pressure:runs.some(r=>r.role==='attack'&&r.pressures>0),mixedPlans:runs.some(r=>r.role==='attack'&&r.pressures>0)&&runs.some(r=>r.role==='attack'&&r.baits>0)}};}''');b.close()
print(json.dumps(data['checks']));(O/'cpu.json').write_text(json.dumps({'htmlSha256':hashlib.sha256(html).hexdigest(),**data,'errors':errors},indent=2)+'\n');assert all(data['checks'].values()) and not errors
