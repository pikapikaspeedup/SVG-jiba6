"""Real launcher permits followed by CPU control, with fixed gameplay seeds.
A short real demo first warms delayed observations; training then lets actions
settle before a player cHP. No launch permit or AI memory is fabricated.
"""
from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/air-pursuit';O.mkdir(parents=True,exist_ok=True);html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode());p.wait_for_function('window.INKDuel?.ready&&INK.AirPursuit')
 runs=p.evaluate('''()=>{const A=SVG_FIGHTER,G=A.state,out=[];for(const difficulty of ['hard','normal','easy'])for(let seed=1;seed<=16;seed++){document.getElementById('difficulty').value=difficulty;A.start('ryu','ryu','training','classic',seed);G.paused=true;document.getElementById('dummy').value='idle';document.getElementById('autohp').checked=false;document.getElementById('infinite').checked=false;A.teleport(0,220);A.teleport(1,1220);G.mode='demo';document.getElementById('mode').value='demo';A.step(35);G.mode='training';document.getElementById('mode').value='training';A.step(140);A.teleport(0,560);A.teleport(1,710);A.step();A.inputMove(0,'cHP');const f=A.fighters[0];for(let i=0;i<100&&!f._inkLaunch;i++)A.step();const launch=f._inkLaunch,at=launch?.at;G.mode='demo';document.getElementById('mode').value='demo';let start=null,pay=null,moves=[],phases=[],forbidden=[],prevDrive=f.drive,finished=false,trace=[];for(let i=0;i<130;i++){const before=f._inkPursuit;A.step();const q=f._inkPursuit;trace.push({action:G.actionTick,gate:INK.AirPursuit.decision(f,'AIR_CHASE',G),move:f.attack?.m.id,difficulty:G.difficulty,goal:f.ai?.goal,observed:!!f.ai?.observed,tried:f._inkDuel?.pursuitSource===launch?.source});if(q){if(!phases.includes(q.phase))phases.push(q.phase);if(start===null){start=G.actionTick;pay=prevDrive-f.drive;}if(f.attack&&!moves.some(m=>m.id===f.attack.m.id)){moves.push({id:f.attack.m.id,category:f.attack.m.category,air:!!f.attack.m.air,pursuitAir:!!f.attack.m.pursuitAir});}if(f.attack&&(!f.attack.m.air||f.attack.m.category!=='normal'))forbidden.push(f.attack.m.id);}prevDrive=f.drive;if(before&&!q){finished=true;break;}if(start===null&&G.actionTick-at>12)break;}out.push({difficulty,seed,permit:!!launch,at,start,delay:start===null?null:start-at,pay,moves,phases,forbidden,finished,trace});}return out;}''');b.close()
rows=[]
for d,delay in [('hard',3),('normal',6),('easy',10)]:
 group=[r for r in runs if r['difficulty']==d];chased=[r for r in group if r['start'] is not None]
 rows.append({'name':d+' has real permits and respects confirmation delay','passed':all(r['permit'] and (r['delay'] is None or r['delay']>=delay) for r in group)})
 rows.append({'name':d+' pays for every chase and isolates normal air attacks','passed':all(abs(r['pay']-1.5)<.02 and not r['forbidden'] and len(r['moves'])<=1 and all(m['pursuitAir'] for m in r['moves']) for r in chased)})
 rows.append({'name':d+' observed chase frequency','passed':len(chased)==0 if d=='easy' else 0<len(chased)<16,'count':len(chased)})
 if d!='easy':rows.append({'name':d+' makes actual air normals and reaches landing','passed':any(r['moves'] for r in chased) and all('landing' in r['phases'] and r['finished'] for r in chased)})
report={'htmlSha256':hashlib.sha256(html).hexdigest(),'rows':rows,'runs':runs,'errors':errors};(O/'cpu.json').write_text(json.dumps(report,indent=2)+'\n')
for r in rows:print('PASS' if r['passed'] else 'FAIL',r)
assert all(r['passed'] for r in rows) and not errors,errors
