from pathlib import Path
import os,shutil
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium') or shutil.which('google-chrome'),headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1024});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/INK-Street-Fighter-6.html').read_text(),wait_until='load',timeout=60000);page.wait_for_function('window.INKForge?.ready')
 rows=page.evaluate((root/'tests/forge/states.js').read_text());out={'tests':rows,'total':len(rows),'passed':sum(x['pass'] for x in rows),'errors':errors};(root/'qa/forge-states.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in out.items() if k!='tests'},indent=2));print(json.dumps([x for x in rows if not x['pass']],ensure_ascii=False,indent=2));b.close()
 if out['passed']!=out['total'] or errors:raise SystemExit(1)
