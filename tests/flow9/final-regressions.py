"""Run inherited combat regression assertions against a stable current HTML.
Only inherited harness output paths/release metadata were adapted; assertions
of combat behaviour remain unchanged. Logs bind even legacy list-only reports.
"""
from pathlib import Path
import datetime,hashlib,json,subprocess,sys,shutil
R=Path(__file__).resolve().parents[2];O=R/'qa/flow9';html=R/'dist/INK-Street-Fighter-6.html';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();before=sha(html);commands=[];started=datetime.datetime.now(datetime.timezone.utc).isoformat()
for name in ['inherited-contracts.test.js','inherited-regression-core.test.js','inherited-regress.py','inherited-render-and-practice.py','inherited-effect-invariance.py','inherited-character-chain.py','inherited-browser-contracts.py','inherited-transition-matrix.py','inherited-recovery-observation.py']:
 runner=shutil.which('node') if name.endswith('.js') else sys.executable;cmd=[runner,'tests/flow9/'+name];p=subprocess.run(cmd,cwd=R,capture_output=True,text=True);log=O/'inherited'/('final-'+name+'.log');log.write_text(p.stdout+p.stderr);commands.append({'command':cmd,'exitCode':p.returncode,'log':str(log.relative_to(R)),'logSha256':sha(log)});print(name,p.returncode,flush=True)
after=sha(html);report={'suite':'flow9-final-inherited-regressions','startedAt':started,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':before,'unchangedDuringRun':before==after,'total':len(commands),'passed':sum(c['exitCode']==0 for c in commands),'commands':commands}
(O/'final-regressions.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');raise SystemExit(0 if before==after and report['total']==report['passed'] else 1)
