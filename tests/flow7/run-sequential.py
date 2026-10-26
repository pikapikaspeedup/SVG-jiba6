"""Run the selected browser matrices one at a time to bound memory use."""
from pathlib import Path
import subprocess,time,json,datetime,hashlib,sys
R=Path(__file__).resolve().parents[2];O=R/'qa/flow7';rows=[]
for test in ['smoke.py','transition-matrix.py','recovery-observation.py','pace-comparison.py']:
 start=time.monotonic();p=subprocess.run([sys.executable,str(R/'tests/flow7'/test)],cwd=R);row={'test':test,'exitCode':p.returncode,'wallSeconds':round(time.monotonic()-start,3)};rows.append(row);print('SEQUENTIAL',row,flush=True)
(O/'matrix-runner.json').write_text(json.dumps({'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':hashlib.sha256((R/'dist/INK-Street-Fighter-6.html').read_bytes()).hexdigest(),'tests':rows},indent=2));raise SystemExit(0 if all(r['exitCode']==0 for r in rows) else 1)
