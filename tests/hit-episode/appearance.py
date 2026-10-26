from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
import base64
R=Path(__file__).resolve().parents[2];O=R/'qa/hit-episode';h=(R/'dist/INK-Street-Fighter-6.html').read_bytes();sha=hashlib.sha256(h).hexdigest();rows=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page(viewport={'width':1440,'height':1000});p.set_content(h.decode());p.wait_for_function('window.INKDuel?.ready');p.locator('.kinetic-launch button').click()
 for target,move,attack in [('cammy','sMP',False),('luke','cMK',False),('ryu','sMP',True)]:
  info=p.evaluate('''([target,move,attack])=>{const A=SVG_FIGHTER,G=A.state;A.start('ryu',target,'training','classic',42);G.paused=false;document.getElementById('dummy').value='idle';document.getElementById('autohp').checked=false;A.teleport(0,560);A.teleport(1,710);if(attack)A.tryMove(1,'sHP');A.tryMove(0,move);const f=A.fighters[1];for(let i=0;i<60&&!f._inkHitEpisode;i++)A.step();G.paused=true;window.hitBirth=f._inkVisualClock;A.renderFraction(1);return {born:hitBirth,state:f.state,zone:f._inkHitEpisode?.contacts.at(-1).zone};}''',[target,move,attack]);frames=[]
  for age in [0,5,10]:
   data=p.evaluate('''age=>{const A=SVG_FIGHTER,f=A.fighters[1];for(let i=0;i<100&&f._inkVisualClock-hitBirth<age;i++)A.step();A.renderFraction(1);return {age:f._inkVisualClock-hitBirth,state:f.state,owns:INK.HitEpisode.owns(f)};}''',age);path=O/f'{target}-{age}.png';p.locator('#game').screenshot(path=str(path));frames.append(base64.b64encode(path.read_bytes()).decode());info.setdefault('frames',[]).append(data)
  sheet=b.new_page(viewport={'width':1920,'height':405});sheet.set_content('<body style="margin:0;background:#181c22;color:white;font:12px sans-serif"><div style="height:25px">'+f'{target} {move} | SHA {sha[:16]}'+'</div><div style="display:flex">'+''.join('<div style="width:640px">action age '+str(info['frames'][i]['age'])+'<img style="width:640px;display:block" src="data:image/png;base64,'+data+'"></div>' for i,data in enumerate(frames))+'</div></body>');sheet.screenshot(path=str(O/f'{target}-sheet.png'));sheet.close();rows.append({'target':target,'move':move,**info})

 b.close()
(O/'appearance.json').write_text(json.dumps({'sha256':sha,'rows':rows},indent=2)+'\n');print(rows)
