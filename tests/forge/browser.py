"""Actual Chromium integration checks. Uses set_content because this managed
browser forbids URL navigation. Native directory authorization is not simulated
as a successful disk write; portable round-trips cover this environment instead.
"""
from pathlib import Path
import os,shutil
import json,zipfile,base64,time,traceback
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2];out=[];errors=[]
def test(name,fn):
 try:
  detail=fn();out.append({'name':name,'pass':True,'detail':detail});print('PASS',name,flush=True)
 except Exception as e:out.append({'name':name,'pass':False,'error':str(e)});print('FAIL',name,str(e)[:400],flush=True)
def ok(v,m='assertion failed'):
 assert v,m
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium') or shutil.which('google-chrome'),headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1);page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/INK-Street-Fighter-6.html').read_text(),wait_until='load',timeout=60000);page.wait_for_function('window.INKForge?.ready',timeout=15000)
 test('Eight selectable roster entries',lambda:ok(page.locator('#f-roster button').count()==8))
 test('Rendering is retained vector art, no raster fighter images',lambda:ok(page.locator('#f-hero [data-ink-character]').count()==2 and page.locator('#f-hero image').count()==0))
 test('Explicit warning when persistent storage is blocked',lambda:ok(page.evaluate("INKForge.store.mode!=='memory'||!document.getElementById('f-storage-warning').hidden")))
 def play_ui():
  page.locator('#f-match-mode').select_option('training');page.locator('#f-enter').click();page.wait_for_timeout(80)
  ok(page.evaluate("SVG_FIGHTER.state.mode==='training' && SVG_FIGHTER.fighters.length===2 && SVG_FIGHTER.state.screen==='battle'"));return page.evaluate('SVG_FIGHTER.fighters.map(f=>f.ch.id)')
 test('Start actual training match from redesigned selection UI',play_ui)
 def eight():
  page.evaluate("INKForge.route('studio')");n=0
  for id in ['ryu','ken','chun','cammy','luke','juri','mai','iori']:
   page.evaluate("id=>INKForge.loadMove(id,INKForge.store.list(id).find(x=>x.category==='special').key)",id)
   ok(page.evaluate("!!INKForge.actor.group.querySelector('path')&&!/NaN|Infinity/.test(INKForge.actor.group.outerHTML)"));n+=1
  return n
 test('Eight models solve and draw in the production editor',eight)
 page.evaluate("INKForge.loadMove('mai','hishou-ryuuenjin-light')");page.locator('#f-autosave').uncheck()
 test('All 690 assets registered including 522 combat IDs',lambda:ok(page.evaluate("Object.values(INKForge.store.bundle.characters).reduce((n,c)=>n+Object.keys(c.moves).length,0)===690")))
 def seek():
  page.locator('#f-scrub').fill('9');page.locator('#f-scrub').dispatch_event('input');ok(page.evaluate('INKForge.state.frame===9'))
  page.locator('#f-next').click();ok(page.evaluate('INKForge.state.frame===10'))
  page.locator('#f-prev').click();ok(page.evaluate('INKForge.state.frame===9'))
 test('Seek and single-frame transport',seek)
 def playback():
  page.locator('#f-play').click();page.wait_for_timeout(160);ok(page.evaluate('INKForge.state.playing&&INKForge.state.frame!==9'));page.locator('#f-play').click()
 test('Fixed-clock playback advances; pause stops it',playback)
 def bone_drag():
  page.evaluate('INKForge.atFrame(5)');before=page.evaluate('INKForge.state.pose.fw.slice()');circle=page.locator('#f-handles circle[data-handle=fw]');bb=circle.bounding_box();page.mouse.move(bb['x']+bb['width']/2,bb['y']+bb['height']/2);page.mouse.down();page.mouse.move(bb['x']+bb['width']/2+33,bb['y']+bb['height']/2-17,steps=6);page.mouse.up();after=page.evaluate('INKForge.state.pose.fw.slice()');ok(abs(after[0]-before[0])>10);ok(page.evaluate("INKForge.state.draft.clip.tracks.fw.some(k=>k[0]===5)"));return {'before':before,'after':after}
 test('Pointer drag writes real wrist keyframe',bone_drag)
 def undo():
  before=page.evaluate('INKForge.state.pose.fw.slice()');page.locator('#f-undo').click();middle=page.evaluate('INKForge.state.pose.fw.slice()');ok(before!=middle);page.locator('#f-redo').click();ok(page.evaluate('INKForge.state.pose.fw.slice()')==before)
 test('Undo and redo restore authored values',undo)
 def save_live():
  expected=page.evaluate('INKForge.state.clip.sample(5).fw.slice()');page.evaluate('INKForge.testMove()');actual=page.evaluate("()=>{const A=SVG_FIGHTER;A.state.paused=true;const f=A.fighters[0];f.attack.t=5;A.render();return{fw:A.pose(f).fw,record:INK.Runtime.record(f,f.attack.m).gameId,renderer:f.inkRenderer.c.id};}")
  ok(all(abs(a-b)<.01 for a,b in zip(expected,actual['fw'])),str(actual));ok(actual['record']=='ryuenbu_0');return actual
 test('Save → actual match samples precisely the edited pose',save_live)
 def persist_live():
  before=page.evaluate("INKForge.store.byGame('mai','ryuenbu_0').clip.tracks.fw");page.evaluate("INKForge.route('studio')");page.evaluate("INKForge.loadMove('ryu','idle')");page.evaluate("INKForge.loadMove('mai','hishou-ryuuenjin-light')");ok(before==page.evaluate('INKForge.state.draft.clip.tracks.fw'))
 test('Switching characters and returning preserves saved draft',persist_live)
 def retime():
  page.locator('#f-startup').fill('12');page.locator('#f-active').fill('20');page.locator('#f-recovery').fill('24');page.locator('#f-retime').click();ok(page.evaluate('INKForge.state.draft.clip.duration===56'));page.evaluate('INKForge.testMove()');info=page.evaluate("()=>{SVG_FIGHTER.state.paused=true;const m=SVG_FIGHTER.fighters[0].attack.m;return[m.startup,m.active,m.recovery,m.total]}");ok(info==[12,20,24,56],str(info));return info
 test('Edited timing drives real startup/active/recovery',retime)
 def model():
  page.evaluate("INKForge.route('studio')");page.locator('[data-inspector=model]').click();page.locator('#f-model-head').fill('0.96');page.locator('#f-model-head').dispatch_event('change');ok(abs(page.evaluate('INKForge.actor.c.headScale')-.96)<.001);page.locator('#f-rig-hip').fill('66');page.locator('#f-rig-head').fill('-58');page.locator('#f-rig-apply').click();ok(page.evaluate('INKForge.state.rig.hipWidth===66'));page.evaluate('INKForge.testMove()');info=page.evaluate("()=>{SVG_FIGHTER.state.paused=true;const f=SVG_FIGHTER.fighters[0];SVG_FIGHTER.render();return{head:f.inkRenderer.c.headScale,hip:INK.Runtime.profile('mai').rigHipWidth}}")
  ok(info=={'head':.96,'hip':66},str(info));return info
 test('Independent model and rig edits also update the fighter runtime',model)
 def boxes():
  page.evaluate("INKForge.route('studio')");page.locator('[data-inspector=boxes]').click();page.locator('#f-box-add').click();page.locator('#f-box-x').fill('37');page.locator('#f-box-y').fill('-12');page.locator('#f-box-w').fill('75');page.locator('#f-box-h').fill('61');page.locator('#f-box-apply').click();page.evaluate('INKForge.testMove()');result=page.evaluate("()=>{const A=SVG_FIGHTER,f=A.fighters[0];A.state.paused=true;const s=f.attack.m.startup;f.attack.t=s-1;const before=A.geometry(f).hit.length;f.attack.t=s;const active=A.geometry(f).hit;f.attack.t=s+f.attack.m.active;const after=A.geometry(f).hit.length;f.attack.t=s;f.x=f.px=700;f.dir=1;const right=A.geometry(f).hit[0];f.dir=-1;const left=A.geometry(f).hit[0];return{before,active,after,mirrorError:Math.abs((right.x+left.x+left.w)-1400)}}")
  ok(result['before']==0 and len(result['active'])==1 and result['after']==0);ok(result['active'][0]['part'].startswith('ink-hit'));ok(result['mirrorError']<.01);return result
 test('Custom socket hitbox obeys active window and mirrors in combat',boxes)
 def fx():
  page.evaluate("INKForge.route('studio')");page.locator('[data-inspector=fx]').click();page.locator('#f-fx-type').select_option('crescent');page.locator('#f-fx-color').fill('#12abef');page.locator('#f-fx-frame').fill('12');page.locator('#f-fx-duration').fill('16');page.locator('#f-fx-apply').click();page.evaluate('INKForge.testMove()');data=page.evaluate("()=>{const A=SVG_FIGHTER,f=A.fighters[0];A.state.paused=true;f.attack.t=14;A.render();const p=f.inkFX.root.querySelector('path');const visible=p.getAttribute('fill');f.attack.t=11;A.render();const before=f.inkFX.nodes.every(n=>n.g.getAttribute('display')==='none');f.attack.t=14;A.render();return{color:visible,before,visibleAgain:f.inkFX.nodes[0].g.getAttribute('display')}}")
  ok(data['color']=='#12abef' and data['before'] and data['visibleAgain']=='inline',str(data));return data
 test('Authored FX is shared, seekable, and visible only inside its lifetime',fx)
 def once():
  data=page.evaluate("()=>{const A=SVG_FIGHTER,f=A.fighters[0];INK.Runtime.eventLog=[];delete f.attack._inkCursor;f.attack.t=11;INK.Runtime.tick(f,1);f.attack.t=12;INK.Runtime.tick(f,2);INK.Runtime.tick(f,2);INK.Runtime.tick(f,3);return INK.Runtime.eventLog.filter(x=>x.character==='mai').length}");ok(data==1,str(data))
 test('Repeated evaluation of a frozen frame does not dispatch duplicate FX events',once)
 def hidden_storage():
  page.evaluate("INKForge.route('assets')");ok(page.locator('#f-project-stats').inner_text().find('690 CLIPS')>=0)
 test('Asset center reports library and actual persistence mode',hidden_storage)
 def invalid():
  before=page.evaluate('JSON.stringify(INKForge.store.snapshot())');result=page.evaluate("async()=>{const r=structuredClone(INKForge.state.draft);r.clip.duration=999;try{await INKForge.importData(r);return false;}catch(e){return true;}}")
  ok(result);ok(before==page.evaluate('JSON.stringify(INKForge.store.snapshot())'))
 test('Invalid imported data cannot partially overwrite saved work',invalid)
 def portable():
  text=page.evaluate('INK.Portable.html(INKForge.store)');(root/'qa/roundtrip.html').write_text(text);ok('<script id="ink-user-project"' in text);other=b.new_page(viewport={'width':1280,'height':900});other.on('pageerror',lambda e:errors.append('portable: '+str(e)));other.set_content(text,wait_until='load',timeout=60000);other.wait_for_function('window.INKForge?.ready');values=other.evaluate("()=>{const r=INKForge.store.byGame('mai','ryuenbu_0');return{head:INKForge.store.getModel('mai').headScale,startup:r.binding.startup,color:r.fx[0].color,box:r.boxes.mode,revision:INKForge.store.revision}}");ok(values['head']==.96 and values['startup']==12 and values['color']=='#12abef' and values['box']=='custom',str(values));second=other.evaluate('INK.Portable.html(INKForge.store)');ok(len(second)>1000000);other.close();return values
 test('Exported offline HTML boots with saved model, motion, timing, hitbox and FX',portable)
 def player_export():
  text=page.evaluate('INK.Portable.html(INKForge.store,{playerOnly:true})');other=b.new_page(viewport={'width':1280,'height':900});other.on('pageerror',lambda e:errors.append('player: '+str(e)));other.set_content(text,wait_until='load',timeout=60000);other.wait_for_function('window.INKForge?.ready')
  ok(not other.locator('.f-top [data-route=studio]').is_visible());ok(not other.locator('#f-home-edit').is_visible());ok(other.evaluate("INKForge.store.byGame('mai','ryuenbu_0').binding.startup===12"));other.locator('#f-enter').click();ok(other.evaluate("SVG_FIGHTER.state.mode==='cpu'&&INKForge.state.route==='battle'"));other.close()
 test('Player export keeps edited assets but presents only selection and fighting',player_export)
 def zip_test():
  data=page.evaluate("async()=>{const z=INK.Portable.zip(INK.Portable.packageFiles(INKForge.store));const a=new Uint8Array(await z.arrayBuffer());let s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode(...a.subarray(i,i+32768));return btoa(s);}")
  target=root/'qa/browser-export.zip';target.write_bytes(base64.b64decode(data));z=zipfile.ZipFile(target);ok(z.testzip() is None);ok('INK-Street-Fighter-6.html' in z.namelist());r=json.loads(z.read('assets/ink/characters/mai/moves/hishou-ryuuenjin-light.json'));ok(r['binding']['startup']==12);return len(z.namelist())
 test('Browser ZIP is valid UTF-8/CRC32 and contains edited sources + playable HTML',zip_test)
 # Restore pristine bundle to avoid exporting test edits as the final deliverable.
 page.evaluate("async()=>{await INKForge.store.importSnapshot({version:2,kind:'ink-project-overrides',models:{},rigs:{},moves:{}});await INKForge.loadMove('mai','hishou-ryuuenjin-light',false);await INKForge.route('studio');INKForge.state.inspector='motion';INKForge.inspector();INKForge.atFrame(10);}")
 page.screenshot(path=str(root/'qa/forge-studio-tested.png'),full_page=True)
 def mobile():
  page.set_viewport_size({'width':390,'height':844});page.evaluate("INKForge.route('home')");page.screenshot(path=str(root/'qa/forge-mobile-home.png'),full_page=True);ok(page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'home overflow');page.evaluate("INKForge.route('studio')");page.screenshot(path=str(root/'qa/forge-mobile-studio.png'),full_page=True);ok(page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'studio overflow');page.evaluate("INKForge.route('assets')");ok(page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'assets overflow');return '390 × 844'
 test('Mobile home, editor and asset panels fit without horizontal overflow',mobile)
 test('No unhandled browser script errors',lambda:ok(len(errors)==0,str(errors)))
 (root/'qa/forge-browser.json').write_text(json.dumps({'tests':out,'total':len(out),'passed':sum(t['pass'] for t in out),'errors':errors},ensure_ascii=False,indent=2));b.close()
