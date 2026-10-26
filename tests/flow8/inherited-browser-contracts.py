from pathlib import Path
import datetime,hashlib,json,os,shutil
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2]; O=R/'qa/flow8/inherited'; data=(R/'dist/INK-Street-Fighter-6.html').read_bytes();errors=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium'),headless=True,args=['--no-sandbox']);p=b.new_page(viewport={'width':1440,'height':1000});p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(data.decode(),wait_until='load',timeout=60000);p.wait_for_function('window.INKRhythmLab?.ready');rows=p.evaluate((R/'tests/flow7/browser-contracts.js').read_text());b.close()
r={'suite':'flow7-built-browser-contracts','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':hashlib.sha256(data).hexdigest(),'total':len(rows),'passed':sum(t['pass'] for t in rows),'tests':rows,'browserErrors':errors};(O/'browser-contracts.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print('BROWSER CONTRACTS',r['passed'],'/',r['total'],'errors',errors)
for t in rows:
 if not t['pass']:print('FAIL',t['name'],t['error'])
raise SystemExit(0 if r['passed']==r['total'] and not errors else 1)
