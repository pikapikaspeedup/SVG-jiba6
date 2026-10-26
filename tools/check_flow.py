#!/usr/bin/env python3
"""Build and verify FLOW. Python3.10+, Node, Playwright + installed Chromium.
No network access or browser download is performed. INK_CHROMIUM is optional.
Use --report-only to aggregate already-run reports (not to claim new test runs).
"""
from pathlib import Path
import subprocess, sys, json, hashlib, datetime, os
os.environ['PYTHONUTF8']='1'
ROOT=Path(__file__).resolve().parents[1]
commands=[
 [sys.executable,'tools/build_forge.py'],
 ['node','tests/ink/core.test.js'],['node','tests/flow/core.test.js'],
 ['node','tests/forge/core.test.js'],['node','tests/forge/storage.test.js'],
 [sys.executable,'tests/forge/browser.py'],[sys.executable,'tests/flow/browser.py'],
 [sys.executable,'tests/forge/regress.py'],[sys.executable,'tests/forge/states.py'],
 [sys.executable,'tests/flow/combos.py'],[sys.executable,'tests/flow/render_invariance.py'],[sys.executable,'tests/forge/mobile.py'],
 [sys.executable,'tests/flow/mobile.py'],[sys.executable,'tests/forge/retained.py'],
 [sys.executable,'tests/forge/visual.py'],[sys.executable,'tests/flow/visual.py'],[sys.executable,'tests/flow/delivery.py']]
def hashfile(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def report(file,kind='standard'):
 data=json.loads((ROOT/file).read_text(encoding='utf-8'))
 if kind=='mechanics':total=len(data);passed=sum(x['pass'] for x in data)
 elif kind=='replays':total=len(data);passed=sum(bool(x.get('started') and x.get('finite') and x.get('validSVG')) for x in data)
 elif kind=='combos':total=len(data['scenarios']);passed=sum(x['valid'] for x in data['scenarios'])
 else:total=data['total'];passed=data['passed']
 if isinstance(data,dict):assert not data.get('errors') and not data.get('browserErrors'),file+' contains errors'
 assert total==passed, f'{file}: {passed}/{total}'
 return {'total':total,'passed':passed,'report':file,'reportSha256':hashfile(ROOT/file)}
def aggregate():
 entries=[('original_core','test-results/ink-core.json','standard'),('interpolation_particles','qa/flow/core-tests.json','standard'),('asset_schema_contracts','qa/forge-core.json','standard'),('storage_contract_doubles','qa/forge-storage.json','standard'),('editor_roundtrip','qa/forge-browser.json','standard'),('flow_browser_workflow','qa/flow/browser-tests.json','standard'),('combat_mechanics','qa/forge-mechanics.json','mechanics'),('combat_replays','qa/forge-replays.json','replays'),('states_and_throws','qa/forge-states.json','standard'),('combo_both_directions','qa/flow/combo-validation.json','combos'),('render_schedule_invariance','qa/flow/render-invariance.json','standard'),('original_two_finger_touch','qa/forge-mobile.json','standard'),('flow_mobile_ui','qa/flow/mobile-tests.json','standard'),('retained_rendering','qa/forge-retained.json','standard'),('delivery_checks','qa/flow/delivery-check.json','standard')]
 records=[json.loads(p.read_text(encoding='utf-8')) for p in (ROOT/'assets/ink/characters').glob('*/moves/*.json')]
 version=json.loads((ROOT/'VERSION.json').read_text(encoding='utf-8'))['version']
 summary={'build':'INK FLOW '+version,'assembledAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceBaseline':json.loads((ROOT/'VERSION.json').read_text(encoding='utf-8'))['sourceBaseline'],'suites':{name:report(path,kind) for name,path,kind in entries},'artifacts':{},'scope':{'characters':8,'combatAndStateAssets':len(records),'authoredYawVariantsInheritedFromFlow3':52,'configuredEmitters':sum(len(r.get('fx',[])) for r in records),'maiRevisedAssets':sum(r.get('clip',{}).get('meta',{}).get('flowEdition')==4 for r in records),'comboRoutes':16,'maxVerifiedHits':15,'combatHz':60},'limitations':['Tests used real headless Chromium with set_content of full standalone bytes. file:// navigation is blocked by administrator policy in this runtime.','Native directory authorization and persistent storage were not tested end to end; storage contracts use explicit doubles. Browser HTML/ZIP round trips were real.','Touch testing used Chromium mobile emulation and actual browser touch events, not physical-device frame-rate measurements.','Synchronous JS render timings exclude paint/GPU. Not a claimed 120Hz/144Hz performance guarantee.','Fan-game 2.5D SVG choreography and combo rules, not official SF6 models/frame data. No optical flow, 3D reconstruction, networking or rollback.','No GitHub write was performed. Apply the update files locally and review before pushing.']}
 for name in ['INK-Street-Fighter-6.html','INK-Street-Fighter-6-Player.html']:
  p=ROOT/'dist'/name;summary['artifacts'][name]={'bytes':p.stat().st_size,'sha256':hashfile(p)}
 proof_path=ROOT/'qa/flow/source-rebuild.json'
 if proof_path.exists():
  proof=json.loads(proof_path.read_text(encoding='utf-8'))
  current=all(proof.get('artifacts',{}).get(name)==meta['sha256'] for name,meta in summary['artifacts'].items())
  summary['sourceDistribution']={'report':'qa/flow/source-rebuild.json','matchesCurrentHTML':current,'reportSha256':hashfile(proof_path),'result':proof if current else 'Earlier source package proof is stale; rerun source/update rebuild checks.'}
 assert hashfile(ROOT/'game.js')==summary['sourceBaseline']['gameSha256']
 summary['unchangedCombatBaseline']=True
 p=ROOT/'qa/flow/validation.json';p.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
 (ROOT/'qa/forge-validation-summary.json').write_text(json.dumps({**summary,'note':'Compatibility alias; canonical current report is qa/flow/validation.json'},ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(summary,ensure_ascii=False,indent=2),flush=True)
 return summary
if __name__=='__main__':
 (ROOT/'qa/flow').mkdir(parents=True,exist_ok=True)
 if '--report-only' not in sys.argv:
  for command in commands:
   print('\n=== '+' '.join(command)+' ===',flush=True);subprocess.run(command,cwd=ROOT,check=True)
 aggregate()
