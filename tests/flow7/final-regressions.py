"""Run final-hash regressions sequentially while another independent tab soaks."""
from pathlib import Path
import subprocess,time,json,datetime,hashlib,sys
R=Path(__file__).resolve().parents[2];O=R/'qa/flow7';rows=[];html=R/'dist/INK-Street-Fighter-6.html';start_hash=hashlib.sha256(html.read_bytes()).hexdigest()
commands=[['node','tests/flow7/contracts.test.js'],['node','tests/flow7/regression-core.test.js']]+[[sys.executable,'tests/flow7/'+p] for p in ['browser-contracts.py','smoke.py','transition-matrix.py','recovery-observation.py','regress.py','portability.py','pace-comparison.py']]
for cmd in commands:
 start=time.monotonic();p=subprocess.run(cmd,cwd=R);row={'command':cmd,'exitCode':p.returncode,'wallSeconds':round(time.monotonic()-start,3)};rows.append(row);print('FINAL SUITE',row,flush=True)
end_hash=hashlib.sha256(html.read_bytes()).hexdigest();report={'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':start_hash,'unchangedDuringRun':start_hash==end_hash,'tests':rows,'passed':sum(x['exitCode']==0 for x in rows),'total':len(rows)};(O/'final-regressions.json').write_text(json.dumps(report,indent=2)+'\n');raise SystemExit(0 if report['passed']==report['total'] and report['unchangedDuringRun'] else 1)
