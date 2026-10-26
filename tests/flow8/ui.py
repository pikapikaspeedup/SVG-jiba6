"""Pointer/keyboard/touch simulation, actual JSON download/upload, responsive layout.
Not a true mobile-device FPS or native directory-picker test.
"""
from pathlib import Path
import json,shutil,hashlib,datetime,tempfile
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow8';data=(R/'dist/INK-Street-Fighter-6.html').read_bytes();rows=[];errors=[]
def check(name,ok,detail=None):
 rows.append(dict(name=name,pass_=bool(ok),detail=detail)); print('PASS' if ok else 'FAIL',name,detail if not ok else '',flush=True)
with sync_playwright() as pw, tempfile.TemporaryDirectory(prefix='flow8-ui-') as temp:
 b=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 for width,height,touch in [(1440,1080,False),(390,844,True)]:
  p=b.new_page(viewport={'width':width,'height':height},is_mobile=touch,has_touch=touch);p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(data.decode(),wait_until='load',timeout=60000);p.wait_for_function('window.INKResponseLab?.ready');p.screenshot(path=str(O/f'home-{width}.png'))
  p.locator('#r8-open').click();p.wait_for_function('document.querySelector("#r8-dialog").open && INK.Replay.frames.length>100');p.locator('#r8-next').click();check(f'{width}: click next frame',p.evaluate('INKResponseLab.index')==1)
  p.locator('#r8-next').focus();p.keyboard.press('Shift+ArrowRight');check(f'{width}: keyboard ten-frame step',p.evaluate('INKResponseLab.index')==11)
  p.locator('#r8-event-next').click();check(f'{width}: seek actual state bookmark',p.evaluate('INK.Replay.events.some(e=>e.tick===INK.Replay.frames[Math.floor(INKResponseLab.index)].tick)'))
  p.locator('#r8-bones').check();p.locator('#r8-bones').uncheck();p.evaluate('INKResponseLab.seek(55.5)');p.screenshot(path=str(O/f'review-{width}.png'))
  q=p.evaluate('''()=>{const d=document.querySelector('#r8-dialog'),r=d.getBoundingClientRect();return{vw:innerWidth,body:document.documentElement.scrollWidth,dialog:d.scrollWidth,client:d.clientWidth,left:r.left,right:r.right};}''');check(f'{width}: dialog fits viewport without horizontal scroll',q['dialog']<=q['client']+2 and q['left']>=-1 and q['right']<=q['vw']+1,q)
  p.locator('#r8-scenario').select_option('knockdown');p.locator('#r8-run').click();p.wait_for_function('INK.Replay.frames.length===176');check(f'{width}: real sweep records down and rise',p.evaluate('INK.Replay.frames.some(f=>f.actors[1].state==="down") && INK.Replay.frames.some(f=>f.actors[1].state==="rise")'))
  with p.expect_download() as download:p.locator('#r8-export').click()
  path=Path(temp)/f'pose-{width}.json';download.value.save_as(path);replay=json.loads(path.read_text());check(f'{width}: actual download contains solved angles',replay['kind']=='ink-pose-replay' and 'angles' in replay['frames'][0]['actors'][0])
  p.locator('#r8-file').set_input_files(path);p.wait_for_function('document.querySelector("#r8-note").textContent.includes("已载入")');check(f'{width}: actual file upload reopens frame zero',p.evaluate('INKResponseLab.index===0 && INK.Replay.frames.length===176'))
  if width==1440:(O/'sample-knockdown-replay.json').write_text(json.dumps(replay,ensure_ascii=False,separators=(',',':')))
  p.locator('#r8-close').click();check(f'{width}: review closes and fresh scenario remains paused',p.evaluate('!document.querySelector("#r8-dialog").open && SVG_FIGHTER.state.paused'))
  p.evaluate('SVG_FIGHTER.state.paused=false');p.locator('#r8-record').click();p.wait_for_timeout(120);p.locator('#r8-record').click();p.wait_for_function('document.querySelector("#r8-dialog").open');tick=p.evaluate('SVG_FIGHTER.state.tick');p.wait_for_timeout(100);check(f'{width}: opening real recording pauses the combat clock',p.evaluate('SVG_FIGHTER.state.tick')==tick)
  p.keyboard.press('Escape');check(f'{width}: Escape restores prior running state',p.evaluate('!document.querySelector("#r8-dialog").open && !SVG_FIGHTER.state.paused'))
  p.close()
 b.close()
report=dict(suite='flow8-review-ui',capturedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),htmlSha256=hashlib.sha256(data).hexdigest(),passed=sum(r['pass_'] for r in rows),total=len(rows),tests=rows,browserErrors=errors,scope='Desktop and emulated 390px touch viewport. Not a native phone.')
(O/'ui.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(report['passed'],report['total'],errors);raise SystemExit(0 if not errors and report['passed']==report['total'] else 1)
