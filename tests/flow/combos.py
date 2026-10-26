"""Real combat proof: all authored routes, mirrored directions, guard after first hit."""
from pathlib import Path
import os, shutil
from playwright.sync_api import sync_playwright
import json
R=Path(__file__).resolve().parents[2]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium') or shutil.which('google-chrome'),headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1080});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((R/'dist/INK-Street-Fighter-6.html').read_text(),wait_until='load',timeout=60000);page.wait_for_function('!!window.INKComboUI')
 out=page.evaluate('''() => {
 const C=INK.Combo,A=SVG_FIGHTER,rows=[];
 for(const route of C.routes.routes)for(const side of [1,-1]){
   C.start(route,'demo',{paused:true,side});const hp=A.fighters[1].hp;
   for(let t=0;t<900&&C.status==='running';t++)A.step(1);
   A.render();const row={...C.summary(),side,expected:route.expectedHits,hpLost:hp-A.fighters[1].hp,cheats:document.querySelector('#infinite').checked,guard:document.querySelector('#dummy').value};
   row.finiteSVG=!/NaN|Infinity/.test(document.querySelector('#game').outerHTML);
   row.valid=row.status==='success'&&row.hits===route.expectedHits&&row.hits===row.maxCombo&&row.hpLost===row.damage&&!row.cheats&&row.guard==='guard'&&row.remaining.drive>=0&&row.remaining.super>=0&&row.finiteSVG;
   rows.push(row);C.stop();
 }
 return rows;
}''')
 (R/'qa/flow/combo-validation.json').write_text(json.dumps({'scenarios':out,'browserErrors':errors},ensure_ascii=False,indent=2))
 for r in out: print(r['route'],r['side'],r['status'],r['hits'],r['damage'],r['remaining'],r['reason'])
 print('PASS',sum(r['valid'] for r in out),'/',len(out),'ERRORS',errors)
 assert all(r['valid'] for r in out) and not errors
 b.close()
