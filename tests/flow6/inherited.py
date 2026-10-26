"""Re-run the inherited combat/core tests and bind their evidence to this build."""
from pathlib import Path
import datetime,hashlib,json,subprocess,sys
R=Path(__file__).resolve().parents[2];O=R/'qa/flow6';O.mkdir(parents=True,exist_ok=True)
commands=[['node','tests/ink/core.test.js'],['node','tests/forge/core.test.js'],['node','tests/flow/core.test.js'],[sys.executable,'tests/forge/regress.py']]
checks=[]
for c in commands:
 p=subprocess.run(c,cwd=R,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
 name='-'.join(str(Path(x).with_suffix('')).replace('/', '-') for x in c[1:]);(O/(name+'.log')).write_text(p.stdout,encoding='utf-8')
 checks.append({'command':c,'exitCode':p.returncode});print('PASS' if p.returncode==0 else 'FAIL',' '.join(c),flush=True)
 if p.returncode:print(p.stdout,flush=True)
files={'ink':'test-results/ink-core.json','forge':'qa/forge-core.json','flow':'qa/flow/core-tests.json','mechanics':'qa/forge-mechanics.json','replays':'qa/forge-replays.json','browserErrors':'qa/forge-regression-errors.json'}
result={'suite':'flow6-inherited-regression','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':hashlib.sha256((R/'dist/INK-Street-Fighter-6.html').read_bytes()).hexdigest(),'commands':checks,'passed':all(c['exitCode']==0 for c in checks),'results':{}}
for k,f in files.items():
 p=R/f
 if p.exists():result['results'][k]=json.loads(p.read_text())
 else:result['results'][k]={'note':'Test command passed/failure as above; see its captured log for filename.'}
(O/'regression.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
raise SystemExit(0 if result['passed'] else 1)
