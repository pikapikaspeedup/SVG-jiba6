"""Three eight-character sheets from the production renderer; no injected data."""
from pathlib import Path
import base64
import hashlib
import html
import json
import os
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'qa/shared-defense'
RAW = (ROOT / 'dist/INK-Street-Fighter-6.html').read_bytes()
SHA = hashlib.sha256(RAW).hexdigest()
errors = []
with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM', '/Users/miaomiaomiao/Library/Caches/ms-playwright/chromium-1169/chrome-mac/Chromium.app/Contents/MacOS/Chromium'), headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.set_content(RAW.decode())
    page.wait_for_function('window.INKDuel?.ready && INK.RuleBody && INK.DefenseData')
    page.locator('.kinetic-launch button').click()
    result = page.evaluate('''() => {
      const A=SVG_FIGHTER,G=A.state,rows=[],plates=[];
      for(const state of ['S','H','L'])for(const id of ['ryu','ken','chun','cammy','luke','juri','mai','iori']){
        A.start(id,'ryu','training','classic',42);G.paused=true;
        document.getElementById('dummy').value='idle';
        A.teleport(0,450);A.teleport(1,1150);A.step(45);
        if(state!=='S'){G.paused=false;A.press(0,'left');if(state==='L')A.press(0,'down');G.paused=true;}
        A.step(state==='H'?220:18);
        const f=A.fighters[0],geometry=A.geometry(f),pose=A.visualPose(f),frame=INK.VisualFrame.get(pose),body=INK.RuleBody.sample(f);
        const finite=value=>typeof value==='number'?Number.isFinite(value):Array.isArray(value)?value.every(finite):true;
        rows.push({id,state,kind:body?.kind,clock:f._inkVisualClock,owner:geometry.bodyModel?.owner,mode:frame?.mode,hurt:geometry.hurt.length,feet:frame?.worldFeet,frontLoad:INK.RuleBody.target(f).frontLoad,residuals:body?.model?.residuals,finite:!!frame&&Object.values(frame.joints3D).every(finite)&&frame.skinMatrices.every(finite)&&finite(frame.headMatrix)});
        A.render();
        plates.push({id,state,svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="220 235 480 490"><defs>'+document.querySelector('#game defs').innerHTML+'</defs>'+'<g transform="translate('+(450-f.x)+' 0)">'+f.root.outerHTML+'</g></svg>'});
        A.release(0,'left');A.release(0,'down');
      }return {rows,plates};
    }''')
    assert not errors, errors
    assert len(result['rows']) == 24
    for row in result['rows']:
        assert row['finite'] and row['hurt'] == 20 and row['owner'], row
        assert row['kind'] == {'S': 'stance', 'H': 'high', 'L': 'low'}[row['state']], row
    OUT.mkdir(parents=True, exist_ok=True)
    sheet = browser.new_page(viewport={'width': 1280, 'height': 850}, device_scale_factor=1)
    titles = {'S': '站姿', 'H': '高护架', 'L': '低护架'}
    images = []
    for state in titles:
        cells = ''.join('<article><img src="data:image/svg+xml;base64,' + base64.b64encode(row['svg'].encode()).decode() + '"><p>' + html.escape(row['id']) + '</p></article>' for row in result['plates'] if row['state'] == state)
        sheet.set_content('<style>body{margin:20px;background:#eae6dd;color:#292c32;font:16px sans-serif}h1{font-size:23px;font-weight:500}main{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}article{background:#f8f6f0;border-radius:8px}img{display:block;width:100%;height:320px}p{text-align:center;margin:0 0 12px}</style><h1>' + titles[state] + '</h1><main>' + cells + '</main>')
        sheet.locator('img').evaluate_all('(images)=>Promise.all(images.map(i=>i.decode()))')
        name = 'checkpoint-' + state + '.png'
        sheet.screenshot(path=str(OUT / name), full_page=True)
        images.append({'file': name, 'sha256': hashlib.sha256((OUT / name).read_bytes()).hexdigest()})
    browser.close()
report = {'htmlSha256': SHA, 'scope': '24 settled S/H/L production-renderer poses; not transient movement or combat coverage', 'rows': result['rows'], 'images': images, 'errors': errors}
(OUT / 'checkpoint.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'htmlSha256': SHA, 'poses': len(report['rows']), 'images': images, 'errors': errors}))
