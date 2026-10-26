"""Seeded AI must reproduce across fresh runtimes and extra render work.
This validates the random-stream prerequisite, not a complete input replay.
"""
from pathlib import Path
import os,json,hashlib,datetime
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow11';O.mkdir(exist_ok=True)
html=(R/'dist/INK-Street-Fighter-6.html').read_bytes(); errors=[];rows=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True)
 def run(seed,extra=False):
  p=b.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode());p.wait_for_function('window.INKSpacingLab?.ready')
  out=p.evaluate('''({seed,extra})=>{const A=SVG_FIGHTER,G=A.state;A.start('ryu','ken','demo','classic',seed);G.paused=true;const trace=[];
   for(let i=0;i<900;i++){A.step();if(extra){for(let n=0;n<37;n++)Math.random();A.render(1/144);A.render(1/30);}
    trace.push({tick:G.tick,action:G.actionTick,phase:G.phase,clock:G.clock,freeze:G.hitstop,rng:INK.Random.combat.inspect(),fighters:A.fighters.map(f=>({x:f.x,y:f.y,vx:f.vx,vy:f.vy,hp:f.hp,drive:f.drive,super:f.super,state:f.state,stateT:f.stateT,dir:f.dir,attack:f.attack&&[f.attack.m.id,f.attack.t,[...f.attack.hitsDone]],plan:f.ai?.plan})),shots:G.shots.map(s=>[s.owner.index,s.m.id,s.x,s.y,s.life,s.hits])});}
   const saved=INK.Random.combat.inspect();A.reset();return {trace,saved,reset:INK.Random.combat.inspect()};}''',dict(seed=seed,extra=extra))
  p.close();return out
 a=run(907);same=run(907);paint=run(907,True);different=run(908)
 def check(name,ok):rows.append({'name':name,'passed':bool(ok)});print('PASS' if ok else 'FAIL',name,flush=True)
 check('Same seed reproduces 900 ticks of real CPU combat',a['trace']==same['trace'])
 check('Additional renders and cosmetic randomness do not change combat',a['trace']==paint['trace'])
 check('Another seed changes actual CPU decisions',any(x['fighters']!=y['fighters'] for x,y in zip(a['trace'],different['trace'])))
 check('Seeded CPU exercised random decisions',a['saved']['draws']>10)
 check('Reset restores seed and clears draws',a['reset']['seed']==907 and a['reset']['draws']==0)
 p=b.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode());p.wait_for_function('window.INKSpacingLab?.ready')
 lesson=p.evaluate("""()=>{const A=SVG_FIGHTER,G=A.state;A.start('ryu','ryu','training','classic',17);A.experience.lesson(4);G.paused=true;
 const start=G.actionTick;G.hitstop=80;A.step(80);const frozen={phase:G.trial.drill.phase,action:G.actionTick,attack:!!A.fighters[1].attack};
 A.step(59);const before=G.trial.drill.phase;for(let i=0;i<50;i++){A.render();}const painted=G.trial.drill.phase;
 A.step();return {start,frozen,before,painted,after:G.trial.drill.phase,move:A.fighters[1].attack?.m.id,elapsed:G.actionTick-start};}""")
 check('Lesson opponent cannot act while the simulation is frozen',lesson['frozen']=={'phase':'cue','action':lesson['start'],'attack':False})
 check('Repeated renders cannot dispatch training attacks',lesson['before']=='cue' and lesson['painted']=='cue')
 check('Training attack starts after exactly 60 actionable steps',lesson['after']=='attack' and lesson['move']=='sHP' and lesson['elapsed']==60)
 p.close()
 check('No runtime errors',not errors)
 b.close()
report={'suite':'flow11-random-prerequisite','utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':hashlib.sha256(html).hexdigest(),'rows':rows,'errors':errors,'draws':a['saved']['draws'],'traceSha256':hashlib.sha256(json.dumps(a['trace'],sort_keys=True).encode()).hexdigest()}
(O/'random-browser.json').write_text(json.dumps(report,indent=2)+'\n')
for label,other in [('repeat',same),('renders',paint)]:
 for i,(x,y) in enumerate(zip(a['trace'],other['trace'])):
  if x!=y:(O/('random-divergence-'+label+'.json')).write_text(json.dumps({'frame':i,'expected':x,'actual':y},indent=2));break
assert all(r['passed'] for r in rows),report
