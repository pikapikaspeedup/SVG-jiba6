"""Two live Mai actors and emulated gamepad input isolation on the final HTML.
State injection only sets up/ends test actions; this is not a human playthrough
or a physical gamepad compatibility assertion. No runtime source is changed.
"""
from pathlib import Path
import datetime, hashlib, json, os, shutil
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'qa/flow5'
html = (ROOT / 'dist/INK-Street-Fighter-6.html').read_bytes()
errors = []
script = r'''async () => {
 const A=SVG_FIGHTER,F=INKForge,V=INK.VFX,R=INK.Runtime,tests=[];
 const poll=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))); // public production loop, not private game functions
 const assert=(yes,msg)=>{if(!yes)throw Error(msg||'assertion failed');};
 const run=async(name,fn)=>{try{tests.push({name,pass:true,detail:await fn()});}catch(e){tests.push({name,pass:false,error:String(e.stack||e)});}};
 async function setup(){INK.Combo.stop();await F.route('battle');A.start('mai','mai','versus','classic');A.state.phase='fight';A.state.paused=true;document.querySelector('#infinite').checked=false;document.querySelector('#autohp').checked=false;A.fighters.forEach((f,i)=>{f.x=f.px=i?1060:360;f.dir=i?-1:1;});V.settings.enabled=true;V.settings.reducedMotion=false;V.settings.intensity=1;V.quality(1);}
 await run('Two real Mai fighters own distinct simultaneous timelines and emitter banks',async()=>{
   await setup();assert(A.tryMove(0,'hissatsu_2')&&A.tryMove(1,'hissatsu_2'),'ordinary move request failed');A.step(22);A.render();
   assert(V.bank.actors.size===2,'expected two live banks');const [a,b]=A.fighters,[u,v]=[V.bank.actors.get(0),V.bank.actors.get(1)];
   assert(a.attack._inkTimeline!==b.attack._inkTimeline,'shared timeline');assert(u.instance!==v.instance,'shared bank instance');
   assert(u.lastEdge===a.attack._inkTimeline.serial&&v.lastEdge===b.attack._inkTimeline.serial,'bank edge mismatch');
   const ka=[...u.emitters.values()].map(s=>s.key),kb=[...v.emitters.values()].map(s=>s.key);
   assert(ka.length>0&&kb.length>0&&ka.every(k=>!kb.includes(k)),'emitter identity collision');
   return {actors:V.bank.actors.size,keys:[ka,kb],particles:V.stats.active,ribbons:V.trailStats.active};
 });
 await run('Same-character renderers keep owned SVG clip identities separate',()=>{
   const seen=new Set(),counts=[];for(const f of A.fighters){const ids=[...f.inkRenderer.group.querySelectorAll('[id]')].map(n=>n.id);assert(ids.length>0,'no owned SVG clip IDs');for(const id of ids){assert(!seen.has(id),'duplicate '+id);seen.add(id);}counts.push(ids.length);assert(!/NaN|Infinity/.test(f.inkRenderer.group.outerHTML),'invalid SVG');}
   return {paintIdCounts:counts};
 });
 await run('Closing only player one preserves player two identity and particles already born',()=>{
   const other=V.bank.actors.get(1),serial=A.fighters[1].attack._inkTimeline.serial,particleCount=V.stats.active,previous=V.bank.stats.acceptedBirths;
   A.setState(A.fighters[0],'idle');assert(!V.bank.actors.has(0)&&V.bank.actors.get(1)===other,'other bank removed');assert(V.stats.active===particleCount,'existing particles cleared');
   A.step(4);assert(V.bank.actors.get(1)===other,'other instance recreated');assert(A.fighters[1].attack._inkTimeline.serial>=serial);assert(V.bank.stats.acceptedBirths>previous,'other actor stopped emitting');
   return {survivingInstance:other.instance,newAcceptedBirths:V.bank.stats.acceptedBirths-previous};
 });
 await run('Two-actor teardown expires all effects without allocating more pool nodes',()=>{
   const nodes=V.pool.nodes.length,trails=V.trails.nodes.length;A.setState(A.fighters[1],'idle');A.state.hitstop=0;A.step(150);
   assert(V.bank.actors.size===0&&V.stats.active===0&&V.trailStats.active===0,'effects did not expire');assert(nodes===V.pool.nodes.length&&trails===V.trails.nodes.length,'pool nodes grew');
   return {particleNodes:nodes,ribbonGroups:trails};
 });
 const original=Object.getOwnPropertyDescriptor(navigator,'getGamepads');
 try {
   const buttons=Array.from({length:17},()=>({value:0,pressed:false})),pad={index:0,id:'FLOW5 virtual test controller',connected:true,mapping:'standard',axes:[0,0],buttons};
   Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad]});
   const key=(n,on)=>{buttons[n].value=on?1:0;buttons[n].pressed=on;};
   await run('Engine dialog rejects emulated gamepad Start and attack input',async()=>{
     await setup();A.state.paused=false;await poll();INKEngineLab.open('ryuuenbu-heavy');const tick=A.state.tick;
     key(9,true);key(2,true);await poll();assert(A.state.paused,'Start resumed battle under modal');assert(A.state.tick===tick,'dialog simulation changed');assert(A.controllers().sources.length===0,'input leaked through modal');
     return {paused:A.state.paused,controllers:A.controllers()};
   });
   await run('Held gamepad inputs require neutral after inspection, then new input works',async()=>{
     INKEngineLab.close();await poll();assert(!A.state.paused,'prior running state not restored');await poll();assert(A.controllers().sources.length===0,'held input leaked on close');
     key(9,false);key(2,false);await poll();key(2,true);await poll();
     assert(A.controllers().sources.some(s=>s.source==='pad:0'&&s.buttons.includes('LP')),'new neutral-separated attack not accepted');
     key(2,false);await poll();A.state.paused=true;return {neutralLatchRespected:true};
   });
 } finally {if(document.querySelector('#engine5-inspector')?.open)INKEngineLab.close();if(original)Object.defineProperty(navigator,'getGamepads',original);else delete navigator.getGamepads;await poll();A.state.paused=true;}
 return tests;
}'''
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':900})
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html.decode('utf-8'),wait_until='load',timeout=60000)
    page.wait_for_function('window.INKEngineLab')
    tests=page.evaluate(script)
    browser.close()
report={'suite':'flow5-two-actor-and-input','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'htmlSha256':hashlib.sha256(html).hexdigest(),'total':len(tests),'passed':sum(t['pass'] for t in tests),
        'tests':tests,'browserErrors':errors,'scope':'Actual two-fighter runtime, forced simulation steps for state coverage; browser gamepad object is emulated, not physical hardware.'}
(OUT/'dual-actor.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
raise SystemExit(0 if report['passed']==report['total'] and not errors else 1)
