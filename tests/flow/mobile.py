"""Responsive lab + real Chromium mobile touch events. Not physical-device fps."""
from pathlib import Path
import os, shutil
from playwright.sync_api import sync_playwright
import json
R=Path(__file__).resolve().parents[2];rows=[];errors=[]
def check(name,fn):
 try:detail=fn();rows.append({'name':name,'pass':True,'detail':detail});print('PASS',name)
 except Exception as e:rows.append({'name':name,'pass':False,'error':str(e)});print('FAIL',name,str(e))
def ok(v,msg='assertion failed'):assert v,msg
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium') or shutil.which('google-chrome'),headless=True,args=['--no-sandbox']);ctx=b.new_context(viewport={'width':844,'height':390},is_mobile=True,has_touch=True,device_scale_factor=1);pg=ctx.new_page();pg.on('pageerror',lambda e:errors.append(str(e)));pg.set_content((R/'dist/INK-Street-Fighter-6.html').read_text(),wait_until='load',timeout=60000);pg.wait_for_function('!!window.INKComboUI')
 pg.locator('#flow-open').tap();pg.evaluate('SVG_FIGHTER.state.paused=true;SVG_FIGHTER.step(100);SVG_FIGHTER.render();INKComboUI.draw()')
 def fit():
  q=pg.evaluate("()=>({w:innerWidth,scroll:document.documentElement.scrollWidth,items:['#joystick','.touch-buttons [data-btn=LP]','#flow-mobile-exit','#flow-mobile-pause'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return{s,x:r.x,y:r.y,w:r.width,h:r.height,visible:r.width>0&&r.height>0&&r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1}})})")
  ok(q['scroll']<=q['w']+1 and all(r['visible'] for r in q['items']),str(q));return q
 check('844×390 landscape: joystick, attack, exit and pause accessible',fit);pg.screenshot(path=str(R/'qa/flow/mobile-landscape.png'))
 def routes():
  pg.locator('#flow-mobile-route').tap();pg.wait_for_timeout(500);r=pg.locator('#flow-route').bounding_box();ok(r and r['y']>=0 and r['y']<390,str(r));return r
 check('Route selector can be reached from fullscreen landscape arena',routes)
 def practice():
  pg.evaluate("INKComboUI.run('practice',true)");pg.evaluate('INKComboUI.draw()');pg.locator('#flow-mobile-arena').tap();pg.wait_for_timeout(350);pg.evaluate('SVG_FIGHTER.state.paused=false');pg.locator('#flow-mobile-act').tap();pg.evaluate('SVG_FIGHTER.state.paused=true');q=pg.evaluate('INK.Combo.summary()');ok(q['cursor']==1 and q['actions'][0]['move']=='sHP',str(q));return q['actions'][0]
 check('Actual touchscreen tap requests first rhythm move without forced state',practice)
 def release():
  held=pg.evaluate('[...SVG_FIGHTER.fighters[0].input.held]');ok(held==[],str(held));return held
 check('Rhythm tap does not leave direction or attack inputs held',release)
 def exit():
  pg.locator('#flow-mobile-exit').tap();ok(pg.evaluate("!INKComboUI.open&&INK.Combo.status==='idle'&&INKForge.state.route==='home'"));ok(pg.locator('.f-top').is_visible())
 check('Exit leaves lab and restores normal navigation',exit)
 def portrait():
  pg.set_viewport_size({'width':390,'height':844});pg.locator('#flow-home-demo').tap();pg.evaluate('SVG_FIGHTER.state.paused=true;SVG_FIGHTER.step(135);SVG_FIGHTER.render();INKComboUI.draw()');ok(pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));pg.screenshot(path=str(R/'qa/flow/mobile-portrait.png'),full_page=True);return pg.evaluate('({width:innerWidth,documentWidth:document.documentElement.scrollWidth})')
 check('390px portrait lab has no horizontal overflow',portrait)
 check('No browser script errors',lambda:ok(not errors,str(errors)))
 b.close()
(R/'qa/flow/mobile-tests.json').write_text(json.dumps({'total':len(rows),'passed':sum(r['pass'] for r in rows),'tests':rows,'errors':errors},ensure_ascii=False,indent=2))
if any(not r['pass'] for r in rows):raise SystemExit(1)
