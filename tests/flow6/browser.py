"""FLOW 06 production-geometry and interaction regression, real Chromium DOM."""
from pathlib import Path
import datetime,hashlib,json,os,shutil
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow6';html=(R/'dist/INK-Street-Fighter-6.html').read_bytes();rows=[];errors=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 p=b.new_page(viewport={'width':1440,'height':1000});p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode(),wait_until='load',timeout=60000);p.wait_for_function('window.INKContinuityLab')
 rows+=p.evaluate((R/'tests/flow6/browser-cases.js').read_text())
 for r in rows:print('PASS' if r['pass'] else 'FAIL',r['name'],r.get('error',''),flush=True)
 p.evaluate('INKContinuityLab.open();INKContinuityLab.seek(22.5)');p.screenshot(path=str(O/'anatomy-desktop.png'))
 for w,h in [(1440,1000),(1280,800),(1024,768),(844,390),(390,844),(360,740)]:
  p.set_viewport_size({'width':w,'height':h});p.wait_for_timeout(80);q=p.evaluate('''()=>{const d=document.querySelector('#continuity6-dialog');return {doc:document.documentElement.scrollWidth,viewport:innerWidth,dialog:d.clientWidth,content:d.scrollWidth,finite:!/NaN|Infinity/.test(d.outerHTML),open:d.open};}''');rows.append({'name':f'Continuity lab responsive {w}x{h}','pass':q['doc']<=w+1 and q['content']<=q['dialog']+1 and q['finite'] and q['open'],'detail':q})
  if w==390:p.screenshot(path=str(O/'anatomy-mobile.png'))
 p.keyboard.press('Escape');p.wait_for_timeout(50);rows.append({'name':'Escape closes continuity dialog','pass':p.evaluate('!document.querySelector("#continuity6-dialog").open')})
 p.set_viewport_size({'width':1440,'height':1000});p.evaluate('INKForge.route("home")');p.screenshot(path=str(O/'home.png'),full_page=True)
 ctx=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);t=ctx.new_page();t.on('pageerror',lambda e:errors.append(str(e)));t.set_content(html.decode(),wait_until='load',timeout=60000);t.wait_for_function('window.INKContinuityLab');t.locator('#continuity6-open').tap();t.locator('#continuity6-rig').tap();t.locator('#continuity6-mirror').tap();q=t.evaluate('({direction:INKContinuityLab.state.direction,mode:INKContinuityLab.renderer.mode,display:getComputedStyle(INKContinuityLab.renderer.debug).display})');rows.append({'name':'Touch controls update actual mirrored rig overlay','pass':q['direction']==-1 and q['mode']=='overlay' and q['display']!='none','detail':q});ctx.close()
 player=b.new_page(viewport={'width':1280,'height':900});player.on('pageerror',lambda e:errors.append(str(e)));player.set_content((R/'dist/INK-Street-Fighter-6-Player.html').read_text(),wait_until='load',timeout=60000);player.wait_for_function('window.INKContinuityLab');player.click('#continuity6-open');q=player.evaluate('({player:document.body.classList.contains("forge-player"),open:document.querySelector("#continuity6-dialog").open,id:INKForge.store.id})');rows.append({'name':'Player build retains continuity inspector in isolated v6 storage','pass':q['player'] and q['open'] and q['id']=='ink-flow-player-6','detail':q});b.close()
report={'suite':'flow6-browser','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':hashlib.sha256(html).hexdigest(),'total':len(rows),'passed':sum(r['pass'] for r in rows),'tests':rows,'browserErrors':errors}
(O/'anatomy-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('ANATOMY BROWSER',report['passed'],'/',report['total'],'ERRORS',errors,flush=True)
for r in rows:
 if not r['pass']:print('FAIL',r,flush=True)
raise SystemExit(0 if report['passed']==report['total'] and not errors else 1)
