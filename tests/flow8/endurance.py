"""Wall-clock, continuously rendered browser endurance run.
Default 60 seconds; --seconds 1200 for the full 20-minute session. No simulated
wait or substituted timer: records monotonic elapsed time and actual rAF counts.
"""
from pathlib import Path
import argparse,datetime,hashlib,json,os,shutil,time
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow8';O.mkdir(parents=True,exist_ok=True)
a=argparse.ArgumentParser();a.add_argument('--seconds',type=int,default=60);args=a.parse_args();assert 10<=args.seconds<=7200
html=(R/'dist/INK-Street-Fighter-6.html').read_text(encoding='utf-8');started=datetime.datetime.now(datetime.timezone.utc);errors=[];checkpoints=[];cycles=[]
environment={'memoryLimitBytes':None,'memoryEventsBefore':None}
try:
 environment['memoryLimitBytes']=Path('/sys/fs/cgroup/memory.max').read_text().strip();environment['memoryEventsBefore']=Path('/sys/fs/cgroup/memory.events').read_text()
except OSError:pass
report={'environment':environment,'requestedWallSeconds':args.seconds,'startedAt':started.isoformat(),'htmlSha256':hashlib.sha256(html.encode()).hexdigest(),'status':'running','description':'FLOW 08: continuously rendered real Chromium; six new Mai routes and all previous characters, opposite directions, rhythm/rules/speed/FX presets, live combo composer, pause, real solved-pose recording/review and skeleton inspector. No substituted time or hardware FPS guarantee.'}
(O/'endurance-progress.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
elapsed=0;final={};final_heap={};final_dom={};t0=None
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-background-timer-throttling','--disable-renderer-backgrounding'])
  page=b.new_page(viewport={'width':1280,'height':900});page.on('pageerror',lambda e:errors.append(str(e)));page.set_content(html,wait_until='load',timeout=60000);page.wait_for_function('window.INKResponseLab?.ready');cdp=page.context.new_cdp_session(page)
  page.evaluate("""async()=>{const A=SVG_FIGHTER,C=INK.Combo,V=INK.VFX,T=INK.CombatFlow,L=INKRhythmLab;await L.show();window.soak={cycles:0,raf:0,events:[],errors:[],maxParticles:0,maxTrails:0,maxLocal:0,maxRoots:0,maxCache:0,maxDom:0,maxActors:0,maxLifecycle:0,maxImpacts:0,maxInputs:0,maxGhostSlots:0,maxReplay:0,maxStateEvents:0,recordings:0,reviews:0,inspections:0,pausedChecks:0,views:0,next:0,lastStatus:'',mode:'battle',lastClock:0,busy:false};const s=soak;
  async function next(){const n=s.cycles,newRoutes=C.routes.routes.filter(r=>r.rulesPreset==='flow'),oldRoutes=C.routes.routes.filter(r=>!r.rulesPreset),r=n%4!==3?newRoutes[n%newRoutes.length]:oldRoutes[Math.floor(n/4)%oldRoutes.length];
   L.setSettings({rhythm:n%3===0?'legacy':'weighted',rules:r.rulesPreset|| (n%2?'legacy':'flow'),speed:[1,.85,1,.75,1,.5][n%6],buffer:[3,6,9,12][n%4]});V.quality([.5,1,1.5][n%3]);V.settings.enabled=n%17!==16;V.settings.intensity=n%7===6?.65:1;V.settings.reducedMotion=n%7===6;
   if(!L.active)await L.show(r.id);L.setDraft(r);document.getElementById('r7-side').value=String(n%2?-1:1);await L.run('demo');if(n%3===0){INK.Replay.begin('Endurance actual route '+r.id);s.recordings++;}s.lastStatus='running';s.mode='battle';s.next=0;}
  await next();function frame(){s.raf++;requestAnimationFrame(frame);}requestAnimationFrame(frame);
  s.timer=setInterval(async()=>{if(s.busy)return;s.busy=true;try{
   const now=performance.now();s.maxParticles=Math.max(s.maxParticles,V.stats.active);s.maxTrails=Math.max(s.maxTrails,V.trailStats.active);s.maxDom=Math.max(s.maxDom,document.querySelectorAll('*').length);s.maxActors=Math.max(s.maxActors,V.bank.actors.size);s.maxLifecycle=Math.max(s.maxLifecycle,INK.Runtime.lifecycleLog.length);s.maxImpacts=Math.max(s.maxImpacts,INK.ImpactFeedback.events.length);
   if(V.bank.actors.size>2||INK.Runtime.lifecycleLog.length>256||INK.ImpactFeedback.events.length>128||T.events.length>120)throw Error('Engine ownership/log bounds exceeded');
   for(const f of A.fighters){s.maxRoots=Math.max(s.maxRoots,f._inkTrail?.rows.length||0);s.maxInputs=Math.max(s.maxInputs,f._inkInputLog?.length||0);if(f.input.queue.length>1||s.maxInputs>64)throw Error('Input bounds exceeded');if(f.inkFX){s.maxLocal=Math.max(s.maxLocal,f.inkFX.stats.active);s.maxCache=Math.max(s.maxCache,f.inkFX.cache.size);}}
   if(V.stats.active>320||V.trailStats.active>64||s.maxLocal>144||s.maxRoots>40||s.maxCache>2048)throw Error('Pool bounds exceeded');
   s.maxGhostSlots=Math.max(s.maxGhostSlots,INK.SceneFeedback.slots.length);s.maxReplay=Math.max(s.maxReplay,INK.Replay.frames.length);s.maxStateEvents=Math.max(s.maxStateEvents,INK.StateTransitions.events.length);if(s.maxGhostSlots>6||s.maxReplay>600||INK.Replay.events.length>240||s.maxStateEvents>160)throw Error('Response/replay capacity exceeded');
   if(s.mode==='response'){if(A.state.tick!==s.lastClock)throw Error('Review changed combat clock');if(now>=s.next){INKResponseLab.close();await next();}return;}
   if(s.mode==='pause'){if(A.state.tick!==s.lastClock)throw Error('Paused simulation advanced');if(now>=s.next){s.pausedChecks++;A.state.paused=false;s.mode='battle';}return;}
   if(s.mode==='continuity'){if(now>=s.next){INKContinuityLab.close();await next();}return;}
   if(C.status==='failed')throw Error('Combo failed: '+C.route.id+' '+C.reason);
   if(C.status==='success'&&s.lastStatus!=='success'){
    s.lastStatus='success';const q=C.summary();if(q.hits!==C.route.expectedHits||q.damage<=0||q.remaining.drive<0||q.remaining.super<0)throw Error('Invalid combat result');if(INK.Replay.recording){INK.Replay.stop();INK.Replay.validate(INK.Replay.export());}s.cycles++;s.events.push({cycle:s.cycles,route:q.route,hits:q.hits,damage:q.damage,remaining:q.remaining,tempo:q.tempo,ticks:q.elapsedTicks,actionFrames:q.actionFrames});
    if(/NaN|Infinity/.test(document.querySelector('#game').outerHTML))throw Error('Non-finite SVG');
    if(s.cycles%7===0&&INK.Replay.frames.length){C.stop();L.close();await INKResponseLab.open();for(const t of [0,7.5,30,18.5,7.5,INK.Replay.frames.length-1])INKResponseLab.seek(t);s.lastClock=A.state.tick;s.mode='response';s.next=now+900;s.reviews++;return;}
    if(s.cycles%11===0){s.mode='continuity';C.stop();L.close();await INKForge.route('home');INKContinuityLab.open(s.cycles%22?'turn':'sHK');for(const t of (s.cycles%22?[0,22.5,45,67.5,90,135,180]:[0,11,22,15,31]))INKContinuityLab.seek(t);INKContinuityLab.paint();if(INKContinuityLab.state.boneError>1e-7||INKContinuityLab.state.wristError>1e-7)throw Error('Anatomy invariant lost in soak');s.inspections++;s.views++;s.next=now+1200;return;}
    await next();if(s.cycles%4===0){A.state.paused=true;s.mode='pause';s.lastClock=A.state.tick;s.next=now+550;}
   }
  }catch(e){s.errors.push(String(e.stack||e));clearInterval(s.timer);A.state.paused=true;}finally{s.busy=false;}},180);
  return true;}""")
  t0=time.monotonic();last_metric=-60;last_image=-300
  while time.monotonic()-t0<args.seconds:
   page.wait_for_timeout(1500)
   status=page.evaluate("()=>{const s=soak;const events=s.events.splice(0);return{events,cycles:s.cycles,raf:s.raf,mode:s.mode,errors:s.errors,maxParticles:s.maxParticles,maxTrails:s.maxTrails,maxLocal:s.maxLocal,maxRoots:s.maxRoots,maxCache:s.maxCache,maxDom:s.maxDom,maxActors:s.maxActors,maxLifecycle:s.maxLifecycle,inspections:s.inspections,clock:INK.EngineClock.inspect(),bank:{...INK.VFX.bank.stats},maxImpacts:s.maxImpacts,maxInputs:s.maxInputs,maxGhostSlots:s.maxGhostSlots,maxReplay:s.maxReplay,maxStateEvents:s.maxStateEvents,recordings:s.recordings,reviews:s.reviews,pausedChecks:s.pausedChecks,views:s.views};}")
   cycles.extend(status.pop('events'));elapsed=time.monotonic()-t0
   if status['errors'] or errors:errors.extend(status['errors']);break
   if elapsed-last_metric>=60:
    cdp.send('HeapProfiler.collectGarbage');heap=cdp.send('Runtime.getHeapUsage');dom=cdp.send('Memory.getDOMCounters');checkpoint=dict(elapsed=round(elapsed,3),**status,heap=heap,dom=dom);checkpoints.append(checkpoint);last_metric=elapsed
    (O/'endurance-progress.json').write_text(json.dumps({**report,'elapsedWallSeconds':round(elapsed,3),'latest':checkpoint,'completedRoutes':len(cycles),'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
    print('CHECKPOINT',round(elapsed,1),'cycles',len(cycles),'heap',heap['usedSize'],'nodes',dom['nodes'],'errors',errors,flush=True)
   if elapsed-last_image>=600:
    page.screenshot(path=str(O/('endurance-%04ds.png'%round(elapsed))));last_image=elapsed
  elapsed=time.monotonic()-t0
  final=page.evaluate("()=>{clearInterval(soak.timer);SVG_FIGHTER.state.paused=true;const {timer,events,...rest}=soak;return rest;}");cdp.send('HeapProfiler.collectGarbage');final_heap=cdp.send('Runtime.getHeapUsage');final_dom=cdp.send('Memory.getDOMCounters');page.screenshot(path=str(O/'endurance-final.png'));b.close()
except Exception as exc:
 errors.append(type(exc).__name__+': '+str(exc))
 elapsed=time.monotonic()-t0 if t0 is not None else 0
 final={'errors':errors,'mode':'browser-exception'}
try:environment['memoryEventsAfter']=Path('/sys/fs/cgroup/memory.events').read_text()
except OSError:pass
report.update(status='passed' if not errors and elapsed>=args.seconds and len(cycles)>0 else 'failed',finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),elapsedWallSeconds=round(elapsed,3),completedRoutes=len(cycles),final=final,finalHeap=final_heap,finalDOM=final_dom,checkpoints=checkpoints,routeResults=cycles,browserErrors=errors)
(O/'endurance.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');(O/'endurance-progress.json').write_text(json.dumps({k:v for k,v in report.items() if k not in ['routeResults','checkpoints']},ensure_ascii=False,indent=2),encoding='utf-8');print('ENDURANCE',report['status'],'seconds',report['elapsedWallSeconds'],'routes',len(cycles),flush=True)
raise SystemExit(0 if report['status']=='passed' else 1)
