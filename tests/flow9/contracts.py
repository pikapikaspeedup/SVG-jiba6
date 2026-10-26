from pathlib import Path
import datetime,json,shutil,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow9';errors=[];html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox']);p=b.new_page(viewport={'width':1440,'height':1000});p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode(),wait_until='load',timeout=60000);p.wait_for_function('window.INKFluidLab?.ready');out=p.evaluate((R/'tests/flow9/contracts.js').read_text());b.close()
report={'suite':'flow9-engine-contracts','utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':hashlib.sha256(html).hexdigest(),'passed':sum(x['pass'] for x in out['rows']),'total':len(out['rows']),'browserErrors':errors,**out};(O/'contracts.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('FLOW9',report['passed'],'/',report['total'],errors);[print('FAIL',x) for x in out['rows'] if not x['pass']];raise SystemExit(0 if report['passed']==report['total'] and not errors else 1)
