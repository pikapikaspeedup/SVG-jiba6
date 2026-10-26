from pathlib import Path
import json,shutil,hashlib,datetime
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow8';errors=[];html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox']);p=b.new_page(viewport={'width':1440,'height':1100});p.on('pageerror',lambda e: errors.append(str(e)));p.set_content(html.decode(),wait_until='load',timeout=60000);p.wait_for_function('window.INKResponseLab?.ready');out=p.evaluate((R/'tests/flow8/browser-contracts.js').read_text());b.close()
report={'suite':'flow8-engine-browser-contracts','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':hashlib.sha256(html).hexdigest(),'passed':sum(r['pass'] for r in out['rows']),'total':len(out['rows']),'browserErrors':errors,**out};(O/'browser-contracts.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('FLOW8',report['passed'],'/',report['total'],'ERRORS',errors);[print('FAIL',r) for r in out['rows'] if not r['pass']];raise SystemExit(0 if report['passed']==report['total'] and not errors else 1)
