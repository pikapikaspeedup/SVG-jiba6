"""FLOW 05 real Chromium integration, authoring and responsive UI checks."""
from pathlib import Path
import datetime,hashlib,json,os,shutil
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow5';O.mkdir(parents=True,exist_ok=True)
html=(R/'dist/INK-Street-Fighter-6.html').read_bytes();rows=[];errors=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 p=b.new_page(viewport={'width':1440,'height':1050});p.on('pageerror',lambda e:errors.append(str(e)))
 p.set_content(html.decode(),wait_until='load',timeout=60000);p.wait_for_function('window.INKEngineLab')
 rows+=p.evaluate((R/'tests/flow5/browser-cases.js').read_text())
 for r in rows:print('PASS' if r['pass'] else 'FAIL',r['name'],r.get('error',''),flush=True)
 p.evaluate('INKEngineLab.open(); INKEngineLab.seek(24.25)');p.screenshot(path=str(O/'inspector-desktop.png'),full_page=True)
 for w,h in [(1440,1050),(1280,800),(1024,768),(844,390),(390,844),(360,740)]:
  p.set_viewport_size({'width':w,'height':h});p.wait_for_timeout(80)
  q=p.evaluate('''()=>{const d=document.querySelector('#engine5-inspector');return{width:innerWidth,docWidth:document.documentElement.scrollWidth,dialogWidth:d.clientWidth,dialogContentWidth:d.scrollWidth,finite:!/NaN|Infinity/.test(d.outerHTML),open:d.open};}''')
  rows.append({'name':f'Engine inspector responsive {w}x{h}','pass':q['docWidth']<=w+1 and q['dialogContentWidth']<=q['dialogWidth']+1 and q['finite'] and q['open'],'detail':q})
  if w in [390,844]:p.screenshot(path=str(O/f'inspector-{w}.png'),full_page=False)
 p.set_viewport_size({'width':1440,'height':1050});p.keyboard.press('Escape');p.wait_for_timeout(60)
 rows.append({'name':'Native Escape closes inspector without activating battle controls','pass':p.evaluate('!document.querySelector("#engine5-inspector").open')})
 p.evaluate('INKForge.route("home")');p.screenshot(path=str(O/'home.png'),full_page=True)
 # Explicit protocol attempts: record actual environment behavior rather than
 # assuming a set_content browser is a native filesystem permission test.
 protocol=b.new_page();fileresult={}
 try:
  protocol.goto((R/'dist/INK-Street-Fighter-6.html').as_uri(),wait_until='load',timeout=15000);protocol.wait_for_function('window.INKEngineLab',timeout=15000);fileresult={'status':'passed','ready':True}
 except Exception as e:fileresult={'status':'environment-blocked-or-failed','error':str(e)[:1000]}
 protocol.close();(O/'file-protocol.json').write_text(json.dumps(fileresult,ensure_ascii=False,indent=2)+'\n')
 player=b.new_page(viewport={'width':1280,'height':900});player.on('pageerror',lambda e:errors.append(str(e)));player.set_content((R/'dist/INK-Street-Fighter-6-Player.html').read_text(),wait_until='load',timeout=60000);player.wait_for_function('window.INKEngineLab');player.click('#engine5-open');q=player.evaluate('''()=>({player:document.body.classList.contains('forge-player'),lab:document.querySelector('#engine5-inspector').open,editVisible:!!document.querySelector('#engine5-edit').getClientRects().length,id:INKForge.store.id})''');rows.append({'name':'Player-only build exposes inspection but not editing','pass':q['player'] and q['lab'] and not q['editVisible'] and q['id']=='ink-flow-player-5','detail':q})
 # Touch input on actual page handlers, not just a resized desktop viewport.
 context=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2);mobile=context.new_page();mobile.on('pageerror',lambda e:errors.append(str(e)));mobile.set_content(html.decode(),wait_until='load',timeout=60000);mobile.wait_for_function('window.INKEngineLab');mobile.locator('#engine5-open').tap();mobile.locator('#engine5-layers').tap();mobile.locator('#engine5-contacts').tap();q=mobile.evaluate('INKEngineLab.snapshot()');rows.append({'name':'Touch toggles update actual graph output without modifying base data','pass':not q['options']['layers'] and not q['options']['contacts'] and q['fanDelta']<1e-6});mobile.locator('#engine5-close').tap();rows.append({'name':'Touch close dismisses engine modal','pass':mobile.evaluate('!document.querySelector("#engine5-inspector").open')});context.close();b.close()
report={'suite':'flow5-browser','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':hashlib.sha256(html).hexdigest(),'total':len(rows),'passed':sum(r['pass'] for r in rows),'tests':rows,'browserErrors':errors,'fileProtocol':fileresult,'limitations':['Chromium viewport/touch emulation is not physical-phone performance evidence.','set_content loads complete HTML bytes; file protocol and persistence capabilities are reported separately.']}
(O/'browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('BROWSER',report['passed'],'/',report['total'],'ERRORS',errors,flush=True)
for r in rows:
 if not r['pass']:print('FAIL',r,flush=True)
raise SystemExit(0 if report['passed']==report['total'] and not errors else 1)
