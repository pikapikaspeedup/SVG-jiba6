from pathlib import Path
import os,shutil
import json,time
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium') or shutil.which('google-chrome'),headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1080});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/INK-Street-Fighter-6.html').read_text(),wait_until='load',timeout=60000);page.wait_for_function('window.INKForge?.ready',timeout=15000)
 page.evaluate("INK.CombatFlow.set({rhythm:'legacy',rules:'legacy'})")
 start=time.time();mechanics=page.evaluate((root/'tests/mechanics.js').read_text().replace('f.maiFollowUntil>G.tick','f.maiFollowUntil>G.actionTick').replace('f.maiAirFollow>G.tick','f.maiAirFollow>G.actionTick'));(root/'qa/flow7/legacy-mechanics.json').write_text(json.dumps(mechanics,ensure_ascii=False,indent=2));print('MECHANICS',len(mechanics),sum(x['pass'] for x in mechanics),[x for x in mechanics if not x['pass']],flush=True)
 replay=(root/'tests/replays.js').read_text()
 # Run one character at a time, keeping each result even if an unrelated future test fails.
 allrows=[]
 for id in ['ryu','ken','chun','cammy','luke','juri','mai','iori']:
  script=replay.replace('for(const ch of A.characters){',"for(const ch of A.characters.filter(x=>x.id==='"+id+"')){")
  rows=page.evaluate(script);allrows+=rows;(root/'qa/flow7/legacy-replays.json').write_text(json.dumps(allrows,ensure_ascii=False,indent=2));bad=[x for x in rows if not(x.get('started') and x.get('finite') and x.get('validSVG'))];print(id,len(rows),'bad',bad,'elapsed',round(time.time()-start),flush=True)
 (root/'qa/flow7/legacy-regression-errors.json').write_text(json.dumps(errors,ensure_ascii=False,indent=2));b.close()

 if errors or any(not r["pass"] for r in mechanics) or any(not(r.get("started") and r.get("finite") and r.get("validSVG")) for r in allrows):raise SystemExit(1)
