"""Real combos driven by deterministic display schedules; G requests during hitstop.
Synthetic display schedules are not measured hardware FPS.
"""
from pathlib import Path
import json,datetime,hashlib,shutil,os
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow7';data=(R/'dist/INK-Street-Fighter-6.html').read_bytes();errors=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium'),headless=True,args=['--no-sandbox']);p=b.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(data.decode(),wait_until='load',timeout=60000);p.wait_for_function('window.INKRhythmLab?.ready')
 q=p.evaluate('''()=>{const A=SVG_FIGHTER,C=INK.Combo,T=INK.CombatFlow,G=A.state,rows=[],practice=[],references=new Map();
 const original=C.routes.routes.filter(r=>r.rulesPreset==='flow');
 for(const rhythm of ['legacy','weighted'])for(const route of original){T.set({rhythm,rules:'flow',speed:1});C.start(route,'demo',{paused:true});for(let i=0;i<1200&&C.status==='running';i++)A.step();references.set(rhythm+route.id,C.summary());C.stop();}
 for(const hz of [30,60,144])for(const speed of [.85,1])for(const rhythm of ['legacy','weighted'])for(const route of original){
  const side=hz===60?-1:1;T.set({rhythm,rules:'flow',speed});C.start(route,'demo',{paused:false,side});const clock=new INK.SimulationClock();let callbacks=0;clock.advance(0,{speed},()=>A.step());
  for(let n=1;n<1800&&C.status==='running';n++){const alpha=clock.advance(n*1000/hz,{speed},()=>A.step());A.renderFraction(alpha);callbacks++;}
  const q=C.summary(),ref=references.get(rhythm+route.id);const finite=!/NaN|Infinity/.test(document.getElementById('game').outerHTML);rows.push({route:route.id,hz,speed,rhythm,side,callbacks,status:q.status,hits:q.hits,damage:q.damage,elapsedTicks:q.elapsedTicks,actionFrames:q.actionFrames,discarded:clock.stats.discardedSteps,finite,pass:q.status==='success'&&q.hits===ref.hits&&q.damage===ref.damage&&q.elapsedTicks===ref.elapsedTicks&&q.actionFrames===ref.actionFrames&&finite&&clock.stats.discardedSteps===0});C.stop();
 }
 for(const side of [1,-1])for(const buffer of [0,3,6])for(const route of original){T.set({rhythm:'weighted',rules:'flow',speed:1});C.start(route,'practice',{paused:false,side,bufferFrames:buffer});let requested=-1,frozenRequests=0;
  for(let n=0;n<1600&&C.status==='running';n++){C.updateWindow(G,A.fighters);if(C.cursor<route.steps.length&&C.cursor!==requested&&(C.window.ready||buffer>0&&C.window.confirmed&&G.hitstop>0)){const current=C.cursor;const result=C.requestStep(buffer);if(result.status==='accepted'||result.status==='buffered'){requested=current;if(G.hitstop>0)frozenRequests++;}}A.step();}
  const q=C.summary();practice.push({route:route.id,side,buffer,status:q.status,hits:q.hits,damage:q.damage,frozenRequests,accepted:q.inputLog.filter(e=>e.status==='accepted').length,expectedRequests:route.steps.length,log:q.inputLog,pass:q.status==='success'&&q.hits===route.expectedHits&&q.inputLog.filter(e=>e.status==='accepted').length===route.steps.length&&(buffer===0||frozenRequests>0)});C.stop();
 }
 T.set({rhythm:'weighted',rules:'flow',speed:1,buffer:9});G.paused=true;return{rows,practice};}''');b.close()
report={'suite':'flow7-display-schedule-and-G-practice','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':hashlib.sha256(data).hexdigest(),'displayTotal':len(q['rows']),'displayPassed':sum(r['pass'] for r in q['rows']),'practiceTotal':len(q['practice']),'practicePassed':sum(r['pass'] for r in q['practice']),'display':q['rows'],'practice':q['practice'],'browserErrors':errors,'note':'Synthetic 30/60/144Hz callback schedules render production SVG and run actual combat. Not a real device FPS benchmark. G tests submit one explicit request per step, with 3/6F requests during actual hitstop.'};(O/'render-and-practice.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('DISPLAY',report['displayPassed'],'/',report['displayTotal'],'PRACTICE',report['practicePassed'],'/',report['practiceTotal'],'errors',errors)
for r in q['rows']+q['practice']:
 if not r['pass']:print('FAIL',r)
raise SystemExit(0 if not errors and report['displayPassed']==report['displayTotal'] and report['practicePassed']==report['practiceTotal'] else 1)
