from pathlib import Path
import base64,hashlib,json
from playwright.sync_api import sync_playwright
root=Path.cwd();raw=(root/'dist/INK-Street-Fighter-6.html').read_bytes();out=root/'qa/hit-rule';errors=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/Users/miaomiaomiao/Library/Caches/ms-playwright/chromium-1169/chrome-mac/Chromium.app/Contents/MacOS/Chromium',headless=True)
 p=b.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(raw.decode());p.wait_for_function('window.INKDuel?.ready');p.locator('.kinetic-launch button').click()
 rows=p.evaluate('''()=>{const A=SVG_FIGHTER,G=A.state,out=[];for(const move of ['sHP','cMK'])for(const id of ['ryu','ken','chun','cammy','luke','juri','mai','iori']){A.start(id,'ken','training','classic',42);G.paused=true;document.getElementById('dummy').value='idle';document.getElementById('autohp').checked=false;A.teleport(0,450);A.teleport(1,650);A.step(12);const f=A.fighters[0];A.tryMove(1,move);let first=null;for(let i=0;i<80;i++){A.step();if(INK.HitRule.owns(f)){first??=f._inkVisualClock;if(f._inkVisualClock-first>=6)break;}}const q=INK.HitRule.sample(f);A.render();out.push({id,move,age:q.time-f._inkHitRule.born,hurtID:f._inkHitRule.lastContact.hurtID,svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="210 230 500 500"><defs>'+document.querySelector('#game defs').innerHTML+'</defs><g transform="translate('+(450-f.x)+' 0)">'+f.root.outerHTML+'</g></svg>'});}return out;}''')
 sheet=b.new_page(viewport={'width':1280,'height':850})
 for move,title in [('sHP','胸部中拳 · 受力后第 6 行动帧'),('cMK','前腿中扫 · 受力后第 6 行动帧')]:
  cells=''.join('<article><img src="data:image/svg+xml;base64,'+base64.b64encode(r['svg'].encode()).decode()+'"><p>'+r['id']+' · '+r['hurtID']+'</p></article>' for r in rows if r['move']==move)
  sheet.set_content('<style>body{margin:20px;background:#eae6dd;color:#292c32;font:14px sans-serif}h1{font-size:23px;font-weight:500}main{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}article{background:#f8f6f0;border-radius:8px}img{display:block;width:100%;height:320px}p{text-align:center;margin:0 0 12px}</style><h1>'+title+'</h1><main>'+cells+'</main>');sheet.locator('img').evaluate_all('(is)=>Promise.all(is.map(i=>i.decode()))');sheet.screenshot(path=str(out/(move+'.png')),full_page=True)
 b.close()
report={'htmlSha256':hashlib.sha256(raw).hexdigest(),'errors':errors,'rows':[{k:v for k,v in r.items() if k!='svg'} for r in rows]};(out/'plates.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');assert not errors;print(json.dumps(report,ensure_ascii=False))
