"""Current-build state, retained-SVG and persistence contract regression.
Storage/file handles are doubles, not native operating-system permission tests.
"""
from pathlib import Path
import datetime,hashlib,json,subprocess,sys
R=Path(__file__).resolve().parents[2];O=R/'qa/flow5';O.mkdir(parents=True,exist_ok=True)
commands=[['node','tests/forge/storage.test.js'],[sys.executable,'tests/forge/states.py'],[sys.executable,'tests/forge/retained.py']]
for i,c in enumerate(commands):
 p=subprocess.run(c,cwd=R,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT);(O/f'extra-{i}.log').write_text(p.stdout,encoding='utf-8');print('PASS' if p.returncode==0 else 'FAIL',' '.join(c),flush=True)
 if p.returncode:raise SystemExit(p.returncode)
result={'suite':'flow5-extra-regression','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':hashlib.sha256((R/'dist/INK-Street-Fighter-6.html').read_bytes()).hexdigest(),'results':{k:json.loads((R/f'qa/forge-{k}.json').read_text()) for k in ['storage','states','retained']}}
result['passed']=all(d['total']==d['passed'] and not d.get('errors') for d in result['results'].values());(O/'extra-regression.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');raise SystemExit(0 if result['passed'] else 1)
