#!/usr/bin/env python3
"""Rebuild then run FORGE regressions. Python 3.10+, Node.js, Playwright + Chromium.
INK_CHROMIUM can select a local executable; no browser is downloaded by this runner.
"""
from pathlib import Path
import subprocess,sys,json,hashlib,datetime
ROOT=Path(__file__).resolve().parents[1]
(ROOT/'qa').mkdir(exist_ok=True)
commands=[
 [sys.executable,'tools/build_forge.py'],['node','tests/ink/core.test.js'],
 ['node','tests/forge/core.test.js'],['node','tests/forge/storage.test.js'],
 [sys.executable,'tests/forge/browser.py'],[sys.executable,'tests/forge/regress.py'],
 [sys.executable,'tests/forge/states.py'],[sys.executable,'tests/forge/mobile.py'],
 [sys.executable,'tests/forge/retained.py'],[sys.executable,'tests/forge/visual.py']]
for command in commands:
 print('\n=== '+' '.join(command)+' ===',flush=True)
 subprocess.run(command,cwd=ROOT,check=True)
def report(file,kind='standard'):
 data=json.loads((ROOT/file).read_text())
 if kind=='mechanics':return {'total':len(data),'passed':sum(x['pass'] for x in data)}
 if kind=='replays':return {'total':len(data),'passed':sum(bool(x.get('started') and x.get('finite') and x.get('validSVG')) for x in data)}
 return {'total':data['total'],'passed':data['passed']}
entries=[('core','test-results/ink-core.json','standard'),('assets_and_contracts','qa/forge-core.json','standard'),('storage_contract_doubles','qa/forge-storage.json','standard'),('browser_workflow','qa/forge-browser.json','standard'),('combat_mechanics','qa/forge-mechanics.json','mechanics'),('combat_replays','qa/forge-replays.json','replays'),('states_and_throws','qa/forge-states.json','standard'),('real_mobile_touch','qa/forge-mobile.json','standard'),('retained_rendering','qa/forge-retained.json','standard')]
summary={'build':'INK FORGE 2.0','testedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'suites':{key:{**report(file,kind),'report':file} for key,file,kind in entries},'artifacts':{},'limitations':['Headless Chromium only; set_content was used because this environment blocks URL navigation.','Native IndexedDB persistence and directory permission UI were not exercised. Storage/file-handle contracts use explicit doubles. Portable HTML/ZIP round trips were tested in a real browser.','Render benchmark is synchronous JavaScript time, not GPU paint or device FPS.','Passing tests is not a claim of official SF6 frame accuracy or perfect artwork.']}
for name in ['INK-Street-Fighter-6.html','INK-Street-Fighter-6-Player.html']:
 data=(ROOT/'dist'/name).read_bytes();summary['artifacts'][name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
assert all(s['passed']==s['total'] for s in summary['suites'].values())
(ROOT/'qa/forge-validation-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
print('\nALL SUITES PASSED\n'+json.dumps(summary,ensure_ascii=False,indent=2),flush=True)
