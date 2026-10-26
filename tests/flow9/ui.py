from pathlib import Path
import json,shutil,datetime,hashlib,tempfile
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow9';data=(R/'dist/INK-Street-Fighter-6.html').read_bytes();rows=[];errors=[]
def check(name,ok,detail=None):
 rows.append({'name':name,'pass':bool(ok),'detail':detail});print('PASS' if ok else 'FAIL',name,detail if not ok else '',flush=True)
with sync_playwright() as pw,tempfile.TemporaryDirectory(prefix='flow9-ui-') as temp:
 b=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 for width,height,touch in [(1440,1040,False),(390,844,True)]:
  p=b.new_page(viewport={'width':width,'height':height},is_mobile=touch,has_touch=touch);p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(data.decode(),wait_until='load',timeout=60000);p.wait_for_function('window.INKFluidLab?.ready');p.screenshot(path=str(O/f'home-{width}.png'))
  check(f'{width}: current branding and isolated v9 store',p.evaluate("document.querySelector('.f-brand i').textContent==='09' && INKForge.store.id==='ink-flow-sf6-v9'"))
  p.locator('#f9-open').click();check(f'{width}: native keyboard modal opens',p.evaluate("document.querySelector('#f9-dialog').open && document.activeElement.id==='f9-close'"))
  p.locator('#f9-camera').select_option('follow');check(f'{width}: camera setting immediately applies',p.evaluate("INK.Viewport.settings.mode==='follow'"));p.locator('#f9-camera').select_option('stable')
  p.evaluate("()=>{SVG_FIGHTER.state.artCloseup=true;const b=document.getElementById('lab-close');b.textContent='特写 开';b.setAttribute('aria-pressed','true');INKFluidLab.paint();}")
  check(f'{width}: explicit close-up is labelled instead of claiming fixed stage',p.locator('#f9-fixed').inner_text().startswith('CLOSE-UP'))
  p.locator('#f9-camera').select_option('follow');p.locator('#f9-camera').select_option('stable');check(f'{width}: reselecting stable mode also clears the old close-up button',p.evaluate("!SVG_FIGHTER.state.artCloseup && document.getElementById('lab-close').getAttribute('aria-pressed')==='false' && document.getElementById('lab-close').textContent==='特写 关'"))
  p.locator('#f9-rhythm').select_option('weighted');check(f'{width}: old rhythm remains available',p.evaluate("INK.CombatFlow.settings.rhythm==='weighted' && document.querySelector('#r7-rhythm').value==='weighted'"));p.locator('#f9-rhythm').select_option('fluid')
  p.locator('#f9-speed').select_option('0.85');check(f'{width}: explicit slow speed synchronizes with workshop',p.evaluate("INK.CombatFlow.settings.speed===.85 && document.querySelector('#r7-speed').value==='0.85'"));p.locator('#f9-speed').select_option('1')
  p.locator('#f9-effects').select_option('clean');check(f'{width}: clean mode preserves bone settings',p.evaluate("INK.VFX.settings.quality===.55 && INK.VFX.settings.reducedMotion && INK.Presentation.settings.interpolate && INK.Articulation.settings.enabled"));p.locator('#f9-effects').select_option('full')
  q=p.evaluate("()=>{const d=document.querySelector('#f9-dialog'),r=d.getBoundingClientRect();return{vw:innerWidth,left:r.left,right:r.right,client:d.clientWidth,scroll:d.scrollWidth};}");check(f'{width}: modal has no horizontal overflow',q['left']>=-1 and q['right']<=q['vw']+1 and q['scroll']<=q['client']+2,q)
  p.locator('#f9-demo').click();p.wait_for_function("INK.Combo.status==='running'");p.wait_for_timeout(1500);p.locator('#f9-battle').click();tick=p.evaluate('SVG_FIGHTER.state.tick');p.wait_for_timeout(350);check(f'{width}: diagnostics observe, never pause battle',p.evaluate('SVG_FIGHTER.state.tick')>tick)
  p.evaluate('INKFluidLab.paint()');p.screenshot(path=str(O/f'diagnostics-{width}.png'));q=p.evaluate('INK.FrameProbe.inspect()');check(f'{width}: actual callbacks and CPU samples recorded',q['samples']>20 and q['intervalP95']>0 and q['cpuP95']>0,q)
  with p.expect_download() as event:p.locator('#f9-export').click()
  path=Path(temp)/f'diagnostic-{width}.json';event.value.save_as(path);diag=json.loads(path.read_text());check(f'{width}: downloaded diagnostics contain real time samples',diag['kind']=='ink-flow9-frame-diagnostic' and len(diag['frames'])>20 and diag['settings']['viewport']['mode']=='stable')
  p.locator('#f9-reset').click();check(f'{width}: clear diagnostics resets bounded ring',p.evaluate('INK.FrameProbe.frames().length')<10)
  p.keyboard.press('Escape');check(f'{width}: Escape closes modal',p.evaluate("!document.querySelector('#f9-dialog').open"));p.evaluate('SVG_FIGHTER.state.paused=true');p.close()
 b.close()
report={'suite':'flow9-settings-responsive-ui','utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':hashlib.sha256(data).hexdigest(),'passed':sum(x['pass'] for x in rows),'total':len(rows),'tests':rows,'browserErrors':errors,'scope':'Real pointer/keyboard/download; desktop and emulated touch viewport, not a physical phone.'};(O/'ui.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));raise SystemExit(0 if report['passed']==report['total'] and not errors else 1)
