"""Real Chromium CDP multi-touch checks, not programmatic inputPress shortcuts.
Native URL navigation is disabled in this managed browser; set_content is used.
"""
from pathlib import Path
import os,shutil
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[2]
results=[];errors=[]
def check(name,fn):
 try:
  detail=fn();results.append({'name':name,'pass':True,'detail':detail});print('PASS',name,flush=True)
 except Exception as e:results.append({'name':name,'pass':False,'error':str(e)});print('FAIL',name,str(e),flush=True)
def require(v,m='assertion failed'):
 assert v,m
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium') or shutil.which('google-chrome'),headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':844,'height':390},is_mobile=True,has_touch=True,device_scale_factor=1)
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((ROOT/'dist/INK-Street-Fighter-6.html').read_text(),wait_until='load',timeout=60000);page.wait_for_function('window.INKForge?.ready')
 page.evaluate("async()=>{await INKForge.route('battle');SVG_FIGHTER.start('mai','ryu','training','classic');SVG_FIGHTER.state.phase='fight';SVG_FIGHTER.state.paused=false;SVG_FIGHTER.experience.stage('forge');SVG_FIGHTER.fighters[0].x=360;SVG_FIGHTER.fighters[1].x=1050;window.focus();}")
 page.wait_for_timeout(100)
 session=context.new_cdp_session(page)
 def rect(selector):return page.locator(selector).bounding_box()
 def touch(kind,points):session.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[{'id':i,'x':x,'y':y,'radiusX':5,'radiusY':5,'force':1} for i,x,y in points]})
 def fit():
  values=page.evaluate("()=>{const sels=['#joystick','.touch-buttons [data-btn=LP]','.touch-buttons [data-btn=HK]','#back-btn'];return sels.map(s=>{const r=document.querySelector(s).getBoundingClientRect();return {s,x:r.x,y:r.y,w:r.width,h:r.height,visible:r.width>0&&r.height>0&&r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1}})}")
  require(all(x['visible'] for x in values),str(values));require(page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'horizontal overflow');return values
 check('Landscape controls, exit and arena stay within 844 × 390 viewport',fit)
 page.screenshot(path=str(ROOT/'qa/forge-mobile-battle-landscape.png'),full_page=False)
 def motion():
  # Hold a real touch on the joystick through down, down-forward, forward.
  j=rect('#joystick');cx=j['x']+j['width']/2;cy=j['y']+j['height']/2;d=j['width']*.30
  touch('touchStart',[(1,cx,cy+d)]);page.wait_for_timeout(20)
  touch('touchMove',[(1,cx+d,cy+d)]);page.wait_for_timeout(20)
  touch('touchMove',[(1,cx+d,cy)]);page.wait_for_timeout(20)
  a=rect('.touch-buttons [data-btn=LP]');ax=a['x']+a['width']/2;ay=a['y']+a['height']/2
  touch('touchStart',[(1,cx+d,cy),(2,ax,ay)]);page.wait_for_timeout(45)
  info=page.evaluate("()=>{const f=SVG_FIGHTER.fighters[0];return {move:f.attack?.m.id,held:[...f.input.held],dir:f.input.dir,history:f.input.dirs}}")
  touch('touchEnd',[])
  require(info['move']=='kachosen_0',str(info));return info
 check('Real two-finger 236 + LP fires Mai Kachousen in classic mode',motion)
 def release():
  page.wait_for_timeout(40);r=page.evaluate("()=>({held:[...SVG_FIGHTER.fighters[0].input.held],pressed:document.querySelectorAll('[data-btn].pressed').length,knob:document.getElementById('stick-knob').style.transform})");require(r['held']==[] and r['pressed']==0 and r['knob']=='',str(r));return r
 check('Touch release clears held directions, button state and joystick',release)
 def cancel():
  j=rect('#joystick');cx=j['x']+j['width']/2;cy=j['y']+j['height']/2;touch('touchStart',[(1,cx+j['width']*.3,cy)]);touch('touchCancel',[]);r=page.evaluate("()=>[...SVG_FIGHTER.fighters[0].input.held]");require(r==[],str(r))
 check('Pointer cancellation cannot leave the fighter walking',cancel)
 def exit():
  page.locator('#back-btn').tap();page.wait_for_timeout(30);require(page.evaluate("INKForge.state.route==='home'&&!document.body.classList.contains('forge-battle-active')"));require(page.locator('.f-top').is_visible())
 check('In-game exit restores ordinary navigation after landscape fullscreen layout',exit)
 def portrait():
  page.set_viewport_size({'width':390,'height':844});page.locator('#f-match-mode').select_option('training');page.locator('#f-enter').tap();page.wait_for_timeout(50);require(page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));page.screenshot(path=str(ROOT/'qa/forge-mobile-battle-portrait.png'),full_page=True)
 check('Portrait arena and touch panel fit the 390px layout',portrait)
 check('No browser script errors',lambda:require(not errors,str(errors)))
 browser.close()
(ROOT/'qa/forge-mobile.json').write_text(json.dumps({'total':len(results),'passed':sum(r['pass'] for r in results),'tests':results,'errors':errors},ensure_ascii=False,indent=2))
if any(not r['pass'] for r in results):raise SystemExit(1)
