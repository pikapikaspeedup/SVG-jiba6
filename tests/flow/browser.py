"""FLOW browser contracts: real engine requests, UI controls, particles and offline round-trip."""
from pathlib import Path
import os, shutil
from playwright.sync_api import sync_playwright
import json, hashlib
R=Path(__file__).resolve().parents[2];out=[];errors=[]
def check(name,fn):
 try:
  detail=fn();out.append({'name':name,'pass':True,'detail':detail});print('PASS',name,flush=True)
 except Exception as e:
  out.append({'name':name,'pass':False,'error':str(e)});print('FAIL',name,str(e),flush=True)
def require(x,msg='assertion failed'):
 assert x,msg
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium') or shutil.which('google-chrome'),headless=True,args=['--no-sandbox'])
 pg=b.new_page(viewport={'width':1600,'height':1250});pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.set_content((R/'dist/INK-Street-Fighter-6.html').read_text(),wait_until='load',timeout=60000);pg.wait_for_function('!!window.INKComboUI')
 def opens():
  pg.locator('#flow-home-demo').click();pg.evaluate('SVG_FIGHTER.state.paused=true');require(pg.locator('#flow-panel').is_visible());require(pg.evaluate('INK.Combo.routes.routes.length===16'));return '16 routes / live battle mounted'
 check('Home launch opens the real combo arena and route panel',opens)
 def practice_idle():
  pg.evaluate("async()=>{await INKComboUI.run('practice',true);SVG_FIGHTER.step(240);}")
  q=pg.evaluate("({hits:INK.Combo.hits,cursor:INK.Combo.cursor,hp:SVG_FIGHTER.fighters[1].hp,attack:!!SVG_FIGHTER.fighters[0].attack})");require(q['hits']==0 and q['cursor']==0 and not q['attack']);return q
 check('Practice never auto-attacks or changes damage while waiting',practice_idle)
 def key():
  pg.evaluate('SVG_FIGHTER.state.paused=false');pg.keyboard.press('g');pg.evaluate('SVG_FIGHTER.state.paused=true');q=pg.evaluate('INK.Combo.summary()');require(q['cursor']==1 and q['actions'][0]['move']=='sHP',str(q));return q['actions'][0]
 check('Physical Playwright G keyboard event starts requested first move',key)
 def rhythm():
  q=pg.evaluate("""async()=>{await INKComboUI.run('practice',true);const C=INK.Combo,A=SVG_FIGHTER;let inputs=0;
  for(let i=0;i<900&&C.status==='running';i++){A.step(1);if(C.window?.ready&&C.cursor<C.route.steps.length){A.state.paused=false;document.body.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyG',key:'g',bubbles:true}));A.state.paused=true;inputs++;}}
  A.render();INKComboUI.draw();return{...C.summary(),inputs};}""")
  require(q['status']=='success' and q['hits']==15 and q['inputs']==7,str(q));return {k:q[k] for k in ['status','hits','damage','inputs']}
 check('Seven timed DOM G events complete 15 hits without forced cancels',rhythm)
 def bad_timing():
  q=pg.evaluate("""()=>{const C=INK.Combo,A=SVG_FIGHTER,r=C.routes.routes.find(r=>r.id==='ken-extended');C.start(r,'demo',{paused:true,delay:80});A.step(400);return C.summary();}""")
  require(q['status']=='failed' and q['hits']<15,str(q));return {'hits':q['hits'],'reason':q['reason']}
 check('Deliberately late input fails instead of faking a long combo',bad_timing)
 def low_resources():
  q=pg.evaluate("""()=>{const C=INK.Combo,A=SVG_FIGHTER,r=structuredClone(C.routes.routes.find(r=>r.id==='ken-extended'));r.meter={drive:1,super:0};C.start(r,'demo',{paused:true});A.step(450);return C.summary();}""")
  require(q['status']=='failed' and q['remaining']['drive']>=0 and q['remaining']['super']>=0,str(q));return {'hits':q['hits'],'remaining':q['remaining'],'reason':q['reason']}
 check('Insufficient resources cannot trigger Drive cancel or free supers',low_resources)
 def wrong_move():
  q=pg.evaluate("""()=>{const C=INK.Combo,A=SVG_FIGHTER;C.start(C.routes.routes[1],'practice',{paused:true});A.tryMove(0,'sLP');return C.summary();}""")
  require(q['status']=='failed' and '错误招式' in q['reason']);return q['reason']
 check('Wrong real input is reported, not replaced with the expected move',wrong_move)
 def frozen():
  q=pg.evaluate("""()=>{const C=INK.Combo,A=SVG_FIGHTER;C.start(C.routes.routes[3],'demo',{paused:true});A.step(50);A.render();const before={hp:A.fighters[1].hp,tick:A.state.tick,damage:C.damage};for(let i=0;i<240;i++)A.render(0);return{before,after:{hp:A.fighters[1].hp,tick:A.state.tick,damage:C.damage}};}""")
  require(q['before']==q['after'],str(q));return q
 check('240 render-only calls do not advance combat or apply damage',frozen)
 def real_subframes():
  q=pg.evaluate("""()=>{const A=SVG_FIGHTER;INK.Combo.stop();A.practice('ken','shoryu_2');const f=A.fighters[0];A.state.paused=false;A.state.hitstop=0;f.attack.t=13;A.render();const hp=A.fighters[1].hp,tick=A.state.tick;A.renderFraction(.25);const first={yaw:f.pose.yaw,head:f.inkRenderer.headRoot?.outerHTML,frame:f.attack.t};A.renderFraction(.75);const second={yaw:f.pose.yaw,frame:f.attack.t};A.state.hitstop=4;A.renderFraction(.2);const hitA=f.pose.yaw;A.renderFraction(.8);const hitB=f.pose.yaw;A.state.paused=true;return{first,second,hitA,hitB,exact:A.pose(f).yaw,hpUnchanged:hp===A.fighters[1].hp,tickUnchanged:tick===A.state.tick};}""")
  require(q['first']['yaw']!=q['second']['yaw'] and q['first']['frame']==q['second']['frame']==13,str(q));require(q['hitA']==q['hitB']==q['exact'],str(q));require(q['hpUnchanged'] and q['tickUnchanged']);return q
 check('Live battle draws fractional turns but freezes exactly on integer contact pose',real_subframes)
 def root_trails():
  q=pg.evaluate("""()=>{const A=SVG_FIGHTER,C=INK.Combo;C.start(C.routes.routes.find(r=>r.id==='cammy-extended'),'demo',{paused:true});let maximum=0,travel=0,currentRoots=true;for(let i=0;i<230;i++){A.step(1);const f=A.fighters[0],rows=f._inkTrail?.rows||[];maximum=Math.max(maximum,rows.length);if(f.attack&&rows.length)currentRoots=currentRoots&&rows.at(-1).x===f.x&&rows.at(-1).y===f.y;if(rows.length>1)travel=Math.max(travel,Math.abs(rows[0].x-rows.at(-1).x));}A.render();return{maximum,travel,currentRoots,cap:40,finite:!document.querySelector('#game').outerHTML.includes('NaN')};}""")
  require(0<q['maximum']<=40 and q['travel']>20 and q['finite'] and q['currentRoots'],str(q));return q
 check('Moving attacks record bounded world-space trajectory instead of foot-local trails',root_trails)
 def no_extra():
  q=pg.evaluate("""()=>{const C=INK.Combo,A=SVG_FIGHTER;C.start(C.routes.routes[3],'demo',{paused:true});A.step(600);const before={remain:C.summary().remaining,trace:C.trace.length,clock:C.clock};A.step(600);return{before,after:{remain:C.summary().remaining,trace:C.trace.length,clock:C.clock}};}""")
  require(q['before']==q['after'],str(q));return q['before']
 check('Completion freezes proof metrics instead of post-route regen changing totals',no_extra)
 def settings():
  q=pg.evaluate("""()=>{INK.Combo.stop();const A=SVG_FIGHTER;document.querySelector('#infinite').checked=true;document.querySelector('#autohp').checked=true;document.querySelector('#dummy').value='crouch';INK.Combo.start(INK.Combo.routes.routes[0],'demo',{paused:true});INK.Combo.setSpeed(.25);INKComboUI.close();return{infinite:document.querySelector('#infinite').checked,autohp:document.querySelector('#autohp').checked,dummy:document.querySelector('#dummy').value,speed:A.state.artSpeed,status:INK.Combo.status};}""")
  require(q=={'infinite':True,'autohp':True,'dummy':'crouch','speed':1,'status':'idle'},str(q));return q
 check('Leaving combo lab restores previous training settings and speed',settings)
 def route_schema():
  q=pg.evaluate("""()=>{const C=INK.Combo,r=structuredClone(C.routes.routes[0]),before=JSON.stringify(C.routes);r.steps[0].move='not-a-move';let rejected=false;try{C.configure({version:1,kind:'ink-combo-library',routes:[r]});}catch(e){rejected=true;}return{rejected,unchanged:before===JSON.stringify(C.routes)};}""")
  require(q['rejected'] and q['unchanged']);return q
 check('Malformed combo library is rejected without replacing working routes',route_schema)
 def subframe():
  pg.evaluate("async()=>{INKComboUI.close();await INKForge.loadMove('ken','shoryu_2');await INKForge.route('studio');INKForge.atFrame(12.25)}")
  a=pg.evaluate('({yaw:INKForge.state.pose.yaw,projection:INKForge.actor.turnState})');pg.evaluate('INKForge.atFrame(12.75)');c=pg.evaluate('({yaw:INKForge.state.pose.yaw,projection:INKForge.actor.turnState})');require(a['yaw']!=c['yaw'],str([a,c]));return {'12.25F':a,'12.75F':c}
 check('Editor and renderer really sample different fractional-turn poses',subframe)
 def rewind():
  pg.evaluate('INKForge.atFrame(14.25)');canonical="()=>{const g=INKForge.effects.root.cloneNode(true);g.querySelectorAll('[display=none]').forEach(n=>n.remove());return g.outerHTML;}";a=pg.evaluate(canonical);pg.evaluate('INKForge.atFrame(25.5);INKForge.atFrame(14.25)');v=pg.evaluate(canonical);require(a==v,'Visible rewind SVG differs');return hashlib.sha256(a.encode()).hexdigest()
 check('Reverse seek reconstructs identical particle and ribbon SVG',rewind)
 def pool():
  q=pg.evaluate("""()=>{const ns=INK.SVG.node('g',{},document.querySelector('#game')),p=new INK.Particles.ParticleSystem(ns,{capacity:32});p.emit({x:0,y:0,frame:0,count:90});const n=ns.querySelectorAll('path').length,peak=p.stats.active;for(let t=0;t<1000;t++){p.step(t);if(t%3===0)p.emit({x:0,y:0,frame:t,count:9});p.render(t+.3);}const final={nodes:ns.querySelectorAll('path').length,peak:p.stats.peak,dropped:p.stats.dropped,active:p.stats.active};p.clear();const cleared=p.stats.active;p.destroy();ns.remove();return{n,peak,final,cleared};}""")
  require(q['n']==32 and q['peak']==32 and q['final']['nodes']==32 and q['final']['peak']==32 and q['cleared']==0,str(q));return q
 check('Particle over-capacity stays within fixed SVG pool after 1000 updates',pool)
 def stepped():
  pg.locator('#flow-stepped').check();pg.evaluate('INKForge.atFrame(13.5)');q=pg.evaluate('INKForge.state.pose.yaw');pg.locator('#f-key-add').click();require(not pg.evaluate('INKFlowView.stepped'));return q
 check('4-frame comparison is view-only; authoring returns to continuous sampling',stepped)
 def emitter():
  pg.locator('[data-inspector=fx]').click();pg.locator('#f-fx-count').fill('57');pg.locator('#f-fx-life').fill('37');pg.locator('#f-fx-speed').fill('6.3');pg.locator('#f-fx-species').select_option('ember');pg.locator('#f-fx-apply').click();pg.evaluate('INKForge.save()');q=pg.evaluate("INKForge.store.byGame('ken','shoryu_2').fx[0].particles");require(q['count']==57 and q['life']==37 and q['speed']==6.3,str(q));return q
 check('Particle inspector edits write into the persistent move asset',emitter)
 def invalid():
  q=pg.evaluate("""async()=>{const before=JSON.stringify(INKForge.store.snapshot()),r=structuredClone(INKForge.state.draft);r.fx[0].particles.count=1000000;let rejected=false;try{await INKForge.importData(r);}catch(e){rejected=true;}return{rejected,unchanged:before===JSON.stringify(INKForge.store.snapshot())};}""")
  require(q['rejected'] and q['unchanged']);return q
 check('Invalid particle import is rejected atomically',invalid)
 def portable():
  text=pg.evaluate('INK.Portable.html(INKForge.store)');other=b.new_page(viewport={'width':1400,'height':1000});other.on('pageerror',lambda e:errors.append('portable: '+str(e)))
  other.set_content(text,wait_until='load',timeout=60000);other.wait_for_function('!!window.INKComboUI');q=other.evaluate("({particle:INKForge.store.byGame('ken','shoryu_2').fx[0].particles,routes:INK.Combo.routes.routes.length,yaw:!!INKForge.store.byGame('ken','shoryu_2').clip.tracks.yaw,paths:!!INK.Turn.bands})");require(q['particle']['count']==57 and q['routes']==16 and q['yaw'] and q['paths'],str(q));other.close();return q
 check('Exported standalone HTML reopens with particles, authored yaw and combo lab',portable)
 def player():
  other=b.new_page();other.on('pageerror',lambda e:errors.append('player: '+str(e)));other.set_content((R/'dist/INK-Street-Fighter-6-Player.html').read_text(),wait_until='load',timeout=60000);other.wait_for_function('!!window.INKComboUI');other.locator('#flow-open').click();other.evaluate('SVG_FIGHTER.state.paused=true');q=other.evaluate('INK.Combo.route.id');require(q=='ken-extended');other.close();return q
 check('Player-only edition includes the playable combo lab',player)
 check('No unhandled page errors',lambda:require(not errors,str(errors)))
 b.close()
(R/'qa/flow/browser-tests.json').write_text(json.dumps({'total':len(out),'passed':sum(r['pass'] for r in out),'tests':out,'browserErrors':errors},ensure_ascii=False,indent=2))
if any(not r['pass'] for r in out):raise SystemExit(1)
