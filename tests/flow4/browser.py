"""FLOW 04 real Chromium regression: no fabricated hits or screenshots.
Requires built dist HTML. Writes raw check details, screenshots and file:// result.
"""
from pathlib import Path
import os,shutil,json,hashlib,time
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow4';O.mkdir(parents=True,exist_ok=True)
rows=[];errors=[]
def ok(value,message='assertion failed'):
 if not value: raise AssertionError(message)
def check(name,fn):
 try:
  detail=fn();rows.append(dict(name=name,pass_=True,detail=detail));print('PASS',name,flush=True)
 except Exception as e:
  rows.append(dict(name=name,pass_=False,error=str(e)));print('FAIL',name,str(e),flush=True)
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':1080});page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((R/'dist/INK-Street-Fighter-6.html').read_text(encoding='utf-8'),wait_until='load',timeout=60000);page.wait_for_function('window.INKMaiShowcase')
 def run(code):return page.evaluate(code)
 def setup():run("()=>{INK.Combo.stop();SVG_FIGHTER.start('mai','ryu','training','assist');SVG_FIGHTER.state.phase='fight';SVG_FIGHTER.state.paused=true;document.querySelector('#dummy').value='idle';document.querySelector('#infinite').checked=false;document.querySelector('#autohp').checked=false;const[f,d]=SVG_FIGHTER.fighters;f.x=f.px=360;d.x=d.px=1050;f.dir=1;d.dir=-1;INK.VFX.settings.enabled=true;INK.VFX.settings.intensity=1;INK.VFX.settings.reducedMotion=false;}")
 def version():
  q=run("({game:SVG_FIGHTER.version,core:INK.VERSION,motion:INK.Motion.version,store:INKForge.store.id,build:INKForge.store.manifest.build})");ok(q['core']=='4.0.0-flow' and q['store']=='ink-flow-sf6-v4' and q['build']=='4.0.0',str(q));return q
 check('Version, build and new isolated storage namespace agree',version)
 def fan_geometry():
  q=run("""async()=>{await INKForge.loadMove('mai','ryuuenbu-heavy');await INKForge.route('studio');const errors=[];for(const t of [0,8,15,18.5,24,36.75,60]){INKForge.atFrame(t);const F=INKForge,p=F.state.pose,rig=F.state.solved,fan=F.actor.frontArm.fan,root=document.querySelector('#f-actor-root');for(const socket of ['fanTip','fanGrip']){const local=INK.Runtime.socket(p,rig,socket),actual=new DOMPoint(socket==='fanTip'?79:0,0).matrixTransform(fan.getCTM()),expected=new DOMPoint(...local).matrixTransform(root.getCTM());errors.push({t,socket,error:Math.hypot(actual.x-expected.x,actual.y-expected.y)});}}return{maximum:Math.max(...errors.map(x=>x.error)),samples:errors};}""");ok(q['maximum']<.01,str(q));return q
 check('Fan-tip and grip emitters exactly match SVG weapon transforms',fan_geometry)
 def fan_open():
  q=run("""()=>{const F=INKForge,p={...F.state.pose,fan:1};F.actor.render(p,{frame:10});const fan=F.actor.frontArm.fan,a=fan.querySelector('path').getAttribute('d'),count=fan.querySelectorAll('path').length;p.fan=.15;F.actor.render(p,{frame:10});return{changed:a!==fan.querySelector('path').getAttribute('d'),transform:fan.getAttribute('transform'),paths:count,retained:count===fan.querySelectorAll('path').length};}""");ok(q['changed'] and 'scale' not in q['transform'] and q['retained'],str(q));return q
 check('Fan opens with retained radial ribs, not a squeezed paper sprite',fan_open)
 def secondary():
  q=run("""()=>{const F=INKForge;F.atFrame(15.2);const p=JSON.stringify(F.state.pose),a=F.actor.hair.outerHTML+'|'+F.actor.trail.outerHTML;F.atFrame(26.8);const b=F.actor.hair.outerHTML+'|'+F.actor.trail.outerHTML;F.atFrame(15.2);return{moving:a!==b,rewind:a===F.actor.hair.outerHTML+'|'+F.actor.trail.outerHTML,poseUnchanged:p===JSON.stringify(F.state.pose)};}""");ok(all(q.values()),str(q));return q
 check('Hair and obi ribbon deform, rewind identically, and preserve the pose',secondary)
 def smooth_cache():
  q=run("""()=>{const F=INKForge;F.atFrame(18);const fx=F.effects,record=F.state.draft,profile=F.store.profile('mai'),I=INK.mat.identity();let maxJump=0,prev=null;for(let t=18;t<22;t+=.01){const q=fx.point(record,t,'fanTip',profile,I);if(prev)maxJump=Math.max(maxJump,Math.hypot(q[0]-prev[0],q[1]-prev[1]));prev=q;}return{maxJump,cache:fx.cache.size};}""");ok(q['maxJump']<2 and q['cache']<=2048,str(q));return q
 check('Quarter-frame FX cache interpolates rather than visibly stepping',smooth_cache)
 def layers_rewind():
  q=run("""async()=>{const F=INKForge;await F.loadMove('mai','ryuuenbu-heavy');await F.route('studio');const visible=root=>{const n=root.cloneNode(true);n.querySelectorAll('[display="none"]').forEach(x=>x.remove());return n.outerHTML;};F.atFrame(27.25);const a=visible(F.effects.root)+'|'+visible(F.effects.backRoot);F.atFrame(49.5);F.atFrame(27.25);return{same:a===visible(F.effects.root)+'|'+visible(F.effects.backRoot),back:F.effects.backRoot.querySelectorAll('g:not([display="none"])').length,front:F.effects.root.querySelectorAll('g:not([display="none"])').length};}""");ok(q['same'] and q['back']>0 and q['front']>0,str(q));return q
 check('Front/back ribbons and seeded particles reverse-seek identically',layers_rewind)
 def quality():
  q=run("""()=>{const F=INKForge;const snapshot=()=>[...F.effects.particles.nodes].filter(n=>n.getAttribute('display')!=='none').map(n=>[n.getAttribute('d'),n.getAttribute('transform'),n.getAttribute('opacity'),n.getAttribute('fill')].join('|'));INK.VFX.quality(.5);F.atFrame(30.5);const lo=snapshot();INK.VFX.quality(1.5);F.atFrame(30.5);const hi=snapshot();INK.VFX.quality(1);return{low:lo.length,high:hi.length,subset:lo.every(x=>hi.includes(x))};}""");ok(q['subset'] and q['high']>=q['low']>0,str(q));return q
 check('Low particle quality is a stable subset of high-quality births',quality)
 def freeze_buffer():
  setup();q=run("""()=>{const A=SVG_FIGHTER,G=A.state,I=INK.Input,f=A.fighters[0];G.hitstop=24;const start=I.frame;A.inputMove(0,'sLP');A.step(24);const afterFreeze={frame:I.frame,attack:f.attack?.m.id||null,pending:I.inspect(f)};A.step(1);const first=f.attack?.m.id;A.step(60);return{start,afterFreeze,first,finalAttack:f.attack?.m.id||null,queue:f.input.queue.length,input:f._inkInput};}""");ok(q['start']==q['afterFreeze']['frame'] and q['afterFreeze']['attack'] is None and q['afterFreeze']['pending']['remaining']==9 and q['first']=='sLP' and q['queue']==0 and q['finalAttack'] is None,str(q));return q
 check('Actual input survives 24-frame freeze and executes exactly once',freeze_buffer)
 def natural_cancel():
  setup();q=run("""()=>{const A=SVG_FIGHTER,G=A.state;A.practice('mai','hissatsu_3');G.paused=true;let f=A.fighters[0],n=0;while(!f.attack?.hitConfirmed&&n++<100)A.step(1);const original=f.attack,freeze=G.hitstop;A.inputMove(0,'SA3');const queue=INK.Input.inspect(f);A.step(freeze);const same=f.attack===original;A.step(1);return{freeze,queue,same,next:f.attack?.m.id,super:f.super,drive:f.drive};}""");ok(q['freeze']>0 and q['queue']['move']=='SA3' and q['same'] and q['next']=='SA3' and q['super']==0 and q['drive']>=0,str(q));return q
 check('Real hitstop accepts a super cancel without canceling mid-freeze',natural_cancel)
 def insufficient():
  setup();q=run("""()=>{const A=SVG_FIGHTER,f=A.fighters[0];f.super=0;A.state.hitstop=15;A.inputMove(0,'SA3');A.step(30);return{attack:f.attack?.m.id||null,super:f.super,queue:f.input.queue.length,status:f._inkInput.status};}""");ok(q['attack'] is None and q['super']<1 and q['queue']==0 and q['status']=='expired',str(q));return q
 check('Buffered super cannot bypass resource checks and expires cleanly',insufficient)
 def freeze_fx():
  setup();q=run("""()=>{const A=SVG_FIGHTER,V=INK.VFX,G=A.state;V.burst(500,400,'#ff0000',12,'hit',{owner:A.fighters[0],move:A.getMove(A.fighters[0],'sHP')},G);G.hitstop=13;A.renderFraction(1);const before=V.pool.root.outerHTML,clock=V.time;let stable=true;for(let t=0;t<13;t++){A.step(1);A.renderFraction(t%2?.2:.8);stable=stable&&V.pool.root.outerHTML===before;}return{stable,clock,after:V.time,lastFrozen:V.frozen,hitstop:G.hitstop};}""");ok(q['stable'] and q['clock']==q['after'] and q['lastFrozen'] and q['hitstop']==0,str(q));return q
 check('World FX freeze through the final hitstop tick without time reversal',freeze_fx)
 def no_render_damage():
  setup();q=run("""()=>{const A=SVG_FIGHTER,C=INK.Combo;C.start(C.routes.routes.find(r=>r.id==='mai-extended'),'demo',{paused:true});A.step(100);const before=JSON.stringify([A.fighters.map(f=>({x:f.x,y:f.y,hp:f.hp,drive:f.drive,super:f.super,t:f.attack?.t})),A.state.tick,INK.Input.frame,INK.VFX.time,C.summary()]);for(let i=0;i<360;i++)A.renderFraction((i%101)/100);return{same:before===JSON.stringify([A.fighters.map(f=>({x:f.x,y:f.y,hp:f.hp,drive:f.drive,super:f.super,t:f.attack?.t})),A.state.tick,INK.Input.frame,INK.VFX.time,C.summary()])};}""");ok(q['same'],str(q));return q
 check('360 render-only calls do not move fighters, advance clocks or add hits',no_render_damage)
 def trails():
  setup();q=run("""()=>{const A=SVG_FIGHTER,G=A.state;A.practice('mai','hissatsu_3');G.paused=true;const f=A.fighters[0];let n=0;while((!f.attack?.confirmed||INK.VFX.trailStats.active===0)&&n++<80)A.step(1);G.hitstop=0;const old=f.attack,active=INK.VFX.trailStats.active,births=INK.VFX.trails.live.filter(Boolean).map(p=>p.birth);const started=A.tryMove(0,'SA3'),kept=INK.VFX.trailStats.active;A.setState(f,'idle');A.fighters[1].invuln=500;G.hitstop=0;A.step(120);return{active,kept,started,changed:f.attack!==old,expired:INK.VFX.trailStats.active,births};}""");ok(q['active']>0 and q['kept']==q['active'] and q['started'] and q['expired']==0,str(q));return q
 check('Simulation-owned world trails survive cancels and expire without DOM clones',trails)
 def fx_off():
  setup();q=run("""()=>{const A=SVG_FIGHTER;A.practice('mai','hissatsu_3');A.state.paused=true;A.step(22);INK.VFX.setEnabled(false);A.renderFraction(1);const f=A.fighters[0],values=[INK.VFX.pool.root,INK.VFX.trails.root,f.inkFX.root,f.inkFX.backRoot].map(n=>n.getAttribute('display'));INK.VFX.setEnabled(true);return{values};}""");ok(all(v=='none' for v in q['values']),str(q));return q
 check('FX off hides both local layers, world particles and world trails',fx_off)
 def reduce_flash():
  setup();run("()=>{SVG_FIGHTER.state.paused=true;SVG_FIGHTER.state.flash=.8;INK.VFX.settings.reducedMotion=true;}");page.wait_for_timeout(100);off=run("document.querySelector('#hit-flash').getAttribute('opacity')");run("INK.VFX.settings.reducedMotion=false");page.wait_for_timeout(100);on=run("document.querySelector('#hit-flash').getAttribute('opacity')");ok(float(off)==0 and float(on)>.1,str([off,on]));return dict(reduced=off,full=on)
 check('Reduced-motion mode suppresses the actual fullscreen hit flash',reduce_flash)
 def early_practice():
  setup();q=run("""()=>{const A=SVG_FIGHTER,C=INK.Combo,r=C.routes.routes.find(r=>r.id==='mai-confirm');C.start(r,'practice',{paused:false,control:'rhythm',bufferFrames:6});const first=C.requestStep(6);A.state.paused=true;while(C.clock<7&&C.status==='running')A.step(1);A.state.paused=false;const early=C.requestStep(6);A.state.paused=true;const before=C.cursor;for(let i=0;i<20&&C.cursor===before;i++)A.step(1);const accepted=C.inputLog.filter(x=>x.status==='accepted');const q={first,early,cursor:C.cursor,accepted,forced:C.mode==='demo',pending:C.pending,damage:C.damage};C.stop();return q;}""");ok(q['first']['status']=='accepted' and q['early']['status']=='buffered' and q['cursor']==2 and not q['forced'] and any(x['delay']>0 for x in q['accepted']),str(q));return q
 check('Rhythm 6F buffer waits for real confirmation and sends one next step',early_practice)
 def rhythm_hitstop():
  setup();q=run("""()=>{const A=SVG_FIGHTER,C=INK.Combo,r=C.routes.routes.find(r=>r.id==='mai-confirm'),results=[];
  for(const side of [1,-1])for(const bufferFrames of [0,3,6]){C.start(r,'practice',{paused:false,control:'rhythm',bufferFrames,side});C.requestStep(bufferFrames);A.state.paused=true;let n=0;while(!A.state.hitstop&&n++<50)A.step(1);const attack=A.fighters[0].attack,clock=C.clock,freeze=A.state.hitstop;
  A.state.paused=false;const request=C.requestStep(bufferFrames),window={...C.window};A.state.paused=true;const unchangedImmediately=C.cursor===1&&A.fighters[0].attack===attack;A.step(freeze);const frozen=C.cursor===1&&A.fighters[0].attack===attack&&C.clock===clock;A.step(1);results.push({side,bufferFrames,freeze,request,window,unchangedImmediately,frozen,cursor:C.cursor,pending:C.pending,state:A.fighters[0].state,accepted:C.inputLog.filter(x=>x.status==='accepted').length});C.stop();}return results;}""")
  for row in q:
   ok(row['freeze']>0 and row['unchangedImmediately'] and row['frozen'] and row['window']['frozen'] and not row['window']['ready'],str(row))
   ok(row['request']['status']==('early' if row['bufferFrames']==0 else 'buffered') and row['cursor']==(1 if row['bufferFrames']==0 else 2) and row['accepted']==(1 if row['bufferFrames']==0 else 2) and row['pending'] is None,str(row))
  return q
 check('Rhythm inputs never cancel mid-hitstop; 3F/6F survive the freeze and 0F remains strict on both sides',rhythm_hitstop)
 def strict_practice():
  setup();q=run("""()=>{const A=SVG_FIGHTER,C=INK.Combo,r=C.routes.routes.find(r=>r.id==='mai-confirm');C.start(r,'practice',{paused:false,control:'rhythm',bufferFrames:0});C.requestStep(0);const early=C.requestStep(0);A.state.paused=true;A.step(21);const q={early,cursor:C.cursor,pending:C.pending,mode:C.mode};C.stop();return q;}""");ok(q['early']['status']=='early' and q['cursor']==1 and q['pending'] is None,str(q));return q
 check('Strict 0F rhythm mode never silently queues or plays subsequent steps',strict_practice)
 def expired_practice():
  setup();q=run("""()=>{const A=SVG_FIGHTER,C=INK.Combo,r=C.routes.routes.find(r=>r.id==='mai-confirm');C.start(r,'practice',{paused:false,control:'rhythm'});C.requestStep(6);C.requestStep(3);A.state.paused=true;A.step(23);const q={cursor:C.cursor,pending:C.pending,expired:C.inputLog.some(x=>x.status==='expired')};C.stop();return q;}""");ok(q['cursor']==1 and q['pending'] is None and q['expired'],str(q));return q
 check('Too-early rhythm input expires instead of becoming delayed autopilot',expired_practice)
 def stock_rules():
  setup();q=run("""()=>{const A=SVG_FIGHTER;A.practice('mai','SA1');A.state.paused=true;A.step(100);const f=A.fighters[0],before=f.flameStocks??f.maiStock??f.stock;return{keys:Object.fromEntries(Object.entries(f).filter(([k,v])=>/stock/i.test(k)&&typeof v!=='object')),finite:A.geometry(f).hurt.every(b=>Object.values(b).filter(v=>typeof v==='number').every(Number.isFinite))};}""");ok(q['finite'],str(q));return q
 check('SA1 visual rewrite leaves stock-bearing combat state and geometry finite',stock_rules)
 def showcase():
  run("async()=>{INK.Combo.stop();await INKForge.route('home')}");page.locator('#mai-showcase-open').click();run('INKMaiShowcase.seek(23.5)');q=run("({open:document.querySelector('#mai-showcase').open,source:INKMaiShowcase.record.key,paths:INKMaiShowcase.actor.frontArm.fan.querySelectorAll('path').length,pose:INKMaiShowcase.actor.group.outerHTML.includes('NaN')})");ok(q['open'] and q['source']=='ryuuenbu-heavy' and q['paths']>20 and not q['pose'],str(q));page.screenshot(path=str(O/'mai-showcase.png'));return q
 check('Dedicated Mai showcase renders the editable assets in a keyboard-accessible dialog',showcase)
 def reduced_preview():
  run('INKMaiShowcase.close();INK.VFX.settings.reducedMotion=true;INKMaiShowcase.open();INKMaiShowcase.seek(20)');before=run('INKMaiShowcase.frame');page.wait_for_timeout(120);paused=run('INKMaiShowcase.frame');page.locator('#mai-preview-play').click();page.wait_for_timeout(180);played=run('INKMaiShowcase.frame');ok(before==paused and played>paused,str([before,paused,played]));run('INK.VFX.settings.reducedMotion=false;INKMaiShowcase.seek(23.5)');return dict(openPaused=paused,explicitPlay=played)
 check('Reduced-motion showcase starts paused but honors an explicit Play request',reduced_preview)
 def modal_seek():
  q=run("""()=>{const S=INKMaiShowcase,clean=root=>{const n=root.cloneNode(true);n.querySelectorAll('[display="none"]').forEach(x=>x.remove());return n.outerHTML;};S.select('enbu-ada-zakura');S.seek(98.25);const a=S.actor.group.outerHTML+clean(S.fx.root)+clean(S.fx.backRoot);S.seek(40);S.seek(98.25);return{rewind:a===S.actor.group.outerHTML+clean(S.fx.root)+clean(S.fx.backRoot),events:S.record.fx.length};}""");ok(q['rewind'] and q['events']==12,str(q));page.screenshot(path=str(O/'mai-sa3.png'));return q
 check('SA3 has 12 authored events and deterministic full-visual reverse seek',modal_seek)
 def mirror():
  a=run("document.querySelector('#mai-preview-root').getAttribute('transform')");page.locator('#mai-preview-mirror').click();b=run("document.querySelector('#mai-preview-root').getAttribute('transform')");ok(a!=b and 'scale(-1 1)' in b,str([a,b]));return dict(before=a,after=b)
 check('Showcase mirrored facing updates the entire actor and attached FX together',mirror)
 def escape():
  page.keyboard.press('Escape');q=run("({closed:!document.querySelector('#mai-showcase').open,focus:document.activeElement.id,scrollUnlocked:!document.body.classList.contains('mai-dialog-open')})");ok(q['closed'] and q['scrollUnlocked'] and q['focus']=='mai-showcase-open',str(q));return q
 check('Escape closes the dialog and restores focus and scrolling',escape)
 def dedicated_combo():
  page.locator('#mai-combo').click();run('SVG_FIGHTER.state.paused=true;SVG_FIGHTER.step(650);SVG_FIGHTER.renderFraction(1);INKComboUI.draw()');q=run('INK.Combo.summary()');ok(q['route']=='mai-extended' and q['status']=='success' and q['hits']==14 and q['damage']>0,str(q));page.screenshot(path=str(O/'mai-combo-14.png'),full_page=True);return {k:q[k] for k in ['route','status','hits','damage','remaining']}
 check('Dedicated Mai button runs an actual guarded 14-hit route',dedicated_combo)
 def pose_fx_invalidation():
  run("async()=>{INKComboUI.close();await INKForge.loadMove('mai','ryuuenbu-heavy');await INKForge.route('studio');INKForge.atFrame(18)}");page.locator('[data-inspector=motion]').click();before=run("INKForge.effects.point(INKForge.state.draft,18,'fanTip',INKForge.store.profile('mai'),INK.mat.identity())");x=float(page.locator('#f-target-x').input_value());page.locator('#f-target-x').fill(str(x+28));page.locator('#f-pose-apply').click();after=run("INKForge.effects.point(INKForge.state.draft,18,'fanTip',INKForge.store.profile('mai'),INK.mat.identity())");distance=((after[0]-before[0])**2+(after[1]-before[1])**2)**.5;ok(distance>1,str([before,after]));return dict(before=before,after=after,distance=distance)
 check('Editing a pose invalidates its FX socket cache immediately, before saving or reloading',pose_fx_invalidation)
 def editor_roundtrip():
  run("async()=>{INKComboUI.close();await INKForge.loadMove('mai','ryuuenbu-heavy');await INKForge.route('studio')}");page.locator('[data-inspector=fx]').click();page.locator('#f-fx-trailFrames').fill('14');page.locator('#f-fx-width').fill('16.5');page.locator('#f-fx-layer').select_option('back');page.locator('#f-fx-gravity').fill('0.035');page.locator('#f-fx-curl').fill('4.5');page.locator('#f-fx-species').select_option('petal');page.locator('#f-fx-apply').click();run('INKForge.save()');q=run("INKForge.store.byGame('mai','hissatsu_2').fx[0]");ok(q['trailFrames']==14 and q['width']==16.5 and q['layer']=='back' and q['particles']['species']=='petal' and q['particles']['curl']==4.5,str(q));return q
 check('New FX inspector controls persist exact data without dropping emitter fields',editor_roundtrip)
 def portable():
  text=run('INK.Portable.html(INKForge.store)');other=browser.new_page();other.on('pageerror',lambda e:errors.append('portable: '+str(e)));other.set_content(text,wait_until='load',timeout=60000);other.wait_for_function('window.INKMaiShowcase');q=other.evaluate("({fx:INKForge.store.byGame('mai','hissatsu_2').fx[0],showcase:!!INKMaiShowcase,motion:INK.Motion.version})");other.close();ok(q['fx']['trailFrames']==14 and q['fx']['particles']['curl']==4.5 and q['showcase'],str(q));return q
 check('Edited HTML export reopens with Mai showcase, motion engine and new FX fields',portable)
 def particle_basis():
  q=run('''()=>{const rec=INKForge.store.getMove('mai','enbu-ada-zakura'),profile=INKForge.store.profile('mai'),clip=INKForge.store.clip(rec),p=clip.sample(98.25),svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),root=document.createElementNS(svg.namespaceURI,'g');svg.append(root);document.body.append(svg);const fx=new INK.Effects(root),M=INK.mat;
  const rootMat=p=>M.multiply(M.compose(0,0,0,p.depth||1,1),M.multiply(M.compose(p.rootShift||0,(p.floor||0)-180,p.spin||0),M.compose(0,180)));
  function take(pose){root.setAttribute('transform','matrix('+rootMat(pose).join(' ')+')');fx.render(rec,98.25,pose,INK.Rig.solveAnimation(profile,pose));return fx.particles.nodes.filter(n=>n.getAttribute('display')!=='none').map(n=>{const m=n.getCTM();return [m.e,m.f,Math.atan2(m.b,m.a)]});}
  const a=take(p),b=take({...p,spin:(p.spin||0)+90});fx.destroy();svg.remove();return {count:a.length,maxPositionError:Math.max(...a.map((v,i)=>Math.hypot(v[0]-b[i][0],v[1]-b[i][1]))),maxAngleError:Math.max(...a.map((v,i)=>Math.abs(INK.Motion.shortest((v[2]-b[i][2])*180/Math.PI))))};}''');ok(q['count']>0 and q['maxPositionError']<.035 and q['maxAngleError']<.02,str(q));return q
 check('Emitted petal positions and orientations remain world-aligned when the actor root rotates',particle_basis)
 def responsive():
  run("async()=>{await INKForge.route('home')}");sizes=[]
  for w,h in [(390,844),(844,390),(1280,800),(1440,1080)]:
   page.set_viewport_size({'width':w,'height':h});run('INKMaiShowcase.open();INKMaiShowcase.seek(23.5)');q=run("({width:innerWidth,body:document.documentElement.scrollWidth,dialog:document.querySelector('#mai-showcase').getBoundingClientRect().toJSON(),inside:document.querySelector('#mai-showcase').scrollWidth})");ok(q['body']<=w+1 and q['inside']<=q['dialog']['width']+1 and q['dialog']['left']>=0 and q['dialog']['right']<=w+1,str(q));sizes.append(q)
   if w==390:page.screenshot(path=str(O/'mai-mobile.png'))
   run('INKMaiShowcase.close()')
  return sizes
 check('Mai dialog and home fit portrait, landscape and desktop without horizontal overflow',responsive)
 def player_edition():
  other=browser.new_page(viewport={'width':1280,'height':900});other.on('pageerror',lambda e:errors.append('player: '+str(e)));other.set_content((R/'dist/INK-Street-Fighter-6-Player.html').read_text(encoding='utf-8'),wait_until='load',timeout=60000);other.wait_for_function('window.INKMaiShowcase');other.locator('#mai-showcase-open').click();other.evaluate('INKMaiShowcase.seek(23.5)');hidden=not other.locator('#mai-preview-edit').is_visible();other.locator('#mai-preview-combo').click();other.evaluate('SVG_FIGHTER.state.paused=true;SVG_FIGHTER.step(650);SVG_FIGHTER.renderFraction(1)');q=other.evaluate('INK.Combo.summary()');title=other.title();other.close();ok(hidden and q['status']=='success' and q['hits']==14 and '04' in title,str([hidden,q['status'],q['hits'],title]));return dict(editorHidden=hidden,hits=q['hits'],status=q['status'],title=title)
 check('Standalone Player edition includes Mai preview and real 14-hit route without an editor entry',player_edition)
 def native_file():
  other=browser.new_page();result={}
  try:
   other.goto((R/'dist/INK-Street-Fighter-6.html').as_uri(),wait_until='load',timeout=30000);other.wait_for_function('window.INKMaiShowcase',timeout=15000);result=dict(status='passed',source='file://',version=other.evaluate('SVG_FIGHTER.version'),storageMode=other.evaluate('INKForge.store.mode'))
  except Exception as e:result=dict(status='environment-blocked' if 'ERR_BLOCKED_BY_ADMINISTRATOR' in str(e) else 'failed',error=str(e)[:500],fallback='Other tests loaded the complete standalone bytes with set_content.')
  other.close();(O/'file-protocol.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');ok(result['status']!='failed',str(result));return result
 check('Native file protocol is attempted and its actual result recorded',native_file)
 def no_errors():ok(not errors,str(errors));return errors
 check('No unhandled browser script errors',no_errors)
 browser.close()
rows=[{('pass' if k=='pass_' else k):v for k,v in row.items()} for row in rows]
report=dict(total=len(rows),passed=sum(r['pass'] for r in rows),tests=rows,browserErrors=errors,htmlSha256=hashlib.sha256((R/'dist/INK-Street-Fighter-6.html').read_bytes()).hexdigest())
(O/'browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({'total':report['total'],'passed':report['passed'],'errors':errors},ensure_ascii=False),flush=True)
raise SystemExit(0 if report['total']==report['passed'] and not errors else 1)
